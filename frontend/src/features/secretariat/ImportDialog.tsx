import type { ImportResult } from '@bis/shared'
import { useState, type ChangeEvent } from 'react'
import { Button, Dialog, toast } from '../../components/ui/index.ts'
import { useImportCompetitors } from '../../hooks/index.ts'
import { parseCompetitorCsv, type CompetitorCsvRow } from '../../lib/csv.ts'

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

function ImportBody({ onClose }: { onClose: () => void }) {
  const importRows = useImportCompetitors()
  const [fileName, setFileName] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<CompetitorCsvRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setFailure(null)
    try {
      const content = await readText(file)
      setText(content)
      // Only for the count shown here; the server reads the file itself
      setRows(parseCompetitorCsv(content))
      setFileName(file.name)
    } catch {
      setFailure('That file could not be read.')
    }
  }

  function submit() {
    importRows.mutate(text, {
      onSuccess: (r) => {
        setResult(r)
        toast.success(`Imported ${r.created} competitor${r.created === 1 ? '' : 's'}`)
      },
      onError: (e) => setFailure(e.message),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-small text-neutral-600">
        A CSV with three columns: <span className="font-mono">Dancer 1, Dancer 2, Club</span>. Leave Dancer 2 empty for a
        solo dancer. The club must already exist.
      </p>

      <label className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-dashed border-neutral-300 px-4 py-5 text-small hover:border-neutral-400">
        <span className="font-medium text-neutral-900">{fileName ?? 'Choose a CSV file'}</span>
        <span className="text-neutral-500">
          {fileName ? `${rows.length} row${rows.length === 1 ? '' : 's'} found` : 'Click to browse'}
        </span>
        <input type="file" accept=".csv,text/csv" onChange={pick} className="sr-only" aria-label="CSV file" />
      </label>

      {failure && (
        <p role="alert" className="text-small text-danger">
          {failure}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2 text-small" role="status">
          <p className="text-neutral-900">
            {result.created} imported, {result.skipped.length} skipped.
          </p>
          {result.skipped.length > 0 && (
            <ul className="flex flex-col gap-1 text-neutral-600">
              {result.skipped.map((s) => (
                <li key={s.line}>
                  <span className="font-mono tabular-nums">Line {s.line}</span> · {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-3.5">
        <Button variant="ghost" onClick={onClose}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button disabled={rows.length === 0 || importRows.isPending} onClick={submit}>
            {importRows.isPending ? 'Importing…' : `Import ${rows.length || ''}`.trim()}
          </Button>
        )}
      </div>
    </div>
  )
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Import competitors" description="Add many dancers at once.">
      {open && <ImportBody onClose={onClose} />}
    </Dialog>
  )
}
