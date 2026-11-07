import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AccountKind, PointsRow, Role } from '@bis/shared'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

export const usePaymentDetails = () =>
  useQuery({ queryKey: ['payments', 'details'], queryFn: api.getPaymentDetails })

export const usePanels = (competitionId: string) =>
  useQuery({ queryKey: ['panels', competitionId], queryFn: () => api.getPanels(competitionId) })

// Runs a write, then refreshes the queries it affects
function useWrite<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  invalidates: (vars: TVars) => unknown[][],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_data, vars) =>
      Promise.all(invalidates(vars).map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export const useSaveCompetition = () =>
  useWrite(
    (v: { input: api.CompetitionInput; id?: string }) => api.saveCompetition(actor(), v.input, v.id),
    () => [['competitions']],
  )

export const useDeleteCompetition = () =>
  useWrite((v: { id: string; cascade?: boolean }) => api.deleteCompetition(actor(), v.id, v.cascade), () => [['competitions']])

export const useSaveEventKind = () =>
  useWrite((v: { input: api.EventKindInput; id?: string }) => api.saveEventKind(actor(), v.input, v.id), () => [['catalog']])

export const useDeleteEventKind = () =>
  useWrite((v: { id: string; cascade?: boolean }) => api.deleteEventKind(actor(), v.id, v.cascade), () => [['catalog']])

export const useSaveAgeGroup = () =>
  useWrite((v: { input: api.AgeGroupInput; id?: string }) => api.saveAgeGroup(actor(), v.input, v.id), () => [['catalog']])

export const useDeleteAgeGroup = () =>
  useWrite((v: { id: string; cascade?: boolean }) => api.deleteAgeGroup(actor(), v.id, v.cascade), () => [['catalog']])

export const useCreateStaff = () =>
  useWrite(
    (v: { name: string; username: string; role: Role; photo: string }) => api.createStaffUser(actor(), v),
    () => [['staff-users']],
  )

export const useUpdateStaff = () =>
  useWrite(
    (v: { id: string; name: string; role: Role; photo?: string }) => api.updateStaffUser(actor(), v.id, { name: v.name, role: v.role, photo: v.photo }),
    () => [['staff-users']],
  )

export const useDeleteStaff = () =>
  useWrite((id: string) => api.deleteStaffUser(actor(), id), () => [['staff-users']])

export const useUpdateAdjudicator = () =>
  useWrite(
    (v: { id: string; name: string; photo?: string }) => api.updateAdjudicator(actor(), v.id, { name: v.name, photo: v.photo }),
    () => [['adjudicators']],
  )

export const useDeleteAdjudicator = () =>
  useWrite(
    (v: { id: string; cascade?: boolean }) => api.deleteAdjudicator(actor(), v.id, v.cascade),
    () => [['adjudicators'], ['adjudicator-pins'], ['panels']],
  )

export const useResetStaffPassword = () =>
  useWrite((id: string) => api.resetStaffPassword(actor(), id), () => [])

export const useCreateAdjudicator = () =>
  useWrite(
    (v: { name: string; letter: string; photo: string }) => api.createAdjudicator(actor(), v),
    () => [['adjudicators']],
  )

export const useGeneratePins = () =>
  useWrite(
    (v: { competitionId: string; adjudicatorId?: string }) =>
      api.generatePins(actor(), v.competitionId, v.adjudicatorId),
    (v) => [['adjudicator-pins', v.competitionId]],
  )

export const useSetPanel = () =>
  useWrite(
    (v: { eventId: string; adjudicatorIds: string[] }) =>
      api.setPanel(actor(), v.eventId, v.adjudicatorIds),
    (v) => [['panels'], ['panel', v.eventId]],
  )

export const useSavePointsTable = () =>
  useWrite((rows: PointsRow[]) => api.savePointsTable(actor(), rows), () => [['points-table']])

export const useRevokeSessions = () =>
  useWrite((v: { kind: AccountKind; id: string }) => api.revokeSessions(actor(), v.kind, v.id), () => [])
