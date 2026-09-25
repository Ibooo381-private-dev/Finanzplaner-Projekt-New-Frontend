/**
 * Unit-Test der Regel-15-Datenregel (Blueprint §6, "zusätzlich klein"; DM21-Vorgriff).
 * Beispieldatei: snap-2026-07-17 ist locked → 2026-07-17 abgelehnt, 2026-08-01 erlaubt.
 * Diese Funktionen sind bewusst NICHT Teil der Datei-Ladevalidierung.
 */

import { describe, expect, it } from 'vitest'
import { checkHistoryEntryAllowed, isDateLocked } from '../../src/validation/lockedDates'
import { loadExample } from './fixtures'

describe('lockedDates – Regel 15 (G3/G4, DM21)', () => {
  const data = loadExample()

  it('2026-07-17 (gesperrter Seed-Snapshot) ist gesperrt', () => {
    expect(isDateLocked(data, '2026-07-17')).toBe(true)
  })

  it('2026-08-01 (kein Snapshot) ist nicht gesperrt', () => {
    expect(isDateLocked(data, '2026-08-01')).toBe(false)
  })

  it('checkHistoryEntryAllowed lehnt 2026-07-17 mit erklärender Meldung ab', () => {
    const issue = checkHistoryEntryAllowed(data, '2026-07-17')
    expect(issue).not.toBeNull()
    expect(issue!.code).toBe('E_LOCKED_DATE')
    expect(issue!.path).toBe('snapshots[0]')
    expect(issue!.message).toContain('2026-07-17')
    expect(issue!.message).toContain('gesperrten Snapshot')
    expect(issue!.message).toContain('neuer Snapshot')
  })

  it('checkHistoryEntryAllowed erlaubt 2026-08-01 (null)', () => {
    expect(checkHistoryEntryAllowed(data, '2026-08-01')).toBeNull()
  })

  it('ein nicht gesperrter Snapshot sperrt sein Datum nicht', () => {
    const withUnlocked = {
      ...data,
      snapshots: [...data.snapshots, { id: 'snap-2026-09-01', date: '2026-09-01', locked: false }],
    }
    expect(isDateLocked(withUnlocked, '2026-09-01')).toBe(false)
    expect(checkHistoryEntryAllowed(withUnlocked, '2026-09-01')).toBeNull()
  })
})
