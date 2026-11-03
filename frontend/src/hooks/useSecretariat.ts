import type { TeamInput, CoachInput, CompetitorDetails, RegistrationInput } from '@bis/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

export const useCompetitionEntries = (competitionId: string) =>
  useQuery({
    queryKey: ['competition-entries', competitionId],
    queryFn: () => api.getCompetitionEntries(competitionId),
  })

export const useEntryRows = (eventId: string) =>
  useQuery({ queryKey: ['entry-rows', eventId], queryFn: () => api.getEntryRows(eventId) })

export const useCompetitorRows = () =>
  useQuery({ queryKey: ['competitor-rows'], queryFn: api.getCompetitorRows })

export const useLateEntries = (competitionId: string) =>
  useQuery({ queryKey: ['late-entries', competitionId], queryFn: () => api.getLateEntries(competitionId) })

export const useSchedule = (competitionId: string) =>
  useQuery({ queryKey: ['schedule', competitionId], queryFn: () => api.getSchedule(competitionId) })

// Runs a write, then refreshes the queries it affects
function useWrite<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>, invalidates: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useScratchEntry = () =>
  useWrite(
    (v: { entryId: string; scratched: boolean }) => api.setEntryScratched(actor(), v.entryId, v.scratched),
    ['entry-rows', 'competition-entries', 'competitor-rows'],
  )

export const useCreateCompetitor = () =>
  useWrite((v: { names: string[]; teamId: string; details?: CompetitorDetails }) => api.createCompetitor(actor(), v), ['competitor-rows'])

export const useSetBackNumber = () =>
  useWrite(
    (v: { id: string; backNumber: number | null }) => api.setBackNumber(actor(), v.id, v.backNumber),
    ['competitor-rows', 'entry-rows'],
  )

export const useAssignBackNumbers = () =>
  useWrite(() => api.assignBackNumbers(actor()), ['competitor-rows', 'entry-rows'])

// The file's text goes to the server, which reads it (quoted fields with commas included)
export const useImportCompetitors = () =>
  useWrite((csv: string) => api.importCompetitorsCsv(actor(), csv), ['competitor-rows'])

export const useCreateLateEntry = () =>
  useWrite(
    (v: { competitorId: string; eventId: string; paidInCash: boolean }) => api.createLateEntry(actor(), v),
    ['late-entries', 'entry-rows', 'competition-entries', 'competitor-rows', 'payments'],
  )

export const useMarkPaidAtVenue = () =>
  useWrite((paymentId: string) => api.markPaidAtVenue(actor(), paymentId), ['payments', 'late-entries', 'entry-rows'])

export const useMoveScheduledEvent = () =>
  useWrite(
    (v: { competitionId: string; eventId: string; direction: 'up' | 'down' }) =>
      api.moveScheduledEvent(actor(), v.competitionId, v.eventId, v.direction),
    ['schedule'],
  )

export const useUpdateCompetitor = () =>
  useWrite(
    (v: { id: string; names: string[]; teamId: string; details?: CompetitorDetails }) =>
      api.updateCompetitor(actor(), v.id, { names: v.names, teamId: v.teamId, details: v.details }),
    ['competitor-rows', 'entry-rows', 'late-entries'],
  )

export const useDeleteCompetitor = () =>
  useWrite((id: string) => api.deleteCompetitor(actor(), id), ['competitor-rows'])

export const useDeleteLateEntry = () =>
  useWrite(
    (entryId: string) => api.deleteLateEntry(actor(), entryId),
    ['late-entries', 'entry-rows', 'competition-entries', 'competitor-rows', 'payments'],
  )

export const useUpdateLateEntry = () =>
  useWrite(
    (v: { entryId: string; eventId: string; paidInCash: boolean }) =>
      api.updateLateEntry(actor(), v.entryId, { eventId: v.eventId, paidInCash: v.paidInCash }),
    ['late-entries', 'entry-rows', 'competition-entries', 'competitor-rows', 'payments'],
  )

export const useSaveEvent = () =>
  useWrite(
    (v: { competitionId: string; input: api.EventInput; id?: string }) =>
      api.saveEvent(actor(), v.competitionId, v.input, v.id),
    ['events', 'event', 'schedule', 'panels'],
  )

export const useDeleteEvent = () =>
  useWrite((id: string) => api.deleteEvent(actor(), id), ['events', 'schedule', 'panels'])

export const useSaveTeam = () =>
  useWrite((v: { input: TeamInput; id?: string }) => api.saveTeam(actor(), v.input, v.id), ['teams', 'competitor-rows'])

export const useDeleteTeam = () => useWrite((id: string) => api.deleteTeam(actor(), id), ['teams'])

export const useCoaches = (enabled = true) => useQuery({ queryKey: ['coaches'], queryFn: api.getCoaches, enabled })

export const useSaveCoach = () =>
  useWrite((v: { input: CoachInput; id?: string }) => api.saveCoach(actor(), v.input, v.id), ['coaches'])

export const useDeleteCoach = () => useWrite((id: string) => api.deleteCoach(actor(), id), ['coaches'])

// The price of the chosen events, worked out by the server
export const useRegistrationQuote = (competitorId: string, eventIds: string[], coachFees?: { membership: boolean; summit: boolean }) =>
  useQuery({
    queryKey: ['registration-quote', competitorId, [...eventIds].sort(), coachFees ?? null],
    queryFn: () => api.quoteRegistration(competitorId, eventIds, coachFees),
    // Ticking a coach fee keeps the old lines on screen until the new total arrives
    placeholderData: (previous) => previous,
    enabled: competitorId !== '' && eventIds.length > 0,
  })

export const useRegisterCompetitor = () =>
  useWrite((v: RegistrationInput) => api.registerCompetitor(actor(), v), [
    'competitor-rows',
    'entry-rows',
    'competition-entries',
    'payments',
    'registration-quote',
  ])
