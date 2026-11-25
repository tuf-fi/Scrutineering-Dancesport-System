import { CERTIFICATE_TOKENS } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog, Input } from '../../components/ui/index.ts'

type Detail = (typeof CERTIFICATE_TOKENS)[number]

// What a person sees for each filled-in detail, instead of the {braces} the layout is stored with
const DETAIL_LABEL: Record<Detail, string> = {
  organizer: 'Organizer',
  competition: 'Competition',
  name: 'Couple',
  team: 'Team',
  place: 'Place',
  event: 'Event',
  grade: 'Grade',
  number: 'Back number',
  venue: 'Venue',
  date: 'Date',
}

const toShown = (text: string) => text.replace(/\{(\w+)\}/g, (all, k: string) => (k in DETAIL_LABEL ? `[${DETAIL_LABEL[k as Detail]}]` : all))
const toStored = (text: string) => CERTIFICATE_TOKENS.reduce((out, k) => out.split(`[${DETAIL_LABEL[k]}]`).join(`{${k}}`), text)

// Changes the words of one certificate line. Nothing changes on the certificate until Done.
export function WordingDialog({ open, title, text, onDone, onClose }: { open: boolean; title: string; text: string; onDone: (text: string) => void; onClose: () => void }) {
  const [shown, setShown] = useState(toShown(text))
  const add = (k: Detail) => setShown((s) => `${s}${s && !s.endsWith(' ') ? ' ' : ''}[${DETAIL_LABEL[k]}]`)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title={`Wording: ${title}`}
      description="Type your own words, or add a detail that changes for each couple. Leave it empty to hide the line."
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onDone(toStored(shown))}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Wording" value={shown} maxLength={200} onChange={(e) => setShown(e.target.value)} />
        <div role="group" aria-label="Add a detail" className="flex flex-wrap gap-2">
          {CERTIFICATE_TOKENS.map((k) => (
            <Button key={k} type="button" size="sm" variant="secondary" onClick={() => add(k)}>
              + {DETAIL_LABEL[k]}
            </Button>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
