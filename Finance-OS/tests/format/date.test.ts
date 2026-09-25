/**
 * Tests der deutschen Datums- und Zeitstempel-Formatierung (src/format/date.ts):
 * fachliche ISO-Daten als TT.MM.JJJJ (UTC-fixiert), technische Zeitstempel
 * als deutsches Datum mit LOKALER Uhrzeit (Speicherzeitpunkt); ungültige
 * Eingaben gehen unverändert zurück (nie werfen, nie raten).
 */

import { describe, expect, it } from 'vitest'
import { formatIsoDateGerman, formatIsoTimestampGerman } from '../../src/format/date'

describe('formatIsoDateGerman', () => {
  it('formatiert ISO-Daten als TT.MM.JJJJ (zeitzonenfrei)', () => {
    expect(formatIsoDateGerman('2026-07-17')).toBe('17.07.2026')
    expect(formatIsoDateGerman('2026-01-02')).toBe('02.01.2026')
  })

  it('gibt Nicht-ISO-Eingaben unverändert zurück', () => {
    expect(formatIsoDateGerman('17.07.2026')).toBe('17.07.2026')
    expect(formatIsoDateGerman('kein Datum')).toBe('kein Datum')
    expect(formatIsoDateGerman('')).toBe('')
  })

  it('kalendarisch ungültige Daten gehen unverändert zurück – kein Datums-Überlauf („nie raten“)', () => {
    expect(formatIsoDateGerman('2026-02-30')).toBe('2026-02-30')
    expect(formatIsoDateGerman('2026-13-01')).toBe('2026-13-01')
    // Schaltjahr-Kontrolle: 29.02. ist 2024 gültig, 2026 nicht.
    expect(formatIsoDateGerman('2024-02-29')).toBe('29.02.2024')
    expect(formatIsoDateGerman('2026-02-29')).toBe('2026-02-29')
  })
})

describe('formatIsoTimestampGerman', () => {
  it('formatiert ISO-Zeitstempel als deutsches Datum mit Uhrzeit und „Uhr“ – nie als ISO-Rohtext', () => {
    const result = formatIsoTimestampGerman('2026-07-19T10:30:00.000Z')
    // Uhrzeit in der LOKALEN Zeitzone → nur das Muster prüfen, nicht die Stunde.
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr$/)
    expect(result).not.toContain('T')
    expect(result).not.toContain('Z')
  })

  it('reine ISO-Daten ohne Zeitanteil werden als TT.MM.JJJJ formatiert', () => {
    expect(formatIsoTimestampGerman('2026-07-17')).toBe('17.07.2026')
  })

  it('gibt ungültige Eingaben unverändert zurück', () => {
    expect(formatIsoTimestampGerman('keinTdatum')).toBe('keinTdatum')
    expect(formatIsoTimestampGerman('unbekannt')).toBe('unbekannt')
  })
})
