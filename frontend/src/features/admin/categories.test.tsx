import { Role } from '@bis/shared'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { confirmDelete, renderApp } from '../../test-utils.tsx'

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
    expect(within(dialog).queryByLabelText('Price')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Latin')).toBeChecked()
    await userEvent.click(within(dialog).getByLabelText('Standard'))
    await userEvent.click(within(dialog).getByLabelText('Email'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add kind' }))
    expect(await screen.findByText('Kind added')).toBeInTheDocument()
    expect(await screen.findByText('School cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit School cup' }))
    dialog = await dialogFor('Edit kind')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('School cup')
    expect(within(dialog).getByLabelText('Email')).toBeChecked()
    expect(within(dialog).getByLabelText('Latin')).toBeChecked()
    expect(within(dialog).getByLabelText('Standard')).not.toBeChecked()
    const name = within(dialog).getByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Inter-school cup')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Kind updated')).toBeInTheDocument()
    expect(await screen.findByText('Inter-school cup')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Inter-school cup' }))
    dialog = await dialogFor('Delete Inter-school cup?')
    await confirmDelete(dialog)
    expect(await screen.findByText('Deleted Inter-school cup')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Inter-school cup')).not.toBeInTheDocument())
  })

  it('lists the events that go with a kind before deleting it', async () => {
    renderApp('/admin/categories', Role.Admin)
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Standard' }))
    const dialog = await dialogFor('Delete Standard?')
    expect(await within(dialog).findByText('Will be deleted')).toBeInTheDocument()
    expect(within(dialog).getByText('Events')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete everything' })).toBeInTheDocument()
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
    await userEvent.type(within(dialog).getByLabelText('Born from'), '19')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add age group' }))
    expect(await within(dialog).findByText('Enter a year, like 2012.')).toBeInTheDocument()

    const from = within(dialog).getByLabelText('Born from')
    await userEvent.clear(from)
    await userEvent.type(from, '1992')
    // Another group may cover the same years: the Adult group already starts in 1992
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add age group' }))
    expect(await screen.findByText('Age group added')).toBeInTheDocument()
    expect(await screen.findByText('Masters')).toBeInTheDocument()
  })
})
