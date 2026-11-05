import { useRef } from 'react'
import { Avatars } from '../../components/Avatars.tsx'
import { Button, toast } from '../../components/ui/index.ts'
import { useSaveMyPhoto } from '../../hooks/index.ts'
import { squarePhoto } from '../../lib/image.ts'

type PhotoSave = { isPending: boolean; mutate: (photo: string | null, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void }

// The profile picture: choose one, or go back to the initials
export function PhotoField({ profile, useSave = useSaveMyPhoto }: { profile: { name: string; photo: string | null }; useSave?: () => PhotoSave }) {
  const save = useSave()
  const input = useRef<HTMLInputElement>(null)

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      const photo = await squarePhoto(file)
      save.mutate(photo, { onSuccess: () => toast.success('Picture saved'), onError: (e) => toast.error(e.message) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatars names={[profile.name]} photo={profile.photo} size="xxl" />
      <div className="flex flex-col items-start gap-2">
        <p className="text-small text-neutral-600">A square picture works best. It shows in your account and the menu.</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={save.isPending} onClick={() => input.current?.click()}>
            {profile.photo ? 'Change picture' : 'Add a picture'}
          </Button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Profile picture" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
      </div>
    </div>
  )
}
