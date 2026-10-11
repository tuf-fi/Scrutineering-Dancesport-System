import type { Competition } from '@bis/shared'

export const currentCompetitionId = 'comp-sorsogon-2026'

export const competitions: Competition[] = [
  {
    id: currentCompetitionId,
    name: 'Sorsogon Dancesport Open 2026',
    date: '2026-10-10',
    venue: 'Sorsogon Provincial Gymnasium, Sorsogon City',
    organizer: 'BN IT Scrutineer',
  },
  {
    id: 'comp-legazpi-2026',
    name: 'Legazpi Dancesport Cup 2026',
    date: '2026-06-13',
    venue: 'Legazpi City Convention Center, Legazpi City',
    organizer: 'Albay Dancesport Council',
  },
  {
    id: 'comp-naga-2025',
    name: 'Naga Dancesport Invitational 2025',
    date: '2025-11-22',
    venue: 'Naga City Coliseum, Naga City',
    organizer: 'Camarines Sur Dancesport Association',
  },
]
