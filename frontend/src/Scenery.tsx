import { Cloud, Island } from './Sprite'

// A fixed pixel landscape behind every page: teal sky, hills, water, clouds and floating islands.
export function Scenery() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#3b625c_0%,#4f8680_28%,#78b6b0_58%,#8fc7bf_72%)]" />
      {/* distant hills */}
      <div className="absolute bottom-[26%] -left-[10vw] h-[22vh] w-[55vw] rounded-[50%] bg-[#4d7b55]" />
      <div className="absolute bottom-[24%] left-[30vw] h-[28vh] w-[60vw] rounded-[50%] bg-[#3f6e4d]" />
      <div className="absolute bottom-[25%] -right-[12vw] h-[18vh] w-[45vw] rounded-[50%] bg-[#58875a]" />
      {/* water */}
      <div className="absolute inset-x-0 bottom-0 h-[27%] bg-[#3f7d78] [background-image:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.08)_0_4px,transparent_4px_20px)]" />
      <div className="absolute inset-x-0 bottom-[27%] h-1 bg-[#2f5a56]" />
      {/* clouds */}
      <Cloud className="px-cloud absolute top-[18%] left-0 opacity-70" scale={9} light="#d6ebe6" shade="#a9cfca" />
      <Cloud className="px-cloud absolute top-[42%] left-0 opacity-60 [animation-delay:-30s]" scale={6} light="#d6ebe6" shade="#a9cfca" />
      {/* floating islands */}
      <Island className="px-float absolute -top-6 -left-20 sm:-left-12" scale={8} />
      <Island className="px-float absolute -right-24 -bottom-16 [animation-delay:-3s] sm:-right-12" scale={7} />
    </div>
  )
}
