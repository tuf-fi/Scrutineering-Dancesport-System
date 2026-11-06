import { useQuery } from '@tanstack/react-query'
import { DEFAULT_CATALOG, ageGroupName, ageGroupShort, eventKindName, type Catalog, type Event } from '@bis/shared'
import { useCallback, useMemo } from 'react'
import * as api from '../api/index.ts'
import { eventGrade } from '../lib/format.ts'

// The kinds and age groups the admin keeps, with the names screens show. Until they load, the built-in ones
// stand in, so a screen never shows a blank where a name should be.
export function useCatalog() {
  const query = useQuery({ queryKey: ['catalog'], queryFn: api.getCatalog, staleTime: 5 * 60_000 })
  const catalog: Catalog = query.data ?? DEFAULT_CATALOG
  const { kinds } = catalog
  // Pickers and tabs list the current groups; labels also know the retired versions that past events kept
  const ageGroups = useMemo(() => catalog.ageGroups.filter((g) => !g.retired), [catalog.ageGroups])
  const ageGroupLabel = useCallback((id: string) => ageGroupName(catalog.ageGroups, id), [catalog.ageGroups])
  const ageGroupPrinted = useCallback((id: string) => ageGroupShort(catalog.ageGroups, id), [catalog.ageGroups])
  const kindLabel = useCallback((id: string) => eventKindName(kinds, id), [kinds])
  const grade = useCallback((event: Pick<Event, 'ageGroup' | 'class' | 'discipline'>) => eventGrade(event, ageGroupLabel), [ageGroupLabel])
  return useMemo(
    () => ({ catalog, kinds, ageGroups, ageGroupLabel, ageGroupShort: ageGroupPrinted, kindLabel, eventGrade: grade, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }),
    [catalog, kinds, ageGroups, ageGroupLabel, ageGroupPrinted, kindLabel, grade, query.isLoading, query.isError, query.refetch],
  )
}
