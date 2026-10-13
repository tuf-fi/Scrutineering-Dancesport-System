import { Role } from '@bis/shared'
import { screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { renderApp } from './test-utils.tsx'

// Automated accessibility checks on one screen per role. jsdom cannot judge colour contrast,
// so that rule is left to a manual pass; everything else (names, labels, roles, landmarks) is checked.
const C = 'comp-sorsogon-2026'

const screens: Array<{ name: string; path: string; role?: Role; user?: Record<string, string>; ready: () => Promise<unknown> }> = [
  { name: 'public home', path: '/', ready: () => screen.findByRole('heading', { name: 'Sorsogon Dancesport Open 2026' }) },
  { name: 'rankings', path: '/rankings', ready: () => screen.findByRole('heading', { name: /Junior I/ }) },
  { name: 'staff sign-in', path: '/login', ready: () => screen.findByRole('heading', { name: 'Sign in' }) },
  { name: 'club sign-up', path: '/club/sign-up', ready: () => screen.findByRole('heading', { name: 'Register your club' }) },
  { name: 'adjudicator PIN sign-in', path: '/adjudicator', ready: () => screen.findByRole('heading', { name: 'Enter your PIN' }) },
  { name: 'admin competitions', path: '/admin/competitions', role: Role.Admin, ready: () => screen.findByText('Legazpi Dancesport Cup 2026') },
  { name: 'admin payments', path: '/admin/payments', role: Role.Admin, ready: () => screen.findByRole('columnheader', { name: 'Club' }) },
  { name: 'secretariat events', path: '/secretariat', role: Role.Secretariat, ready: () => screen.findByRole('link', { name: 'E1' }) },
  { name: 'scrutineer rounds', path: '/scrutineer', role: Role.Scrutineer, user: { id: 'staff-scrutineer' }, ready: () => screen.findByRole('region', { name: 'On the floor' }) },
  { name: 'adjudicator marking', path: '/adjudicator/waiting', role: Role.Adjudicator, user: { id: 'adj-d', letter: 'D' }, ready: () => screen.findByText(/Mark an X for exactly/) },
  { name: 'club dancers', path: '/club', role: Role.Club, user: { id: 'club-3' }, ready: () => screen.findByRole('heading', { name: 'Dancers' }) },
  { name: 'MC screen', path: '/mc', role: Role.Mc, user: { id: 'staff-mc' }, ready: () => screen.findByText('Next to the floor') },
  { name: 'print qualified list', path: `/print/recall/${C}:e12?round=${C}:e12:round_1`, role: Role.Scrutineer, user: { id: 'staff-scrutineer' }, ready: () => screen.findByRole('heading', { name: /Qualified Solos/ }) },
]

describe('accessibility', () => {
  for (const s of screens) {
    it(`${s.name} has no automated violations`, async () => {
      renderApp(s.path, s.role, s.user)
      await s.ready()
      // Let tables and queries settle so skeletons are not what is checked
      await waitFor(() => expect(document.querySelector('[class*="animate-pulse"]')).toBeNull(), { timeout: 4000 }).catch(() => {})
      const result = await axe.run(document.body, {
        rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
      })
      const report = result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`)
      expect(report).toEqual([])
    }, 20_000)
  }
})
