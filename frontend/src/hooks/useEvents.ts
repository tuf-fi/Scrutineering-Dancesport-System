import { useQuery } from '@tanstack/react-query'
import * as api from '../api/index.ts'

export const useEvents = (competitionId?: string) =>
  useQuery({
    queryKey: ['events', competitionId ?? 'all'],
    queryFn: () => api.getEvents(competitionId),
  })

export const useEvent = (id: string) =>
  useQuery({ queryKey: ['event', id], queryFn: () => api.getEvent(id) })

export const useEntries = (eventId: string) =>
  useQuery({ queryKey: ['entries', eventId], queryFn: () => api.getEntries(eventId) })

export const usePanel = (eventId: string) =>
  useQuery({ queryKey: ['panel', eventId], queryFn: () => api.getPanel(eventId) })

export const useResults = (eventId: string) =>
  useQuery({ queryKey: ['results', eventId], queryFn: () => api.getResults(eventId) })
