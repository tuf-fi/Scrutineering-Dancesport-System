import { useEffect } from 'react'

export const SITE_NAME = 'Bicol Oragon Scrutineering System'
export const SITE_TITLE = `${SITE_NAME} | Dancesport results and rankings`

// The browser tab and search results show the page's own name before the site's
export function useDocumentTitle(page: string | null | undefined) {
  useEffect(() => {
    if (page === undefined) return
    document.title = page ? `${page} | ${SITE_NAME}` : SITE_TITLE
  }, [page])
}
