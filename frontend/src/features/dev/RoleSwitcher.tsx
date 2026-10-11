import { Role, type SessionUser } from '@bis/shared'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../../api/index.ts'
import { roleHome } from '../../app/nav.ts'
import { Button, Dialog } from '../../components/ui/index.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'

const ROLES = Object.values(Role)

async function sessionFor(role: Role): Promise<SessionUser | null> {
  if (role === Role.Public) return null
  if (role === Role.Adjudicator) {
    const a = (await api.getAdjudicators())[0]
    return { id: a.id, name: a.name, role, letter: a.letter }
  }
  if (role === Role.Club) {
    const c = (await api.getClubs())[0]
    return { id: c.id, name: c.name, role }
  }
  const staff = (await api.getStaffUsers()).find((s) => s.role === role)
  return staff ? { id: staff.id, name: staff.name, role } : null
}

// Development only: Ctrl+Shift+D opens a menu that signs in as any role
export function RoleSwitcher() {
  const [open, setOpen] = useState(false)
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const signOut = useAuth((s) => s.signOut)
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function choose(role: Role) {
    const session = await sessionFor(role)
    if (session) signIn(session)
    else signOut()
    setOpen(false)
    navigate(roleHome[role])
  }

  const current = user?.role ?? Role.Public

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Switch role"
      description="Development only. Signs in as a sample user with that role."
      actions={
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      }
    >
      <ul className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => (
          <li key={role}>
            <Button
              variant="secondary"
              className="w-full justify-between"
              aria-current={role === current ? 'true' : undefined}
              onClick={() => choose(role)}
            >
              {ROLE_LABEL[role]}
              {role === current && <span className="size-1.5 rounded-full bg-gold-500" aria-label="current" />}
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
