import { PAST_COLUMNS, PAST_HELP, PAST_SHEETS, type PastImportReport, type PastIssue, type PastWorkbook } from '@bis/shared'
import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, PageHeader, Table, toast, type Column } from '../../components/ui/index.ts'
import { useImportPastCompetition } from '../../hooks/index.ts'
import { coverPhoto } from '../../lib/image.ts'
import { pastTemplate, readPastWorkbook } from '../../lib/pastWorkbook.ts'

const COUNT_LABEL: Array<[keyof PastImportReport['counts'], string]> = [
  ['events', 'Events'],
  ['competitors', 'Dancers'],
  ['adjudicators', 'Adjudicators'],
  ['rounds', 'Rounds'],
  ['marks', 'Marks'],
  ['results', 'Results'],
  ['newTeams', 'New teams'],
  ['newAdjudicators', 'New adjudicators'],
]

const issueColumns: Column<PastIssue>[] = [
  { key: 'sheet', header: 'Sheet', cell: (i) => i.sheet, widthClass: 'w-32' },
  { key: 'row', header: 'Row', cell: (i) => (i.row > 0 ? i.row : ''), mono: true, widthClass: 'w-20' },
  { key: 'message', header: 'What to fix', cell: (i) => i.message, wrap: true },
]

const issueKey = (i: PastIssue) => `${i.sheet}:${i.row}:${i.message}`

async function downloadTemplate() {
  const url = URL.createObjectURL(await pastTemplate())
  const link = document.createElement('a')
  link.href = url
  link.download = 'past-competition-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export function PastImportPage() {
  const run = useImportPastCompetition()
  const filePicker = useRef<HTMLInputElement>(null)
  const photoPicker = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState<PastWorkbook['sheets'] | null>(null)
  const [image, setImage] = useState('')
  const [report, setReport] = useState<PastImportReport | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function check(nextSheets: PastWorkbook['sheets'] | null, nextImage: string) {
    setReport(null)
    setFailure(null)
    if (!nextSheets) return
    run.mutate({ book: { sheets: nextSheets, image: nextImage }, dryRun: true }, { onSuccess: setReport, onError: (e) => setFailure(e.message) })
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    setReport(null)
    setFailure(null)
    try {
      const read = await readPastWorkbook(file)
      setFileName(file.name)
      setSheets(read)
      check(read, image)
    } catch {
      setSheets(null)
      setFileName('')
      setFailure('That file could not be read. Use the Excel template (.xlsx).')
    }
  }

  function removeFile() {
    if (filePicker.current) filePicker.current.value = ''
    setFileName('')
    setSheets(null)
    setReport(null)
    setFailure(null)
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return
    try {
      const photo = await coverPhoto(file)
      setImage(photo)
      check(sheets, photo)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  function save() {
    if (!sheets) return
    run.mutate(
      { book: { sheets, image }, dryRun: false },
      {
        onSuccess: (saved) => {
          setReport(saved)
          if (saved.imported) toast.success(`${saved.competitionName} is imported`)
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  const checking = run.isPending && !report
  const clean = report !== null && report.errors.length === 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Past competition"
        description="Add a competition that was run before the system, with its marks, results and ranking points, so its records show here like any other."
        actions={
          <Button onClick={() => void downloadTemplate()}>
            Download template
          </Button>
        }
      />

      <section aria-label="Upload" className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={filePicker} type="file" accept=".xlsx" aria-label="Workbook" className="sr-only" onChange={(e) => void chooseFile(e.target.files?.[0])} />
          <Button variant="secondary" onClick={() => filePicker.current?.click()}>
            {sheets ? 'Import another record' : 'Import previous record'}
          </Button>
          {fileName && <span className="min-w-0 truncate text-small text-neutral-600">{fileName}</span>}
          {sheets && (
            <Button variant="danger-ghost" onClick={removeFile} disabled={run.isPending}>
              <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
              Remove
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={photoPicker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Card photo" className="sr-only" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
          <Button variant="secondary" onClick={() => photoPicker.current?.click()}>
            {image ? 'Change card photo' : 'Choose the card photo'}
          </Button>
          {image ? <img src={image} alt="" className="h-12 w-10 rounded-sm object-cover" /> : <span className="text-small text-neutral-500">Every competition has a photo on its card.</span>}
        </div>
        {checking && <p className="text-small text-neutral-600">Checking the workbook…</p>}
        {failure && (
          <p role="alert" className="text-small text-danger">
            {failure}
          </p>
        )}
      </section>

      {report && (
        <section aria-label="Result of the check" className="flex flex-col gap-5 border-t border-neutral-200 pt-4">
          {report.errors.length > 0 ? (
            <>
              <p className="text-body font-medium text-neutral-900">
                {report.errors.length === 1 ? '1 thing to fix' : `${report.errors.length} things to fix`} before this can be imported.
              </p>
              <Table<PastIssue> rows={report.errors} rowKey={issueKey} columns={issueColumns} minWidthClass="min-w-0" paginationLabel="Things to fix" />
            </>
          ) : (
            <>
              <p className="text-body font-medium text-neutral-900">
                {report.imported ? `${report.competitionName} is imported.` : `${report.competitionName} is ready to import.`}
              </p>
              <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-small">
                {COUNT_LABEL.filter(([key]) => report.counts[key] > 0).map(([key, label]) => (
                  <div key={key} className="contents">
                    <dt className="text-neutral-600">{label}</dt>
                    <dd className="text-right font-mono text-neutral-900">{report.counts[key]}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {report.warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-small font-medium text-neutral-900">To look at (the import still goes ahead)</p>
              <Table<PastIssue> rows={report.warnings} rowKey={issueKey} columns={issueColumns} minWidthClass="min-w-0" paginationLabel="To look at" />
            </div>
          )}

          {clean && !report.imported && (
            <div>
              <Button onClick={save} disabled={run.isPending || !image}>
                {run.isPending ? 'Importing…' : 'Import it'}
              </Button>
              {!image && <p className="mt-2 text-small text-neutral-600">Choose the card photo first.</p>}
            </div>
          )}
        </section>
      )}

      <section aria-label="What the workbook holds" className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
        <h2 className="text-small font-semibold text-neutral-900">What the workbook holds</h2>
        <dl className="grid gap-x-6 gap-y-3 text-small sm:grid-cols-[10rem_1fr]">
          {PAST_SHEETS.map((name) => (
            <div key={name} className="contents">
              <dt className="font-medium text-neutral-900">{name}</dt>
              <dd className="flex flex-col gap-0.5 text-neutral-600">
                <span>{PAST_HELP[name]}</span>
                <span className="font-mono text-neutral-500">{PAST_COLUMNS[name].join(', ')}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
