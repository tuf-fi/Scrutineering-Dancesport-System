import { useQuery } from '@tanstack/react-query'
import * as api from '../api/index.ts'

export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: api.getAnnouncements })
