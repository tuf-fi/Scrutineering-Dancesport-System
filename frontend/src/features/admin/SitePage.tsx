import { ImageUp, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { Button, ErrorState, PageHeader, Skeleton, toast } from '../../components/ui/index.ts'
import { useSaveHeroImage, useSiteSettings } from '../../hooks/index.ts'
import { heroPhoto } from '../../lib/image.ts'
import { HERO_IMAGE } from '../../lib/hero.ts'

// The picture beside the heading on the public home page
export function SitePage() {
  const settings = useSiteSettings()
  const save = useSaveHeroImage()
  const picker = useRef<HTMLInputElement>(null)
  const custom = settings.data?.heroImage ?? null

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      const image = await heroPhoto(file)
      save.mutate(image, { onSuccess: () => toast.success('Home page picture changed'), onError: (e) => toast.error(e.message) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that picture.')
    }
  }

  if (settings.isError) return <ErrorState onRetry={() => void settings.refetch()} />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Home page" description="The picture beside the heading on the public home page." />
      <section aria-label="Hero picture" className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase text-neutral-500">Hero picture</h2>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {settings.isLoading ? (
            <Skeleton className="h-32 w-full shrink-0 sm:w-64" />
          ) : (
            <img src={custom ?? HERO_IMAGE} alt="The picture now on the home page" className="h-auto w-full shrink-0 rounded-lg border border-neutral-200 sm:w-64" />
          )}
          <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" disabled={save.isPending || settings.isLoading} onClick={() => picker.current?.click()}>
            <ImageUp aria-hidden className="size-4" />
            {save.isPending ? 'Saving…' : 'Change picture'}
          </Button>
          {custom && (
            <Button
              variant="ghost"
              disabled={save.isPending}
              onClick={() => save.mutate(null, { onSuccess: () => toast.success('Back to the built-in picture'), onError: (e) => toast.error(e.message) })}
            >
              <RotateCcw aria-hidden className="size-4" />
              Use the built-in picture
            </Button>
          )}
        </div>
        <p className="max-w-md text-small text-neutral-500">A wide, landscape photo works best. It shows on the right half of the home page, fading into the black on its left.</p>
          </div>
        </div>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Hero picture" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
      </section>
    </div>
  )
}
