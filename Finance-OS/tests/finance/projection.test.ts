/**
 * Unit-Tests F22 – 6-/12-Monats-Projektion ohne Kursentwicklung.
 * Erwartungswerte aus docs/calculation-rules.md Abschnitt 12 (Seed 2026-07-17):
 * geglättet n=6 → 4.650,06 / n=12 → 6.150,06; real (Start August, Telekom im Juli)
 * n=6 → 3.900,06 / n=12 → 6.150,06. Eingaben sind eingefroren.
 */

import { describe, expect, it } from 'vitest'
import { projectNoGrowth } from '../../src/finance'
import { deepFreeze } from './deepFreeze'

const START = deepFreeze({ cash: 627.59, depot: 2522.47 })
const SMOOTHED = deepFreeze({ cashPerMonth: 25, depotPerMonth: 225 })
const REAL = deepFreeze({ cashPerMonth: 25, depotPerMonth: 100 })
const TELEKOM_JULY = deepFreeze({ events: [{ dueMonth: 7, amount: 1500 }], startMonth: 8 })

describe('F22 – Projektion ohne Kursentwicklung', () => {
  it('geglättet, 6 Monate: Tagesgeld 777,59; Depot 3.872,47; Gesamt 4.650,06', () => {
    const result = projectNoGrowth(START, 6, SMOOTHED)
    expect(result.cash).toBeCloseTo(777.59, 9)
    expect(result.depot).toBeCloseTo(3872.47, 9)
    expect(result.total).toBeCloseTo(4650.06, 9)
    expect(result.kind).toBe('projection-no-growth')
  })

  it('geglättet, 12 Monate: Gesamt 6.150,06', () => {
    const result = projectNoGrowth(START, 12, SMOOTHED)
    expect(result.cash).toBeCloseTo(927.59, 9)
    expect(result.depot).toBeCloseTo(5222.47, 9)
    expect(result.total).toBeCloseTo(6150.06, 9)
  })

  it('real (Start August), 6 Monate: Juli liegt außerhalb → Gesamt 3.900,06', () => {
    const result = projectNoGrowth(START, 6, REAL, TELEKOM_JULY)
    expect(result.cash).toBeCloseTo(777.59, 9)
    expect(result.depot).toBeCloseTo(3122.47, 9)
    expect(result.total).toBeCloseTo(3900.06, 9)
  })

  it('real (Start August), 12 Monate: Juli einmal im Horizont → Gesamt 6.150,06', () => {
    const result = projectNoGrowth(START, 12, REAL, TELEKOM_JULY)
    expect(result.depot).toBeCloseTo(5222.47, 9)
    expect(result.total).toBeCloseTo(6150.06, 9)
  })

  it('Konsistenzprüfung F22: reale und geglättete 12-Monats-Projektion sind identisch', () => {
    const smoothed = projectNoGrowth(START, 12, SMOOTHED)
    const real = projectNoGrowth(START, 12, REAL, TELEKOM_JULY)
    expect(real.total).toBeCloseTo(smoothed.total, 9)
    // 6-Monats-Differenz planmäßig 750,00 (= 6 × 125 geglätteter Telekom-Anteil).
    const smoothed6 = projectNoGrowth(START, 6, SMOOTHED)
    const real6 = projectNoGrowth(START, 6, REAL, TELEKOM_JULY)
    expect(smoothed6.total - real6.total).toBeCloseTo(750.0, 9)
  })

  it('n = 0 → Startwerte; Nullraten sind gültig', () => {
    const result = projectNoGrowth(START, 0, SMOOTHED)
    expect(result.cash).toBeCloseTo(627.59, 9)
    expect(result.depot).toBeCloseTo(2522.47, 9)
    const zeroRates = projectNoGrowth(START, 12, { cashPerMonth: 0, depotPerMonth: 0 })
    expect(zeroRates.total).toBeCloseTo(3150.06, 9)
  })

  it('ungültige Eingaben werden abgewiesen (nie NaN/Infinity)', () => {
    expect(() => projectNoGrowth(START, -1, SMOOTHED)).toThrow(/Ganzzahl/)
    expect(() => projectNoGrowth(START, 2.5, SMOOTHED)).toThrow(/Ganzzahl/)
    expect(() =>
      projectNoGrowth(START, 6, REAL, { events: [{ dueMonth: 13, amount: 1 }], startMonth: 8 }),
    ).toThrow(/Kalendermonat/)
    expect(() =>
      projectNoGrowth(START, 6, { cashPerMonth: Number.NaN, depotPerMonth: 0 }),
    ).toThrow(/endliche Zahl/)
  })

  it('Jahresereignis mit dueMonth = startMonth zählt im ersten Monat', () => {
    const result = projectNoGrowth(
      { cash: 0, depot: 0 },
      1,
      { cashPerMonth: 0, depotPerMonth: 0 },
      { events: [{ dueMonth: 8, amount: 1500 }], startMonth: 8 },
    )
    expect(result.depot).toBe(1500)
  })

  it('Reinheit: projectNoGrowth mutiert ungefrorene Eingaben nicht (Snapshot-Vergleich)', () => {
    // Bewusst OHNE deepFreeze: positiver Nachweis der Kopfzeilen-Zusage
    // „Eingaben werden nicht mutiert“ – Snapshot vor/nach dem Aufruf ist identisch.
    const start = { cash: 627.59, depot: 2522.47 }
    const rates = { cashPerMonth: 25, depotPerMonth: 100 }
    const annual = { events: [{ dueMonth: 7, amount: 1500 }], startMonth: 8 }
    const before = JSON.stringify({ start, rates, annual })
    projectNoGrowth(start, 12, rates, annual)
    expect(JSON.stringify({ start, rates, annual })).toBe(before)
  })
})
