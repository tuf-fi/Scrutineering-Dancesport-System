import { Check, Circle } from 'lucide-react'
import { cn } from '../../lib/cn.ts'
import { PASSWORD_RULES } from '../../lib/passwordRules.ts'

// Checklist under the password field; each rule ticks when met
export function PasswordRules({ password, matches }: { password: string; matches: boolean }) {
  const rules = [...PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, met: r.test(password) })), { id: 'match', label: 'Both passwords match', met: matches }]

  return (
    <ul aria-label="Password rules" className="-mt-2 flex flex-col gap-1.5">
      {rules.map((r) => (
        <li key={r.id} className={cn('flex items-center gap-2 text-small transition-colors', r.met ? 'text-neutral-900' : 'text-neutral-500')}>
          {r.met ? (
            <Check aria-hidden className="size-4 shrink-0 text-success" strokeWidth={2.25} />
          ) : (
            <Circle aria-hidden className="size-4 shrink-0 text-neutral-300" strokeWidth={1.75} />
          )}
          {r.label}
          <span className="sr-only">{r.met ? ' (done)' : ' (not done)'}</span>
        </li>
      ))}
    </ul>
  )
}
