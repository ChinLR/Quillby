import { Cloud, Island } from './Sprite'

// A fixed pixel landscape behind every page: teal sky, hills, water, clouds and floating islands.
export function Scenery() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#6fb0a8_0%,#8ccdc4_28%,#aee0d6_58%,#c5ede3_72%)]" />
      {/* distant hills */}
      <div className="absolute bottom-[26%] -left-[10vw] h-[22vh] w-[55vw] rounded-[50%] bg-[#68a46a]" />
      <div className="absolute bottom-[24%] left-[30vw] h-[28vh] w-[60vw] rounded-[50%] bg-[#58975f]" />
      <div className="absolute bottom-[25%] -right-[12vw] h-[18vh] w-[45vw] rounded-[50%] bg-[#7cb572]" />
      {/* water */}
      <div className="absolute inset-x-0 bottom-0 h-[27%] bg-[#62b0a6] [background-image:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.14)_0_4px,transparent_4px_20px)]" />
      <div className="absolute inset-x-0 bottom-[27%] h-1 bg-[#3f857d]" />
      {/* clouds */}
      <Cloud className="px-cloud absolute top-[18%] left-0 opacity-90" scale={9} light="#f4fbf8" shade="#cfe9e2" />
      <Cloud className="px-cloud absolute top-[42%] left-0 opacity-80 [animation-delay:-30s]" scale={6} light="#f4fbf8" shade="#cfe9e2" />
      {/* floating islands */}
      <Island className="px-float absolute -top-6 -left-20 sm:-left-12" scale={8} />
      <Island className="px-float absolute -right-24 -bottom-16 [animation-delay:-3s] sm:-right-12" scale={7} />
    </div>
  )
}
