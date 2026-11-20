import type { AccountKind } from './AccountForm.tsx'

export const ACCOUNT_COPY: Record<AccountKind, { title: string; create: string; name: string; signInNote: string; createNote: string }> = {
  athlete: { title: 'Athlete sign-in', create: 'Create your account', name: 'Full name', signInNote: 'Sign in to register and follow your results.', createNote: 'One account per athlete. Use an email you check.' },
  coach: { title: 'Coach sign-in', create: 'Create a coach account', name: 'Full name', signInNote: 'Sign in to your coach page.', createNote: 'One account per coach. Use an email you check.' },
  team: { title: 'Team sign-in', create: 'Create a team account', name: 'Team name', signInNote: 'Sign in to your team page.', createNote: 'One account per team. Use an email the team checks.' },
}
