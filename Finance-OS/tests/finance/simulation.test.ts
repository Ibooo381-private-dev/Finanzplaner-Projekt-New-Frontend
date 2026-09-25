/**
 * Unit-Tests M13 – Simulations-Bausteine (simulateScenario, summarizeSimulation,
 * goalReachMonthInSeries, analyzeGoalsInSimulation, compareSimulations).
 * Pflicht-Pins aus der ratifizierten Spezifikation (KORREKTUR 2.1: startMonth =
 * FOLGEMONAT des Stichtags; der 6-Monats-Pin 777,59/3.122,47/3.900,06 pinnt die
 * Konvention – der 12-Monats-Pin allein würde den Fehler maskieren), F22-Pins
 * 927,59/5.222,47/6.150,06, Growth-Pin 1.000 × 12 % → exakt 1.120,00,
 * G8-Partition 1.000 eigen / 1.500 gesamt, Grenzen (months 1/1200/0/1,5/1201;
 * Rendite 0/0,15/−0,01/0,16/NaN/∞), Mutationsfreiheit.
 */

import { describe, expect, it } from 'vitest'
import {
  analyzeGoalsInSimulation,
  compareSimulations,
  firstProjectionStartMonth,
  formatIsoMonthGerman,
  goalReachMonthInSeries,
  isProjectableSimulationMetric,
  projectionMonthIso,
  projectNoGrowth,
  simulateScenario,
  summarizeSimulation,
  TELEKOM_ANNUAL_EVENT,
} from '../../src/finance'
import type { EmergencyFund, Goal, SimulationParams } from '../../src/types/finance'
import { deepFreeze } from './deepFreeze'

/** Stichtag Juli 2026 → erster projizierter Monat ist AUGUST (startMonth 8, F22). */
const TODAY = '2026-07-20'
const START_MONTH = firstProjectionStartMonth(TODAY)

/** Seed-reale Vorbelegung (Auflage 2.4): 93,50 own + 6,50 employer (depot) + 25 own (cash) + Ereignis. */
function realParams(months: number, annualReturnRate = 0): SimulationParams {
  return {
    startDepotValue: 2522.47,
    startTagesgeldValue: 627.59,
    months,
    annualReturnRate,
    monthlyContributions: [
      { label: 'Eigene Depot-Sparraten (monatlich)', amount: 93.5, flowType: 'own_fixed' },
      { label: 'VL-Arbeitgeberzuschuss', amount: 6.5, flowType: 'employer' },
      { label: 'Tagesgeld-Rate', amount: 25, flowType: 'own_fixed', target: 'cash' },
    ],
    telekomMode: 'real',
  }
}

/** Seed-geglättete Vorbelegung (Auflage 2.4, zeilenweise – KEINE Sammelzeile „225 eigen“). */
function smoothedParams(months: number, annualReturnRate = 0): SimulationParams {
  return {
    startDepotValue: 2522.47,
    startTagesgeldValue: 627.59,
    months,
    annualReturnRate,
    monthlyContributions: [
      { label: 'VL Eigenanteil', amount: 33.5, flowType: 'own_fixed' },
      { label: 'VL-Arbeitgeberzuschuss', amount: 6.5, flowType: 'employer' },
      { label: 'TR feste Sparraten', amount: 60, flowType: 'own_fixed' },
      { label: 'Telekom Eigenbeitrag – geglättet (Analysewert)', amount: 83.33, flowType: 'own_fixed' },
      { label: 'Telekom Bonus – geglättet (Analysewert)', amount: 41.67, flowType: 'employer' },
      { label: 'Tagesgeld-Rate', amount: 25, flowType: 'own_fixed', target: 'cash' },
    ],
    telekomMode: 'smoothed',
  }
}

function bareParams(overrides: Partial<SimulationParams> = {}): SimulationParams {
  return {
    startDepotValue: 0,
    startTagesgeldValue: 0,
    months: 12,
    annualReturnRate: 0,
    monthlyContributions: [],
    telekomMode: 'smoothed',
    ...overrides,
  }
}

const FUND: EmergencyFund = { factor: 4, netIncomeMonthly: 1170, manualOverrideAmount: null }

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-test',
    name: 'Testziel',
    status: 'active',
    ...overrides,
  }
}

describe('firstProjectionStartMonth / projectionMonthIso – KORREKTUR 2.1 (Folgemonat)', () => {
  it('Juli-Stichtag → startMonth 8 (F22 „Real (Start August 2026)“); Dezember → Januar', () => {
    expect(firstProjectionStartMonth('2026-07-20')).toBe(8)
    expect(firstProjectionStartMonth('2026-12-01')).toBe(1)
    expect(firstProjectionStartMonth('2026-01-31')).toBe(2)
  })

  it('projectionMonthIso: Index 0 = Stichtagsmonat, Index 1 = Folgemonat, Jahreswechsel korrekt', () => {
    expect(projectionMonthIso('2026-07-20', 0)).toBe('2026-07')
    expect(projectionMonthIso('2026-07-20', 1)).toBe('2026-08')
    expect(projectionMonthIso('2026-07-20', 6)).toBe('2027-01')
    expect(projectionMonthIso('2026-12-05', 1)).toBe('2027-01')
  })

  it('formatIsoMonthGerman liefert deutsche Monatsnamen', () => {
    expect(formatIsoMonthGerman('2026-08')).toBe('August 2026')
    expect(formatIsoMonthGerman('2027-01')).toBe('Januar 2027')
  })

  it('ungültige Eingaben werden abgewiesen', () => {
    expect(() => firstProjectionStartMonth('20.07.2026')).toThrow(/ISO-Datum/)
    expect(() => projectionMonthIso('2026-07-20', -1)).toThrow(/Ganzzahl/)
  })
})

describe('simulateScenario – r = 0 ist exakt der projectNoGrowth-Pfad (Konsistenz-Pin)', () => {
  it('PFLICHT-PIN real 6 Monate (Start August, Juli außerhalb): 777,59 / 3.122,47 / 3.900,06', () => {
    const result = simulateScenario(deepFreeze(realParams(6)), START_MONTH)
    expect(result.end.cash).toBeCloseTo(777.59, 9)
    expect(result.end.depot).toBeCloseTo(3122.47, 9)
    expect(result.end.total).toBeCloseTo(3900.06, 9)
    expect(result.kind).toBe('simulation-projection')
  })

  it('real 12 Monate (Juli einmal im Horizont): 927,59 / 5.222,47 / 6.150,06 (F22)', () => {
    const result = simulateScenario(deepFreeze(realParams(12)), START_MONTH)
    expect(result.end.cash).toBeCloseTo(927.59, 9)
    expect(result.end.depot).toBeCloseTo(5222.47, 9)
    expect(result.end.total).toBeCloseTo(6150.06, 9)
    // Identisch mit der 0-%-Referenz projectNoGrowth (Konsistenz-Pin).
    const reference = projectNoGrowth(
      { cash: 627.59, depot: 2522.47 },
      12,
      { cashPerMonth: 25, depotPerMonth: 100 },
      { events: [{ dueMonth: 7, amount: 1500 }], startMonth: START_MONTH },
    )
    expect(result.end.total).toBeCloseTo(reference.total, 9)
    expect(result.end.depot).toBeCloseTo(reference.depot, 9)
    expect(result.end.cash).toBeCloseTo(reference.cash, 9)
  })

  it('geglättet 12 Monate: identischer Endwert 6.150,06 (Sichten-Konsistenz F22)', () => {
    const smoothed = simulateScenario(deepFreeze(smoothedParams(12)), START_MONTH)
    expect(smoothed.end.cash).toBeCloseTo(927.59, 9)
    expect(smoothed.end.depot).toBeCloseTo(5222.47, 9)
    expect(smoothed.end.total).toBeCloseTo(6150.06, 9)
  })

  it('AK 1: bei r = 0 ist der Endwert exakt Start + Σ Zuflüsse (nachrechenbar)', () => {
    const result = simulateScenario(realParams(12), START_MONTH)
    expect(result.end.total).toBeCloseTo(3150.06 + result.contributed.total, 9)
    // Leere Beiträge sind gültig: Endwert = Startwert.
    const still = simulateScenario(bareParams({ startDepotValue: 100, startTagesgeldValue: 50 }), 8)
    expect(still.end.total).toBeCloseTo(150, 9)
    expect(still.contributed.total).toBe(0)
  })

  it('liefert eine monatliche Reihe mit months + 1 Punkten (Index 0 = Start)', () => {
    const result = simulateScenario(realParams(6), START_MONTH)
    expect(result.points).toHaveLength(7)
    expect(result.points[0]).toEqual({
      monthIndex: 0,
      cash: 627.59,
      depot: 2522.47,
      total: 3150.06,
    })
    expect(result.points[6].total).toBeCloseTo(3900.06, 9)
    // Zwischenpunkt: nach 1 Monat (August, kein Ereignis).
    expect(result.points[1].depot).toBeCloseTo(2622.47, 9)
    expect(result.points[1].cash).toBeCloseTo(652.59, 9)
  })

  it('Ereignis im ersten projizierten Monat: Juli-Stichtag zählt NICHT, Juni-Stichtag zählt (dueMonth 7)', () => {
    // Stichtag Juni → startMonth 7 → Juli ist der ERSTE projizierte Monat.
    const juneStart = simulateScenario(
      bareParams({ months: 1, telekomMode: 'real' }),
      firstProjectionStartMonth('2026-06-15'),
    )
    expect(juneStart.end.depot).toBe(TELEKOM_ANNUAL_EVENT.totalAmount)
    // Juli-Stichtag → startMonth 8 → das nächste Juli-Ereignis liegt bei Monat 12.
    const julyStart = simulateScenario(bareParams({ months: 11, telekomMode: 'real' }), START_MONTH)
    expect(julyStart.end.depot).toBe(0)
  })
})

describe('simulateScenario – Wachstum (geometrischer Monatsfaktor, Monatsende-Regel)', () => {
  it('GROWTH-PIN: 1.000 Start, 12 Monate, 12 % p. a., keine Beiträge → exakt 1.120,00', () => {
    const result = simulateScenario(
      bareParams({ startDepotValue: 1000, months: 12, annualReturnRate: 0.12 }),
      8,
    )
    expect(result.end.depot).toBeCloseTo(1120, 8)
    expect(result.end.cash).toBe(0)
  })

  it('Monatsende-Regel: Beiträge werden im Zuführungsmonat NICHT verzinst', () => {
    const oneMonth = simulateScenario(
      bareParams({
        months: 1,
        annualReturnRate: 0.12,
        monthlyContributions: [{ label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' }],
      }),
      8,
    )
    expect(oneMonth.end.depot).toBe(100)
    const twoMonths = simulateScenario(
      bareParams({
        months: 2,
        annualReturnRate: 0.12,
        monthlyContributions: [{ label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' }],
      }),
      8,
    )
    const monthlyFactor = Math.pow(1.12, 1 / 12)
    expect(twoMonths.end.depot).toBeCloseTo(100 * monthlyFactor + 100, 9)
  })

  it('verzinst NUR das Depot – Tagesgeld bleibt ohne Zinsannahme', () => {
    const result = simulateScenario(
      bareParams({ startTagesgeldValue: 1000, months: 12, annualReturnRate: 0.15 }),
      8,
    )
    expect(result.end.cash).toBe(1000)
    expect(result.end.depot).toBe(0)
  })

  it('cash-Beiträge fließen ins Tagesgeld und werden nie verzinst', () => {
    const result = simulateScenario(
      bareParams({
        months: 12,
        annualReturnRate: 0.15,
        monthlyContributions: [
          { label: 'Tagesgeld-Rate', amount: 25, flowType: 'own_fixed', target: 'cash' },
        ],
      }),
      8,
    )
    expect(result.end.cash).toBeCloseTo(300, 9)
    expect(result.end.depot).toBe(0)
  })

  it('Performance-Grenze: 1.200 Monate (100 Jahre) rechnen ohne NaN/Infinity', () => {
    const result = simulateScenario(
      bareParams({
        startDepotValue: 1000,
        months: 1200,
        annualReturnRate: 0.15,
        monthlyContributions: [{ label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' }],
      }),
      8,
    )
    expect(result.points).toHaveLength(1201)
    expect(Number.isFinite(result.end.total)).toBe(true)
    expect(result.end.total).toBeGreaterThan(0)
  })
})

describe('simulateScenario – G8-Partition (eigen vs. gesamt, NIE vermischt)', () => {
  it('Ereignis-Partition 2.3: telekomMode real → 1.000 eigen + 500 Arbeitgeber = 1.500 gesamt', () => {
    const result = simulateScenario(bareParams({ months: 12, telekomMode: 'real' }), START_MONTH)
    expect(result.contributed.own).toBe(1000)
    expect(result.contributed.total).toBe(1500)
  })

  it('Seed real 12 Monate: eigen 2.422,00 (12 × 118,50 + 1.000), gesamt 3.000,00 (12 × 125 + 1.500)', () => {
    const result = simulateScenario(realParams(12), START_MONTH)
    expect(result.contributed.own).toBeCloseTo(2422, 9)
    expect(result.contributed.total).toBeCloseTo(3000, 9)
  })

  it('geglättet: KEIN Ereignis (sonst Doppelzählung, G9) – gesamt 12 × 250 = 3.000,00', () => {
    const result = simulateScenario(smoothedParams(12), START_MONTH)
    expect(result.contributed.total).toBeCloseTo(3000, 9)
    expect(result.contributed.own).toBeCloseTo(12 * (33.5 + 60 + 83.33 + 25), 9)
  })
})

describe('simulateScenario – Grenzen und Ablehnungen (nie NaN/Infinity)', () => {
  it('months: 1 und 1200 gültig; 0, 1,5 und 1201 abgelehnt', () => {
    expect(simulateScenario(bareParams({ months: 1 }), 8).points).toHaveLength(2)
    expect(simulateScenario(bareParams({ months: 1200 }), 8).points).toHaveLength(1201)
    expect(() => simulateScenario(bareParams({ months: 0 }), 8)).toThrow(/Ganzzahl/)
    expect(() => simulateScenario(bareParams({ months: 1.5 }), 8)).toThrow(/Ganzzahl/)
    expect(() => simulateScenario(bareParams({ months: 1201 }), 8)).toThrow(/1200/)
  })

  it('Rendite: 0 und 0,15 gültig; −0,01, 0,16, NaN und ∞ abgelehnt', () => {
    expect(simulateScenario(bareParams({ annualReturnRate: 0 }), 8).end.total).toBe(0)
    expect(
      simulateScenario(bareParams({ startDepotValue: 100, annualReturnRate: 0.15 }), 8).end.depot,
    ).toBeCloseTo(115, 8)
    expect(() => simulateScenario(bareParams({ annualReturnRate: -0.01 }), 8)).toThrow(/0–15/)
    expect(() => simulateScenario(bareParams({ annualReturnRate: 0.16 }), 8)).toThrow(/0–15/)
    expect(() => simulateScenario(bareParams({ annualReturnRate: Number.NaN }), 8)).toThrow(
      /endliche Zahl/,
    )
    expect(() =>
      simulateScenario(bareParams({ annualReturnRate: Number.POSITIVE_INFINITY }), 8),
    ).toThrow(/endliche Zahl/)
  })

  it('negative Beiträge und Startwerte werden abgelehnt', () => {
    expect(() =>
      simulateScenario(
        bareParams({
          monthlyContributions: [{ label: 'Kaputt', amount: -1, flowType: 'own_fixed' }],
        }),
        8,
      ),
    ).toThrow(/nicht negativ/)
    expect(() => simulateScenario(bareParams({ startDepotValue: -1 }), 8)).toThrow(/negativ/)
  })

  it('Umbuchungs-Zuflussarten sind unzulässig (G7)', () => {
    for (const flowType of ['reserve_transfer', 'liquidity_transfer'] as const) {
      expect(() =>
        simulateScenario(
          bareParams({
            monthlyContributions: [{ label: 'Umbuchung', amount: 75, flowType }],
          }),
          8,
        ),
      ).toThrow(/Umbuchung/)
    }
  })

  it('startMonth muss ein Kalendermonat 1–12 sein', () => {
    expect(() => simulateScenario(bareParams(), 0)).toThrow(/Kalendermonat/)
    expect(() => simulateScenario(bareParams(), 13)).toThrow(/Kalendermonat/)
  })

  it('Mutationsfreiheit: eingefrorene und ungefrorene Eingaben bleiben unverändert', () => {
    // deepFreeze würde bei einer Mutation im Strict Mode werfen.
    simulateScenario(deepFreeze(realParams(12)), START_MONTH)
    const params = smoothedParams(12)
    const before = JSON.stringify(params)
    simulateScenario(params, START_MONTH)
    expect(JSON.stringify(params)).toBe(before)
  })
})

describe('summarizeSimulation – Endwerte, Einzahlungen, Wertzuwachs aus der Annahme', () => {
  it('r = 0: growthFromAssumption ist null (kein Annahme-Anteil)', () => {
    const summary = summarizeSimulation(simulateScenario(realParams(12), START_MONTH))
    expect(summary.endTotal).toBeCloseTo(6150.06, 9)
    expect(summary.contributedTotal).toBeCloseTo(3000, 9)
    expect(summary.contributedOwn).toBeCloseTo(2422, 9)
    expect(summary.growthFromAssumption).toBeNull()
  })

  it('r > 0: Wertzuwachs = Endwert − Start − Einzahlungen (Growth-Pin 120,00)', () => {
    const summary = summarizeSimulation(
      simulateScenario(
        bareParams({ startDepotValue: 1000, months: 12, annualReturnRate: 0.12 }),
        8,
      ),
    )
    expect(summary.growthFromAssumption).not.toBeNull()
    expect(summary.growthFromAssumption!).toBeCloseTo(120, 8)
  })
})

describe('goalReachMonthInSeries – erster Erreichungsmonat je Kennzahl', () => {
  const series = simulateScenario(
    bareParams({
      months: 12,
      monthlyContributions: [
        { label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' },
        { label: 'Tagesgeld-Rate', amount: 50, flowType: 'own_fixed', target: 'cash' },
      ],
    }),
    8,
  ).points

  it('depotValue/tagesgeld/totalWealth liefern den ersten Monatsindex mit Wert ≥ Ziel', () => {
    expect(goalReachMonthInSeries(series, 'depotValue', 500)).toBe(5)
    expect(goalReachMonthInSeries(series, 'tagesgeld', 500)).toBe(10)
    expect(goalReachMonthInSeries(series, 'totalWealth', 600)).toBe(4)
  })

  it('nicht erreicht → null; bereits zum Start erreicht → 0', () => {
    expect(goalReachMonthInSeries(series, 'depotValue', 5000)).toBeNull()
    const richStart = simulateScenario(bareParams({ startDepotValue: 900, months: 1 }), 8).points
    expect(goalReachMonthInSeries(richStart, 'depotValue', 900)).toBe(0)
  })

  it('ungültige Ziele werden abgelehnt; isProjectableSimulationMetric grenzt die Kennzahlen ab', () => {
    expect(() => goalReachMonthInSeries(series, 'depotValue', 0)).toThrow(/größer als 0/)
    expect(() => goalReachMonthInSeries(series, 'depotValue', Number.NaN)).toThrow(/endliche Zahl/)
    expect(isProjectableSimulationMetric('tagesgeld')).toBe(true)
    expect(isProjectableSimulationMetric('depotValue')).toBe(true)
    expect(isProjectableSimulationMetric('totalWealth')).toBe(true)
    expect(isProjectableSimulationMetric('accountBalance')).toBe(false)
    expect(isProjectableSimulationMetric('positionValue')).toBe(false)
    expect(isProjectableSimulationMetric('manual')).toBe(false)
    expect(isProjectableSimulationMetric('monthlySavingsRate')).toBe(false)
    expect(isProjectableSimulationMetric(null)).toBe(false)
  })
})

describe('analyzeGoalsInSimulation – alle vier Status mit Begründung („weil …“)', () => {
  // 12 Monate, 100 €/Monat Depot ab 0 → Depot erreicht 500 bei Monat 5 (Dezember 2026).
  const series = simulateScenario(
    bareParams({
      months: 12,
      monthlyContributions: [{ label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' }],
    }),
    START_MONTH,
  ).points

  it('erreichbar (ohne Zieltermin): Erreichungsmonat + Horizont in der Begründung', () => {
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 500 })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reachMonthIndex).toBe(5)
    expect(analysis.reachMonthIso).toBe('2026-12')
    expect(analysis.reason).toContain('weil')
    expect(analysis.reason).toContain('Dezember 2026')
    expect(analysis.reason).toContain('Monat 5 von 12')
  })

  it('erreichbar (mit Zieltermin, rechtzeitig): Zieltermin in der Begründung', () => {
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 500, targetDate: '2027-06-30' })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reason).toContain('30.06.2027')
  })

  it('voraussichtlich verspätet: im Horizont erreicht, aber nach dem Zieltermin', () => {
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 500, targetDate: '2026-09-30' })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('late')
    expect(analysis.reason).toContain('weil')
    expect(analysis.reason).toContain('30.09.2026')
    expect(analysis.reason).toContain('Dezember 2026')
  })

  it('im Horizont nicht erreicht: Zielbetrag + Horizont in der Begründung', () => {
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 50000 })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('not-in-horizon')
    expect(analysis.reason).toContain('weil')
    expect(analysis.reason).toContain('12 projizierten Monate')
  })

  it('keine Aussage möglich: nicht projizierbare Kennzahl mit Aggregatmodell-Begründung', () => {
    const analyses = analyzeGoalsInSimulation(
      [
        goal({ id: 'goal-a', metric: 'accountBalance', refId: 'acc-x', targetAmount: 100 }),
        goal({ id: 'goal-b', metric: 'monthlySavingsRate', targetAmount: 1000 }),
        goal({ id: 'goal-c', metric: 'manual', targetAmount: 100 }),
        goal({ id: 'goal-d', metric: null }),
        goal({ id: 'goal-e', metric: 'depotValue', targetAmount: null }),
      ],
      FUND,
      series,
      TODAY,
    )
    expect(analyses.map((entry) => entry.outcome)).toEqual([
      'no-statement',
      'no-statement',
      'no-statement',
      'no-statement',
      'no-statement',
    ])
    expect(analyses[0].reason).toContain('nicht Teil des Aggregatmodells')
    expect(analyses[3].reason).toContain('keine Kennzahl')
    expect(analyses[4].reason).toContain('offen')
  })

  it('archivierte und pausierte Ziele sind ausgenommen (dokumentiert)', () => {
    const analyses = analyzeGoalsInSimulation(
      [
        goal({ id: 'goal-archived', metric: 'depotValue', targetAmount: 500, status: 'archived' }),
        goal({ id: 'goal-paused', metric: 'depotValue', targetAmount: 500, status: 'deferred' }),
        goal({ id: 'goal-active', metric: 'depotValue', targetAmount: 500 }),
      ],
      FUND,
      series,
      TODAY,
    )
    expect(analyses).toHaveLength(1)
    expect(analyses[0].goal.id).toBe('goal-active')
  })

  it('Notgroschen läuft über effectiveGoalTarget (4 × 1.170 = 4.680, Override-Vorrang)', () => {
    const cashSeries = simulateScenario(
      bareParams({
        startTagesgeldValue: 4600,
        months: 12,
        monthlyContributions: [
          { label: 'Tagesgeld-Rate', amount: 25, flowType: 'own_fixed', target: 'cash' },
        ],
      }),
      START_MONTH,
    ).points
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'tagesgeld', isAutoCalculated: true, targetAmount: null })],
      FUND,
      cashSeries,
      TODAY,
    )
    // 4.600 + 4 × 25 = 4.700 ≥ 4.680 → Monat 4.
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reachMonthIndex).toBe(4)
    const [withOverride] = analyzeGoalsInSimulation(
      [goal({ metric: 'tagesgeld', isAutoCalculated: true, targetAmount: null })],
      { ...FUND, manualOverrideAmount: 10000 },
      cashSeries,
      TODAY,
    )
    expect(withOverride.outcome).toBe('not-in-horizon')
  })

  it('bereits zum Start erreicht → Monatsindex 0 mit eigener Begründung', () => {
    const richSeries = simulateScenario(bareParams({ startDepotValue: 1000, months: 6 }), 8).points
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 900 })],
      FUND,
      richSeries,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reachMonthIndex).toBe(0)
    expect(analysis.reason).toContain('bereits zum Start')
  })

  it('N2: bereits zum Start erreicht schlägt einen VERGANGENEN Zieltermin – nie „verspätet“', () => {
    const richSeries = simulateScenario(bareParams({ startDepotValue: 1000, months: 6 }), 8).points
    const [analysis] = analyzeGoalsInSimulation(
      // Zieltermin lange vor dem Stichtag (2026-07-20): erreicht schlägt überfällig
      // (M12-Philosophie) – der Status ist 'reachable', nicht 'late'.
      [goal({ metric: 'depotValue', targetAmount: 900, targetDate: '2025-01-31' })],
      FUND,
      richSeries,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reachMonthIndex).toBe(0)
    expect(analysis.reason).toContain('bereits zum Start der Projektion erreicht')
    expect(analysis.reason).not.toContain('verspätet')
  })
})

describe('compareSimulations – Vergleich ab 2 Simulationen inkl. G9-Mischungs-Hinweis', () => {
  it('weniger als 2 Simulationen → null (definierter Zustand)', () => {
    expect(compareSimulations([])).toBeNull()
    expect(
      compareSimulations([
        { name: 'Nur eine', result: simulateScenario(realParams(12), START_MONTH) },
      ]),
    ).toBeNull()
  })

  it('liefert je Simulation Endwerte, Einzahlungen (G8-getrennt) und Annahmen', () => {
    const comparison = compareSimulations([
      { name: 'Real', result: simulateScenario(realParams(12), START_MONTH) },
      { name: 'Mit Annahme', result: simulateScenario(realParams(12, 0.05), START_MONTH) },
    ])
    expect(comparison).not.toBeNull()
    expect(comparison!.columns).toHaveLength(2)
    expect(comparison!.columns[0].name).toBe('Real')
    expect(comparison!.columns[0].endTotal).toBeCloseTo(6150.06, 9)
    expect(comparison!.columns[0].contributedOwn).toBeCloseTo(2422, 9)
    expect(comparison!.columns[0].contributedTotal).toBeCloseTo(3000, 9)
    expect(comparison!.columns[0].growthFromAssumption).toBeNull()
    expect(comparison!.columns[1].annualReturnRate).toBe(0.05)
    expect(comparison!.columns[1].endTotal).toBeGreaterThan(6150.06)
    expect(comparison!.columns[1].growthFromAssumption).not.toBeNull()
    // Beide real → keine Sicht-Mischung.
    expect(comparison!.viewsMixed).toBe(false)
  })

  it('erkennt gemischte Sichten (real vs. geglättet, G9-Hinweis-Pflicht)', () => {
    const comparison = compareSimulations([
      { name: 'Real', result: simulateScenario(realParams(12), START_MONTH) },
      { name: 'Geglättet', result: simulateScenario(smoothedParams(12), START_MONTH) },
    ])
    expect(comparison!.viewsMixed).toBe(true)
  })
})

describe('Randfall-Pins (calculation-tester M13)', () => {
  it('1.200 Monate bei r = 0 bleiben EXAKT: 1.000 + 1.200 x 100 = 121.000,00 (Drift-Pin)', () => {
    const result = simulateScenario(
      bareParams({
        startDepotValue: 1000,
        months: 1200,
        monthlyContributions: [{ label: 'Beitrag', amount: 100, flowType: 'own_fixed' }],
      }),
      START_MONTH,
    )
    expect(result.end.depot).toBe(121000)
  })

  it('Jahresereignis + Zielerreichung kombiniert: Depot-Ziel 10.000 im Seed-real-Szenario -> Monat 36 (Juli 2029)', () => {
    // depot(k) = 2.522,47 + 100k + 1.500 x (Julis in 1..k); Julis bei k = 12/24/36:
    // k=35 -> 9.022,47 < 10.000; k=36 -> 10.622,47 >= 10.000.
    const series = simulateScenario(deepFreeze(realParams(48)), START_MONTH).points
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 10000 })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
    expect(analysis.reachMonthIndex).toBe(36)
    expect(analysis.reachMonthIso).toBe('2029-07')
  })

  it('Zieltermin im ERREICHUNGSMONAT selbst -> rechtzeitig (reachable, nicht verspaetet)', () => {
    const series = simulateScenario(
      bareParams({
        months: 12,
        monthlyContributions: [{ label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed' }],
      }),
      START_MONTH,
    ).points
    // Erreichung bei Monat 5 = Dezember 2026; Termin 15.12.2026 = gleicher Monat.
    const [analysis] = analyzeGoalsInSimulation(
      [goal({ metric: 'depotValue', targetAmount: 500, targetDate: '2026-12-15' })],
      FUND,
      series,
      TODAY,
    )
    expect(analysis.outcome).toBe('reachable')
  })
})
