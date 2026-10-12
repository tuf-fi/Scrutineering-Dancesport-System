import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PointsRow, Role } from '@bis/shared'
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
  useWrite((id: string) => api.deleteCompetition(actor(), id), () => [['competitions']])

export const useCreateStaff = () =>
  useWrite(
    (v: { name: string; username: string; role: Role }) => api.createStaffUser(actor(), v),
    () => [['staff-users']],
  )

export const useUpdateStaff = () =>
  useWrite(
    (v: { id: string; name: string; role: Role }) => api.updateStaffUser(actor(), v.id, { name: v.name, role: v.role }),
    () => [['staff-users']],
  )

export const useDeleteStaff = () =>
  useWrite((id: string) => api.deleteStaffUser(actor(), id), () => [['staff-users']])

export const useUpdateAdjudicator = () =>
  useWrite(
    (v: { id: string; name: string }) => api.updateAdjudicator(actor(), v.id, { name: v.name }),
    () => [['adjudicators']],
  )

export const useDeleteAdjudicator = () =>
  useWrite(
    (id: string) => api.deleteAdjudicator(actor(), id),
    () => [['adjudicators'], ['adjudicator-pins'], ['panels']],
  )

export const useResetStaffPassword = () =>
  useWrite((id: string) => api.resetStaffPassword(actor(), id), () => [])

export const useCreateAdjudicator = () =>
  useWrite(
    (v: { name: string; letter: string }) => api.createAdjudicator(actor(), v),
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

export const useApprovePayment = () =>
  useWrite((id: string) => api.approvePayment(actor(), id), () => [['payments']])

export const useRejectPayment = () =>
  useWrite(
    (v: { id: string; reason: string }) => api.rejectPayment(actor(), v.id, v.reason),
    () => [['payments']],
  )
