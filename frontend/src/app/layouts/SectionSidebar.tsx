import type { LucideIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { cn } from '../../lib/cn.ts'
import { useUi } from '../../stores/ui.ts'

export interface SectionItem {
  id: string
  label: string
  icon: LucideIcon
}

// Which of a page's sections is open: the one in the address (?section=), or the first
export function useSection(sections: readonly SectionItem[]): string {
  const [params] = useSearchParams()
  const asked = params.get('section')
  return sections.find((s) => s.id === asked)?.id ?? sections[0]!.id
}

// A second sidebar beside the admin one: the same look, fixed to the viewport and touching it, so a page's sections are one step away.
// On phones and tablets the sections become a strip of tabs instead. The page itself sits to its right with lg:ml-[13rem].
export function SectionSidebar({ title, label, sections, current }: { title: string; label: string; sections: readonly SectionItem[]; current: string }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const first = sections[0]!.id
  const link = (x: SectionItem) => ({
    to: { search: x.id === first ? '' : `?section=${x.id}` },
    replace: true,
    'aria-current': x.id === current ? ('page' as const) : undefined,
  })

  if (!desktop) {
    return (
      <nav aria-label={label} className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto border-b border-neutral-200 px-4 sm:-mx-8 sm:px-8">
        {sections.map((x) => (
          <Link
            key={x.id}
            {...link(x)}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 py-3 text-small font-semibold',
              x.id === current ? 'border-gold-500 text-neutral-900' : 'border-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <aside className={cn('fixed inset-y-0 z-10 flex w-56 flex-col border-r border-neutral-200 bg-neutral-50 transition-[left] duration-200', collapsed ? 'left-[4.5rem]' : 'left-60')}>
      <p className="px-6 pb-3 pt-8 font-mono text-xs uppercase text-neutral-500">{title}</p>
      <nav aria-label={label} className="flex flex-col gap-1 px-3">
        {sections.map((x) => {
          const Icon = x.icon
          const active = x.id === current
          return (
            <Link
              key={x.id}
              {...link(x)}
              className={cn(
                'flex h-10 items-center gap-3 rounded-md border px-3 text-small font-medium transition-colors',
                active ? 'border-neutral-200 bg-white text-neutral-900' : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              )}
            >
              <Icon aria-hidden className={cn('size-[18px] shrink-0', active && 'text-gold-600')} strokeWidth={1.75} />
              {x.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
