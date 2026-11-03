import { describe, expect, it } from 'vitest'
import { parseCompetitorCsv } from './csv.ts'

describe('parseCompetitorCsv', () => {
  it('reads solo and couple rows and skips the header and blank lines', () => {
    const rows = parseCompetitorCsv('Dancer 1,Dancer 2,Team\r\nMia Cruz,,Naga Dance Academy\n\nAna Uy, Leo Co ,Legazpi Ballroom Club\n')
    expect(rows).toEqual([
      { names: ['Mia Cruz'], teamName: 'Naga Dance Academy' },
      { names: ['Ana Uy', 'Leo Co'], teamName: 'Legazpi Ballroom Club' },
    ])
  })

  it('keeps commas, quotes and line breaks inside quoted fields', () => {
    const rows = parseCompetitorCsv('"Cruz, Mia",,"Naga ""Elite"", Dance Academy"\n"Ana\nUy",Leo Co,Team')
    expect(rows).toEqual([
      { names: ['Cruz, Mia'], teamName: 'Naga "Elite", Dance Academy' },
      { names: ['Ana\nUy', 'Leo Co'], teamName: 'Team' },
    ])
  })

  it('returns nothing for an empty file', () => {
    expect(parseCompetitorCsv('')).toEqual([])
  })
})
