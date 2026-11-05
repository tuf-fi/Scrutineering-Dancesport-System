import { useRef } from 'react'
import { squarePhoto } from '../lib/image.ts'
import { Avatars } from './Avatars.tsx'
import { Button } from './ui/index.ts'

// The picture of a person or a team, chosen while a form is filled in. It is cropped to a square and kept small.
export function PhotoInput({
  name,
  value,
  onChange,
  error,
  label = 'Photo',
  hint = 'A square picture works best.',
}: {
  name: string
  value: string
  onChange: (photo: string) => void
  error?: string
  label?: string
  hint?: string
}) {
  const picker = useRef<HTMLInputElement>(null)

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      onChange(await squarePhoto(file))
    } catch (e) {
      onChange('')
      throw e
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-small font-medium text-neutral-700 after:ml-0.5 after:text-danger after:content-['*']">{label}</span>
      <div className="flex items-center gap-4">
        <Avatars names={[name || '?']} photo={value || null} size="xl" />
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
            {value ? 'Change photo' : 'Choose photo'}
          </Button>
          <p className={error ? 'text-small text-danger' : 'text-small text-neutral-500'}>{error ?? hint}</p>
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={label}
          className="sr-only"
          onChange={(e) => void choose(e.target.files?.[0]).catch(() => undefined)}
        />
      </div>
    </div>
  )
}
