/**
 * Tests der de-DE-Betragsverarbeitung (Review-Befund 3.2, Modul Konten):
 * parseGermanAmount darf den Tausenderpunkt nie als Dezimalpunkt deuten.
 */

import { describe, expect, it } from 'vitest'
import { formatEuro, parseGermanAmount } from '../../src/format/money'

describe('parseGermanAmount – strenges de-DE-Muster', () => {
  it('gültige Eingaben', () => {
    expect(parseGermanAmount('250')).toBe(250)
    expect(parseGermanAmount('250,00')).toBe(250)
    expect(parseGermanAmount('250,5')).toBe(250.5)
    expect(parseGermanAmount('1.234')).toBe(1234) // Tausenderpunkt, NICHT 1,234
    expect(parseGermanAmount('1.234,56')).toBe(1234.56)
    expect(parseGermanAmount('12.345.678,90')).toBe(12345678.9)
    expect(parseGermanAmount('-50')).toBe(-50)
    expect(parseGermanAmount(' 627,59 ')).toBe(627.59) // Whitespace wird getrimmt
    expect(parseGermanAmount('0')).toBe(0)
  })

  it('ungültige Eingaben → null (nie stillschweigend fehlinterpretieren)', () => {
    expect(parseGermanAmount('')).toBeNull()
    expect(parseGermanAmount('12.34')).toBeNull() // Punkt-Gruppe muss 3 Ziffern haben
    expect(parseGermanAmount('1,234')).toBeNull() // höchstens 2 Nachkommastellen
    expect(parseGermanAmount('1.23,45')).toBeNull()
    expect(parseGermanAmount('0x10')).toBeNull() // Number()-Exoten ausgeschlossen
    expect(parseGermanAmount('1e3')).toBeNull()
    expect(parseGermanAmount('abc')).toBeNull()
    expect(parseGermanAmount('12,34,56')).toBeNull()
    expect(parseGermanAmount('--5')).toBeNull()
  })

  it('Rundreise mit formatEuro: geparster Wert formatiert zurück zum Eingabemuster', () => {
    const amount = parseGermanAmount('1.234,56')!
    // formatEuro nutzt geschützte Leerzeichen; nur den Zahlenteil vergleichen.
    expect(formatEuro(amount)).toContain('1.234,56')
  })
})
