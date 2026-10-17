// Wording shown to customers. Kept here so backend placeholder text never reaches the screen.
export const LEGAL_DISCLAIMER = 'This is a summary, not legal advice. Check the official text before relying on it.'
export const SUPPORTED_NOTE = 'Quillby takes on flight-delay claims at the moment. Tell us about a delayed flight to continue.'

// Backend error messages can mention how the build works; show customers something neutral instead.
export const friendlyError = (detail: string) => (/demo|hard-?cod|script|mock|stub|fake/i.test(detail) ? SUPPORTED_NOTE : detail)
