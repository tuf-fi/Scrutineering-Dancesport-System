import { KeyRound, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { SectionSidebar, useSection } from '../../app/layouts/SectionSidebar.tsx'
import { Avatars } from '../../components/Avatars.tsx'
import { Button, Input, PageHeader, toast } from '../../components/ui/index.ts'
import { useChangeMyStaffPassword, useSaveMyStaffName, useTotpStatus } from '../../hooks/index.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { SectionHead } from '../admin/SectionHead.tsx'
import { PasswordForm } from './PasswordForm.tsx'

const SECTIONS = [
  { id: 'details', label: 'Details', icon: UserRound },
  { id: 'password', label: 'Password', icon: KeyRound },
] as const

// Who the signed-in staff member is, and the two things they may change about themselves: their name and their password
export function StaffAccountPage() {
  const user = useAuth((s) => s.user)
  const saveName = useSaveMyStaffName()
  const changePassword = useChangeMyStaffPassword()
  const totp = useTotpStatus()
  const [name, setName] = useState(user?.name ?? '')
  const [error, setError] = useState<string | undefined>()
  const current = useSection(SECTIONS)
  if (!user) return null

  const dirty = name.trim() !== user.name

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter your name.')
    setError(undefined)
    saveName.mutate(name, {
      onSuccess: (saved) => {
        useAuth.setState({ user: { ...user!, name: saved.name } })
        toast.success('Name saved')
      },
      onError: (e) => setError(e.message),
    })
  }

  return (
    <div className="flex flex-col gap-8 lg:ml-[13rem]">
      <SectionSidebar title="Account" label="Account sections" sections={SECTIONS} current={current} />
      <PageHeader title="My account" description="Your details and your password." />

      <section hidden={current !== 'details'} className="flex flex-col gap-6">
        <SectionHead title="Details" note="Your email and role are set by an admin." />
        <div className="flex items-center gap-4">
          <Avatars names={[user.name]} size="xl" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-neutral-900">{user.name}</span>
            <span className="text-small text-neutral-600">{ROLE_LABEL[user.role]}</span>
          </div>
        </div>
        <dl className="border-y border-neutral-200">
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 py-3 text-small">
            <dt className="text-neutral-500">Role</dt>
            <dd className="font-medium text-neutral-900">{ROLE_LABEL[user.role]}</dd>
          </div>
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-neutral-100 py-3 text-small">
            <dt className="text-neutral-500">Two-step sign-in</dt>
            <dd className="font-medium text-neutral-900">{totp.data ? (totp.data.enabled ? 'On' : 'Off') : '–'}</dd>
          </div>
        </dl>
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} autoComplete="name" />
          <div>
            <Button type="submit" disabled={!dirty || saveName.isPending}>
              {saveName.isPending ? 'Saving…' : 'Save name'}
            </Button>
          </div>
        </form>
      </section>

      <section hidden={current !== 'password'} className="flex flex-col gap-6">
        <SectionHead title="Password" note="Enter your current password, then choose a new one." />
        <PasswordForm change={changePassword} />
      </section>
    </div>
  )
}
