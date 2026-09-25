/**
 * Unit-Tests der Zielfortschritts-Bausteine (Modul Übersicht M7 und Modul
 * Ziele M12, calculation-rules §7/T7 + „Ziel-Bausteine (M12)“): wirksames
 * Notgroschen-Ziel (Override-Vorrang), generischer Zielfortschritt
 * (Rest/Anteil/erreicht, F20-Randfälle) sowie die M12-Bausteine
 * (Ist-Wert je Zielart, G11-Normalisierung, Monatszählregel, Monatsrate,
 * Prognose ohne Rendite, Statuskaskade, zuordenbare eigene Sparleistung).
 */

import { describe, expect, it } from 'vitest'
import {
  assignedOwnPlans,
  assignedOwnSavings,
  compareGoalEntries,
  countGoalsByStatus,
  deriveGoalStatus,
  effectiveEmergencyFundTarget,
  effectiveGoalTarget,
  forecastMonthsToTarget,
  goalActualValue,
  goalProgress,
  goalSurplus,
  isEmergencyFundGoal,
  isPlanActiveOn,
  normalizedActualForStatus,
  rateGap,
  remainingFullMonths,
  requiredMonthlyRate,
} from '../../src/finance'
import type { EmergencyFund, FinanceData, Goal } from '../../src/types/finance'
import { loadExample } from '../storage/fixtures'
import { deepFreeze } from './deepFreeze'

describe('§7 – effectiveEmergencyFundTarget', () => {
  it('Seed: manualOverrideAmount null → factor × netIncomeMonthly = 4 × 1.170 = 4.680', () => {
    const fund = deepFreeze(loadExample()).settings.emergencyFund
    expect(effectiveEmergencyFundTarget(fund)).toBe(4680)
  })

  it('manueller Override hat Vorrang und wird nie durch die Berechnung ersetzt (T7)', () => {
    const fund = deepFreeze({
      factor: 4,
      netIncomeMonthly: 1170,
      manualOverrideAmount: 5000,
    }) as EmergencyFund
    expect(effectiveEmergencyFundTarget(fund)).toBe(5000)
  })

  it('fehlendes Override-Feld (undefined) → Berechnung aus factor × netto', () => {
    const fund = deepFreeze({ factor: 3, netIncomeMonthly: 3000 }) as EmergencyFund
    expect(effectiveEmergencyFundTarget(fund)).toBe(9000)
  })

  it('Override ≤ 0 wird durchgereicht – goalProgress liefert dann null („kein gültiger Zielbetrag“)', () => {
    const fund = deepFreeze({
      factor: 4,
      netIncomeMonthly: 1170,
      manualOverrideAmount: 0,
    }) as EmergencyFund
    expect(effectiveEmergencyFundTarget(fund)).toBe(0)
    expect(goalProgress(627.59, effectiveEmergencyFundTarget(fund))).toBeNull()
  })
})

describe('§7/T7 – goalProgress', () => {
  it('Seed-Notgroschen: Ist 627,59 / Ziel 4.680 → Rest 4.052,41, Anteil ≈ 13,41 %, nicht erreicht', () => {
    const progress = goalProgress(627.59, 4680)!
    expect(progress.target).toBe(4680)
    expect(progress.actual).toBeCloseTo(627.59, 9)
    expect(progress.remaining).toBeCloseTo(4052.41, 9)
    expect(progress.share!).toBeCloseTo(0.1341004, 6)
    expect(progress.reached).toBe(false)
  })

  it('Ziel exakt erreicht: remaining 0, share 1, reached true', () => {
    const progress = goalProgress(4680, 4680)!
    expect(progress.remaining).toBe(0)
    expect(progress.share).toBe(1)
    expect(progress.reached).toBe(true)
  })

  it('Ziel übertroffen: remaining bleibt 0 (nie negativ), share > 1 – Anzeige-Cap ist Sache der UI', () => {
    // Dokumentiertes Cap-Verhalten: der Rechenwert bleibt ehrlich (> 1); die UI
    // begrenzt nur den <progress>-Balken auf max und zeigt den echten Prozentwert als Text.
    const progress = goalProgress(5000, 4680)!
    expect(progress.remaining).toBe(0)
    expect(progress.reached).toBe(true)
    expect(progress.share!).toBeGreaterThan(1)
    expect(progress.share!).toBeCloseTo(5000 / 4680, 9)
  })

  it('target ≤ 0 → null („nicht berechenbar“, F20) – nie NaN/Infinity', () => {
    expect(goalProgress(100, 0)).toBeNull()
    expect(goalProgress(100, -1)).toBeNull()
  })

  it('Ist 0 ist gültig: Anteil 0, Rest = Ziel', () => {
    const progress = goalProgress(0, 4680)!
    expect(progress.share).toBe(0)
    expect(progress.remaining).toBe(4680)
    expect(progress.reached).toBe(false)
  })

  it('negatives Ist (erlaubter Negativsaldo): Rest > Ziel, Anteil negativ, nicht erreicht – Klemmung nur in der UI', () => {
    const progress = goalProgress(-100, 4680)!
    expect(progress.remaining).toBe(4780)
    expect(progress.share!).toBeCloseTo(-100 / 4680, 9)
    expect(progress.reached).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// M12 – Ziel-Bausteine
// ---------------------------------------------------------------------------

const TODAY = '2026-07-20'
const example = deepFreeze(loadExample())

/** Test-Ziel mit Defaults (deepFreeze – Reinheit wird implizit mitgeprüft). */
function makeGoal(patch: Record<string, unknown>): Goal {
  return deepFreeze({
    id: 'goal-test',
    name: 'Testziel',
    status: 'active',
    ...patch,
  }) as unknown as Goal
}

function withPatchedData(mutator: (data: FinanceData) => FinanceData): FinanceData {
  return deepFreeze(mutator(loadExample())) as FinanceData
}

const activeSeedPlans = example.savingsPlans.filter((plan) => isPlanActiveOn(plan, TODAY))

describe('M12 – isEmergencyFundGoal / effectiveGoalTarget (Auflage-D-Guard-Parität)', () => {
  it('Seed-Notgroschen (auto + tagesgeld): wirksames Ziel = 4.680', () => {
    const notgroschen = example.goals.find((entry) => entry.id === 'goal-notgroschen')!
    expect(isEmergencyFundGoal(notgroschen)).toBe(true)
    expect(effectiveGoalTarget(notgroschen, example.settings.emergencyFund)).toBe(4680)
  })

  it('auto + metric null verhält sich als Notgroschen (Doppel-Guard, metric == null)', () => {
    const goal = makeGoal({ isAutoCalculated: true, metric: null, targetAmount: null })
    expect(isEmergencyFundGoal(goal)).toBe(true)
    expect(effectiveGoalTarget(goal, example.settings.emergencyFund)).toBe(4680)
  })

  it('auto mit FREMDER Kennzahl wird NIE als Notgroschen behandelt (regressionstreu)', () => {
    const goal = makeGoal({ isAutoCalculated: true, metric: 'depotValue', targetAmount: 20000 })
    expect(isEmergencyFundGoal(goal)).toBe(false)
    expect(effectiveGoalTarget(goal, example.settings.emergencyFund)).toBe(20000)
  })

  it('manueller Zielbetrag > 0 → Betrag; null/fehlend/≤ 0 → null („offen“, G11 – nichts erfinden)', () => {
    expect(effectiveGoalTarget(makeGoal({ targetAmount: 10000 }), example.settings.emergencyFund)).toBe(10000)
    expect(effectiveGoalTarget(makeGoal({ targetAmount: null }), example.settings.emergencyFund)).toBeNull()
    expect(effectiveGoalTarget(makeGoal({}), example.settings.emergencyFund)).toBeNull()
    expect(effectiveGoalTarget(makeGoal({ targetAmount: 0 }), example.settings.emergencyFund)).toBeNull()
    expect(effectiveGoalTarget(makeGoal({ targetAmount: -5 }), example.settings.emergencyFund)).toBeNull()
  })
})

describe('M12 – goalActualValue je Zielart (Seed-Werte)', () => {
  it('tagesgeld (Notgroschen): 627,59 aus dem aktiven Tagesgeld-Konto', () => {
    const notgroschen = example.goals.find((entry) => entry.id === 'goal-notgroschen')!
    const value = goalActualValue(notgroschen, example, TODAY)!
    expect(value.amount).toBeCloseTo(627.59, 9)
    expect(value.missingIds).toEqual([])
    expect(value.relevantCount).toBe(1)
    expect(value.refInactive).toBe(false)
  })

  it('depotValue: 2.522,47 über die aktiven Positionen; totalWealth: 3.150,06', () => {
    const depotGoal = makeGoal({ metric: 'depotValue', targetAmount: 10000 })
    const depot = goalActualValue(depotGoal, example, TODAY)!
    expect(depot.amount).toBeCloseTo(2522.47, 9)
    expect(depot.relevantCount).toBe(6)
    const totalGoal = makeGoal({ metric: 'totalWealth', targetAmount: 50000 })
    const total = goalActualValue(totalGoal, example, TODAY)!
    expect(total.amount).toBeCloseTo(3150.06, 9)
    expect(total.relevantCount).toBe(7)
  })

  it('inaktive Positionen zählen nicht in die Aggregate (Aufruferfilter in der reinen Schicht)', () => {
    const data = withPatchedData((raw) => ({
      ...raw,
      portfolioPositions: raw.portfolioPositions.map((position) =>
        position.id === 'pos-telekom-aktien' ? { ...position, isActive: false } : position,
      ),
    }))
    const depotGoal = makeGoal({ metric: 'depotValue', targetAmount: 10000 })
    expect(goalActualValue(depotGoal, data, TODAY)!.amount).toBeCloseTo(1153.33, 9)
  })

  it('monthlySavingsRate: eigene REALE Sparleistung der am Stichtag aktiven Pläne (U3-Basis, keine Vermischung)', () => {
    const goal = makeGoal({ metric: 'monthlySavingsRate', targetAmount: 1000 })
    expect(goalActualValue(goal, example, TODAY)!.amount).toBeCloseTo(118.5, 9)
    // Stichtag VOR validFrom aller Pläne → 0 (der Stichtag wird injiziert).
    expect(goalActualValue(goal, example, '2026-07-18')!.amount).toBe(0)
  })

  it('accountBalance: jüngster Saldo des referenzierten Kontos; tote Referenz → null („nicht berechenbar“)', () => {
    const goal = makeGoal({ metric: 'accountBalance', refId: 'acc-vw-tagesgeld', targetAmount: 5000 })
    const value = goalActualValue(goal, example, TODAY)!
    expect(value.amount).toBeCloseTo(627.59, 9)
    expect(value.relevantCount).toBe(1)
    expect(
      goalActualValue(makeGoal({ metric: 'accountBalance', refId: 'acc-gibt-es-nicht' }), example, TODAY),
    ).toBeNull()
  })

  it('accountBalance ohne Saldo-Historie: amount 0 + missingIds („unbekannt“, NIE eine erfundene 0 im Status – Auflage E)', () => {
    const goal = makeGoal({ metric: 'accountBalance', refId: 'acc-sparkasse-giro', targetAmount: 500 })
    const value = goalActualValue(goal, example, TODAY)!
    expect(value.amount).toBe(0)
    expect(value.missingIds).toEqual(['acc-sparkasse-giro'])
    expect(normalizedActualForStatus(value)).toBeNull()
  })

  it('deaktivierte Referenz: Wert wird berechnet (ausdrückliche Referenz) plus Warn-Flag refInactive', () => {
    const data = withPatchedData((raw) => ({
      ...raw,
      accounts: raw.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld' ? { ...account, isActive: false } : account,
      ),
    }))
    const goal = makeGoal({ metric: 'accountBalance', refId: 'acc-vw-tagesgeld', targetAmount: 5000 })
    const value = goalActualValue(goal, data, TODAY)!
    expect(value.amount).toBeCloseTo(627.59, 9)
    expect(value.refInactive).toBe(true)
  })

  it('positionValue: jüngster Wert der referenzierten Position (Telekom 1.369,14); inaktiv → Warn-Flag', () => {
    const goal = makeGoal({ metric: 'positionValue', refId: 'pos-telekom-aktien', targetAmount: 2000 })
    expect(goalActualValue(goal, example, TODAY)!.amount).toBeCloseTo(1369.14, 9)
    const data = withPatchedData((raw) => ({
      ...raw,
      portfolioPositions: raw.portfolioPositions.map((position) =>
        position.id === 'pos-telekom-aktien' ? { ...position, isActive: false } : position,
      ),
    }))
    const inactive = goalActualValue(goal, data, TODAY)!
    expect(inactive.amount).toBeCloseTo(1369.14, 9)
    expect(inactive.refInactive).toBe(true)
  })

  it('manual: manualCurrentAmount gesetzt → Wert; null/fehlend → null („offen“)', () => {
    expect(
      goalActualValue(makeGoal({ metric: 'manual', manualCurrentAmount: 500 }), example, TODAY)!
        .amount,
    ).toBe(500)
    expect(
      goalActualValue(makeGoal({ metric: 'manual', manualCurrentAmount: null }), example, TODAY),
    ).toBeNull()
    expect(goalActualValue(makeGoal({ metric: 'manual' }), example, TODAY)).toBeNull()
  })

  it('ohne Kennzahl (nicht auto): null („nicht berechenbar“)', () => {
    expect(goalActualValue(makeGoal({ metric: null }), example, TODAY)).toBeNull()
  })
})

describe('M12 – normalizedActualForStatus (G11-Normalisierung, Auflage E)', () => {
  it('Teilsummen rechnen mit Betrag; vollständig unbekannt → null; relevantCount 0 → Betrag', () => {
    expect(normalizedActualForStatus(null)).toBeNull()
    expect(
      normalizedActualForStatus({ amount: 100, missingIds: ['a'], relevantCount: 2, refInactive: false }),
    ).toBe(100)
    expect(
      normalizedActualForStatus({ amount: 0, missingIds: ['a', 'b'], relevantCount: 2, refInactive: false }),
    ).toBeNull()
    expect(
      normalizedActualForStatus({ amount: 118.5, missingIds: [], relevantCount: 0, refInactive: false }),
    ).toBe(118.5)
  })
})

describe('M12 – goalSurplus / rateGap', () => {
  it('Überschuss = MAX(0, Ist − Ziel); Ratenlücke = benötigt − vorhanden', () => {
    expect(goalSurplus(5000, 4680)).toBeCloseTo(320, 9)
    expect(goalSurplus(100, 4680)).toBe(0)
    expect(rateGap(250, 118.5)).toBeCloseTo(131.5, 9)
    expect(rateGap(100, 250)).toBeCloseTo(-150, 9)
    expect(() => goalSurplus(Number.NaN, 1)).toThrow(/endliche Zahl/)
  })
})

describe('M12 – remainingFullMonths (verbindliche Monatszählregel, konservativ)', () => {
  it('zählt VOLLE Kalendermonatswechsel; der angebrochene aktuelle Monat zählt nicht', () => {
    expect(remainingFullMonths('2026-07-20', '2026-07-31')).toBe(0) // gleicher Monat
    expect(remainingFullMonths('2026-07-20', '2026-08-01')).toBe(1)
    expect(remainingFullMonths('2026-07-31', '2026-08-01')).toBe(1) // Monatsende → Monatsanfang
    expect(remainingFullMonths('2026-07-20', '2026-12-31')).toBe(5)
    expect(remainingFullMonths('2026-07-20', '2027-01-15')).toBe(6) // Jahreswechsel
    expect(remainingFullMonths('2026-07-20', '2027-07-20')).toBe(12)
  })

  it('Vergangenheit → 0; ungültiges/fehlendes Datum → null (nie raten)', () => {
    expect(remainingFullMonths('2026-07-20', '2026-06-30')).toBe(0)
    expect(remainingFullMonths('2026-07-20', '2020-01-01')).toBe(0)
    expect(remainingFullMonths('2026-07-20', null)).toBeNull()
    expect(remainingFullMonths('2026-07-20', undefined)).toBeNull()
    expect(remainingFullMonths('2026-07-20', 'bald')).toBeNull()
    expect(remainingFullMonths('kaputt', '2026-08-01')).toBeNull()
  })
})

describe('M12 – requiredMonthlyRate / forecastMonthsToTarget (ohne Rendite-/Kursannahme)', () => {
  it('Monatsrate: Rest/Monate ungerundet; 0 Monate → null; erreicht → 0', () => {
    expect(requiredMonthlyRate(1000, 4)).toBe(250)
    expect(requiredMonthlyRate(1000, 3)).toBeCloseTo(333.3333333, 6)
    expect(requiredMonthlyRate(1000, 0)).toBeNull()
    expect(requiredMonthlyRate(1000, null)).toBeNull()
    expect(requiredMonthlyRate(0, 4)).toBe(0)
    expect(requiredMonthlyRate(-50, null)).toBe(0)
  })

  it('Prognose: CEIL(Rest/Rate) als reine Division; Rest ≤ 0 → 0; Rate ≤ 0/NaN → null (kein Throw, nie NaN/Infinity)', () => {
    expect(forecastMonthsToTarget(4052.41, 118.5)).toBe(35) // ceil(34,197…)
    expect(forecastMonthsToTarget(600, 200)).toBe(3) // exakte Teilung ohne Aufschlag
    expect(forecastMonthsToTarget(0, 118.5)).toBe(0)
    expect(forecastMonthsToTarget(-10, 118.5)).toBe(0)
    expect(forecastMonthsToTarget(1000, 0)).toBeNull()
    expect(forecastMonthsToTarget(1000, -5)).toBeNull()
    expect(forecastMonthsToTarget(1000, Number.NaN)).toBeNull()
    expect(forecastMonthsToTarget(1000, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('M12 – deriveGoalStatus (verbindliche Rangfolge)', () => {
  const context = { target: 1000, actual: 500, todayIso: TODAY }

  it('(1) archived schlägt alles – auch rechnerisch erreichte Werte', () => {
    expect(
      deriveGoalStatus(makeGoal({ status: 'archived' }), { target: 100, actual: 200, todayIso: TODAY }),
    ).toBe('archived')
  })

  it('(2) gespeichertes reached = manuell abgeschlossen – schlägt auch einen SINKENDEN Ist-Wert', () => {
    expect(
      deriveGoalStatus(makeGoal({ status: 'reached' }), { target: 1000, actual: 10, todayIso: TODAY }),
    ).toBe('completed')
  })

  it('(3) deferred = pausiert; gespeicherter Nutzerwille schlägt das Zeitfenster (startDate in der Zukunft)', () => {
    expect(deriveGoalStatus(makeGoal({ status: 'deferred' }), context)).toBe('paused')
    expect(
      deriveGoalStatus(makeGoal({ status: 'deferred', startDate: '2027-01-01' }), context),
    ).toBe('paused')
  })

  it('(4) geplant NUR bei startDate > Stichtag; startDate = Stichtag ist NICHT geplant', () => {
    expect(deriveGoalStatus(makeGoal({ startDate: '2026-07-21' }), context)).toBe('planned')
    expect(deriveGoalStatus(makeGoal({ startDate: TODAY }), context)).toBe('active')
  })

  it('(5) notComputable: kein wirksames Ziel > 0 ODER unbekannter Ist – NIE ein erfundenes „überfällig mit 0 %“ (Auflage E)', () => {
    expect(deriveGoalStatus(makeGoal({}), { target: null, actual: 500, todayIso: TODAY })).toBe('notComputable')
    expect(deriveGoalStatus(makeGoal({}), { target: 0, actual: 500, todayIso: TODAY })).toBe('notComputable')
    expect(deriveGoalStatus(makeGoal({}), { target: 1000, actual: null, todayIso: TODAY })).toBe('notComputable')
    // Integration: Konto ohne Historieneintrag + überschrittener Termin →
    // notComputable, NICHT „überfällig mit 0 %“.
    const goal = makeGoal({
      metric: 'accountBalance',
      refId: 'acc-sparkasse-giro',
      targetAmount: 500,
      targetDate: '2026-01-01',
    })
    const actual = normalizedActualForStatus(goalActualValue(goal, example, TODAY))
    expect(actual).toBeNull()
    expect(deriveGoalStatus(goal, { target: 500, actual, todayIso: TODAY })).toBe('notComputable')
  })

  it('(6) reachedNow rechnerisch (NIE gespeichert) – auch bei überschrittenem Termin; fällt bei sinkendem Ist zurück', () => {
    const goal = makeGoal({ targetDate: '2026-01-01' })
    expect(deriveGoalStatus(goal, { target: 1000, actual: 1000, todayIso: TODAY })).toBe('reachedNow')
    expect(deriveGoalStatus(goal, { target: 1000, actual: 1200, todayIso: TODAY })).toBe('reachedNow')
    // Sinkender Wert: der abgeleitete Status fällt zurück (hier: überfällig).
    expect(deriveGoalStatus(goal, { target: 1000, actual: 999.99, todayIso: TODAY })).toBe('overdue')
    expect(deriveGoalStatus(makeGoal({}), { target: 1000, actual: 999.99, todayIso: TODAY })).toBe('active')
  })

  it('(7) überfällig NUR bei targetDate < Stichtag; targetDate = Stichtag ist NICHT überfällig; (8) sonst aktiv', () => {
    expect(
      deriveGoalStatus(makeGoal({ targetDate: '2026-07-19' }), context),
    ).toBe('overdue')
    expect(deriveGoalStatus(makeGoal({ targetDate: TODAY }), context)).toBe('active')
    expect(deriveGoalStatus(makeGoal({ targetDate: null }), context)).toBe('active')
  })

  it('geplant schlägt „nicht berechenbar“: Zukunfts-startDate mit offenem Ziel → planned (Rang 4 vor 5, L3)', () => {
    expect(
      deriveGoalStatus(makeGoal({ startDate: '2026-08-01', targetAmount: null }), {
        target: null,
        actual: null,
        todayIso: TODAY,
      }),
    ).toBe('planned')
  })
})

describe('M12 – assignedOwnPlans/assignedOwnSavings (ableitbare Zuordnung, kein goalId-Feld)', () => {
  it('tagesgeld/Notgroschen: eigene Pläne auf AKTIVE Tagesgeld-Konten → 25,00 real (nur sp-vw-tagesgeld)', () => {
    const notgroschen = example.goals.find((entry) => entry.id === 'goal-notgroschen')!
    const plans = assignedOwnPlans(notgroschen, activeSeedPlans, example.accounts, example.portfolioPositions)!
    expect(plans.map((plan) => plan.id)).toEqual(['sp-vw-tagesgeld'])
    expect(assignedOwnSavings(notgroschen, activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBe(25)
  })

  it('tagesgeld: deaktiviertes Tagesgeld-Konto → keine Zuordnung (0, nicht 25)', () => {
    const data = withPatchedData((raw) => ({
      ...raw,
      accounts: raw.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld' ? { ...account, isActive: false } : account,
      ),
    }))
    const notgroschen = example.goals.find((entry) => entry.id === 'goal-notgroschen')!
    expect(assignedOwnSavings(notgroschen, activeSeedPlans, data.accounts, data.portfolioPositions, 'realMonthly')).toBe(0)
  })

  it('depotValue: eigene Positions-Pläne mit Betrag → real 93,50 (ohne extern, ohne variable, ohne Umbuchung)', () => {
    const goal = makeGoal({ metric: 'depotValue', targetAmount: 10000 })
    const plans = assignedOwnPlans(goal, activeSeedPlans, example.accounts, example.portfolioPositions)!
    const ids = plans.map((plan) => plan.id)
    expect(ids).toContain('sp-vl-own')
    expect(ids).toContain('sp-telekom-eigen')
    expect(ids).not.toContain('sp-vl-employer') // extern zählt nie
    expect(ids).not.toContain('sp-tr-roundup') // variabel ohne Betrag zählt nie
    expect(ids).not.toContain('sp-ing-ruecklage') // Umbuchung, zudem Konto-Ziel
    expect(assignedOwnSavings(goal, activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBeCloseTo(93.5, 9)
    // Telekom-Jahresrate erscheint nur geglättet: 93,50 + 1.000/12 ≈ 176,83.
    expect(assignedOwnSavings(goal, activeSeedPlans, example.accounts, example.portfolioPositions, 'smoothed')).toBeCloseTo(176.8333333, 6)
  })

  it('depotValue: Plan auf eine DEAKTIVIERTE Position zählt nicht in die Zuordnung (konsistent zum Ziel-Ist)', () => {
    // finance-analyst-Befund M12: das Depot-Ziel-Ist (F2) zählt nur aktive
    // Positionen – die Zuordnung darf die Prognosebasis nicht mit Plänen auf
    // deaktivierte Positionen aufblähen.
    const data = withPatchedData((raw) => ({
      ...raw,
      portfolioPositions: raw.portfolioPositions.map((position) =>
        position.id === 'pos-telekom-aktien' ? { ...position, isActive: false } : position,
      ),
    }))
    const goal = makeGoal({ metric: 'depotValue', targetAmount: 10000 })
    // Ohne Telekom-Plan: geglättet 176,83 − 83,33 = 93,50.
    expect(
      assignedOwnSavings(goal, activeSeedPlans, data.accounts, data.portfolioPositions, 'smoothed'),
    ).toBeCloseTo(93.5, 9)
  })

  it('positionValue: Zuordnung bleibt bei DEAKTIVIERTER referenzierter Position bestehen (ausdrückliche Referenz, L2)', () => {
    // Bewusste Asymmetrie (dokumentiert): accountBalance/positionValue haben
    // KEINEN Aktiv-Filter – das Ziel referenziert die Position ausdrücklich.
    const data = withPatchedData((raw) => ({
      ...raw,
      portfolioPositions: raw.portfolioPositions.map((position) =>
        position.id === 'pos-telekom-aktien' ? { ...position, isActive: false } : position,
      ),
    }))
    const goal = makeGoal({ metric: 'positionValue', refId: 'pos-telekom-aktien', targetAmount: 2000 })
    expect(
      assignedOwnSavings(goal, activeSeedPlans, data.accounts, data.portfolioPositions, 'smoothed'),
    ).toBeCloseTo(83.3333333, 6)
  })

  it('accountBalance/positionValue: exakt die Pläne auf die referenzierte Referenz', () => {
    const kontoZiel = makeGoal({ metric: 'accountBalance', refId: 'acc-vw-tagesgeld', targetAmount: 5000 })
    expect(assignedOwnSavings(kontoZiel, activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBe(25)
    const telekomZiel = makeGoal({ metric: 'positionValue', refId: 'pos-telekom-aktien', targetAmount: 2000 })
    expect(assignedOwnSavings(telekomZiel, activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBe(0)
    expect(assignedOwnSavings(telekomZiel, activeSeedPlans, example.accounts, example.portfolioPositions, 'smoothed')).toBeCloseTo(83.3333333, 6)
    const goldZiel = makeGoal({ metric: 'positionValue', refId: 'pos-ishares-gold-etc', targetAmount: 500 })
    // Saveback/Round-up (amount null) zählen nie – nur die feste 5-€-Rate.
    expect(assignedOwnSavings(goldZiel, activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBe(5)
  })

  it('totalWealth/monthlySavingsRate/manual/ohne Kennzahl: null (keine eindeutige Zuordnung – UI zeigt die allgemeine Sparleistung)', () => {
    for (const patch of [
      { metric: 'totalWealth', targetAmount: 50000 },
      { metric: 'monthlySavingsRate', targetAmount: 1000 },
      { metric: 'manual', manualCurrentAmount: 100 },
      { metric: null },
    ]) {
      expect(assignedOwnSavings(makeGoal(patch), activeSeedPlans, example.accounts, example.portfolioPositions, 'realMonthly')).toBeNull()
    }
  })

  it('Doppelzählungs-Schutz: dieselbe Rate ist mehreren Zielen zuordenbar – Summen über Ziele wären Mehrfachzählung', () => {
    const depotZiel = makeGoal({ metric: 'depotValue', targetAmount: 10000 })
    const spdrZiel = makeGoal({ metric: 'positionValue', refId: 'pos-spdr-world-acc', targetAmount: 1000 })
    const depotPlanIds = assignedOwnPlans(depotZiel, activeSeedPlans, example.accounts, example.portfolioPositions)!.map((plan) => plan.id)
    const spdrPlanIds = assignedOwnPlans(spdrZiel, activeSeedPlans, example.accounts, example.portfolioPositions)!.map((plan) => plan.id)
    // Der SPDR-Plan steckt in BEIDEN Zuordnungen → zielbezogene Werte werden
    // NIE über Ziele summiert (dokumentierte Regel, calculation-rules M12).
    expect(depotPlanIds).toContain('sp-tr-spdr')
    expect(spdrPlanIds).toEqual(['sp-tr-spdr'])
  })
})

describe('M12 – Aggregation und Sortierung', () => {
  it('countGoalsByStatus zählt je abgeleitetem Status (fehlende Status → 0)', () => {
    const counts = countGoalsByStatus(['active', 'overdue', 'active', 'archived'])
    expect(counts.active).toBe(2)
    expect(counts.overdue).toBe(1)
    expect(counts.archived).toBe(1)
    expect(counts.paused).toBe(0)
  })

  it('Sortierung: zwei gesetzte Zieldaten im selben Status → früheres Datum zuerst; leere Liste zählt 0 (L5)', () => {
    const entries = [
      { goal: makeGoal({ id: 'g1', name: 'B', targetDate: '2027-01-01' }), status: 'active' as const },
      { goal: makeGoal({ id: 'g2', name: 'A', targetDate: '2026-09-01' }), status: 'active' as const },
    ]
    expect(entries.slice().sort(compareGoalEntries).map((entry) => entry.goal.id)).toEqual([
      'g2',
      'g1',
    ])
    const counts = countGoalsByStatus([])
    expect(counts.active).toBe(0)
    expect(counts.archived).toBe(0)
    expect(counts.overdue).toBe(0)
  })

  it('Sortierung: Status-Rang (überfällig zuerst, archiviert zuletzt), dann Zieldatum (null ans Ende), dann Name de-DE', () => {
    const entries = [
      { goal: makeGoal({ id: 'g1', name: 'Zeta' }), status: 'active' as const },
      { goal: makeGoal({ id: 'g2', name: 'Alpha' }), status: 'archived' as const },
      { goal: makeGoal({ id: 'g3', name: 'Beta', targetDate: '2027-01-01' }), status: 'active' as const },
      { goal: makeGoal({ id: 'g4', name: 'Ärger', targetDate: '2026-01-01' }), status: 'overdue' as const },
      { goal: makeGoal({ id: 'g5', name: 'Anton' }), status: 'active' as const },
    ]
    const sorted = entries.slice().sort(compareGoalEntries)
    expect(sorted.map((entry) => entry.goal.id)).toEqual(['g4', 'g3', 'g5', 'g1', 'g2'])
  })
})

describe('M12 – Reinheit (mutierbare Eingaben bleiben Byte-für-Byte unverändert)', () => {
  it('goalActualValue/assignedOwnSavings/deriveGoalStatus mutieren nichts', () => {
    const mutable = loadExample()
    const before = JSON.stringify(mutable)
    const activePlans = mutable.savingsPlans.filter((plan) => isPlanActiveOn(plan, TODAY))
    for (const goal of mutable.goals) {
      const target = effectiveGoalTarget(goal, mutable.settings.emergencyFund)
      const value = goalActualValue(goal, mutable, TODAY)
      const actual = normalizedActualForStatus(value)
      deriveGoalStatus(goal, { target, actual, todayIso: TODAY })
      assignedOwnSavings(goal, activePlans, mutable.accounts, mutable.portfolioPositions, 'realMonthly')
      remainingFullMonths(TODAY, goal.targetDate)
    }
    expect(JSON.stringify(mutable)).toBe(before)
  })
})
