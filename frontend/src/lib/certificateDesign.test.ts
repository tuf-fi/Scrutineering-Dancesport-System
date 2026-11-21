import { describe, expect, it } from 'vitest'
import { certificateDesign } from './certificateDesign.ts'

describe('importing a certificate design', () => {
  it('takes only JPG, PNG, WebP and PDF files', async () => {
    await expect(certificateDesign(new File(['x'], 'design.gif', { type: 'image/gif' }))).rejects.toThrow('JPG, PNG, WebP or PDF')
    await expect(certificateDesign(new File(['x'], 'design.json', { type: 'application/json' }))).rejects.toThrow('JPG, PNG, WebP or PDF')
  })

  it('refuses a file over 10 MB', async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'design.png', { type: 'image/png' })
    await expect(certificateDesign(big)).rejects.toThrow('10 MB')
  })
})
