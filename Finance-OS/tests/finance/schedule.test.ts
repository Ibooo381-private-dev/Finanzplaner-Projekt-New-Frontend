/**
 * Unit-Tests der Sparplan-Kalenderlogik (M10, src/finance/schedule.ts):
 * realAmountInMonth je Intervall inkl. Gültigkeitsfenster/isPaused,
 * nextDueDate inkl. Monatsende-Klemmung (31., Februar, Schaltjahr 2024/2026),
 * Quartalszyklus über die Jahresgrenze, validUntil mitten im Zyklus sowie die
 * komplette Status-Kaskade (Auflage 2b). Stichtag wird IMMER injiziert.
 */

import { describe, expect, it } from 'vitest'
import {
  hasUnknownSchedule,
  isoMonthOf,
  nextDueDate,
  planStatus,
  realAmountInMonth,
} from '../../src/finance'
import type { SavingsPlan } from '../../src/types/finance'
import { deepFreeze } from './deepFreeze'

const TODAY = '2026-07-19'

function makePlan(patch: Partial<SavingsPlan>): SavingsPlan {
  return deepFreeze({
    id: 'sp-test',
    name: 'Testplan',
    targetKind: 'position',
    targetId: 'pos-x',
    amount: 100,
    interval: 'monthly',
    flowType: 'own_fixed',
    validFrom: '2026-01-15',
    validUntil: null,
    ...patch,
  }) as SavingsPlan
}

describe('isoMonthOf / hasUnknownSchedule', () => {
  it('isoMonthOf schneidet auf JJJJ-MM', () => {
    expect(isoMonthOf('2026-07-19')).toBe('2026-07')
  })

  it('hasUnknownSchedule: NUR yearly ohne dueMonth', () => {
    expect(hasUnknownSchedule(makePlan({ interval: 'yearly', dueMonth: null }))).toBe(true)
    expect(hasUnknownSchedule(makePlan({ interval: 'yearly' }))).toBe(true) // dueMonth fehlt
    expect(hasUnknownSchedule(makePlan({ interval: 'yearly', dueMonth: 7 }))).toBe(false)
    expect(hasUnknownSchedule(makePlan({ interval: 'monthly' }))).toBe(false)
    expect(hasUnknownSchedule(makePlan({ interval: 'once' }))).toBe(false)
  })
})

describe('realAmountInMonth – U4-Defensivguard (Auflage A)', () => {
  it('nicht endliche oder ≤ 0-Beträge zählen als 0 („zählt nicht“, kein Throw, keine Negativ-Durchreichung)', () => {
    expect(realAmountInMonth(makePlan({ amount: Number.NaN }), '2026-07')).toBe(0)
    expect(realAmountInMonth(makePlan({ amount: Number.POSITIVE_INFINITY }), '2026-07')).toBe(0)
    expect(realAmountInMonth(makePlan({ amount: -50 }), '2026-07')).toBe(0)
    expect(realAmountInMonth(makePlan({ amount: 0 }), '2026-07')).toBe(0)
    // Gültiger positiver Betrag bleibt unverändert (U4: zählt vollständig).
    expect(realAmountInMonth(makePlan({ amount: 15, flowType: 'own_variable' }), '2026-07')).toBe(15)
  })
})

describe('realAmountInMonth – reale Monatssicht je Intervall', () => {
  it('monthly: Betrag in jedem Monat des Gültigkeitsfensters, 0 außerhalb', () => {
    const plan = makePlan({ validFrom: '2026-03-15', validUntil: '2026-05-31' })
    expect(realAmountInMonth(plan, '2026-02')).toBe(0) // vor validFrom-Monat
    expect(realAmountInMonth(plan, '2026-03')).toBe(100)
    expect(realAmountInMonth(plan, '2026-05')).toBe(100) // validUntil-Monat zählt noch
    expect(realAmountInMonth(plan, '2026-06')).toBe(0) // nach validUntil-Monat
  })

  it('quarterly: Zyklusmonate ab validFrom-Monat (+3), auch über die Jahresgrenze', () => {
    const plan = makePlan({ interval: 'quarterly', amount: 120, validFrom: '2026-11-10' })
    expect(realAmountInMonth(plan, '2026-11')).toBe(120)
    expect(realAmountInMonth(plan, '2026-12')).toBe(0)
    expect(realAmountInMonth(plan, '2027-01')).toBe(0)
    expect(realAmountInMonth(plan, '2027-02')).toBe(120) // 2026-11 + 3 Monate
    expect(realAmountInMonth(plan, '2027-05')).toBe(120)
  })

  it('halfyearly: Zyklus +6 Monate ab validFrom-Monat', () => {
    const plan = makePlan({ interval: 'halfyearly', amount: 300, validFrom: '2026-02-28' })
    expect(realAmountInMonth(plan, '2026-02')).toBe(300)
    expect(realAmountInMonth(plan, '2026-05')).toBe(0)
    expect(realAmountInMonth(plan, '2026-08')).toBe(300)
    expect(realAmountInMonth(plan, '2027-02')).toBe(300)
  })

  it('yearly: Betrag nur im dueMonth; ohne dueMonth 0 (Erkennung über hasUnknownSchedule, G11)', () => {
    const plan = makePlan({ interval: 'yearly', amount: 1000, dueMonth: 7, validFrom: '2026-07-19' })
    expect(realAmountInMonth(plan, '2026-07')).toBe(1000)
    expect(realAmountInMonth(plan, '2026-08')).toBe(0)
    expect(realAmountInMonth(plan, '2027-07')).toBe(1000)
    const unknown = makePlan({ interval: 'yearly', amount: 1000, dueMonth: null })
    expect(realAmountInMonth(unknown, '2026-07')).toBe(0)
    expect(hasUnknownSchedule(unknown)).toBe(true)
  })

  it('once: Betrag nur im validFrom-Monat', () => {
    const plan = makePlan({ interval: 'once', amount: 500, validFrom: '2026-09-01', validUntil: '2026-09-01' })
    expect(realAmountInMonth(plan, '2026-08')).toBe(0)
    expect(realAmountInMonth(plan, '2026-09')).toBe(500)
    expect(realAmountInMonth(plan, '2026-10')).toBe(0)
  })

  it('pausiert (strikt isPaused === true) → immer 0; variable Pläne (amount null) → 0', () => {
    expect(realAmountInMonth(makePlan({ isPaused: true }), '2026-07')).toBe(0)
    expect(realAmountInMonth(makePlan({ amount: null, flowType: 'provider' }), '2026-07')).toBe(0)
    // Nicht-boolesches isPaused würde die Validierung ablehnen; die strikte
    // Prüfung wertet nur true als pausiert.
    expect(
      realAmountInMonth(makePlan({ isPaused: undefined }), '2026-07'),
    ).toBe(100)
  })
})

describe('nextDueDate – nächster geplanter Termin (Monatsende-Klemmung, Zyklen)', () => {
  it('monthly mit Zahltag 31: Klemmung auf 30./28./29. (Schaltjahr korrekt, kein Überlauf)', () => {
    const plan = makePlan({ validFrom: '2024-01-31' })
    expect(nextDueDate(plan, '2026-04-05')).toBe('2026-04-30') // April hat 30 Tage
    expect(nextDueDate(plan, '2026-02-01')).toBe('2026-02-28') // 2026 kein Schaltjahr
    expect(nextDueDate(plan, '2024-02-01')).toBe('2024-02-29') // 2024 Schaltjahr
    expect(nextDueDate(plan, '2026-01-31')).toBe('2026-01-31') // Termin am Stichtag zählt
  })

  it('monthly: liegt der geklemmte Termin des Stichtagsmonats vor dem Stichtag, folgt der nächste Monat', () => {
    const plan = makePlan({ validFrom: '2024-01-31' })
    // Stichtag 2026-02-28 = geklemmter Februartermin → genau heute.
    expect(nextDueDate(plan, '2026-02-28')).toBe('2026-02-28')
    // Einen Tag später ist der Februartermin vorbei → 31. März.
    expect(nextDueDate(plan, '2026-03-01')).toBe('2026-03-31')
  })

  it('geplanter Plan (validFrom in der Zukunft): erster Termin ist validFrom', () => {
    const plan = makePlan({ validFrom: '2026-10-15' })
    expect(nextDueDate(plan, TODAY)).toBe('2026-10-15')
  })

  it('quarterly über die Jahresgrenze: 2026-11-30 → nächster Zyklustermin 2027-02-28', () => {
    const plan = makePlan({ interval: 'quarterly', validFrom: '2026-11-30' })
    expect(nextDueDate(plan, '2026-12-01')).toBe('2027-02-28')
    expect(nextDueDate(plan, '2026-11-30')).toBe('2026-11-30')
  })

  it('validUntil mitten im Zyklus: Termin nach validUntil → null', () => {
    const plan = makePlan({ interval: 'quarterly', validFrom: '2026-01-15', validUntil: '2026-05-31' })
    expect(nextDueDate(plan, '2026-03-01')).toBe('2026-04-15') // im Fenster
    expect(nextDueDate(plan, '2026-05-01')).toBe(null) // 2026-07-15 läge nach validUntil
  })

  it('yearly: dueMonth + validFrom-Tag (geklemmt); ohne dueMonth → null (unbekannt)', () => {
    const plan = makePlan({ interval: 'yearly', dueMonth: 7, validFrom: '2026-07-19' })
    expect(nextDueDate(plan, TODAY)).toBe('2026-07-19')
    expect(nextDueDate(plan, '2026-07-20')).toBe('2027-07-19')
    const clamped = makePlan({ interval: 'yearly', dueMonth: 2, validFrom: '2025-02-28' })
    expect(nextDueDate(clamped, '2026-01-01')).toBe('2026-02-28')
    expect(nextDueDate(makePlan({ interval: 'yearly', dueMonth: null }), TODAY)).toBeNull()
  })

  it('yearly geplant: Termine vor validFrom werden übersprungen', () => {
    const plan = makePlan({ interval: 'yearly', dueMonth: 3, validFrom: '2027-03-10' })
    expect(nextDueDate(plan, TODAY)).toBe('2027-03-10')
  })

  it('validUntil TAGGENAU: Zahltag nach dem Enddatum → keine Zahlung im Endmonat (Befund M10-1)', () => {
    // Quartalsplan: Zyklusmonate Jan/Apr/Jul, Zahltag 15.; Ende am 10.04. liegt
    // VOR dem April-Zahltag → April zählt nicht mehr (konsistent mit nextDueDate).
    const endsBeforePayday = makePlan({
      interval: 'quarterly',
      amount: 120,
      validFrom: '2026-01-15',
      validUntil: '2026-04-10',
    })
    expect(realAmountInMonth(endsBeforePayday, '2026-01')).toBe(120)
    expect(realAmountInMonth(endsBeforePayday, '2026-04')).toBe(0)
    // Ende am 20.04. liegt NACH dem Zahltag → April zählt noch.
    const endsAfterPayday = makePlan({
      interval: 'quarterly',
      amount: 120,
      validFrom: '2026-01-15',
      validUntil: '2026-04-20',
    })
    expect(realAmountInMonth(endsAfterPayday, '2026-04')).toBe(120)
  })

  it('nextDueDate yearly respektiert validUntil (Termin nach dem Enddatum → null)', () => {
    const plan = makePlan({
      interval: 'yearly',
      dueMonth: 7,
      validFrom: '2026-07-19',
      validUntil: '2026-12-31',
    })
    expect(nextDueDate(plan, '2026-08-01')).toBeNull()
  })

  it('Reinheit: realAmountInMonth/nextDueDate/planStatus mutieren die Eingabe nicht', () => {
    const plan: SavingsPlan = {
      id: 'sp-pure',
      name: 'Reinheit',
      targetKind: 'position',
      targetId: 'pos-x',
      amount: 100,
      interval: 'quarterly',
      flowType: 'own_fixed',
      validFrom: '2026-01-31',
      validUntil: '2026-12-31',
    }
    const snapshot = JSON.parse(JSON.stringify(plan)) as unknown
    realAmountInMonth(plan, '2026-04')
    nextDueDate(plan, TODAY)
    planStatus(plan, TODAY)
    expect(JSON.parse(JSON.stringify(plan))).toEqual(snapshot)
  })

  it('yearly weit vorausgeplant (validFrom > 2 Jahre): erster Termin bleibt ableitbar (F2)', () => {
    // finance-analyst-Befund M10-F2: das Kandidaten-Startjahr ist das SPÄTERE aus
    // Stichtagsjahr und validFrom-Jahr – nie „unbekannt" für ableitbare Termine.
    const plan = makePlan({ interval: 'yearly', dueMonth: 6, validFrom: '2029-06-01' })
    expect(nextDueDate(plan, TODAY)).toBe('2029-06-01')
    // dueMonth VOR dem validFrom-Monat: erster Termin erst im Folgejahr.
    const later = makePlan({ interval: 'yearly', dueMonth: 2, validFrom: '2029-06-01' })
    expect(nextDueDate(later, TODAY)).toBe('2030-02-01')
  })

  it('once: validFrom ≥ Stichtag → validFrom; vergangen → null (abgeschlossen)', () => {
    expect(nextDueDate(makePlan({ interval: 'once', validFrom: '2026-09-01' }), TODAY)).toBe('2026-09-01')
    expect(nextDueDate(makePlan({ interval: 'once', validFrom: TODAY }), TODAY)).toBe(TODAY)
    expect(nextDueDate(makePlan({ interval: 'once', validFrom: '2026-07-18' }), TODAY)).toBeNull()
  })

  it('pausiert → null; beendet (validUntil < Stichtag) → null; variabler Plan hat trotzdem einen Termin', () => {
    expect(nextDueDate(makePlan({ isPaused: true }), TODAY)).toBeNull()
    expect(nextDueDate(makePlan({ validUntil: '2026-07-18' }), TODAY)).toBeNull()
    expect(
      nextDueDate(makePlan({ amount: null, flowType: 'provider', validFrom: '2026-07-01' }), TODAY),
    ).toBe('2026-08-01')
  })
})

describe('planStatus – Status-Kaskade (Auflage 2b, verbindliche Rangfolge)', () => {
  it('once + pausiert + vergangen → abgeschlossen (Rang 1 vor pausiert)', () => {
    const plan = makePlan({ interval: 'once', validFrom: '2026-07-18', isPaused: true })
    expect(planStatus(plan, TODAY)).toBe('completed')
  })

  it('beendet schlägt pausiert (Rang 2 vor 3)', () => {
    const plan = makePlan({ validUntil: '2026-07-18', isPaused: true })
    expect(planStatus(plan, TODAY)).toBe('ended')
  })

  it('pausiert + Zukunft (geplant) → pausiert (Rang 3 vor 4)', () => {
    const plan = makePlan({ validFrom: '2026-10-01', isPaused: true })
    expect(planStatus(plan, TODAY)).toBe('paused')
  })

  it('validUntil = Stichtag → aktiv (beendet erst NACH dem Enddatum)', () => {
    expect(planStatus(makePlan({ validUntil: TODAY }), TODAY)).toBe('active')
  })

  it('once mit validFrom = Stichtag → aktiv; once vergangen → abgeschlossen', () => {
    expect(planStatus(makePlan({ interval: 'once', validFrom: TODAY }), TODAY)).toBe('active')
    expect(planStatus(makePlan({ interval: 'once', validFrom: '2026-07-18' }), TODAY)).toBe('completed')
  })

  it('geplant (validFrom > Stichtag) und aktiv (Normalfall)', () => {
    expect(planStatus(makePlan({ validFrom: '2026-08-01' }), TODAY)).toBe('planned')
    expect(planStatus(makePlan({}), TODAY)).toBe('active')
  })
})
