import { Role, type AthleteInput, type EntryRequestInput, type MemberInput } from '@bis/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as api from '../api/index.ts'
import { useAuth } from '../stores/auth.ts'

const actor = () => useAuth.getState().user?.id ?? 'unknown'

// Runs a write, then refreshes the queries it affects
function useWrite<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>, invalidates: string[]) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}

export const useSignUpAthlete = () =>
  useMutation({ mutationFn: (v: { name: string; email: string; password: string; photo: string }) => api.signUpAthlete(v.name, v.email, v.password, v.photo) })

export const useSignInAthlete = () =>
  useMutation({ mutationFn: (v: { email: string; password: string }) => api.signInAthlete(v.email, v.password) })

// The signed-in athlete's own page
// Only an athlete has an athlete record; asking as anyone else is refused
export const useMyAthlete = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  const isAthlete = useAuth((s) => s.user?.role === Role.Athlete)
  return useQuery({ queryKey: ['my-athlete', id], queryFn: () => api.getMyAthlete(id), enabled: isAthlete })
}

export const useSaveMyAthlete = () => useWrite((input: AthleteInput) => api.saveMyAthlete(actor(), input), ['my-athlete'])

export const useRequestMembership = () =>
  useWrite((input: { method: string; receipt: string }) => api.requestMembership(actor(), input), ['my-athlete'])

export const useChangeMyPassword = () =>
  useWrite((v: { current: string; next: string }) => api.changeMyPassword(actor(), v.current, v.next), [])

export const useSaveMyPhoto = () => useWrite((photo: string | null) => api.saveMyPhoto(actor(), photo), ['my-athlete'])

export const useSignOutEverywhere = () => useMutation({ mutationFn: () => api.signOutEverywhere(actor()) })

// Results and entries of the competitors that carry the athlete's name; it all comes from the database
export const useMyActivity = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['my-activity', id], queryFn: () => api.getMyActivity(id), enabled: id !== '' })
}

// The athlete's notifications, newest first. The server pushes a nudge when there is a new one, so the list refetches at once.
export const useMyNotifications = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  const queryClient = useQueryClient()
  useEffect(() => {
    if (id === '') return
    return api.subscribeNotifications(() => void queryClient.invalidateQueries({ queryKey: ['my-notifications'] }))
  }, [id, queryClient])
  return useQuery({ queryKey: ['my-notifications', id], queryFn: () => api.getMyNotifications(id), enabled: id !== '' })
}

// Marks the given notifications as seen, or all of them
export const useMarkNotificationsRead = () => useWrite((ids?: string[]) => api.markNotificationsRead(actor(), ids), ['my-notifications'])

// What a competitor is entered in and has placed in, for the staff's detail panel; only loaded while the panel is open
export const useCompetitorActivity = (competitorId: string | undefined) =>
  useQuery({ queryKey: ['competitor-activity', competitorId], queryFn: () => api.getCompetitorActivity(competitorId!), enabled: Boolean(competitorId) })

export const useApproveProfileChange = () => useWrite((id: string) => api.approveProfileChange(actor(), id), ['athletes'])

export const useRejectProfileChange = () =>
  useWrite((v: { id: string; reason: string }) => api.rejectProfileChange(actor(), v.id, v.reason), ['athletes'])

// The secretariat's list of athlete accounts
export const useAthletes = () => useQuery({ queryKey: ['athletes'], queryFn: api.getAthletes })

export const useConfirmMembership = () => useWrite((id: string) => api.confirmMembership(actor(), id), ['athletes'])

export const useRejectMembership = () =>
  useWrite((v: { id: string; reason: string }) => api.rejectMembership(actor(), v.id, v.reason), ['athletes'])

export const useResetAthletePassword = () => useWrite((id: string) => api.resetAthletePassword(actor(), id), [])

export const useCorrectAthlete = () => useWrite((v: { id: string; name: string; birthDate: string }) => api.correctAthlete(actor(), v.id, { name: v.name, birthDate: v.birthDate }), ['athletes'])

export const useDeleteAthlete = () => useWrite((v: { id: string; cascade?: boolean }) => api.deleteAthlete(actor(), v.id, v.cascade), ['athletes'])

// Coaches and teams sign in the same way as athletes, each to their own page
export const useSignUpMember = (role: 'coach' | 'team') =>
  useMutation({ mutationFn: (v: { name: string; email: string; password: string; photo: string }) => api.signUpMember(role, v.name, v.email, v.password, v.photo) })

export const useSignInMember = (role: 'coach' | 'team') =>
  useMutation({ mutationFn: (v: { email: string; password: string }) => api.signInMember(role, v.email, v.password) })

export const useMyMember = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  const isMember = useAuth((s) => s.user?.role === Role.Coach || s.user?.role === Role.Team)
  return useQuery({ queryKey: ['my-member', id], queryFn: () => api.getMyMember(id), enabled: isMember })
}

export const useMyRoster = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['my-roster', id], queryFn: () => api.getMyRoster(id), enabled: id !== '' })
}

export const useSaveMyMember = () => useWrite((input: MemberInput) => api.saveMyMember(actor(), input), ['my-member'])
export const useSaveMyMemberPhoto = () => useWrite((photo: string | null) => api.saveMyMemberPhoto(actor(), photo), ['my-member'])
export const useClaimRecord = () => useWrite((targetId: string) => api.claimRecord(actor(), targetId), ['my-member', 'my-roster'])
export const useCancelClaim = () => useWrite(() => api.cancelClaim(actor()), ['my-member'])

// The secretariat links coach and team accounts to their records
export const useMemberClaims = () => useQuery({ queryKey: ['member-claims'], queryFn: api.getMemberClaims })
export const useMemberChanges = () => useQuery({ queryKey: ['member-changes'], queryFn: api.getMemberChanges })
export const useApproveMemberChange = () => useWrite((memberId: string) => api.approveMemberChange(actor(), memberId), ['member-changes'])
export const useRejectMemberChange = () =>
  useWrite((v: { id: string; reason: string }) => api.rejectMemberChange(actor(), v.id, v.reason), ['member-changes'])

export const useApproveMemberClaim = () => useWrite((memberId: string) => api.approveMemberClaim(actor(), memberId), ['member-claims'])
export const useRejectMemberClaim = () => useWrite((memberId: string) => api.rejectMemberClaim(actor(), memberId), ['member-claims'])

// Entering a competition online: a team's dancers (or an athlete's own entries) are picked, priced and sent for the secretariat to approve
export const useMyEntrants = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['my-entrants', id], queryFn: () => api.getMyEntrants(id), enabled: id !== '' })
}

export const useEntryPaymentMethods = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['entry-payment-methods', id], queryFn: () => api.getEntryPaymentMethods(id), enabled: id !== '' })
}

export const useQuoteMyEntries = (competitorId: string, eventIds: string[]) => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({
    queryKey: ['my-quote', id, competitorId, [...eventIds].sort().join(',')],
    queryFn: () => api.quoteMyEntries(id, competitorId, eventIds),
    enabled: id !== '' && competitorId !== '' && eventIds.length > 0,
    retry: false,
  })
}

export const useMyEntryRequests = () => {
  const id = useAuth((s) => s.user?.id ?? '')
  return useQuery({ queryKey: ['my-entry-requests', id], queryFn: () => api.getMyEntryRequests(id), enabled: id !== '' })
}

export const useSubmitEntryRequest = () => useWrite((input: EntryRequestInput) => api.submitEntryRequest(actor(), input), ['my-entry-requests', 'my-entrants'])
export const useCancelEntryRequest = () => useWrite((id: string) => api.cancelEntryRequest(actor(), id), ['my-entry-requests'])

// The secretariat's side
export const useEntryRequests = () => useQuery({ queryKey: ['entry-requests'], queryFn: api.getEntryRequests })
export const useApproveEntryRequest = () => useWrite((id: string) => api.approveEntryRequest(actor(), id), ['entry-requests', 'payments', 'competitors', 'entries'])
export const useRejectEntryRequest = () => useWrite((v: { id: string; reason: string }) => api.rejectEntryRequest(actor(), v.id, v.reason), ['entry-requests'])
