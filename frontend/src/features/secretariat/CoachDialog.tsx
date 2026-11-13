import { MONTH_NAMES, SUMMIT_QUARTERS, type Coach } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, IconButton, Input, Select, toast } from '../../components/ui/index.ts'
import { X } from 'lucide-react'
import { formatDate } from '../../lib/format.ts'
import { useSaveCoach } from '../../hooks/index.ts'

const FORM_ID = 'coach-form'

function CoachForm({ coach, onDone }: { coach: Coach | null; onDone: () => void }) {
  const save = useSaveCoach()
  const [name, setName] = useState(coach?.name ?? '')
  const [phone, setPhone] = useState(coach?.phone ?? '')
  const [memberYear, setMemberYear] = useState(coach?.memberYear ? String(coach.memberYear) : '')
  const [memberMonth, setMemberMonth] = useState(coach?.memberMonth ? String(coach.memberMonth) : '')
  const savedPeriod = coach?.summitPeriod ?? ''
  const [period, setPeriod] = useState(!savedPeriod ? '' : SUMMIT_QUARTERS.includes(savedPeriod) ? savedPeriod : 'other')
  const [periodName, setPeriodName] = useState(savedPeriod && !SUMMIT_QUARTERS.includes(savedPeriod) ? savedPeriod : '')
  const [summitYear, setSummitYear] = useState(coach?.summitYear ? String(coach.summitYear) : '')
  const [summits, setSummits] = useState<string[]>(coach?.summits ?? [])
  const [newSummit, setNewSummit] = useState('')
  const [errors, setErrors] = useState<{ name?: string; member?: string; summit?: string; period?: string }>({})
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
      period: period === 'other' && !periodName.trim() ? 'Enter the competition name.' : undefined,
    }
    setErrors(found)
    if (found.name || found.member || found.summit || found.period) return
    setFailure(null)
    save.mutate(
      {
        id: coach?.id,
        input: {
          name,
          email: coach?.email ?? '',
          phone,
          memberYear: memberYear.trim() ? Number(memberYear) : null,
          memberMonth: memberYear.trim() && memberMonth ? Number(memberMonth) : null,
          summitYear: summitYear.trim() ? Number(summitYear) : null,
          summitPeriod: summitYear.trim() && period ? (period === 'other' ? periodName.trim() : period) : null,
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
        <div className="sm:col-span-2">
          <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Select label="Membership paid for" value={memberMonth} onChange={(e) => setMemberMonth(e.target.value)}>
          <option value="">Not paid</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Input
          label="Membership year"
          hint="It ends December 31 of this year, whenever it was paid."
          inputMode="numeric"
          value={memberYear}
          onChange={(e) => setMemberYear(e.target.value)}
          error={errors.member}
          className="font-mono tabular-nums"
        />
        <Select label="Coaches Summit paid for" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Not paid</option>
          {SUMMIT_QUARTERS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
          <option value="other">Competition</option>
        </Select>
        <Input
          label="Summit year"
          inputMode="numeric"
          value={summitYear}
          onChange={(e) => setSummitYear(e.target.value)}
          error={errors.summit}
          className="font-mono tabular-nums"
        />
        {period === 'other' && (
          <div className="sm:col-span-2">
            <Input label="Competition name" required value={periodName} onChange={(e) => setPeriodName(e.target.value)} error={errors.period} />
          </div>
        )}
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
