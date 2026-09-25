/**
 * Mock-Handle (Blueprint §6): fängt Schreibzugriffe ab und liefert den
 * zuletzt vollständig geschriebenen Text – Ersatz für die nur im Browser
 * testbaren File-System-Access-Handles.
 */

import type { WritableHandle } from '../../../src/storage/fileAccess'

export interface MockFileHandle extends WritableHandle {
  /** Zuletzt vollständig geschriebener (geschlossener) Text oder null. */
  getWrittenText(): string | null
  /** Anzahl abgeschlossener Schreibvorgänge. */
  getWriteCount(): number
}

export function createMockFileHandle(
  name = 'finance-data.json',
  options: { failWrites?: boolean } = {},
): MockFileHandle {
  let writtenText: string | null = null
  let writeCount = 0
  return {
    name,
    getWrittenText: () => writtenText,
    getWriteCount: () => writeCount,
    createWritable: () => {
      if (options.failWrites) {
        return Promise.reject(new Error('Mock-Schreibfehler (z. B. gesperrte Datei)'))
      }
      let buffer = ''
      return Promise.resolve({
        write: (data: string) => {
          buffer += data
          return Promise.resolve()
        },
        close: () => {
          writtenText = buffer
          writeCount += 1
          return Promise.resolve()
        },
      })
    },
  }
}
