import { useState } from 'react'
import { useNavigate } from 'react-router'
import { type AccountKind } from '../features/athlete/AccountForm.tsx'
import { cn } from '../lib/cn.ts'
import { Button, Dialog } from './ui/index.ts'

const TABS: Array<{ kind: AccountKind; label: string }> = [
  { kind: 'athlete', label: 'Athlete' },
  { kind: 'coach', label: 'Coach' },
  { kind: 'team', label: 'Team' },
]

// Who is signing in; shared by the navbar's dialog and the sign-in page
function KindTabs({ kind, onKind }: { kind: AccountKind; onKind: (kind: AccountKind) => void }) {
  return (
    <div role="tablist" aria-label="Sign in as" className="grid grid-cols-3 border-b border-neutral-200">
      {TABS.map((tab) => (
        <button
          key={tab.kind}
          type="button"
          role="tab"
          aria-selected={kind === tab.kind}
          onClick={() => onKind(tab.kind)}
          className={cn(
            '-mb-px h-11 border-b-2 text-small font-semibold transition-colors',
            kind === tab.kind ? 'border-gold-400 text-neutral-900' : 'border-transparent text-neutral-500 hover:bg-gold-50 hover:text-neutral-900',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

const ABOUT: Record<AccountKind, string> = {
  athlete: 'Register, pay your membership and follow your results.',
  coach: 'Your coach page.',
  team: 'Your team page.',
}

// Only asks who is signing in, then opens the sign-in page for them
export function SignInChooser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<AccountKind>('athlete')
  const navigate = useNavigate()

  function proceed() {
    onClose()
    navigate(`/login?as=${kind}`)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sign in as"
      className="max-w-md"
      actions={
        <Button onClick={proceed} className="w-full sm:w-auto">
          Continue
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <KindTabs kind={kind} onKind={setKind} />
        <p className="text-small text-neutral-600">{ABOUT[kind]}</p>
      </div>
    </Dialog>
  )
}
