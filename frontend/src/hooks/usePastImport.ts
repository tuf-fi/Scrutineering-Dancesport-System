import type { PastWorkbook } from '@bis/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

// A trial run only checks the workbook; the real one saves the competition, so every list is read again
export function useImportPastCompetition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { book: PastWorkbook; dryRun: boolean }) => api.importPastCompetition(actor(), v.book, v.dryRun),
    onSuccess: (report) => (report.imported ? queryClient.invalidateQueries() : undefined),
  })
}
