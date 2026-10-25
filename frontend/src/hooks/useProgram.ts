import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProgramKind, ProgramSlotInput } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'
import { usePoll } from './usePoll.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

const POLL_MS = 3000

// The writes return the new program, so the screen updates without waiting for a refetch
export const useProgram = (competitionId: string) =>
  useQuery({
    queryKey: ['program', competitionId],
    queryFn: () => api.getProgram(competitionId),
    enabled: competitionId !== '',
    refetchInterval: usePoll(POLL_MS),
  })

function useProgramWrite<TVars>(competitionId: string, mutationFn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['program', competitionId] }),
  })
}

export const useSetProgramStart = (competitionId: string) =>
  useProgramWrite(competitionId, (start: string | null) => api.setProgramStart(actor(), competitionId, start))

export const useGenerateProgram = (competitionId: string) =>
  useProgramWrite(competitionId, () => api.generateProgram(actor(), competitionId))

export const useAddProgramBreak = (competitionId: string) =>
  useProgramWrite(competitionId, (v: { kind: ProgramKind; label: string; minutes: number; afterSequence?: number }) =>
    api.addProgramBreak(actor(), competitionId, v),
  )

export const useUpdateProgramSlot = (competitionId: string) =>
  useProgramWrite(competitionId, (v: { slotId: string; input: ProgramSlotInput }) =>
    api.updateProgramSlot(actor(), v.slotId, v.input),
  )

export const useMoveProgramSlot = (competitionId: string) =>
  useProgramWrite(competitionId, (v: { slotId: string; direction: 'up' | 'down' }) =>
    api.moveProgramSlot(actor(), v.slotId, v.direction),
  )

export const useRemoveProgramSlot = (competitionId: string) =>
  useProgramWrite(competitionId, (slotId: string) => api.removeProgramSlot(actor(), slotId))
