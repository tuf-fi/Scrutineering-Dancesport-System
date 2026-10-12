import type { ReactNode } from 'react'

// A labelled value under a hairline, for a row of key facts
export function Fact({ label, children, flag, bare = false }: { label: string; children: ReactNode; flag?: string; bare?: boolean }) {
  return (
    <div className={bare ? 'flex flex-col gap-1' : 'flex flex-col gap-1 border-t border-neutral-200 pt-3'}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-mono text-small tabular-nums text-neutral-900">{children}</dd>
      {flag && <p className="font-sans text-small text-danger">{flag}</p>}
    </div>
  )
}
