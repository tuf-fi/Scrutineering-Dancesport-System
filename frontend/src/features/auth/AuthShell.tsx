import type { ReactNode } from 'react'
import { Brand } from '../../components/Brand.tsx'
import { CompetitionPanel } from './CompetitionPanel.tsx'

// Sign-in layout: the form on the left, the current competition on a dark panel from laptop width
export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-12 px-6 py-8 sm:px-12 lg:px-20">
        <Brand size="lg" className="self-start" />
        <div className="w-full max-w-sm">
          <h1 className="text-display font-semibold text-neutral-900">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
        <div className="flex flex-col gap-3 text-small">{footer}</div>
      </div>
      <CompetitionPanel />
    </div>
  )
}
