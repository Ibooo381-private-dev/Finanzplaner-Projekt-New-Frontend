/**
 * Unit-Tests F11–F21 (Zielwerte, Abweichungen, Kauf-/Verkaufsbedarf, Toleranz,
 * Sparraten-Rebalancing, Rundung). Erwartungswerte aus docs/calculation-rules.md
 * Abschnitt 12 (Seed-Snapshot 2026-07-17, Job-Profil). Eingaben sind eingefroren.
 */

import { describe, expect, it } from 'vitest'
import {
  actionLevel,
  buyRequirement,
  deviationEur,
  deviationPp,
  proposeSavingsRates,
  roundToUnit,
  roundWithVisibleAdjustment,
  sellRequirement,
  splitSavingsQuote,
  targetValues,
  validateLevel1,
  validateWeights,
} from '../../src/finance'
import type { PlanForRebalancing } from '../../src/finance'
import type { WeightEntry } from '../../src/types/finance'
import { loadExample } from '../storage/fixtures'
import { deepFreeze } from './deepFreeze'

const example = deepFreeze(loadExample())
const DEPOT = 2522.47
const jobWeights = example.targetProfiles.find((profile) => profile.id === 'tp-job')!.weights!

/** Ist-Werte des Seed-Snapshots je Position (für F13–F17). */
const ACTUAL: Record<string, number> = {
  'pos-vl-ishares-world': 577.99,
  'pos-xtrackers-world-dist': 204.86,
  'pos-spdr-world-acc': 237.45,
  'pos-ishares-em-imi': 99.11,
  'pos-ishares-gold-etc': 33.92,
  'pos-telekom-aktien': 1369.14,
}

describe('F21 – Zielgewichte validieren', () => {
  it('Job-Profil: Summe exakt 1,0 → gültig', () => {
    const validation = validateWeights(jobWeights)
    expect(validation.status).toBe('valid')
    expect(validation.sum).toBeCloseTo(1.0, 9)
    expect(validation.difference).toBeCloseTo(0, 9)
    expect(validation.issues).toEqual([])
  })

  it('leeres Profil (Ebene B / Eigene Aufteilung) → "empty", es wird nicht gerechnet', () => {
    expect(validateWeights(null).status).toBe('empty')
    expect(validateWeights([]).status).toBe('empty')
    expect(targetValues(null, DEPOT)).toBeNull()
  })

  it('Summe 0,9 → ungültig mit deutscher Meldung inkl. Ist-Summe (DM10)', () => {
    const invalid = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.6 },
      { refKind: 'group', ref: 'telekom', weight: 0.3 },
    ]) as unknown as WeightEntry[]
    const validation = validateWeights(invalid)
    expect(validation.status).toBe('invalid')
    expect(validation.issues[0]).toContain('0.9')
    expect(targetValues(invalid, DEPOT)).toBeNull()
  })

  it('Summe 0,9995 → gültig, Differenz sichtbar (Toleranz ±0,001)', () => {
    const nearOne = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.7 },
      { refKind: 'group', ref: 'em', weight: 0.2995 },
    ]) as unknown as WeightEntry[]
    const validation = validateWeights(nearOne)
    expect(validation.status).toBe('valid')
    expect(validation.difference).toBeCloseTo(-0.0005, 9)
  })

  it('ungültige Prozentwerte: Gewicht > 1 oder < 0 → ungültig, auch wenn die Summe stimmt', () => {
    const outOfRange = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 1.5 },
      { refKind: 'group', ref: 'gold', weight: -0.5 },
    ]) as unknown as WeightEntry[]
    const validation = validateWeights(outOfRange)
    expect(validation.status).toBe('invalid')
    expect(validation.issues).toHaveLength(2)
  })

  it('einzelnes Gewicht exakt 1,0 → gültig ohne Differenzausweis (F21-Randfall „genau 1,0“)', () => {
    // F21: 1,0 ∈ [0;1] und Σ = 1,0 exakt → gültig, Differenz 0, keine Meldungen.
    const single = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 1 },
    ]) as unknown as WeightEntry[]
    const validation = validateWeights(single)
    expect(validation.status).toBe('valid')
    expect(validation.sum).toBe(1)
    expect(validation.difference).toBe(0)
    expect(validation.issues).toEqual([])
    // 100 % World auf Seed-Depot: Sollwert = 1,0 × 2.522,47 = 2.522,47.
    expect(targetValues(single, DEPOT)![0].target).toBeCloseTo(DEPOT, 9)
  })

  it('Summe 0 (alle Gewichte 0) → ungültig; es gibt kein „alles 0“-Profil (F21-Randfall)', () => {
    // F21: Σ = 0 verletzt Σ = 1,0 ± 0,001 → invalid; targetValues rechnet nicht.
    const allZero = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0 },
      { refKind: 'group', ref: 'em', weight: 0 },
    ]) as unknown as WeightEntry[]
    const validation = validateWeights(allZero)
    expect(validation.status).toBe('invalid')
    expect(validation.sum).toBe(0)
    expect(targetValues(allZero, DEPOT)).toBeNull()
  })
})

describe('F11/F12 – Zielwerte (Job-Profil und eigene Zielaufteilung)', () => {
  it('Job-Profil auf Seed-Depot: Sollwerte wie im Formelkatalog, Summe exakt der Depotwert', () => {
    const targets = targetValues(jobWeights, DEPOT)!
    const byRef = new Map(targets.map((entry) => [entry.ref, entry.target]))
    expect(byRef.get('pos-vl-ishares-world')!).toBeCloseTo(121.07856, 5)
    expect(byRef.get('pos-xtrackers-world-dist')!).toBeCloseTo(781.9657, 4)
    expect(byRef.get('pos-spdr-world-acc')!).toBeCloseTo(862.68474, 5)
    expect(byRef.get('pos-ishares-em-imi')!).toBeCloseTo(378.3705, 4)
    expect(byRef.get('pos-ishares-gold-etc')!).toBeCloseTo(126.1235, 4)
    expect(byRef.get('pos-telekom-aktien')!).toBeCloseTo(252.247, 4)
    const sum = targets.reduce((acc, entry) => acc + entry.target, 0)
    expect(sum).toBeCloseTo(DEPOT, 6)
  })

  it('eigene Zielaufteilung (custom): gültige Gewichte rechnen wie das Job-Profil', () => {
    const custom = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.6 },
      { refKind: 'group', ref: 'em', weight: 0.2 },
      { refKind: 'group', ref: 'gold', weight: 0.1 },
      { refKind: 'group', ref: 'telekom', weight: 0.1 },
    ]) as unknown as WeightEntry[]
    const targets = targetValues(custom, 1000)!
    expect(targets.map((entry) => entry.target)).toEqual([600, 200, 100, 100])
  })

  it('leeres Depot (Depotwert 0) → null, keine Division und keine Sollwerte (F20)', () => {
    expect(targetValues(jobWeights, 0)).toBeNull()
  })
})

describe('F11 Ebene 1 / F21 – level1-Validierung und Sparquoten-Split', () => {
  const jobLevel1 = example.targetProfiles.find((profile) => profile.id === 'tp-job')!.level1!

  it('Job-level1 (0,85/0,15) ist gültig; Split von 988 € → 839,80 Depot + 148,20 Tagesgeld', () => {
    expect(validateLevel1(jobLevel1).status).toBe('valid')
    const split = splitSavingsQuote(988, jobLevel1)!
    expect(split.depotAmount).toBeCloseTo(839.8, 9)
    expect(split.cashAmount).toBeCloseTo(148.2, 9)
    expect(split.depotAmount + split.cashAmount).toBeCloseTo(988, 9)
  })

  it('fehlendes level1 → "empty" und kein Split (es wird nicht gerechnet)', () => {
    expect(validateLevel1(null).status).toBe('empty')
    expect(splitSavingsQuote(988, null)).toBeNull()
  })

  it('ungültige Summe (0,85 + 0,05) → invalid, kein Split', () => {
    const invalid = deepFreeze({ depotShare: 0.85, cashShare: 0.05 })
    expect(validateLevel1(invalid).status).toBe('invalid')
    expect(splitSavingsQuote(988, invalid)).toBeNull()
  })

  it('Anteile außerhalb [0;1] trotz Summe 1,0 (1,5/−0,5) → invalid (Review-Regel A2)', () => {
    const outOfRange = deepFreeze({ depotShare: 1.5, cashShare: -0.5 })
    const validation = validateLevel1(outOfRange)
    expect(validation.status).toBe('invalid')
    expect(validation.issues).toHaveLength(2)
  })

  it('negative Sparquote → kein Split (keine negativen Beträge)', () => {
    expect(splitSavingsQuote(-100, jobLevel1)).toBeNull()
  })

  it('Split rechnet intern ungerundet (F19): 987,65 → 839,5025 Depot + 148,1475 Tagesgeld', () => {
    // Arithmetik: 0,85 × 987,65 = 839,5025; 0,15 × 987,65 = 148,1475.
    // F19: intern wird ungerundet gerechnet – die dritte/vierte Nachkommastelle
    // bleibt erhalten (Rundung erst bei der Anzeige), Summe exakt die Sparquote.
    const split = splitSavingsQuote(987.65, jobLevel1)!
    expect(split.depotAmount).toBeCloseTo(839.5025, 9)
    expect(split.cashAmount).toBeCloseTo(148.1475, 9)
    expect(split.depotAmount + split.cashAmount).toBeCloseTo(987.65, 9)
  })

  it('Sparquote 0 ist gültig: Split 0/0 (nur negative Quoten werden abgelehnt)', () => {
    // 0,85 × 0 = 0 und 0,15 × 0 = 0 – gültiger Grenzfall, kein null.
    const split = splitSavingsQuote(0, jobLevel1)!
    expect(split.depotAmount).toBe(0)
    expect(split.cashAmount).toBe(0)
  })
})

describe('F13–F16 – Abweichungen, Kauf- und Verkaufsbedarf', () => {
  const targets = new Map(targetValues(jobWeights, DEPOT)!.map((entry) => [entry.ref, entry.target]))

  it('starke Übergewichtung Telekom: +1.116,89 EUR, +44,27775 Pp → Verkaufsoption wird erwähnt', () => {
    const telekomTarget = targets.get('pos-telekom-aktien')!
    expect(deviationEur(ACTUAL['pos-telekom-aktien'], telekomTarget)).toBeCloseTo(1116.893, 3)
    const pp = deviationPp(ACTUAL['pos-telekom-aktien'] / DEPOT, 0.1)
    expect(pp).toBeCloseTo(44.27775, 4)
    expect(actionLevel(pp)).toBe('recommendation-with-sale-option')
  })

  it('starke Untergewichtung EM (−11,07 Pp): nur Empfehlung – Verkaufsoption gibt es nur bei Übergewichtung (F14)', () => {
    const emPp = deviationPp(ACTUAL['pos-ishares-em-imi'] / DEPOT, 0.15)
    expect(emPp).toBeCloseTo(-11.07091, 4)
    // F14-Beispiel im Formelkatalog: EM −11,07091 Pp → „Empfehlung“ (ohne Verkaufsoption).
    expect(actionLevel(emPp)).toBe('recommendation')
    const goldPp = deviationPp(ACTUAL['pos-ishares-gold-etc'] / DEPOT, 0.05)
    expect(goldPp).toBeCloseTo(-3.65529, 4)
    expect(actionLevel(goldPp)).toBe('none')
  })

  it('Schwellen: ±4,99 → none; ±5 → recommendation; +10 → Verkaufsoption; −10/−44 → nur Empfehlung', () => {
    expect(actionLevel(4.99)).toBe('none')
    expect(actionLevel(-4.99)).toBe('none')
    expect(actionLevel(5)).toBe('recommendation')
    expect(actionLevel(-5)).toBe('recommendation')
    expect(actionLevel(10)).toBe('recommendation-with-sale-option')
    // Untergewichtung: nichts zu verkaufen → nie Verkaufsoption, egal wie groß die Lücke ist.
    expect(actionLevel(-10)).toBe('recommendation')
    expect(actionLevel(-44.28)).toBe('recommendation')
  })

  it('Grenzfall +9,99 Pp: knapp unter der 10er-Schwelle → nur Empfehlung, keine Verkaufsoption', () => {
    // U1/K12: Verkaufsoption erst ab ≥ +10 Pp. 9,99 < 10, aber |9,99| ≥ 5 → recommendation.
    expect(actionLevel(9.99)).toBe('recommendation')
    expect(actionLevel(-9.99)).toBe('recommendation')
  })

  it('Grenzfall ±5,01 Pp (knapp über der 5er-Schwelle) → Empfehlung; +10,01 → Verkaufsoption', () => {
    // K12: |5,01| ≥ 5 → recommendation (Verkaufsoption erst ab ≥ +10 Pp);
    // 10,01 ≥ 10 → recommendation-with-sale-option.
    expect(actionLevel(5.01)).toBe('recommendation')
    expect(actionLevel(-5.01)).toBe('recommendation')
    expect(actionLevel(10.01)).toBe('recommendation-with-sale-option')
  })

  it('Σ Kaufbedarf = Σ Verkaufsbedarf = 1.573,80444 (Pflichtprüfung S2, Seed + Job-Profil)', () => {
    let buySum = 0
    let sellSum = 0
    for (const [ref, target] of targets) {
      buySum += buyRequirement(ACTUAL[ref], target)
      sellSum += sellRequirement(ACTUAL[ref], target)
    }
    expect(buySum).toBeCloseTo(1573.80444, 5)
    expect(sellSum).toBeCloseTo(1573.80444, 5)
    expect(buySum).toBeCloseTo(sellSum, 9)
  })

  it('exakt erreichte Zielverteilung: Abweichung 0, Kauf- und Verkaufsbedarf 0', () => {
    for (const [, target] of targets) {
      expect(deviationEur(target, target)).toBe(0)
      expect(buyRequirement(target, target)).toBe(0)
      expect(sellRequirement(target, target)).toBe(0)
    }
    expect(deviationPp(0.1, 0.1)).toBe(0)
    expect(actionLevel(0)).toBe('none')
  })

  it('Kauf-/Verkaufsbedarf sind nie negativ (MAX-Klammer)', () => {
    expect(buyRequirement(500, 100)).toBe(0)
    expect(sellRequirement(100, 500)).toBe(0)
  })
})

describe('F17/F18 – Sparraten-Rebalancing (Budget 60, Seed-Lücken)', () => {
  /** Ungerundete Kaufbedarfslücken aus F15 (Seed + Job-Profil). */
  const GAPS = {
    spdr: 625.23474,
    xtrackers: 577.1057,
    em: 279.2605,
    gold: 92.2035,
  }

  function seedPlans(): PlanForRebalancing[] {
    return deepFreeze([
      // F18: VL ist fest (vertraglich fix, Mindestbetrag 33,50) – bleibt unverändert.
      {
        id: 'vl',
        isFlexible: false,
        isPaused: false,
        minAmount: 33.5,
        currentMonthlyAmount: 33.5,
        buyRequirement: 0,
      },
      {
        id: 'spdr',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 23,
        buyRequirement: GAPS.spdr,
      },
      {
        id: 'xtrackers',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 22,
        buyRequirement: GAPS.xtrackers,
      },
      {
        id: 'em',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 10,
        buyRequirement: GAPS.em,
      },
      {
        id: 'gold',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 5,
        buyRequirement: GAPS.gold,
      },
      // Übergewichtet (Lücke 0): flexible Position darf 0 erhalten (S2).
      {
        id: 'telekom-pos',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: 0,
      },
      // Pausierter flexibler Plan erhält 0.
      {
        id: 'pausiert',
        isFlexible: true,
        isPaused: true,
        minAmount: null,
        currentMonthlyAmount: 12,
        buyRequirement: 100,
      },
    ]) as PlanForRebalancing[]
  }

  it('F17-Beispiel: 23,84/22,00/10,65/3,52 → Ausgleich −0,01 an der größten Rate, Endsumme exakt 60,00', () => {
    const result = proposeSavingsRates(60, seedPlans())
    const byId = new Map(result.proposals.map((proposal) => [proposal.id, proposal]))
    expect(byId.get('vl')).toMatchObject({ proposedMonthlyAmount: 33.5, reason: 'fixed' })
    // Rohrundung wäre 23,84 – der Ausgleich −0,01 landet an der größten Rate (SPDR).
    expect(byId.get('spdr')).toMatchObject({ proposedMonthlyAmount: 23.83, reason: 'proportional' })
    expect(byId.get('xtrackers')!.proposedMonthlyAmount).toBeCloseTo(22.0, 9)
    expect(byId.get('em')!.proposedMonthlyAmount).toBeCloseTo(10.65, 9)
    expect(byId.get('gold')!.proposedMonthlyAmount).toBeCloseTo(3.52, 9)
    expect(byId.get('telekom-pos')).toMatchObject({ proposedMonthlyAmount: 0, reason: 'no-gap' })
    expect(byId.get('pausiert')).toMatchObject({ proposedMonthlyAmount: 0, reason: 'paused' })
    expect(result.roundingDifference).toBeCloseTo(0.01, 9)
    expect(result.adjustedId).toBe('spdr')
    expect(result.distributedBudget).toBeCloseTo(60.0, 9)
    // Keine vorgeschlagene Rate ist negativ; Summe ≤ Budget.
    result.proposals.forEach((proposal) => {
      expect(proposal.proposedMonthlyAmount).toBeGreaterThanOrEqual(0)
    })
  })

  it('Rundung auf volle Euro (unit 1): 24/22/11/4 = 61 → Ausgleich −1 → 23/22/11/4 = 60', () => {
    const result = proposeSavingsRates(60, seedPlans(), 1)
    const byId = new Map(result.proposals.map((proposal) => [proposal.id, proposal]))
    expect(byId.get('spdr')!.proposedMonthlyAmount).toBe(23)
    expect(byId.get('xtrackers')!.proposedMonthlyAmount).toBe(22)
    expect(byId.get('em')!.proposedMonthlyAmount).toBe(11)
    expect(byId.get('gold')!.proposedMonthlyAmount).toBe(4)
    expect(result.roundingDifference).toBe(1)
    expect(result.adjustedId).toBe('spdr')
    expect(result.distributedBudget).toBe(60)
  })

  it('Budget 0 oder keine Lücken → keine Verteilung, alle flexiblen 0, keine Division durch 0', () => {
    const zeroBudget = proposeSavingsRates(0, seedPlans())
    expect(zeroBudget.distributedBudget).toBe(0)
    zeroBudget.proposals
      .filter((proposal) => proposal.reason !== 'fixed')
      .forEach((proposal) => expect(proposal.proposedMonthlyAmount).toBe(0))

    const noGaps = seedPlans().map((plan) => ({ ...plan, buyRequirement: 0 }))
    const balanced = proposeSavingsRates(60, noGaps)
    expect(balanced.distributedBudget).toBe(0)
    expect(balanced.roundingDifference).toBe(0)
  })

  it('genau eine untergewichtete Position erhält das gesamte Budget', () => {
    const plans = deepFreeze([
      {
        id: 'einzig',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: 500,
      },
      {
        id: 'satt',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 10,
        buyRequirement: 0,
      },
    ]) as PlanForRebalancing[]
    const result = proposeSavingsRates(60, plans)
    expect(result.proposals[0].proposedMonthlyAmount).toBe(60)
    expect(result.proposals[1].proposedMonthlyAmount).toBe(0)
  })

  it('negative Lücke in der Eingabe → Fehler (F15 verlangt ≥ 0)', () => {
    const broken = [
      {
        id: 'kaputt',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: -1,
      },
    ]
    expect(() => proposeSavingsRates(60, broken)).toThrow(/nicht negativ/)
  })

  it('M1-Fix: nicht einheiten-genaue Budgets werden ABgerundet verteilt und nie überschritten', () => {
    // Cent-Einheit: 59,996 → verteilbar 59,99 (abgerundet); keine Exception, Summe ≤ Budget.
    const centBudget = proposeSavingsRates(59.996, seedPlans())
    expect(centBudget.distributedBudget).toBeCloseTo(59.99, 9)
    expect(centBudget.distributedBudget).toBeLessThanOrEqual(59.996)

    // Volle Euro: 62,50 → verteilbar 62. Rohrundung 25/23/11/4 = 63 → Ausgleich −1 an
    // der größten Rate (SPDR 25→24) → 24/23/11/4 = 62.
    const euroBudget = proposeSavingsRates(62.5, seedPlans(), 1)
    const byId = new Map(euroBudget.proposals.map((proposal) => [proposal.id, proposal]))
    expect(byId.get('spdr')!.proposedMonthlyAmount).toBe(24)
    expect(byId.get('xtrackers')!.proposedMonthlyAmount).toBe(23)
    expect(byId.get('em')!.proposedMonthlyAmount).toBe(11)
    expect(byId.get('gold')!.proposedMonthlyAmount).toBe(4)
    expect(euroBudget.distributedBudget).toBe(62)
    expect(euroBudget.roundingDifference).toBe(1)
  })

  it('K1-Fix: NaN- oder negativer minAmount wird abgewiesen (Defense-in-depth)', () => {
    const nanMin = [
      {
        id: 'fix-nan',
        isFlexible: false,
        isPaused: false,
        minAmount: Number.NaN,
        currentMonthlyAmount: 10,
        buyRequirement: 0,
      },
    ]
    expect(() => proposeSavingsRates(60, nanMin)).toThrow(/endliche Zahl/)
    const negativeMin = [
      {
        id: 'fix-negativ',
        isFlexible: false,
        isPaused: false,
        minAmount: -5,
        currentMonthlyAmount: 10,
        buyRequirement: 0,
      },
    ]
    expect(() => proposeSavingsRates(60, negativeMin)).toThrow(/nicht negativ/)
  })

  it('Budget kleiner als eine 1-Cent-Verteilung (0,01 auf drei Lücken): ein Cent, sichtbar ausgeglichen', () => {
    // Roh je 0,01 × 100/300 = 0,0033… → Cent-Rundung je 0,00; gerundete Summe 0
    // gegen Ziel 0,01 → Differenz −0,01 sichtbar, Ausgleich an der ersten (betrags-
    // größten) Position → Raten [0,01, 0, 0]; Summe exakt das Budget, keine Rate negativ.
    const plans = deepFreeze([
      {
        id: 'a',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: 100,
      },
      {
        id: 'b',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: 100,
      },
      {
        id: 'c',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 0,
        buyRequirement: 100,
      },
    ]) as PlanForRebalancing[]
    const result = proposeSavingsRates(0.01, plans)
    expect(result.proposals.map((proposal) => proposal.proposedMonthlyAmount)).toEqual([0.01, 0, 0])
    expect(result.roundingDifference).toBeCloseTo(-0.01, 9)
    expect(result.adjustedId).toBe('a')
    expect(result.distributedBudget).toBeCloseTo(0.01, 9)
  })
})

describe('F19 – Rundung und Rundungsausgleich', () => {
  it('kaufmännische Rundung auf Cent und volle Euro', () => {
    expect(roundToUnit(23.8366)).toBe(23.84)
    expect(roundToUnit(23.8366, 1)).toBe(24)
    expect(roundToUnit(3.515, 1)).toBe(4)
  })

  it('Ausgleich an der größten Position, Differenz sichtbar', () => {
    const result = roundWithVisibleAdjustment([23.8366, 22.0017, 10.6465, 3.5152], 60)
    expect(result.amounts).toEqual([23.83, 22.0, 10.65, 3.52])
    expect(result.roundingDifference).toBeCloseTo(0.01, 9)
    expect(result.adjustedIndex).toBe(0)
  })

  it('keine Differenz → kein Ausgleich (adjustedIndex −1)', () => {
    const result = roundWithVisibleAdjustment([30, 30], 60)
    expect(result.amounts).toEqual([30, 30])
    expect(result.roundingDifference).toBe(0)
    expect(result.adjustedIndex).toBe(-1)
  })

  it('leere Liste: keine Beträge, kein Ausgleich; Differenz zum Ziel bleibt sichtbar (F19)', () => {
    // Ziel 0 auf leerer Liste: Summe 0 = Ziel 0 → Differenz 0.
    const zero = roundWithVisibleAdjustment([], 0)
    expect(zero.amounts).toEqual([])
    expect(zero.roundingDifference).toBe(0)
    expect(zero.adjustedIndex).toBe(-1)
    // Ziel 60 ohne Positionen: 0 − 60 = −60 wird sichtbar ausgewiesen (F19),
    // nicht stillschweigend verschluckt; ein Ausgleich ist mangels Position unmöglich.
    const missing = roundWithVisibleAdjustment([], 60)
    expect(missing.amounts).toEqual([])
    expect(missing.roundingDifference).toBe(-60)
    expect(missing.adjustedIndex).toBe(-1)
  })

  it('Schutzregel S2: Ausgleich, der eine negative Rate ergäbe, wirft statt still zu verfälschen', () => {
    // [0,005, 0,005] rundet je auf 0,01 → Summe 0,02; Ziel 0,00 → Ausgleich −0,02
    // an Position 0 ergäbe 0,01 − 0,02 = −0,01 < 0 → definierter Fehler (S2).
    expect(() => roundWithVisibleAdjustment([0.005, 0.005], 0)).toThrow(/negativen Betrag/)
  })
})

describe('Reinheit – F11–F19 mutieren Eingaben nicht (Snapshot-Vergleich auf UNGEFRORENEN Daten)', () => {
  it('targetValues, splitSavingsQuote, proposeSavingsRates und Rundung lassen mutierbare Eingaben unverändert', () => {
    // Bewusst OHNE deepFreeze: positiver Nachweis, dass die Funktionen mutierbare
    // Eingaben nicht verändern (Snapshot vor/nach dem Aufruf ist identisch).
    const weights = jobWeights.map((entry) => ({ ...entry }))
    const beforeWeights = JSON.stringify(weights)
    targetValues(weights, DEPOT)
    expect(JSON.stringify(weights)).toBe(beforeWeights)

    const level1 = { depotShare: 0.85, cashShare: 0.15 }
    const beforeLevel1 = JSON.stringify(level1)
    splitSavingsQuote(988, level1)
    expect(JSON.stringify(level1)).toBe(beforeLevel1)

    const plans: PlanForRebalancing[] = [
      {
        id: 'a',
        isFlexible: true,
        isPaused: false,
        minAmount: null,
        currentMonthlyAmount: 5,
        buyRequirement: 300,
      },
      {
        id: 'b',
        isFlexible: false,
        isPaused: false,
        minAmount: 33.5,
        currentMonthlyAmount: 33.5,
        buyRequirement: 0,
      },
    ]
    const beforePlans = JSON.stringify(plans)
    proposeSavingsRates(60, plans)
    expect(JSON.stringify(plans)).toBe(beforePlans)

    const raw = [23.8366, 22.0017, 10.6465, 3.5152]
    const beforeRaw = JSON.stringify(raw)
    roundWithVisibleAdjustment(raw, 60)
    expect(JSON.stringify(raw)).toBe(beforeRaw)
  })
})
