import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Без globals в vitest Testing Library сама DOM не чистит
afterEach(() => {
  cleanup()
})
