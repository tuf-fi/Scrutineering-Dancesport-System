import type { Coach } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, IconButton, Input, toast } from '../../components/ui/index.ts'
import { X } from 'lucide-react'
import { formatDate } from '../../lib/format.ts'
import { useSaveCoach } from '../../hooks/index.ts'

const FORM_ID = 'coach-form'

function CoachForm({ coach, onDone }: { coach: Coach | null; onDone: () => void }) {
  const save = useSaveCoach()
  const [name, setName] = useState(coach?.name ?? '')
  const [email, setEmail] = useState(coach?.email ?? '')
  const [phone, setPhone] = useState(coach?.phone ?? '')
  const [memberYear, setMemberYear] = useState(coach?.memberYear ? String(coach.memberYear) : '')
  const [summitYear, setSummitYear] = useState(coach?.summitYear ? String(coach.summitYear) : '')
  const [summits, setSummits] = useState<string[]>(coach?.summits ?? [])
  const [newSummit, setNewSummit] = useState('')
  const [errors, setErrors] = useState<{ name?: string; member?: string; summit?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  const badYear = (v: string) => v.trim() !== '' && !/^\d{4}$/.test(v.trim())
  const addSummit = () => {
    if (!newSummit || summits.includes(newSummit)) return setNewSummit('')
    setSummits((list) => [...list, newSummit].sort().reverse())
    setNewSummit('')
  }

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
          summits,
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
        <Input
          label="Membership ID"
          hint="Given when the first membership fee is paid."
          value={coach?.membershipId ?? ''}
          placeholder="Not given yet"
          disabled
          readOnly
          className="font-mono tabular-nums"
        />
        <fieldset className="flex flex-col gap-3 sm:col-span-2">
          <legend className="mb-1.5 text-small font-medium text-neutral-600">Summits attended</legend>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input label="Date of the summit" type="date" value={newSummit} onChange={(e) => setNewSummit(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={addSummit} disabled={!newSummit}>
              Add date
            </Button>
          </div>
          {summits.length === 0 ? (
            <p className="text-small text-neutral-500">No summit recorded yet.</p>
          ) : (
            <ul aria-label="Summits attended" className="border-y border-neutral-200">
              {summits.map((d) => (
                <li key={d} className="flex items-center justify-between gap-3 border-t border-neutral-100 py-1.5 first:border-t-0">
                  <span className="font-mono text-small tabular-nums text-neutral-800">{formatDate(d)}</span>
                  <IconButton icon={X} tone="danger" label={`Remove ${formatDate(d)}`} onClick={() => setSummits((list) => list.filter((x) => x !== d))} />
                </li>
              ))}
            </ul>
          )}
        </fieldset>
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
