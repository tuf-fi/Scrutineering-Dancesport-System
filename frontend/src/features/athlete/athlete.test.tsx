import { Role } from '@bis/shared'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { confirmMembership, getCompetitorHistory, getCompetitors, rejectMembership, requestMembership, saveMyAthlete, signUpAthlete } from '../../mocks/api.ts'
import { openMenu, renderApp } from '../../test-utils.tsx'

// jsdom cannot decode or draw pictures, so the resizing helper is faked
vi.mock('../../lib/image.ts', () => ({ screenshotImage: async () => 'data:image/jpeg;base64,/9j/', squarePhoto: async () => 'data:image/jpeg;base64,/9j/' }))
const SHOT = 'data:image/jpeg;base64,/9j/'
const screenshot = () => new File(['x'], 'pay.png', { type: 'image/png' })

describe('athlete account', () => {
  it('signs up, fills in details and sends a membership payment, and the secretariat confirms it', async () => {
    renderApp('/athlete')
    expect(await screen.findByRole('heading', { name: 'Athlete sign-in' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ana Lim')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(screen.getByText('At least 8 characters', { exact: false })).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Add a photo.')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Ana Lim' })).toBeInTheDocument()
    expect(await screen.findByText('Not paid')).toBeInTheDocument()

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'Edit account' }))
    await userEvent.type(await screen.findByLabelText('Contact no.'), '0917')
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'Membership' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Send a screenshot of your payment.')).toBeInTheDocument()
    await userEvent.upload(screen.getByLabelText('Payment screenshot'), screenshot())
    await userEvent.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Waiting for the secretariat')).toBeInTheDocument()

    cleanup()
    renderApp('/secretariat/athletes', Role.Secretariat)
    expect(await screen.findByText('Ana Lim')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm membership of Ana Lim' }))
    expect(await screen.findByText('Confirmed Ana Lim')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm membership of Ana Lim' })).not.toBeInTheDocument()
  })

  it('lets the secretariat turn a payment down with a reason', async () => {
    renderApp('/athlete')
    await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'Ben Reyes')
    await userEvent.type(screen.getByLabelText('Email'), 'ben@test.example')
    await userEvent.type(screen.getByLabelText('Password'), 'A-long-password1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'A-long-password1')
    await userEvent.upload(screen.getByLabelText('Photo'), new File(['x'], 'me.png', { type: 'image/png' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await userEvent.click(within(await screen.findByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'Membership' }))
    await userEvent.upload(await screen.findByLabelText('Payment screenshot'), screenshot())
    await userEvent.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Waiting for the secretariat')).toBeInTheDocument()

    cleanup()
    renderApp('/secretariat/athletes', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Turn down payment of Ben Reyes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Turn down' })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'No payment found')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn down' }))
    expect(await screen.findByText('Turned down the payment of Ben Reyes')).toBeInTheDocument()
    expect(await screen.findByText('Not confirmed')).toBeInTheDocument()
  })

  it('changes the password only with the current one', async () => {
    renderApp('/athlete/password', Role.Athlete, { id: 'athlete-sample', name: 'Ana Cruz' })
    await userEvent.type(await screen.findByLabelText('Current password'), 'wrong-password')
    await userEvent.type(screen.getByLabelText('New password'), 'A-new-password1')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'A-new-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Your current password is not right.')).toBeInTheDocument()
  })

  it('keeps an athlete out of the staff screens and staff out of the athlete page', async () => {
    renderApp('/secretariat/athletes', Role.Athlete)
    expect(await screen.findByRole('navigation', { name: 'Account' })).toBeInTheDocument()
    cleanup()
    renderApp('/athlete', Role.Secretariat)
    await openMenu()
    expect(await screen.findByRole('link', { name: 'Athletes' })).toBeInTheDocument()
  })

  it('shows the results, rankings and entries of the competitors that carry the athlete name', async () => {
    let name = ''
    for (const c of await getCompetitors()) {
      if (c.names.length === 1 && (await getCompetitorHistory(c.id)).length > 0) {
        name = c.names[0]!
        break
      }
    }
    expect(name).not.toBe('')
    const session = await signUpAthlete(name, 'match@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    renderApp('/athlete/results', Role.Athlete, { id: session.id, name })
    const list = await screen.findByRole('list', { name: 'My results' })
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0)

    // A competition opens to show the events the athlete placed in
    const [first] = within(list).getAllByRole('button', { expanded: false })
    await userEvent.click(first!)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    const events = await screen.findByRole('list', { name: /^Results at / })
    expect(within(events).getAllByRole('link').length).toBeGreaterThan(0)
    await userEvent.click(first!)
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: /^Results at / })).not.toBeInTheDocument()
    cleanup()

    renderApp('/athlete/rankings', Role.Athlete, { id: session.id, name })
    expect(await screen.findByRole('list', { name: 'My rankings' })).toBeInTheDocument()
    cleanup()

    renderApp('/athlete/entries', Role.Athlete, { id: session.id, name })
    const entries = await screen.findByRole('list', { name: 'My entries' })
    // A competition opens to show the events the athlete is entered in
    const [firstCompetition] = within(entries).getAllByRole('button', { expanded: false })
    await userEvent.click(firstCompetition!)
    expect(firstCompetition).toHaveAttribute('aria-expanded', 'true')
    expect(within(await screen.findByRole('list', { name: /^Entries at / })).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('says so when nothing carries the athlete name', async () => {
    const session = await signUpAthlete('Nobody Atall', 'nobody@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    renderApp('/athlete/results', Role.Athlete, { id: session.id, name: 'Nobody Atall' })
    expect(await screen.findByText('No results yet')).toBeInTheDocument()
  })

  it('keeps a history of payments and a notice for a team change that waits for the secretariat', async () => {
    const session = await signUpAthlete('Eve Dela Cruz', 'eve@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    const teamId = (await (await import('../../mocks/api.ts')).getTeams())[0]!.id
    const otherTeam = (await (await import('../../mocks/api.ts')).getTeams())[1]!.id
    await saveMyAthlete(session.id, { name: 'Eve Dela Cruz', birthDate: '2015-01-01', phone: '0917', address: '', province: '', teamId, coachId: null })
    await saveMyAthlete(session.id, { name: 'Eve Dela Cruz', birthDate: '2015-01-01', phone: '0917', address: '', province: '', teamId: otherTeam, coachId: null })
    await requestMembership(session.id, { method: 'GCash', receipt: SHOT })

    renderApp('/athlete/payments', Role.Athlete, { id: session.id, name: 'Eve Dela Cruz' })
    const history = await screen.findByRole('list', { name: 'Payment history' })
    expect(within(history).getByText('GCash')).toBeInTheDocument()
    cleanup()

    renderApp('/athlete/notifications', Role.Athlete, { id: session.id, name: 'Eve Dela Cruz' })
    // Her details are filled in and a payment is waiting, so there is nothing to do yet and nothing new to read
    expect(await screen.findByText('Nothing yet')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'To do' })).not.toBeInTheDocument()
  })

  it('shows a new notification as it happens, with a count on the bell', async () => {
    const session = await signUpAthlete('Gia Reyes', 'gia@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    await requestMembership(session.id, { method: 'GCash', receipt: SHOT })
    renderApp('/athlete/notifications', Role.Athlete, { id: session.id, name: 'Gia Reyes' })
    expect(await screen.findByText('Nothing yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()

    // The secretariat confirms the payment while the page is open
    await confirmMembership('staff-admin', session.id)
    // It is in the list, and it pops up as well
    expect((await screen.findAllByText('Your 2026 membership was confirmed')).length).toBe(2)
    expect(screen.getByRole('button', { name: 'Notifications, 1 new' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('opens the bell with the latest notifications', async () => {
    const session = await signUpAthlete('Hal Torres', 'hal@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    await requestMembership(session.id, { method: 'Maya', receipt: SHOT })
    await rejectMembership('staff-admin', session.id, 'Screenshot is blurry')
    renderApp('/athlete', Role.Athlete, { id: session.id, name: 'Hal Torres' })
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 new' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Your membership payment was not confirmed')).toBeInTheDocument()
    expect(within(menu).getByText('Screenshot is blurry')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('button', { name: 'Mark all read' }))
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('lets the secretariat approve a team change', async () => {
    const session = await signUpAthlete('Fay Ocampo', 'fay@test.example', 'A-long-password1', 'data:image/png;base64,iVBORw0KGgo=')
    const { getTeams } = await import('../../mocks/api.ts')
    const [first, second] = await getTeams()
    const input = { name: 'Fay Ocampo', birthDate: '2015-01-01', phone: '0917', address: '', province: '', coachId: null }
    await saveMyAthlete(session.id, { ...input, teamId: first!.id })
    await saveMyAthlete(session.id, { ...input, teamId: second!.id })

    renderApp('/secretariat/profile-changes', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Approve change of team or coach of Fay Ocampo' }))
    expect(await screen.findByText('Approved the change for Fay Ocampo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve change of team or coach of Fay Ocampo' })).not.toBeInTheDocument()
  })

  it('signs out on every device from the security page', async () => {
    renderApp('/athlete/password', Role.Athlete, { id: 'athlete-sample', name: 'Ana Cruz' })
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }))
    expect(await screen.findByRole('heading', { name: 'Athlete sign-in' })).toBeInTheDocument()
  })
})
