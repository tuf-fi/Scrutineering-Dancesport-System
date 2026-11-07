import { useState } from 'react'
import { HERO_IMAGE } from '../../../lib/hero.ts'

// What the system is and what it does; the competition itself sits in the panel below
export function Hero() {
  const [photoFailed, setPhotoFailed] = useState(false)

  return (
    // Runs edge to edge and sits flush under the navbar; the content lines up with the page below
    <header className="relative isolate -mt-10 flex min-h-[26rem] w-screen h-[calc(78svh-var(--nav-h,3.5rem))] lg:h-[calc(90svh-var(--nav-h,3.5rem))] ml-[calc(50%-50vw)] overflow-hidden bg-black text-white sm:-mt-14 sm:min-h-[24rem]">
      {!photoFailed && (
        <img
          src={HERO_IMAGE}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="absolute right-0 top-8 -z-10 h-[62%] w-full object-cover object-[center_0%] sm:object-[center_50%] sm:top-0 opacity-80 [mask-image:linear-gradient(to_bottom,black_35%,transparent)] sm:inset-y-0 sm:h-full sm:w-1/2 sm:[mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />
      )}
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-end px-4 py-10 sm:justify-center sm:px-8 sm:py-16">
        <h1 className="max-w-xl text-balance text-[clamp(1.75rem,1rem+2.4vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.02em] motion-safe:animate-rise-in">
          Bicol Oragon Scruteneering System
        </h1>
        <ul style={{ animationDelay: '60ms' }} className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs font-medium uppercase tracking-[0.14em] text-gold-300 motion-safe:animate-rise-in">
          {['Integrity', 'Precision', 'Excellence'].map((word, i) => (
            <li key={word} className="flex items-center gap-4">
              {i > 0 && <span aria-hidden className="h-3 w-px bg-white/30" />}
              {word}
            </li>
          ))}
        </ul>
        <p style={{ animationDelay: '120ms' }} className="mt-6 max-w-[31rem] text-pretty text-title font-normal leading-[1.7] text-white/70 motion-safe:animate-rise-in">
          Scoring and results for dancesport competitions across Bicol. Adjudicators mark on their phones, the Skating System sets the placings,
          and approved results are published here.
        </p>
      </div>
    </header>
  )
}
