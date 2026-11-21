import {
  CERTIFICATE_FONTS,
  CERTIFICATE_PAPER,
  CERTIFICATE_LINE_KEYS,
  CERTIFICATE_SIZE_RANGE,
  certificatePage,
  fillCertificateText,
  type CertificateFont,
  type CertificateLayout,
  type CertificateLine,
  type CertificateLineKey,
  type CertificateOrientation,
  type CertificatePaper,
} from '@bis/shared'
import { Bold, CaseUpper, Italic, RectangleHorizontal, RectangleVertical, RotateCcw, Upload, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Dialog, ErrorState, Input, PageHeader, Select, Skeleton, toast } from '../../components/ui/index.ts'
import { useCertificateLayout, useSaveCertificateLayout } from '../../hooks/index.ts'
import { certificateDesign } from '../../lib/certificateDesign.ts'
import { CertificateSheet } from '../print/CertificateSheet.tsx'
import { WordingDialog } from './WordingDialog.tsx'

const LINE_LABEL: Record<CertificateLineKey, string> = {
  organizer: 'Organizer',
  title: 'Title',
  competition: 'Competition',
  certify: 'Opening words',
  name: 'Name',
  team: 'Team',
  placed: 'Placed words',
  place: 'Place',
  event: 'Event',
  grade: 'Grade',
  number: 'Back number',
  venue: 'Venue and date',
}

// Placeholders, only to show the layout; a printed certificate uses each finalist's real details
const SAMPLE = {
  organizer: 'Bicol Dancesport Association',
  competition: 'Bicol Open Dancesport Championship',
  name: 'Juan Dela Cruz & Maria Santos',
  team: 'Naga Dance Team',
  place: '1st',
  event: 'E12 Waltz, Tango, Quickstep',
  grade: 'Open Adult',
  number: '14',
  venue: 'Naga City',
  date: '20 November 2026',
}
const NO_SIGNERS = { scrutineer: { name: 'Scrutineer', signature: null }, chairperson: { name: 'Chairperson', signature: null } }

// The sheet is drawn in millimetres; this is its width in CSS pixels, so the preview can shrink to fit its column
const MM_PX = 96 / 25.4

// One row of joined buttons where exactly one (or each, for styles) is on
function Segmented({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={`inline-flex divide-x divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 ${className}`}>
      {children}
    </div>
  )
}

function Segment({ on, label, icon: Icon, text, onClick }: { on: boolean; label: string; icon: LucideIcon; text?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 px-3 text-small font-medium transition-colors focus-visible:relative focus-visible:z-10 ${on ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700 hover:bg-gold-50'}`}
    >
      <Icon aria-hidden className="size-4" />
      {text}
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 p-5">
      <h2 className="text-small font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  )
}

// Shrinks the sheet to the width of the column it sits in
function Preview({ sheetMm, children }: { sheetMm: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // A taller preview can bring up the page scrollbar, which narrows the column and shrinks the preview again.
    // Ignoring changes smaller than a scrollbar stops that back and forth.
    const measure = () => setWidth((prev) => (Math.abs(el.clientWidth - prev) > 24 ? el.clientWidth : prev))
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    measure()
    return () => watch.disconnect()
  }, [])
  const zoom = width > 0 ? Math.min(1, width / (sheetMm * MM_PX + 2)) : 0.5
  return (
    <div ref={box}>
      <div style={{ zoom }} className="[&>article]:bg-white [&>article]:shadow-md">
        {children}
      </div>
    </div>
  )
}

function Editor({ saved }: { saved: CertificateLayout }) {
  const save = useSaveCertificateLayout()
  const [draft, setDraft] = useState(saved)
  const [key, setKey] = useState<CertificateLineKey>('name')
  const [editing, setEditing] = useState(0)
  const [asking, setAsking] = useState<'background' | 'reset' | null>(null)
  const importer = useRef<HTMLInputElement>(null)
  const line = draft.lines[key]
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const setLine = (patch: Partial<CertificateLine>) => setDraft((d) => ({ ...d, lines: { ...d.lines, [key]: { ...d.lines[key], ...patch } } }))
  const style = (field: 'bold' | 'italic' | 'uppercase', label: string, icon: LucideIcon) => (
    <Segment on={line[field]} label={label} icon={icon} onClick={() => setLine({ [field]: !line[field] })} />
  )

  function persist(layout: CertificateLayout | null, message: string) {
    save.mutate(layout, {
      onSuccess: (next) => {
        setDraft(next)
        toast.success(message)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  // The designed certificate becomes the background, and the page turns to match it
  async function importDesign(file: File | undefined) {
    if (!file) return
    try {
      const { picture, portrait } = await certificateDesign(file)
      setDraft((d) => ({ ...d, background: picture, orientation: portrait ? 'portrait' : 'landscape' }))
      toast.success('Design imported. Save the layout to use it.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  const orient = (orientation: CertificateOrientation) => () => setDraft((d) => ({ ...d, orientation }))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Certificates"
        description="How printed certificates look. One layout for every competition."
      />

      <div className="flex flex-col gap-8">
        <div aria-label="Preview" className="flex flex-col gap-3 lg:pr-[24rem]">
          <Preview sheetMm={certificatePage(draft).sheetWidth}>
            <CertificateSheet
              layout={draft}
              values={SAMPLE}
              signers={NO_SIGNERS}
              date={SAMPLE.date}
              label="Certificate preview"
              selected={key}
              onSelect={setKey}
            />
          </Preview>
        </div>

        <aside className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:w-88 lg:rounded-none lg:border-y-0 lg:border-r-0">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-5">
            <h2 className="text-body font-semibold text-neutral-900">Layout</h2>
            <Button disabled={!dirty || save.isPending} onClick={() => persist(draft, 'Certificate layout saved')}>
              {save.isPending ? 'Saving…' : 'Save layout'}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-neutral-200 lg:min-h-0 lg:flex-1 lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <p className="p-5 text-small text-neutral-600">Click a line to edit it. Names, places, dates and signatures here are placeholders, just to view the layout.</p>

          <Section title="Page">
            <Select label="Paper" value={draft.paper} onChange={(e) => setDraft((d) => ({ ...d, paper: e.target.value as CertificatePaper }))}>
              {(Object.keys(CERTIFICATE_PAPER) as CertificatePaper[]).map((k) => (
                <option key={k} value={k}>
                  {CERTIFICATE_PAPER[k].label}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented label="Page">
                <Segment on={draft.orientation === 'landscape'} label="Landscape" icon={RectangleHorizontal} text="Landscape" onClick={orient('landscape')} />
                <Segment on={draft.orientation === 'portrait'} label="Portrait" icon={RectangleVertical} text="Portrait" onClick={orient('portrait')} />
              </Segmented>
              <div className="flex items-center gap-2">
                {draft.background && (
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Remove background"
                    onClick={() => setAsking('background')}
                  >
                    <X aria-hidden className="size-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Section>

          <Section title="Line">
            <Select label="Line" hideLabel value={key} onChange={(e) => setKey(e.target.value as CertificateLineKey)}>
              {CERTIFICATE_LINE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {LINE_LABEL[k]}
                </option>
              ))}
            </Select>
            <Input
              label="Wording"
              readOnly
              value={fillCertificateText(line.text, SAMPLE) || 'Hidden'}
              onClick={() => setEditing((n) => n + 1)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing((n) => n + 1)}
              className="cursor-pointer"
            />
            <WordingDialog
              key={`${key}-${editing}`}
              open={editing > 0}
              title={LINE_LABEL[key]}
              text={line.text}
              onClose={() => setEditing(0)}
              onDone={(text) => {
                setLine({ text })
                setEditing(0)
              }}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
              <Select label="Font" value={line.font} onChange={(e) => setLine({ font: e.target.value as CertificateFont })}>
                {(Object.keys(CERTIFICATE_FONTS) as CertificateFont[]).map((f) => (
                  <option key={f} value={f}>
                    {CERTIFICATE_FONTS[f].label}
                  </option>
                ))}
              </Select>
              <Input
                label="Size"
                type="number"
                inputMode="numeric"
                min={CERTIFICATE_SIZE_RANGE.min}
                max={CERTIFICATE_SIZE_RANGE.max}
                value={line.size}
                onChange={(e) => setLine({ size: Number(e.target.value) || line.size })}
                className="font-mono tabular-nums"
              />
            </div>
            <Segmented label="Style" className="self-start">
              {style('bold', 'Bold', Bold)}
              {style('italic', 'Italic', Italic)}
              {style('uppercase', 'Capitals', CaseUpper)}
            </Segmented>
          </Section>

          </div>

          <div className="flex flex-wrap gap-2 border-t border-neutral-200 p-5 lg:pr-20">
            <p className="w-full text-small text-neutral-600">Import a designed certificate as the background: JPG, JPEG, PNG, WebP or PDF (first page), up to 10 MB.</p>
            <Button size="sm" onClick={() => importer.current?.click()}>
              <Upload aria-hidden className="size-4" />
              Import layout
            </Button>
            <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => setAsking('reset')}>
              <RotateCcw aria-hidden className="size-4" />
              Reset
            </Button>
            <input
              ref={importer}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
              aria-label="Certificate design"
              className="sr-only"
              onChange={(e) => {
                void importDesign(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </aside>
      </div>

      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        className="max-w-md"
        title={asking === 'reset' ? 'Go back to the built-in layout?' : 'Remove the background?'}
        description={
          asking === 'reset'
            ? 'Your saved wording, fonts, page and background are replaced by the built-in layout for every competition.'
            : 'The certificate prints on plain paper. Save the layout to keep this.'
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => {
                if (asking === 'reset') persist(null, 'Back to the built-in layout')
                else {
                  setDraft((d) => ({ ...d, background: null }))
                  toast.success('Background removed. Save the layout to keep it.')
                }
                setAsking(null)
              }}
            >
              {asking === 'reset' ? 'Reset' : 'Remove'}
            </Button>
          </>
        }
      />
    </div>
  )
}

export function CertificateLayoutPage() {
  const layout = useCertificateLayout()
  if (layout.isError) return <ErrorState onRetry={() => void layout.refetch()} />
  if (!layout.data) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Certificates" description="How printed certificates look. One layout for every competition." />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }
  return <Editor key={JSON.stringify(layout.data)} saved={layout.data} />
}
