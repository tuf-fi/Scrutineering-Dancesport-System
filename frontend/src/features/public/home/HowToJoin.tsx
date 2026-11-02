import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { SectionHead } from './SectionHead.tsx'

const STEPS = [
  { title: 'Create an account', text: 'Sign up with your email. It takes a minute.' },
  { title: 'Pay your membership', text: 'Pay once a year, then enter the reference number. The secretariat confirms it.' },
  { title: 'Pick your club and coach', text: 'Add them on your page so the secretariat can enter you in your events.' },
]

// Three ruled steps on the left, one gold way in on the right
export function HowToJoin() {
  return (
    <section aria-label="How to join" className="flex flex-col gap-2">
      <SectionHead title="How to join" />
      <div className="grid gap-10 pt-2 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[3rem_1fr] items-baseline gap-4 border-b border-neutral-200 py-6 sm:grid-cols-[5rem_1fr_1.2fr] sm:gap-8 sm:py-7">
              <span className="font-mono text-xs font-medium tabular-nums text-gold-700">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="text-balance text-[1.25rem] font-semibold leading-[1.15] tracking-[-0.02em] text-neutral-900">{s.title}</h3>
              <p className="col-start-2 text-small leading-[1.55] text-neutral-500 sm:col-start-auto">{s.text}</p>
            </li>
          ))}
        </ol>
        <Link to="/athlete" className="group flex min-h-48 flex-col justify-between gap-10 rounded-lg bg-gold-400 p-6 text-black transition-colors hover:bg-gold-300">
          <ArrowUpRight aria-hidden className="size-7 self-end transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} />
          <span className="flex flex-col gap-2">
            <span className="text-[1.5rem] font-semibold leading-[1.1] tracking-[-0.025em]">Join now</span>
            <span className="text-small leading-[1.5]">Athletes register once. The secretariat enters you in events.</span>
          </span>
        </Link>
      </div>
    </section>
  )
}
