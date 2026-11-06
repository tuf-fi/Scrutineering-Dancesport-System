import type { PdfLine } from './minipdf.ts'

export interface SheetLogin {
  role: string
  email: string
  name: string
  password: string
  path: string
}

const pad = (s: string, n: number) => s.padEnd(n)

// The lines of the staging logins sheet, kept apart from the command that makes the logins so the layout has one home
export function loginSheetLines(opts: {
  made: string
  site: string
  logins: SheetLogin[]
  athleteRows: Array<{ name: string; email: string; password: string }>
  pinRows: Array<{ letter: string; name: string; pin: string }>
}): PdfLine[] {
  const { made, site, logins, athleteRows, pinRows } = opts
  const first = logins[0]!
  return [
    { text: 'BOSS staging test logins', style: 'title' },
    { text: `Made ${made} UTC. Running the command again makes a new sheet.`, style: 'muted' },
    { text: 'These are working logins for the staging server only. Keep this sheet private and never create these accounts on production.', style: 'muted' },
    { text: '', style: 'muted' },
    { text: 'One login for each role', style: 'heading' },
    { text: `${pad('Role', 12)}${pad('Sign in at', 19)}${pad('Email', 36)}Password`, style: 'code' },
    ...logins.map((l) => ({ text: `${pad(l.role, 12)}${pad(l.path, 19)}${pad(l.email, 36)}${l.password}`, style: 'code' as const })),
    { text: '', style: 'muted' },
    { text: `Open the site at ${site} followed by the path shown, for example ${site}${first.path}`, style: 'muted' },
    { text: 'The admin is a second admin account, as well as the one you made. Staff roles sign in at the staff page. The coach and team are already linked to a record,', style: 'muted' },
    { text: 'so their dancers, results and entries show. The athlete is Bianca Alcantara, a dancer on Naga Rhythm Studio.', style: 'muted' },
    { text: 'The barker sees the round on the floor and the next event, with back numbers and names, once a competition has a running order.', style: 'muted' },
    { text: '', style: 'muted' },
    { text: `Athletes: all ${athleteRows.length}`, style: 'heading' },
    { text: `Sign in at /login?as=athlete. Each athlete is also a solo dancer on a test team.`, style: 'muted' },
    { text: `${pad('Athlete', 22)}${pad('Email', 40)}Password`, style: 'code' },
    ...athleteRows.map((a) => ({ text: `${pad(a.name, 22)}${pad(a.email, 40)}${a.password}`, style: 'code' as const })),
    { text: '', style: 'muted' },
    { text: `Adjudicators: all ${pinRows.length}`, style: 'heading' },
    { text: `Open ${site}/adjudicator on a phone and type the PIN. The same PINs work for every test competition.`, style: 'muted' },
    { text: `${pad('Letter', 8)}${pad('Adjudicator', 36)}PIN`, style: 'code' },
    ...pinRows.map((r) => ({ text: `${pad(r.letter, 8)}${pad(r.name, 36)}${r.pin}`, style: 'code' as const })),
    { text: '', style: 'muted' },
    { text: 'Staging lets a PIN work on any day. An adjudicator is signed in on one phone at a time: signing in on a second phone signs the first out.', style: 'muted' },
  ]
}
