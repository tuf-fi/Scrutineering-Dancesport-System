import { useSearchParams } from 'react-router'
import type { SectionItem } from './SectionSidebar.tsx'

// Which of a page's sections is open: the one in the address (?section=), or the first
export function useSection(sections: readonly SectionItem[]): string {
  const [params] = useSearchParams()
  const asked = params.get('section')
  return sections.find((s) => s.id === asked)?.id ?? sections[0]!.id
}
