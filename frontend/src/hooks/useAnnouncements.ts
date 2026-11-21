import { useQuery } from '@tanstack/react-query'
import * as api from '../api/index.ts'
import { usePoll } from './usePoll.ts'

export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: api.getAnnouncements, refetchInterval: usePoll(3000) })
