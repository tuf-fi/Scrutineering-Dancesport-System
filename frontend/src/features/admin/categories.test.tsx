import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test-utils.tsx'

// The sample data is shared across tests in this file, so each test uses its own records

const dialogFor = (name: string) => screen.findByRole('dialog', { name })

describe('event kinds', () => {
  it('lists the built-in kinds, then adds, renames and deletes one', async () => {
    renderApp('/admin/categories', Role.Admin)
    expect(await screen.findByText('Beginners (BGB)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New kind' }))
    let dialog = await dialogFor('New kind')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add kind' }))
    expect(await within(dialog).findByText('Enter the name of the kind.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Name'), 'School cup')
    await userEvent.selectOptions(within(dialog).getByLabelText('Price'), 'couple_older')
    await userEvent.click(within(dialog).getByLabelText('Email'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add kind' }))
    expect(await screen.findByText('Kind added')).toBeInTheDocument()
    expect(await screen.findByText('School cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit School cup' }))
    dialog = await dialogFor('Edit kind')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('School cup')
    expect(within(dialog).getByLabelText('Email')).toBeChecked()
    const name = within(dialog).getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Inter-school cup')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Kind updated')).toBeInTheDocument()
    expect(await screen.findByText('Inter-school cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Inter-school cup' }))
    dialog = await dialogFor('Delete Inter-school cup?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Deleted Inter-school cup')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Inter-school cup')).not.toBeInTheDocument())
  })

  it('refuses to delete a kind that events use, and says why', async () => {
    renderApp('/admin/categories', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Standard' }))
    const dialog = await dialogFor('Delete Standard?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText(/Standard is used by \d+ events?, so it can't be deleted/)).toBeInTheDocument()
  })
})

describe('age groups', () => {
  it('adds an age group in order and uses its name in the event form', async () => {
    renderApp('/admin/categories', Role.Admin)
    await userEvent.click(await screen.findByRole('tab', { name: 'Age groups' }))
    expect(await screen.findByText('Juvenile 1')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New age group' }))
    const dialog = await dialogFor('New age group')
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Masters')
    await userEvent.type(within(dialog).getByLabelText('Printed as'), 'MST')
    await userEvent.type(within(dialog).getByLabelText('Oldest age'), '34')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add age group' }))
    expect(await within(dialog).findByText('Another age group already ends at 34.')).toBeInTheDocument()

    const age = within(dialog).getByLabelText('Oldest age')
    await userEvent.clear(age)
    await userEvent.type(age, '44')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add age group' }))
    expect(await screen.findByText('Age group added')).toBeInTheDocument()
    expect(await screen.findByText('Masters')).toBeInTheDocument()
  })
})
