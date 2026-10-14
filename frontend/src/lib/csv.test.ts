import { describe, expect, it } from 'vitest'
import { parseCompetitorCsv } from './csv.ts'

describe('parseCompetitorCsv', () => {
  it('reads solo and couple rows and skips the header and blank lines', () => {
    const rows = parseCompetitorCsv('Dancer 1,Dancer 2,Club\r\nMia Cruz,,Naga Dance Academy\n\nAna Uy, Leo Co ,Legazpi Ballroom Club\n')
    expect(rows).toEqual([
      { names: ['Mia Cruz'], clubName: 'Naga Dance Academy' },
      { names: ['Ana Uy', 'Leo Co'], clubName: 'Legazpi Ballroom Club' },
    ])
  })

  it('keeps commas, quotes and line breaks inside quoted fields', () => {
    const rows = parseCompetitorCsv('"Cruz, Mia",,"Naga ""Elite"", Dance Academy"\n"Ana\nUy",Leo Co,Club')
    expect(rows).toEqual([
      { names: ['Cruz, Mia'], clubName: 'Naga "Elite", Dance Academy' },
      { names: ['Ana\nUy', 'Leo Co'], clubName: 'Club' },
    ])
  })

  it('returns nothing for an empty file', () => {
    expect(parseCompetitorCsv('')).toEqual([])
  })
})
