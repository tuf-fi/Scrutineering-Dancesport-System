import { Role } from '@bis/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { competitorName } from '../../lib/format.ts'
import { currentCompetitionId } from '../../mocks/data/competitions.ts'
import { ageGroupOf, competitors } from '../../mocks/data/competitors.ts'
import { entries } from '../../mocks/data/entries.ts'
import { events } from '../../mocks/data/events.ts'
import { renderApp } from '../../test-utils.tsx'

// The sample data is shared across tests in this file, so each test uses its own records

// Role queries are slow on a big table, and a test that polls them can time out when the machine is busy
const bodyRows = () => Array.from(document.querySelectorAll<HTMLElement>('tbody tr'))

describe('events', () => {
  it('lists events 10 at a time with entry counts, filters, and opens one', async () => {
    renderApp('/secretariat', Role.Secretariat)
    await screen.findByRole('link', { name: 'E1' })
    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByText(/^1–10$/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'senior')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'E1' })).not.toBeInTheDocument())
    expect(bodyRows().length).toBe(9)
    await userEvent.selectOptions(screen.getByLabelText('Age group'), 'all')

    await userEvent.click(await screen.findByRole('link', { name: 'E1' }))
    expect(await screen.findByRole('heading', { name: /^E1 / })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Heat list' })).toHaveAttribute('href', expect.stringMatching(/\/print\/heats\//))
    expect(screen.getByRole('link', { name: 'Recall list' })).toHaveAttribute('href', expect.stringMatching(/\/print\/recall\//))
  })

  it('scratches an entry after confirming, then restores it', async () => {
    renderApp('/secretariat', Role.Secretariat)
    await userEvent.click(await screen.findByRole('link', { name: 'E2' }))
    const scratch = (await screen.findAllByRole('button', { name: /^Scratch / }))[0]
    const name = scratch.getAttribute('aria-label')!.replace('Scratch ', '')

    await userEvent.click(scratch)
    const dialog = await screen.findByRole('dialog', { name: /^Scratch / })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Scratch' }))
    expect(await screen.findByText(`Scratched ${name}`)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: `Restore ${name}` }))
    expect(await screen.findByText(`Restored ${name}`)).toBeInTheDocument()
  })
})

describe('competitors', () => {
  it('shows only the dancers entered in the chosen competition and event', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await screen.findByRole('columnheader', { name: 'Club' })
    await waitFor(() => expect(bodyRows().length).toBe(10))
    const allCount = screen.getByText(/^Showing /).textContent

    const competition = screen.getByLabelText('Competition')
    await userEvent.selectOptions(competition, within(competition).getByRole('option', { name: 'Sorsogon Dancesport Open 2026' }))
    await screen.findByLabelText('Event')
    await screen.findByRole('columnheader', { name: 'Events' })
    await waitFor(() => expect(screen.getByText(/^Showing /).textContent).not.toBe(allCount))

    const event = screen.getByLabelText('Event')
    await waitFor(() => expect(within(event).getAllByRole('option').length).toBeGreaterThan(1))
    await userEvent.selectOptions(event, within(event).getAllByRole('option')[1])
    await waitFor(() => {
      const rows = bodyRows()
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) expect(within(row).getAllByText(/E1/).length).toBeGreaterThan(0)
    })
  })

  it('adds a competitor, assigns the missing back number, and rejects a taken one', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Add competitor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add competitor' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add competitor' }))
    expect(await within(dialog).findByText('Choose a club.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Dancer'), 'Zed Testerson')
    const club = within(dialog).getByLabelText('Club')
    await userEvent.selectOptions(club, within(club).getAllByRole('option')[1])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add competitor' }))
    expect(await screen.findByText('Added Zed Testerson')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Assign 1 back number' }))
    expect(await screen.findByText('Assigned 1 back number')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Assign / })).not.toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Search competitors'), 'Zed Testerson')
    await userEvent.click(await screen.findByRole('button', { name: 'Set back number for Zed Testerson' }))
    const numberDialog = await screen.findByRole('dialog', { name: 'Back number' })
    const field = within(numberDialog).getByLabelText('Back number')
    await userEvent.clear(field)
    await userEvent.type(field, '1')
    await userEvent.click(within(numberDialog).getByRole('button', { name: 'Save' }))
    expect(await within(numberDialog).findByText(/Back number 1 is already taken/)).toBeInTheDocument()
  })

  it('imports a CSV and reports the rows it skipped', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Import CSV' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import competitors' })

    const file = new File(['Dancer 1,Dancer 2,Club\nCsv Person,,Naga Dance Academy\nNo Club,,Nowhere Club\n'], 'people.csv', {
      type: 'text/csv',
    })
    await userEvent.upload(within(dialog).getByLabelText('CSV file'), file)
    expect(await within(dialog).findByText('2 rows found')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import 2' }))

    expect(await within(dialog).findByText('1 imported, 1 skipped.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Unknown club "Nowhere Club"/)).toBeInTheDocument()
  })
})

describe('editing and removing', () => {
  it('adds, edits and deletes an event, and refuses to delete one with entries', async () => {
    renderApp('/secretariat', Role.Secretariat)
    await screen.findByRole('link', { name: 'E1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Add event' }))
    let dialog = await screen.findByRole('dialog', { name: 'Add event' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add event' }))
    expect(await within(dialog).findByText('Choose at least one dance.')).toBeInTheDocument()

    expect(within(dialog).getByLabelText('Event number')).toHaveValue('55')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Samba' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add event' }))
    expect(await screen.findByText('Added E55')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search events'), 'E55')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit E55' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit E55' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Jive' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Saved E55')).toBeInTheDocument()
    expect(await screen.findByText('Samba, Jive')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete E55' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted E55')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Search events'))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete E1' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/has entries or rounds/)).toBeInTheDocument()
  })

  it('edits and deletes a competitor, and refuses to delete one who has entries', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Add competitor' }))
    let dialog = await screen.findByRole('dialog', { name: 'Add competitor' })
    await userEvent.type(within(dialog).getByLabelText('Dancer'), 'Edna Fixable')
    const club = within(dialog).getByLabelText('Club')
    await userEvent.selectOptions(club, within(club).getAllByRole('option')[1])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add competitor' }))
    await screen.findByText('Added Edna Fixable')

    await userEvent.type(screen.getByLabelText('Search competitors'), 'Edna')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Edna Fixable' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit competitor' })
    const name = within(dialog).getByLabelText('Dancer')
    expect(name).toHaveValue('Edna Fixable')
    await userEvent.clear(name)
    await userEvent.type(name, 'Edna Fixed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Saved Edna Fixed')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Edna Fixed' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted Edna Fixed')).toBeInTheDocument()

    // Someone with entries cannot be deleted
    await userEvent.clear(screen.getByLabelText('Search competitors'))
    await waitFor(() => expect(bodyRows().length).toBe(10))
    const withEntries = bodyRows().find((r) => within(r).queryByText(/^[1-9]\d*$/, { selector: 'td.text-right' }))
    const label = within(withEntries!).getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith('Delete '))!
    await userEvent.click(label)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/has entries/)).toBeInTheDocument()
  })

  it('opens a read-only modal with every column when a row is clicked', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await screen.findByRole('columnheader', { name: 'Club' })
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/\d/))
    await userEvent.click(bodyRows()[0].querySelectorAll('td')[1])
    const dialog = await screen.findByRole('dialog')
    for (const label of ['Back no.', 'Competitor', 'Club', 'Entries']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument()
    }
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('edits a late entry to unpaid, then removes it', async () => {
    renderApp('/secretariat/late-entries', Role.Secretariat)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/₱/))
    const before = bodyRows().length
    const edit = (await screen.findAllByRole('button', { name: /^Edit late entry for / }))[0]
    const who = edit.getAttribute('aria-label')!.replace('Edit late entry for ', '')

    await userEvent.click(edit)
    const dialog = await screen.findByRole('dialog', { name: 'Edit late entry' })
    expect(within(dialog).getByText(who)).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText('Payment'), 'later')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(`Late entry saved for ${who}`)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: `Remove late entry for ${who}` }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText(`Removed late entry for ${who}`)).toBeInTheDocument()
    await waitFor(() => expect(bodyRows().length).toBe(before - 1))
  })
})

describe('late entries', () => {
  it('shows the sample late entries with their payment status', async () => {
    renderApp('/secretariat/late-entries', Role.Secretariat)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/₱/))
    expect(screen.getAllByText('Paid at venue').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unpaid').length).toBeGreaterThan(0)
  })

  it('adds a late entry paid in cash and lists it', async () => {
    renderApp('/secretariat/late-entries', Role.Secretariat)
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/₱/))
    const before = bodyRows().length
    await userEvent.click(await screen.findByRole('button', { name: 'Add late entry' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add late entry' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add entry' }))
    expect(await within(dialog).findByText('Choose the event.')).toBeInTheDocument()

    const event = within(dialog).getByLabelText('Event')
    await waitFor(() => expect(within(event).getAllByRole('option').length).toBeGreaterThan(1))
    await userEvent.selectOptions(event, within(event).getAllByRole('option')[1])
    await userEvent.type(within(dialog).getByLabelText('Competitor'), 'a')
    const results = await within(dialog).findByRole('list', { name: 'Matching competitors' })
    await userEvent.click(within(results).getAllByRole('button')[0])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText(/^Late entry added for /)).toBeInTheDocument()
    await waitFor(() => expect(bodyRows().length).toBe(before + 1))
  })

  it('records a cash payment for a club that has not paid', async () => {
    renderApp('/secretariat/late-entries', Role.Secretariat)
    await userEvent.click(await screen.findByRole('tab', { name: 'Cash payments' }))
    const buttons = await screen.findAllByRole('button', { name: /^Mark .* paid at venue$/ })
    const club = buttons[0].getAttribute('aria-label')!.replace(/^Mark | paid at venue$/g, '')

    await userEvent.click(buttons[0])
    const dialog = await screen.findByRole('dialog', { name: /^Record / })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(`${club} marked as paid at the venue`)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: `Mark ${club} paid at venue` })).not.toBeInTheDocument())
  })
})

describe('schedule', () => {
  it('moves an event down and keeps the first event from moving up', async () => {
    renderApp('/secretariat/schedule', Role.Secretariat)
    expect(await screen.findByRole('button', { name: 'Move E1 up' })).toBeDisabled()
    const first = bodyRows()[0]
    expect(within(first).getByText('E1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Move E1 down' }))
    await waitFor(() => expect(within(bodyRows()[1]).getByText('E1')).toBeInTheDocument())
    expect(within(bodyRows()[0]).getByText('E2')).toBeInTheDocument()
  })
})

describe('program', () => {
  it('starts empty, generates from the events, sets the start time and adds a break', async () => {
    renderApp('/secretariat/program', Role.Secretariat)
    expect(await screen.findByText('No program yet')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(bodyRows()).toHaveLength(10))
    expect(screen.getByRole('button', { name: 'Add missing rounds' })).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)

    const start = screen.getByLabelText('Starts at')
    fireEvent.change(start, { target: { value: '07:00' } })
    fireEvent.blur(start)
    await waitFor(() => expect(within(bodyRows()[0]).getByText('7:00 AM')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Add break' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a break' })
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Lunch')
    await userEvent.clear(within(dialog).getByLabelText('Minutes'))
    await userEvent.type(within(dialog).getByLabelText('Minutes'), '45')
    await userEvent.type(within(dialog).getByLabelText('After line'), '1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Added Lunch')).toBeInTheDocument()
    await waitFor(() => expect(within(bodyRows()[1]).getByText(/Lunch/)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Move Lunch up' }))
    await waitFor(() => expect(within(bodyRows()[0]).getByText(/Lunch/)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Move Lunch up' })).toBeDisabled()
  })

  it('refuses a break with no name and keeps the dialog open', async () => {
    renderApp('/secretariat/program', Role.Secretariat)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add break' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Add break' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a break' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Give it a name')
  })
})

describe('coaches', () => {
  it('lists the coaches and adds one', async () => {
    renderApp('/secretariat/coaches', Role.Secretariat)
    expect(await screen.findByText('Ramon Villanueva')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add coach' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add coach' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add coach' }))
    expect(await within(dialog).findByText('Enter the coach’s name.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Lito Santos')
    await userEvent.type(within(dialog).getByLabelText('Membership paid for'), '2026')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add coach' }))
    expect(await screen.findByText('Added Lito Santos')).toBeInTheDocument()
    expect(await screen.findByText('Lito Santos')).toBeInTheDocument()
  })
})

describe('registering from the entry form', () => {
  it('enters a solo dancer in an event, showing the fee and the membership', async () => {
    // A solo dancer and an event of their age group that they are not in yet
    const pick = competitors
      .filter((c) => c.names.length === 1)
      .flatMap((c) =>
        events
          .filter((e) => e.competitionId === currentCompetitionId && e.isSolo && e.ageGroup === ageGroupOf.get(c.id))
          .filter((e) => !entries.some((x) => x.eventId === e.id && x.competitorId === c.id))
          .map((e) => ({ c, e })),
      )[0]!
    const name = competitorName(pick.c.names)
    const code = `E${pick.e.number}`

    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.type(await screen.findByLabelText('Search competitors'), name)
    await userEvent.click(await screen.findByRole('button', { name: `Enter ${name} in events` }))
    const dialog = await screen.findByRole('dialog', { name: `Enter ${name}` })

    await userEvent.selectOptions(within(dialog).getByLabelText('Competition'), currentCompetitionId)
    const box = await waitFor(() => {
      const found = within(dialog)
        .getAllByRole('checkbox')
        .find((cb) => new RegExp(`^${code}(?!\d)`).test(cb.closest('label')?.textContent ?? ''))
      if (!found) throw new Error('event not listed yet')
      return found
    })
    await userEvent.click(box)
    expect(await within(dialog).findByText('Total')).toBeInTheDocument()
    expect(within(dialog).getByText('Athlete membership')).toBeInTheDocument()

    await userEvent.selectOptions(within(dialog).getByLabelText('Payment'), 'cash')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enter' }))
    expect(await screen.findByText(/^Entered in 1 event, ₱/)).toBeInTheDocument()
  })

  it('asks for at least one event', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.click((await screen.findAllByRole('button', { name: /^Enter .* in events$/ }))[0]!)
    const dialog = await screen.findByRole('dialog', { name: /^Enter / })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enter' }))
    expect(await within(dialog).findByText('Choose at least one event.')).toBeInTheDocument()
  })
})

describe('a coach who has not paid', () => {
  it('offers the coach’s fees on the entry and adds them to the total', async () => {
    renderApp('/secretariat/competitors', Role.Secretariat)
    await userEvent.click(await screen.findByRole('button', { name: 'Add competitor' }))
    const adding = await screen.findByRole('dialog', { name: 'Add competitor' })
    await userEvent.type(within(adding).getByLabelText('Dancer'), 'Coached Solo')
    const club = within(adding).getByLabelText('Club')
    await userEvent.selectOptions(club, within(club).getAllByRole('option')[1])
    await userEvent.selectOptions(within(adding).getByLabelText('Coach'), 'Ramon Villanueva')
    await userEvent.click(within(adding).getByRole('button', { name: 'Add competitor' }))
    await screen.findByText('Added Coached Solo')

    await userEvent.type(screen.getByLabelText('Search competitors'), 'Coached Solo')
    await userEvent.click(await screen.findByRole('button', { name: 'Enter Coached Solo in events' }))
    const dialog = await screen.findByRole('dialog', { name: 'Enter Coached Solo' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Competition'), currentCompetitionId)
    const box = await waitFor(() => {
      const first = within(dialog).getAllByRole('checkbox')[0]
      if (!first) throw new Error('events not listed yet')
      return first
    })
    await userEvent.click(box)
    const membership = await within(dialog).findByRole('checkbox', { name: 'Add the coach’s membership to this payment' })
    expect(within(dialog).queryByText('Coach membership')).not.toBeInTheDocument()
    await userEvent.click(membership)
    expect(await within(dialog).findByText('Coach membership')).toBeInTheDocument()
  })
})
