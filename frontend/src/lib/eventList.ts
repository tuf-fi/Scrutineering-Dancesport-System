import type { EventListRow } from '../hooks/useEventList.ts'
import { eventCode, eventDances } from './format.ts'

export function filterEventList(rows: EventListRow[], eventId: string, query: string) {
  const needle = query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (eventId === 'all' || r.event.id === eventId) &&
      (!needle || `${r.backNumber ?? ''} ${r.names} ${r.teamName}`.toLowerCase().includes(needle)),
  )
}

const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

// Opens in Excel; the BOM keeps accented names right
export function eventListCsv(rows: EventListRow[], ageGroupLabel: (id: string) => string) {
  const head = ['Event', 'Dances', 'Age group', 'Class', 'Back number', 'Athletes', 'Team']
  const lines = rows.map((r) =>
    [eventCode(r.event), eventDances(r.event), ageGroupLabel(r.event.ageGroup), r.event.class, r.backNumber ?? '', r.names, r.teamName].map(cell).join(','),
  )
  return `﻿${[head.map(cell).join(','), ...lines].join('\r\n')}`
}

export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
