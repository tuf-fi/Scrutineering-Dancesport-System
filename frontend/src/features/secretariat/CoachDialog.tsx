import type { Coach } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveCoach } from '../../hooks/index.ts'

const FORM_ID = 'coach-form'

function CoachForm({ coach, onDone }: { coach: Coach | null; onDone: () => void }) {
  const save = useSaveCoach()
  const [name, setName] = useState(coach?.name ?? '')
  const [email, setEmail] = useState(coach?.email ?? '')
  const [phone, setPhone] = useState(coach?.phone ?? '')
  const [memberYear, setMemberYear] = useState(coach?.memberYear ? String(coach.memberYear) : '')
  const [summitYear, setSummitYear] = useState(coach?.summitYear ? String(coach.summitYear) : '')
  const [errors, setErrors] = useState<{ name?: string; member?: string; summit?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  const badYear = (v: string) => v.trim() !== '' && !/^\d{4}$/.test(v.trim())

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = {
      name: name.trim() ? undefined : 'Enter the coach’s name.',
      member: badYear(memberYear) ? 'Four digits, such as 2026.' : undefined,
      summit: badYear(summitYear) ? 'Four digits, such as 2026.' : undefined,
    }
    setErrors(found)
    if (found.name || found.member || found.summit) return
    setFailure(null)
    save.mutate(
      {
        id: coach?.id,
        input: {
          name,
          email,
          phone,
          memberYear: memberYear.trim() ? Number(memberYear) : null,
          summitYear: summitYear.trim() ? Number(summitYear) : null,
        },
      },
      {
        onSuccess: (c) => {
          toast.success(`${coach ? 'Saved' : 'Added'} ${c.name}`)
          onDone()
        },
        onError: (err) => setFailure(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        </div>
        <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Membership paid for"
          hint="The year it was paid in. It ends December 31 of that year, whenever it was paid. Leave empty if not paid."
          inputMode="numeric"
          value={memberYear}
          onChange={(e) => setMemberYear(e.target.value)}
          error={errors.member}
          className="font-mono tabular-nums"
        />
        <Input
          label="Coaches Summit paid for"
          hint="The year. Leave empty if not paid."
          inputMode="numeric"
          value={summitYear}
          onChange={(e) => setSummitYear(e.target.value)}
          error={errors.summit}
          className="font-mono tabular-nums"
        />
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds a coach, or edits the one given
export function CoachDialog({ open, coach, onClose }: { open: boolean; coach: Coach | null; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={coach ? 'Edit coach' : 'Add coach'}
      description="Coaches pay their own membership and the Coaches Summit."
      className="max-w-lg"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {coach ? 'Save changes' : 'Add coach'}
          </Button>
        </>
      }
    >
      {open && <CoachForm key={coach?.id ?? 'new'} coach={coach} onDone={onClose} />}
    </Dialog>
  )
}
