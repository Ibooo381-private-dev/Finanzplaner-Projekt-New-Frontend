import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Ohne Vitest-Globals läuft das automatische RTL-Cleanup nicht – daher explizit.
afterEach(() => {
  cleanup()
})
