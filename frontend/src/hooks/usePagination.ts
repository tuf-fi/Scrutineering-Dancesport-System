import { useState } from 'react'

// Every list in BIS shows at most this many rows at a time
export const PAGE_SIZE = 10

// Splits a list into pages. `resetKey` should change whenever a filter or search changes,
// so the list goes back to the first page.
export function usePagination<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [lastKey, setLastKey] = useState(resetKey)
  if (resetKey !== lastKey) {
    setLastKey(resetKey)
    setPage(1)
  }

  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(page, pages)
  return {
    page: current,
    setPage,
    pageSize,
    total: items.length,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
  }
}
