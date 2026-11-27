import type { SiteSettings } from '@bis/shared'
import { useEffect, useState } from 'react'
import { PICTURE_RETRY_MS, useSiteSettings } from '../hooks/useAdmin.ts'
import { cn } from '../lib/cn.ts'
import { HERO_IMAGE } from '../lib/hero.ts'

function FadingPhoto({ src, className }: { src: string; className: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  // A failed download is tried again with a new image element
  useEffect(() => {
    if (state !== 'failed') return
    const timer = setTimeout(() => setState('loading'), PICTURE_RETRY_MS)
    return () => clearTimeout(timer)
  }, [state])

  if (state === 'failed') return null
  return (
    <img
      src={src}
      alt=""
      onLoad={() => setState('loaded')}
      onError={() => setState('failed')}
      className={cn(className, 'transition-opacity duration-500', state === 'loaded' ? 'opacity-80' : 'opacity-0')}
    />
  )
}

// The admin's picture, or the built-in one only once the server says there is none. Until then the area stays black and it keeps trying.
export function SitePhoto({ which, className }: { which: keyof SiteSettings; className: string }) {
  const settings = useSiteSettings()
  if (!settings.data) return null
  const src = settings.data[which] ?? HERO_IMAGE
  return <FadingPhoto key={src} src={src} className={className} />
}
