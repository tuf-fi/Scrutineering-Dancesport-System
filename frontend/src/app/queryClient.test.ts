import { onlineManager } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { queryClient } from './queryClient.ts'

afterEach(() => onlineManager.setOnline(true))

describe('the app\'s query settings', () => {
  it('never pause requests because the browser says it is offline', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.networkMode).toBe('always')
    expect(defaults.mutations?.networkMode).toBe('always')
  })

  it('send a mutation even while the library believes the browser is offline', async () => {
    onlineManager.setOnline(false)
    let sent = false
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async () => (sent = true) })
      .execute(undefined)
    expect(sent).toBe(true)
  })
})
