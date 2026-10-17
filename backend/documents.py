"""Read the customer's uploaded files into plain text.

Supported: text-like files (.txt .md .eml .csv .json .log), HTML, PDF with a
text layer, Word (.docx) and images (read by a vision model). Anything else,
or a file that cannot be read, is reported back so the customer knows.
"""

import asyncio
import base64
import binascii
import io
import re
import zipfile
from dataclasses import dataclass
from html.parser import HTMLParser

from models import DocumentIn

MAX_FILES = 6
MAX_BYTES = 5 * 1024 * 1024
MAX_CHARS_EACH = 12_000
MAX_CHARS_TOTAL = 36_000
VISION_TIMEOUT_S = 40

TEXT_EXT = {".txt", ".md", ".eml", ".csv", ".json", ".log", ".text"}
IMAGE_EXT = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}


@dataclass
class ReadDoc:
    name: str
    text: str
    how: str  # "text", "pdf", "docx", "html", "image"


class _TextOnly(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        if tag in ("p", "br", "li", "h1", "h2", "h3", "h4", "tr", "div", "section"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    p = _TextOnly()
    p.feed(html)
    text = "".join(p.parts)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", text)).strip()


def _decode(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:20]).strip()


def _docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml).strip()


async def _image_text(data: bytes, mime: str) -> str:
    from llm import read_image

    prompt = (
        "Transcribe all the text in this image exactly, then list any other facts it shows "
        "(names, dates, times, amounts, reference numbers). Do not guess missing details."
    )
    return await asyncio.wait_for(asyncio.to_thread(read_image, data, mime, prompt), VISION_TIMEOUT_S)


def _ext(name: str) -> str:
    return ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""


async def read_documents(docs: list[DocumentIn]) -> tuple[list[ReadDoc], list[str]]:
    """Return (documents read, one reason per file that could not be read)."""
    read: list[ReadDoc] = []
    unread: list[str] = []
    total = 0
    for d in docs[:MAX_FILES]:
        try:
            data = base64.b64decode(d.data_base64, validate=False)
        except (binascii.Error, ValueError):
            unread.append(f"{d.name}: the file data was damaged")
            continue
        if not data:
            unread.append(f"{d.name}: the file is empty")
            continue
        if len(data) > MAX_BYTES:
            unread.append(f"{d.name}: bigger than {MAX_BYTES // (1024 * 1024)} MB")
            continue
        ext, mime, how, text = _ext(d.name), (d.mime or "").lower(), "", ""
        try:
            if ext == ".pdf" or mime == "application/pdf":
                how, text = "pdf", _pdf_text(data)
                if not text:
                    unread.append(f"{d.name}: a scanned PDF with no text layer (upload it as an image instead)")
                    continue
            elif ext == ".docx":
                how, text = "docx", _docx_text(data)
            elif ext in (".html", ".htm") or mime == "text/html":
                how, text = "html", html_to_text(_decode(data))
            elif ext in TEXT_EXT or mime.startswith("text/"):
                how, text = "text", _decode(data)
            elif ext in IMAGE_EXT or mime.startswith("image/"):
                how, text = "image", await _image_text(data, IMAGE_EXT.get(ext, mime or "image/png"))
            else:
                unread.append(f"{d.name}: this file type is not supported")
                continue
        except asyncio.TimeoutError:
            unread.append(f"{d.name}: reading it took too long")
            continue
        except Exception as e:
            unread.append(f"{d.name}: could not be read ({type(e).__name__})")
            continue
        text = text.strip()[:MAX_CHARS_EACH]
        if not text:
            unread.append(f"{d.name}: no readable text found")
            continue
        if total + len(text) > MAX_CHARS_TOTAL:
            unread.append(f"{d.name}: skipped, too much text in total")
            continue
        total += len(text)
        read.append(ReadDoc(d.name, text, how))
    if len(docs) > MAX_FILES:
        unread.append(f"Only the first {MAX_FILES} files were read")
    return read, unread
