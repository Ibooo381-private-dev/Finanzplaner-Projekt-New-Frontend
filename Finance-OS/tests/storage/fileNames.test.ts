/**
 * Formattests für Dateinamen (Blueprint §6, "zusätzlich klein").
 * Erwartungswerte: exportFileName → "finance-data-JJJJ-MM-TT.json",
 * backupFileName → "finance-data-backup-JJJJ-MM-TT-HHmm.json" (lokale Zeit).
 */

import { describe, expect, it } from 'vitest'
import { backupFileName, exportFileName } from '../../src/storage/fileNames'

describe('fileNames – Namensschemata (M3/M5)', () => {
  it('exportFileName: finance-data-2026-07-19.json', () => {
    // Lokale Zeit: 19.07.2026 (Monat 6 = Juli, 0-basiert).
    expect(exportFileName(new Date(2026, 6, 19, 10, 30))).toBe('finance-data-2026-07-19.json')
  })

  it('exportFileName füllt Monat/Tag zweistellig auf', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toBe('finance-data-2026-01-05.json')
  })

  it('backupFileName: finance-data-backup-2026-07-19-1030.json', () => {
    expect(backupFileName(new Date(2026, 6, 19, 10, 30))).toBe(
      'finance-data-backup-2026-07-19-1030.json',
    )
  })

  it('backupFileName füllt Stunde/Minute zweistellig auf', () => {
    expect(backupFileName(new Date(2026, 11, 3, 7, 5))).toBe(
      'finance-data-backup-2026-12-03-0705.json',
    )
  })
})
