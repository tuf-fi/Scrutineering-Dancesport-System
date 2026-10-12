import { useQuery } from '@tanstack/react-query'
import type { PaymentStatus } from '@bis/shared'
import * as api from '../api/index.ts'

export const useCompetitions = () =>
  useQuery({ queryKey: ['competitions'], queryFn: api.getCompetitions })

export const useCompetition = (id: string) =>
  useQuery({
    queryKey: ['competitions', id],
    queryFn: () => api.getCompetition(id),
    enabled: Boolean(id),
  })

export const useClubs = () => useQuery({ queryKey: ['clubs'], queryFn: api.getClubs })
export const useCompetitors = () =>
  useQuery({ queryKey: ['competitors'], queryFn: api.getCompetitors })

export const useAdjudicators = () =>
  useQuery({ queryKey: ['adjudicators'], queryFn: api.getAdjudicators })

export const useAdjudicatorPins = (competitionId: string) =>
  useQuery({
    queryKey: ['adjudicator-pins', competitionId],
    queryFn: () => api.getAdjudicatorPins(competitionId),
  })

export const usePayments = (status?: PaymentStatus) =>
  useQuery({ queryKey: ['payments', status ?? 'all'], queryFn: () => api.getPayments(status) })

export const usePointsTable = () =>
  useQuery({ queryKey: ['points-table'], queryFn: api.getPointsTable })

export const useRankingPoints = (filter: api.RankingFilter = {}) =>
  useQuery({ queryKey: ['ranking-points', filter], queryFn: () => api.getRankingPoints(filter) })

export const useCompetitorHistory = (competitorId: string) =>
  useQuery({
    queryKey: ['competitor-history', competitorId],
    queryFn: () => api.getCompetitorHistory(competitorId),
    enabled: Boolean(competitorId),
  })

export const useStaffUsers = () =>
  useQuery({ queryKey: ['staff-users'], queryFn: api.getStaffUsers })

export const useAuditLog = () => useQuery({ queryKey: ['audit-log'], queryFn: api.getAuditLog })
