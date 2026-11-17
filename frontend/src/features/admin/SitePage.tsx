import { ImageUp, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { Button, ErrorState, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { useSaveHeroImage, useSaveSignInImage, useSiteSettings } from '../../hooks/index.ts'
import { heroPhoto } from '../../lib/image.ts'
import { HERO_IMAGE } from '../../lib/hero.ts'

interface PictureProps {
  title: string
  // Names the buttons and the file field, so each picture on the page is told apart
  name: string
  hint: string
  current: string | null
  loading: boolean
  pending: boolean
  onSave: (image: string | null, done: () => void, failed: (e: Error) => void) => void
  changed: string
  reset: string
}

// One picture the admin can change, with the built-in one to go back to
function PictureSection({ title, name, hint, current, loading, pending, onSave, changed, reset }: PictureProps) {
  const picker = useRef<HTMLInputElement>(null)

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      const image = await heroPhoto(file)
      onSave(image, () => toast.success(changed), (e) => toast.error(e.message))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="font-mono text-xs uppercase text-neutral-500">{title}</h2>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {loading ? (
          <Skeleton className="h-32 w-full shrink-0 sm:w-64" />
        ) : (
          <img src={current ?? HERO_IMAGE} alt={`The picture now on ${name}`} className="h-auto w-full shrink-0 rounded-lg border border-neutral-200 sm:w-64" />
        )}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={pending || loading} onClick={() => picker.current?.click()}>
              <ImageUp aria-hidden className="size-4" />
              {pending ? 'Saving…' : `Change ${name} picture`}
            </Button>
            {current && (
              <Button variant="ghost" disabled={pending} onClick={() => onSave(null, () => toast.success(reset), (e) => toast.error(e.message))}>
                <RotateCcw aria-hidden className="size-4" />
                Use the built-in picture
              </Button>
            )}
          </div>
          <p className="max-w-md text-small text-neutral-500">{hint}</p>
        </div>
      </div>
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label={title} className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
    </section>
  )
}

// The pictures the admin chooses for the public home page and the sign-in pages
export function SitePage() {
  const settings = useSiteSettings()
  const saveHero = useSaveHeroImage()
  const saveSignIn = useSaveSignInImage()

  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Home page" description="The pictures on the public home page and beside the sign-in forms." />
      <PictureSection
        title="Hero picture"
        name="hero"
        hint="A wide, landscape photo works best. It shows on the right half of the home page, fading into the black on its left."
        current={settings.data?.heroImage ?? null}
        loading={settings.isLoading}
        pending={saveHero.isPending}
        onSave={(image, done, failed) => saveHero.mutate(image, { onSuccess: done, onError: failed })}
        changed="Home page picture changed"
        reset="Back to the built-in picture"
      />
      <PictureSection
        title="Sign-in picture"
        name="sign-in"
        hint="A tall or square photo works best. It fills the right half of every sign-in page on laptops; phones do not show it."
        current={settings.data?.signInImage ?? null}
        loading={settings.isLoading}
        pending={saveSignIn.isPending}
        onSave={(image, done, failed) => saveSignIn.mutate(image, { onSuccess: done, onError: failed })}
        changed="Sign-in picture changed"
        reset="Sign-in back to the built-in picture"
      />
    </div>
  )
}
