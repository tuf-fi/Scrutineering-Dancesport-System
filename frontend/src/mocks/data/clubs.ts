import type { Club } from '@bis/shared'

const rows: Array<[string, string]> = [
  ['Sorsogon DanceSport Team', 'Marites Dela Cruz'],
  ['TME DanceSport League', 'Rolando Evangelista'],
  ['Juban Galaw DanceSport Team', 'Aileen Gonzales'],
  ['CCDI Kasanggayahan DanceSport', 'Benedict Alcantara'],
  ['Legazpi Ballroom Club', 'Corazon Bautista'],
  ['Naga Dance Academy', 'Ferdinand Ocampo'],
  ['Albay Rhythm Studio', 'Lorna Villanueva'],
  ['Masbate Movers DanceSport', 'Ernesto Magbanua'],
]

export const clubs: Club[] = rows.map(([name, contactName], i) => ({
  id: `club-${i + 1}`,
  name,
  contactName,
  contactEmail: `club${i + 1}@example.com`,
  contactPhone: `0917 000 ${String(1100 + i * 37).padStart(4, '0')}`,
}))
