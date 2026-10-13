import { Role } from '@bis/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

const bodyRows = () => screen.getAllByRole('row').slice(1)

// Signs a brand new club up through the form, so each test works on its own records
async function registerClub(name: string) {
  const router = renderApp('/club/sign-up')
  await userEvent.type(await screen.findByLabelText('Club name'), name)
  await userEvent.type(screen.getByLabelText('Contact person'), 'Test Person')
  await userEvent.type(screen.getByLabelText('Email'), `${name.toLowerCase().replace(/\W+/g, '')}@example.com`)
  await userEvent.type(screen.getByLabelText('Mobile number'), '0917 123 4567')
  await userEvent.type(screen.getByLabelText('Password'), 'longenough1')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByRole('heading', { name: 'Dancers' })
  return router
}

async function addDancer(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Add dancer' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add dancer' })
  await userEvent.type(within(dialog).getByLabelText('Dancer'), name)
  await userEvent.selectOptions(within(dialog).getByLabelText('Age group'), 'junior_1')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add dancer' }))
  expect(await screen.findByText('Dancer added')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('club sign-up', () => {
  it('validates, then creates the club and signs it in', async () => {
    renderApp('/club/sign-up')
    await userEvent.type(await screen.findByLabelText('Club name'), 'Short Pass Club')
    await userEvent.type(screen.getByLabelText('Contact person'), 'Test Person')
    await userEvent.type(screen.getByLabelText('Email'), 'shortpass@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Use a password of at least 8 characters.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Dancers' })).toBeInTheDocument()
    expect(await screen.findByText('No dancers yet')).toBeInTheDocument()
  })

  it('refuses a club that already exists', async () => {
    renderApp('/club/sign-up')
    await userEvent.type(await screen.findByLabelText('Club name'), 'Another Name')
    await userEvent.type(screen.getByLabelText('Contact person'), 'Test Person')
    await userEvent.type(screen.getByLabelText('Email'), 'club1@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'longenough1')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/already exists/)).toBeInTheDocument()
  })
})

describe('club dancers', () => {
  it('adds, edits and deletes a dancer, asking only for a name and an age group', async () => {
    await registerClub('Dancer Club')
    await userEvent.click(await screen.findByRole('button', { name: 'Add dancer' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add dancer' })
    expect(within(dialog).queryByLabelText(/birth|address|phone/i)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add dancer' }))
    expect(await within(dialog).findByText('Choose the age group.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Dancer'), 'Mia Tester')
    await userEvent.selectOptions(within(dialog).getByLabelText('Age group'), 'junior_1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add dancer' }))
    expect(await screen.findByText('Dancer added')).toBeInTheDocument()
    expect(await screen.findByText('Mia Tester')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit Mia Tester' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit dancer' })
    const name = within(edit).getByLabelText('Dancer')
    await userEvent.clear(name)
    await userEvent.type(name, 'Mia Fixed')
    await userEvent.click(within(edit).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Dancer updated')).toBeInTheDocument()
    expect(await screen.findByText('Mia Fixed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Mia Fixed' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted Mia Fixed')).toBeInTheDocument()
    expect(await screen.findByText('No dancers yet')).toBeInTheDocument()
  })
})

describe('club entries and payment', () => {
  it('registers a dancer with a running total, then pays with a receipt', async () => {
    const router = await registerClub('Pay Club')
    await addDancer('Leo Payer')

    await userEvent.click(screen.getByRole('link', { name: 'Events' }))
    await screen.findByRole('heading', { name: 'Events' })
    const total = await screen.findByLabelText('Fee total')
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/₱/))
    expect(total).toHaveTextContent('0 events')
    expect(total).toHaveTextContent(/Your club owes\s*₱0/)

    const boxes = screen.getAllByRole('checkbox')
    await userEvent.click(boxes[0])
    await userEvent.click(boxes[1])
    expect(total).toHaveTextContent('2 events · ₱1,000')
    expect(total).toHaveTextContent(/Your club owes\s*₱1,000/)
    await userEvent.click(screen.getByRole('button', { name: 'Save entries' }))
    expect(await screen.findByText('Entries saved for Leo Payer')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Go to payment' }))
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument()
    const due = await screen.findByRole('region', { name: 'Amount due' })
    expect(within(due).getByText('₱1,000')).toBeInTheDocument()
    expect(within(due).getByText('Unpaid')).toBeInTheDocument()
    expect(await screen.findByText('GCash')).toBeInTheDocument()
    expect(screen.getByText('Maya')).toBeInTheDocument()
    expect(screen.getByText('Bank transfer')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send for checking' }))
    expect(await screen.findByText('Enter the reference number from your receipt.')).toBeInTheDocument()
    expect(screen.getByText('Upload a screenshot of your receipt.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Reference number'), 'GC1234567890')
    const file = new File(['fake'], 'receipt.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('Screenshot of your receipt'), file)
    expect(await screen.findByText('receipt.png')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send for checking' }))

    expect(await screen.findByText('Payment sent for checking')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Amount due' })).getByText('For checking')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Send for checking' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/club/payments')
  })

  it('rejects a non-image receipt', async () => {
    await registerClub('Image Club')
    await addDancer('Ana Imager')
    await userEvent.click(screen.getByRole('link', { name: 'Events' }))
    await waitFor(() => expect(bodyRows()[0]).toHaveTextContent(/₱/))
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await userEvent.click(screen.getByRole('button', { name: 'Save entries' }))
    await screen.findByText('Entries saved for Ana Imager')
    await userEvent.click(screen.getByRole('link', { name: 'Go to payment' }))
    const input = await screen.findByLabelText('Screenshot of your receipt')
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })
    expect(await screen.findByText('Upload an image of the receipt.')).toBeInTheDocument()
  })

  it('shows the reason when a payment was rejected', async () => {
    renderApp('/club/payments', Role.Club, { id: 'club-3', name: 'Juban Galaw DanceSport Team' })
    const due = await screen.findByRole('region', { name: 'Amount due' })
    expect(await within(due).findByText('Rejected')).toBeInTheDocument()
    expect(within(due).getByRole('alert')).toHaveTextContent('Amount sent does not match the GCash record.')
    expect(screen.getByRole('button', { name: 'Send for checking' })).toBeInTheDocument()
  })
})
