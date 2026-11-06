import { Class, DISCIPLINE_DANCES, Discipline, type Event } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, Textarea, toast } from '../../components/ui/index.ts'
import { useSaveEvent, useCatalog } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { DANCE_LABEL, DISCIPLINE_LABEL, eventCode } from '../../lib/format.ts'

const FORM_ID = 'event-form'

function EventForm({
  competitionId,
  event,
  nextNumber,
  onDone,
}: {
  competitionId: string
  event: Event | null
  nextNumber: number
  onDone: () => void
}) {
  const save = useSaveEvent()
  const { kinds, ageGroups } = useCatalog()
  const [number, setNumber] = useState(String(event?.number ?? nextNumber))
  const [ageGroup, setAgeGroup] = useState(event?.ageGroup ?? ageGroups[0]?.id ?? '')
  const [cls, setCls] = useState(event?.class ?? Class.E1)
  const [discipline, setDiscipline] = useState(event?.discipline ?? Discipline.Latin)
  const [dances, setDances] = useState(event?.dances ?? [])
  const [type, setType] = useState(event?.isSolo === false ? 'couple' : 'solo')
  const [kind, setKind] = useState(event?.kind ?? kinds.find((k) => k.id === 'standard')?.id ?? kinds[0]?.id ?? '')
  const [province, setProvince] = useState(event?.province ?? '')
  const [syllabus, setSyllabus] = useState(event?.syllabus ?? '')
  const [error, setError] = useState<string | null>(null)
  const closed = kinds.find((k) => k.id === kind)?.closedToProvince === true

  function pickDiscipline(next: Discipline) {
    setDiscipline(next)
    // Dances belong to one discipline, so a switch clears the old picks
    setDances([])
  }

  const toggle = (dance: (typeof dances)[number]) =>
    setDances((d) => (d.includes(dance) ? d.filter((x) => x !== dance) : [...d, dance]))

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = number.trim()
    if (!/^\d+$/.test(n)) return setError('The event number is a whole number.')
    if (dances.length === 0) return setError('Choose at least one dance.')
    if (closed && !province.trim()) return setError('Enter the province this event is closed to.')
    setError(null)
    save.mutate(
      {
        competitionId,
        id: event?.id,
        input: { number: Number(n), ageGroup, class: cls, discipline, dances, isSolo: type === 'solo', kind, syllabus: syllabus.trim(), ...(closed ? { province: province.trim() } : {}) },
      },
      {
        onSuccess: (saved) => {
          toast.success(`${event ? 'Saved' : 'Added'} ${eventCode(saved)}`)
          onDone()
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Event number" required
          inputMode="numeric"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="font-mono tabular-nums"
        />
        <Select label="Type" required value={type} onChange={(e) => setType(e.target.value)}>
          <option value="solo">Solo</option>
          <option value="couple">Couple</option>
        </Select>
        <Select label="Kind" required hint="Sets the fee and who may enter." value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Select>
        {closed && (
          <div className="sm:col-span-2">
            <Input label="Open to province" required hint="Only teams from this province can be entered." value={province} onChange={(e) => setProvince(e.target.value)} />
          </div>
        )}
        <Select label="Age group" required value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
          {ageGroups.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select label="Class" required value={cls} onChange={(e) => setCls(e.target.value as Class)}>
          {Object.values(Class).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Select label="Discipline" required value={discipline} onChange={(e) => pickDiscipline(e.target.value as Discipline)}>
            {Object.values(Discipline).map((d) => (
              <option key={d} value={d}>
                {DISCIPLINE_LABEL[d]}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-small font-medium text-neutral-600">Dances</legend>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINE_DANCES[discipline].map((dance) => (
              <button
                key={dance}
                type="button"
                aria-pressed={dances.includes(dance)}
                onClick={() => toggle(dance)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-small transition-colors',
                  dances.includes(dance)
                    ? 'border-neutral-900 bg-neutral-50 font-medium text-neutral-900'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
                )}
              >
                {DANCE_LABEL[dance]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <Textarea
            label="Syllabus"
            rows={4}
            hint="Shown to the adjudicators under their numbers. Leave empty to use the standard text for Juvenile up to Junior I."
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
          />
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </>
  )
}

// Adds an event to the competition, or edits the one given
export function EventDialog({
  open,
  competitionId,
  event,
  nextNumber,
  onClose,
}: {
  open: boolean
  competitionId: string
  event: Event | null
  nextNumber: number
  onClose: () => void
}) {
  const editing = event !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title={editing ? `Edit ${eventCode(event)}` : 'Add event'}
      description={editing ? 'Correct the event details.' : 'The event is added to the end of the schedule.'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add event'}
          </Button>
        </>
      }
    >
      {open && (
        <EventForm
          key={event?.id ?? 'new'}
          competitionId={competitionId}
          event={event}
          nextNumber={nextNumber}
          onDone={onClose}
        />
      )}
    </Dialog>
  )
}
