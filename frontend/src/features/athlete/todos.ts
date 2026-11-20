import type { AthletePage as AthleteData } from '@bis/shared'

export interface Todo {
  id: string
  title: string
  detail?: string
  to: string
}

// What the athlete still has to do, worked out from their own account
export function todosOf({ profile }: AthleteData): Todo[] {
  const todos: Todo[] = []
  if (profile.request?.rejectedReason) todos.push({ id: 'resend', title: 'Your membership payment was not confirmed', detail: `${profile.request.rejectedReason}. Ask your team to send it again.`, to: '/athlete/membership' })
  if (!profile.birthDate || !profile.phone) {
    todos.push({ id: 'details', title: 'Finish your details', detail: 'The secretariat needs your date of birth and contact number for entries.', to: '/athlete/edit' })
  }
  return todos
}
