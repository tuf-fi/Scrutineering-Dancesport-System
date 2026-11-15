import { useRef, useState } from 'react'
import { Button, Skeleton, toast } from '../../components/ui/index.ts'
import { useMySignature, useSaveMySignature } from '../../hooks/index.ts'
import { signatureImage } from '../../lib/image.ts'
import { SignaturePad } from '../adjudicator/SignaturePad.tsx'

// The signature printed on the final results and the certificates: drawn here, or an image of it uploaded
export function SignatureSection() {
  const mine = useMySignature()
  const save = useSaveMySignature()
  const [drawn, setDrawn] = useState<string | null>(null)
  const [padKey, setPadKey] = useState(0)
  const [error, setError] = useState<string | undefined>()
  const file = useRef<HTMLInputElement>(null)

  const done = (message: string) => ({
    onSuccess: () => {
      setDrawn(null)
      setPadKey((k) => k + 1)
      setError(undefined)
      toast.success(message)
    },
    onError: (e: Error) => setError(e.message),
  })

  async function upload(chosen: File | undefined) {
    if (!chosen) return
    try {
      save.mutate(await signatureImage(chosen), done('Signature saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  if (mine.isLoading) return <Skeleton className="h-40 w-full max-w-md" />

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-neutral-600">Saved signature</span>
        {mine.data ? (
          <div className="flex h-28 items-center rounded-lg border border-neutral-200 px-4">
            <img src={mine.data} alt="Your saved signature" className="max-h-20" />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-small text-neutral-600">
            No signature yet. Draw or upload one below, and it prints on the results you approve or confirm.
          </p>
        )}
        {mine.data && (
          <div>
            <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => save.mutate(null, done('Signature removed'))}>
              Remove signature
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-small font-medium text-neutral-600">Draw a new one</span>
        <SignaturePad key={padKey} onChange={setDrawn} />
        <div>
          <Button disabled={!drawn || save.isPending} onClick={() => drawn && save.mutate(drawn, done('Signature saved'))}>
            {save.isPending ? 'Saving…' : 'Save drawn signature'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-small font-medium text-neutral-600">Or upload a picture of it</span>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload a picture of your signature" onChange={(e) => void upload(e.target.files?.[0])} />
        <div>
          <Button variant="secondary" disabled={save.isPending} onClick={() => file.current?.click()}>
            Upload a picture
          </Button>
        </div>
        <p className="text-small text-neutral-600">A JPEG, PNG or WebP of your signature on white or clear. It is shrunk to fit.</p>
      </div>

      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
