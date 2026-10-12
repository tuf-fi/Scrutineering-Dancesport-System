import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The fake API waits 250ms per call and role queries are slow on big pages, so allow more than 1s
configure({ asyncUtilTimeout: 4000 })

afterEach(cleanup)
