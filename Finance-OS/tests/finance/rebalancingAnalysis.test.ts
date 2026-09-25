/**
 * Unit-Tests der M11-Rebalancing-Bausteine (Kompositionen über F5/F11–F17):
 * calculateRebalancingAnalysis (Seed×tp-job-Pins aus dem Formelkatalog),
 * deriveFlexibleMonthlyBudget (A1: Seed 60,00 / mit pausiertem Gold 55,00),
 * calculateSavingsOnlyRebalancing (F17-Verteilung 23,83/22/10,65/3,52 mit
 * −0,01-Ausgleich, remainingAfterSavings), estimateSavingsDuration (27 Monate,
 * „ungefähr, ohne Kursentwicklung" ist Anzeige-Pflicht der Seite),
 * calculateFullRebalancing (neue Verteilung = Zielverteilung, A7),
 * Sortierung/Gruppierung, T9-Mapping und alle Fehlerfälle (F20/F21/G11/A6).
 */

import { describe, expect, it } from 'vitest'
import {
  actionLevel,
  calculateFullRebalancing,
  calculateRebalancingAnalysis,
  calculateSavingsOnlyRebalancing,
  deriveFlexibleMonthlyBudget,
  estimateSavingsDuration,
  groupRecommendations,
  isContractBoundPosition,
  sortRebalancingEntries,
} from '../../src/finance'
import type { RebalancingAnalysis } from '../../src/finance'
import type { PortfolioPosition, SavingsPlan, WeightEntry } from '../../src/types/finance'
import { loadExample } from '../storage/fixtures'
import { deepFreeze } from './deepFreeze'

const TODAY = '2026-07-20'
const example = deepFreeze(loadExample())
const activePositions = example.portfolioPositions.filter(
  (position) => position.isActive !== false,
)
const jobWeights = example.targetProfiles.find((profile) => profile.id === 'tp-job')!.weights!

/** Analyse Seed × Job-Profil (in jedem Test frisch berechnet, Eingaben eingefroren). */
function jobAnalysis(): RebalancingAnalysis {
  const analysis = calculateRebalancingAnalysis(activePositions, jobWeights)
  if (analysis === null) throw new Error('Analyse unerwartet nicht berechenbar.')
  return analysis
}

/** Budget-relevante Anzeige-Pläne des Sparraten-Vorschlags (monatliche Positions-Pläne mit Betrag). */
function monthlyPositionPlans(plans: readonly SavingsPlan[] = example.savingsPlans): SavingsPlan[] {
  return plans.filter(
    (plan) =>
      plan.targetKind === 'position' &&
      plan.interval === 'monthly' &&
      typeof plan.amount === 'number' &&
      plan.amount > 0,
  )
}

function position(partial: {
  id: string
  name: string
  group: PortfolioPosition['group']
  value: number | null
}): PortfolioPosition {
  return {
    id: partial.id,
    name: partial.name,
    accountId: 'acc-test-depot',
    group: partial.group,
    valueHistory:
      partial.value === null ? [] : [{ date: '2026-07-17', value: partial.value }],
  }
}

describe('calculateRebalancingAnalysis – Seed × Job-Profil (Formelkatalog-Pins)', () => {
  it('liefert die F13/F14-Pins: Telekom +44,27775 Pp / +1.116,89 €; EM −11,07091; Gold −3,65529', () => {
    const analysis = jobAnalysis()
    expect(analysis.depotValue).toBeCloseTo(2522.47, 9)
    const byRef = new Map(analysis.entries.map((entry) => [entry.ref, entry]))
    const telekom = byRef.get('pos-telekom-aktien')!
    expect(telekom.deviationPp).toBeCloseTo(44.27775, 4)
    expect(telekom.deviationEur).toBeCloseTo(1116.893, 3)
    expect(telekom.sellRequirement).toBeCloseTo(1116.893, 3)
    expect(telekom.level).toBe('recommendation-with-sale-option')
    expect(telekom.name).toBe('Deutsche Telekom Aktien')
    const em = byRef.get('pos-ishares-em-imi')!
    expect(em.deviationPp).toBeCloseTo(-11.07091, 4)
    expect(em.level).toBe('recommendation')
    const gold = byRef.get('pos-ishares-gold-etc')!
    expect(gold.deviationPp).toBeCloseTo(-3.65529, 4)
    expect(gold.level).toBe('none')
  })

  it('liefert die F15-Kaufbedarfe 577,11/625,23/279,26/92,20 und Σ Kauf = Σ Verkauf = 1.573,80', () => {
    const analysis = jobAnalysis()
    const byRef = new Map(analysis.entries.map((entry) => [entry.ref, entry]))
    expect(byRef.get('pos-xtrackers-world-dist')!.buyRequirement).toBeCloseTo(577.11, 2)
    expect(byRef.get('pos-spdr-world-acc')!.buyRequirement).toBeCloseTo(625.23, 2)
    expect(byRef.get('pos-ishares-em-imi')!.buyRequirement).toBeCloseTo(279.26, 2)
    expect(byRef.get('pos-ishares-gold-etc')!.buyRequirement).toBeCloseTo(92.2, 2)
    expect(byRef.get('pos-vl-ishares-world')!.sellRequirement).toBeCloseTo(456.91, 2)
    expect(analysis.totalBuy).toBeCloseTo(1573.80444, 5)
    expect(analysis.totalSell).toBeCloseTo(1573.80444, 5)
    // S2-Pflichtprüfung: Σ Kauf = Σ Verkauf (Differenz ≈ 0) bei voller Abdeckung.
    expect(analysis.buySellDifference).toBeCloseTo(0, 9)
    expect(analysis.totalDeviation).toBeCloseTo(1573.80444, 5)
    expect(analysis.fullCoverage).toBe(true)
    expect(analysis.uncoveredPositionNames).toEqual([])
    expect(analysis.unvaluedPositionNames).toEqual([])
    expect(analysis.unresolvedRefs).toEqual([])
  })

  it('größte Abweichung ist Telekom; Handlungsebene gesamt ist die höchste Stufe', () => {
    const analysis = jobAnalysis()
    expect(analysis.largestDeviation!.ref).toBe('pos-telekom-aktien')
    expect(analysis.largestDeviation!.deviationPp).toBeCloseTo(44.27775, 4)
    expect(analysis.overallLevel).toBe('recommendation-with-sale-option')
  })

  it('Gruppen-Gewichte werden über groupTotal aufgelöst: World −29,55155 Pp (F14-Pin)', () => {
    const groupWeights = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.7 },
      { refKind: 'group', ref: 'em', weight: 0.15 },
      { refKind: 'group', ref: 'gold', weight: 0.05 },
      { refKind: 'group', ref: 'telekom', weight: 0.1 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(activePositions, groupWeights)!
    const world = analysis.entries.find((entry) => entry.ref === 'world')!
    expect(world.refKind).toBe('group')
    expect(world.name).toBeNull()
    expect(world.deviationPp).toBeCloseTo(-29.55155, 4)
    expect(world.buyRequirement).toBeCloseTo(745.429, 3)
    // Alle Positionen sind über ihre Gruppen abgedeckt → volle Abdeckung.
    expect(analysis.fullCoverage).toBe(true)
    expect(analysis.buySellDifference).toBeCloseTo(0, 9)
  })
})

describe('calculateRebalancingAnalysis – Fehler- und Randfälle (F20/F21/G11/A6)', () => {
  it('leeres Depot / Depotwert 0 → null („nicht berechenbar"), nie NaN', () => {
    expect(calculateRebalancingAnalysis([], jobWeights)).toBeNull()
    const zero = deepFreeze([
      position({ id: 'pos-a', name: 'A', group: 'world', value: 0 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 1 },
    ]) as unknown as WeightEntry[]
    expect(calculateRebalancingAnalysis(zero, weights)).toBeNull()
  })

  it('leeres Profil („nicht befüllt") und ungültige Gewichtssumme (0,9/1,1/negativ) → null, keine Rechnung', () => {
    expect(calculateRebalancingAnalysis(activePositions, null)).toBeNull()
    expect(calculateRebalancingAnalysis(activePositions, [])).toBeNull()
    const invalid09 = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.9 },
    ]) as unknown as WeightEntry[]
    expect(calculateRebalancingAnalysis(activePositions, invalid09)).toBeNull()
    const invalid11 = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 1.1 },
    ]) as unknown as WeightEntry[]
    expect(calculateRebalancingAnalysis(activePositions, invalid11)).toBeNull()
    const negative = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 1.5 },
      { refKind: 'group', ref: 'em', weight: -0.5 },
    ]) as unknown as WeightEntry[]
    expect(calculateRebalancingAnalysis(activePositions, negative)).toBeNull()
  })

  it('nur eine Position mit Gewicht 1,0: Soll = Depotwert, Abweichung 0, keine Empfehlung', () => {
    const positions = deepFreeze([
      position({ id: 'pos-solo', name: 'Solo', group: 'world', value: 500 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-solo', weight: 1 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    expect(analysis.entries).toHaveLength(1)
    expect(analysis.entries[0].deviationPp).toBe(0)
    expect(analysis.entries[0].level).toBe('none')
    expect(analysis.overallLevel).toBe('none')
    expect(analysis.totalDeviation).toBe(0)
  })

  it('explizites Gewicht 0: Soll 0, voller Verkaufsbedarf, Stufe nach Pp (kein erfundener Wert)', () => {
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'A', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'B', group: 'em', value: 300 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 0 },
      { refKind: 'position', ref: 'pos-b', weight: 1 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    const a = analysis.entries.find((entry) => entry.ref === 'pos-a')!
    expect(a.targetValue).toBe(0)
    expect(a.sellRequirement).toBe(100)
    // 25 Pp Übergewichtung → Empfehlung inkl. Verkaufsoption.
    expect(a.deviationPp).toBeCloseTo(25, 9)
    expect(a.level).toBe('recommendation-with-sale-option')
    expect(analysis.fullCoverage).toBe(true)
  })

  it('G11: Position ohne erfassten Wert fällt namentlich aus der Rechnung (nie 0) und bricht die Abdeckung', () => {
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'Bewertet', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'Unbewertet', group: 'em', value: null }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 0.5 },
      { refKind: 'position', ref: 'pos-b', weight: 0.5 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    expect(analysis.depotValue).toBe(100)
    expect(analysis.entries.map((entry) => entry.ref)).toEqual(['pos-a'])
    expect(analysis.unvaluedPositionNames).toEqual(['Unbewertet'])
    expect(analysis.fullCoverage).toBe(false)
    // Kein NaN/Infinity in den Ergebnissen.
    analysis.entries.forEach((entry) => {
      expect(Number.isFinite(entry.actualShare)).toBe(true)
      expect(Number.isFinite(entry.deviationPp)).toBe(true)
    })
  })

  it('A6: bewertete Position OHNE Gewichtseintrag bekommt KEIN Soll 0 – Abdeckungslücke sichtbar', () => {
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-telekom-aktien', weight: 1 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(activePositions, weights)!
    expect(analysis.entries).toHaveLength(1)
    expect(analysis.uncoveredPositionNames).toHaveLength(5)
    expect(analysis.uncoveredPositionNames).toContain('VL iShares Core MSCI World')
    expect(analysis.fullCoverage).toBe(false)
    // Σ Kauf ≠ Σ Verkauf – die Differenz ist sichtbar, keine stille „Konsistenz".
    expect(analysis.buySellDifference).toBeCloseTo(2522.47 - 1369.14, 6)
  })

  it('unbekannte Gewichts-Referenz → unresolvedRefs (defensiv; die Validierung lehnt sie beim Laden ab)', () => {
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'A', group: 'world', value: 100 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 0.5 },
      { refKind: 'position', ref: 'pos-unbekannt', weight: 0.5 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    expect(analysis.unresolvedRefs).toEqual(['pos-unbekannt'])
    expect(analysis.fullCoverage).toBe(false)
  })
})

describe('deriveFlexibleMonthlyBudget – A1-Budget-Herleitung', () => {
  it('Seed: 23 + 22 + 10 + 5 = 60,00 (nur aktive flexible eigene monatliche Positions-Pläne mit Betrag)', () => {
    const { budget, plans } = deriveFlexibleMonthlyBudget(example.savingsPlans, TODAY)
    expect(budget).toBeCloseTo(60, 9)
    expect(plans.map((plan) => plan.id)).toEqual([
      'sp-tr-spdr',
      'sp-tr-xtrackers',
      'sp-tr-em-imi',
      'sp-tr-gold',
    ])
  })

  it('mit pausiertem Gold-Plan: 55,00 (pausierte Pläne zählen nie ins Budget)', () => {
    const plans = deepFreeze(
      example.savingsPlans.map((plan) =>
        plan.id === 'sp-tr-gold' ? { ...plan, isPaused: true } : plan,
      ),
    ) as unknown as SavingsPlan[]
    expect(deriveFlexibleMonthlyBudget(plans, TODAY).budget).toBeCloseTo(55, 9)
  })

  it('Budget 0 ist der definierte „keine Empfehlung"-Zustand (alle Pläne unflexibel)', () => {
    const plans = deepFreeze(
      example.savingsPlans.map((plan) => ({ ...plan, isFlexible: false })),
    ) as unknown as SavingsPlan[]
    const { budget, plans: contributing } = deriveFlexibleMonthlyBudget(plans, TODAY)
    expect(budget).toBe(0)
    expect(contributing).toEqual([])
  })
})

describe('calculateSavingsOnlyRebalancing – F17/F18-Wrapper', () => {
  it('Seed×tp-job, Budget 60: 23,83/22,00/10,65/3,52 mit −0,01-Ausgleich am SPDR, Endsumme exakt 60,00', () => {
    const analysis = jobAnalysis()
    const result = calculateSavingsOnlyRebalancing(
      analysis,
      60,
      deepFreeze(monthlyPositionPlans()) as unknown as SavingsPlan[],
      activePositions,
    )
    const byId = new Map(result.proposal.proposals.map((proposal) => [proposal.id, proposal]))
    expect(byId.get('sp-vl-own')).toMatchObject({ proposedMonthlyAmount: 33.5, reason: 'fixed' })
    // F18: employer ist grundsätzlich nicht umlenkbar → fest.
    expect(byId.get('sp-vl-employer')).toMatchObject({ proposedMonthlyAmount: 6.5, reason: 'fixed' })
    expect(byId.get('sp-tr-spdr')).toMatchObject({
      proposedMonthlyAmount: 23.83,
      reason: 'proportional',
    })
    expect(byId.get('sp-tr-xtrackers')!.proposedMonthlyAmount).toBeCloseTo(22, 9)
    expect(byId.get('sp-tr-em-imi')!.proposedMonthlyAmount).toBeCloseTo(10.65, 9)
    expect(byId.get('sp-tr-gold')!.proposedMonthlyAmount).toBeCloseTo(3.52, 9)
    expect(result.proposal.roundingDifference).toBeCloseTo(0.01, 9)
    expect(result.proposal.adjustedId).toBe('sp-tr-spdr')
    expect(result.proposal.distributedBudget).toBeCloseTo(60, 9)
  })

  it('remainingAfterSavings: Übergewichtungen (Telekom, VL) bleiben – ohne Verkäufe nicht abbaubar', () => {
    const analysis = jobAnalysis()
    const result = calculateSavingsOnlyRebalancing(
      analysis,
      60,
      deepFreeze(monthlyPositionPlans()) as unknown as SavingsPlan[],
      activePositions,
    )
    const refs = result.remainingAfterSavings.map((entry) => entry.ref)
    expect(refs).toContain('pos-telekom-aktien')
    expect(refs).toContain('pos-vl-ishares-world')
    const telekom = result.remainingAfterSavings.find(
      (entry) => entry.ref === 'pos-telekom-aktien',
    )!
    expect(telekom.remainingSellRequirement).toBeCloseTo(1116.893, 3)
    expect(result.totalRemainingSell).toBeCloseTo(1573.80444, 5)
  })

  it('Gruppen-Gewichte: die Gruppen-Lücke wird gleichmäßig auf die flexiblen Pläne der Gruppe verteilt (keine Doppelzählung)', () => {
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'A', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'B', group: 'world', value: 100 }),
      position({ id: 'pos-c', name: 'C', group: 'em', value: 800 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 0.5 },
      { refKind: 'group', ref: 'em', weight: 0.5 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    // World-Lücke: Soll 500 − Ist 200 = 300.
    const plans = deepFreeze([
      {
        id: 'sp-a',
        name: 'Plan A',
        targetKind: 'position',
        targetId: 'pos-a',
        amount: 10,
        interval: 'monthly',
        flowType: 'own_fixed',
        validFrom: '2026-01-01',
      },
      {
        id: 'sp-b',
        name: 'Plan B',
        targetKind: 'position',
        targetId: 'pos-b',
        amount: 10,
        interval: 'monthly',
        flowType: 'own_fixed',
        validFrom: '2026-01-01',
      },
    ]) as unknown as SavingsPlan[]
    const result = calculateSavingsOnlyRebalancing(analysis, 20, plans, positions)
    expect(result.mappedPlans.map((plan) => plan.buyRequirement)).toEqual([150, 150])
    // Gleiche Lücken → hälftige Verteilung des Budgets.
    expect(
      result.proposal.proposals.map((proposal) => proposal.proposedMonthlyAmount),
    ).toEqual([10, 10])
  })
})

describe('estimateSavingsDuration – Dauer-Schätzung (Anzeige immer „ungefähr, ohne Kursentwicklung")', () => {
  it('Seed×tp-job: CEIL(1.573,80444 / 60) = 27 Monate', () => {
    expect(estimateSavingsDuration(1573.80444, 60)).toBe(27)
  })

  it('je Position: CEIL(kauf_i / rate_i) bei rate > 0', () => {
    expect(estimateSavingsDuration(625.23474, 23.83)).toBe(27)
    expect(estimateSavingsDuration(92.2035, 3.52)).toBe(27)
  })

  it('Budget 0, negativ oder nicht endlich → null (keine Schätzung, nie NaN/Infinity)', () => {
    expect(estimateSavingsDuration(1573.8, 0)).toBeNull()
    expect(estimateSavingsDuration(1573.8, -5)).toBeNull()
    expect(estimateSavingsDuration(1573.8, Number.NaN)).toBeNull()
    expect(estimateSavingsDuration(1573.8, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('Kaufbedarf 0 → 0 Monate; nicht endlicher Kaufbedarf → definierter Fehler', () => {
    expect(estimateSavingsDuration(0, 60)).toBe(0)
    expect(() => estimateSavingsDuration(Number.NaN, 60)).toThrow(/endliche Zahl/)
  })
})

describe('calculateFullRebalancing – hypothetische Voll-Simulation (A7: reine Anzeige)', () => {
  it('neue Verteilung = Zielverteilung; Käufe/Verkäufe = F15/F16; Summen wie die Analyse', () => {
    const analysis = jobAnalysis()
    const simulation = calculateFullRebalancing(analysis)
    expect(simulation.entries).toHaveLength(6)
    simulation.entries.forEach((entry) => {
      const source = analysis.entries.find((candidate) => candidate.ref === entry.ref)!
      expect(entry.newValue).toBeCloseTo(source.targetValue, 9)
      expect(entry.newShare).toBeCloseTo(source.targetShare, 9)
      expect(entry.buyAmount).toBe(source.buyRequirement)
      expect(entry.sellAmount).toBe(source.sellRequirement)
    })
    // Neue Anteile summieren zu 1,0 (Zielgewichte, F21).
    const shareSum = simulation.entries.reduce((sum, entry) => sum + entry.newShare, 0)
    expect(shareSum).toBeCloseTo(1, 9)
    expect(simulation.totalBuy).toBeCloseTo(1573.80444, 5)
    expect(simulation.totalSell).toBeCloseTo(1573.80444, 5)
  })

  it('unbewertete/nicht abgedeckte Positionen bleiben als Rest ausgewiesen', () => {
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'Bewertet', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'Unbewertet', group: 'em', value: null }),
      position({ id: 'pos-c', name: 'Ohne Gewicht', group: 'gold', value: 50 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 0.5 },
      { refKind: 'position', ref: 'pos-b', weight: 0.5 },
    ]) as unknown as WeightEntry[]
    const simulation = calculateFullRebalancing(
      calculateRebalancingAnalysis(positions, weights)!,
    )
    expect(simulation.unvaluedPositionNames).toEqual(['Unbewertet'])
    expect(simulation.uncoveredPositionNames).toEqual(['Ohne Gewicht'])
  })
})

describe('sortRebalancingEntries / groupRecommendations', () => {
  it('sortiert |Pp| absteigend: Telekom, SPDR, Xtrackers, VL, EM, Gold (Seed×tp-job)', () => {
    const sorted = sortRebalancingEntries(jobAnalysis().entries)
    expect(sorted.map((entry) => entry.ref)).toEqual([
      'pos-telekom-aktien',
      'pos-spdr-world-acc',
      'pos-xtrackers-world-dist',
      'pos-vl-ishares-world',
      'pos-ishares-em-imi',
      'pos-ishares-gold-etc',
    ])
  })

  it('bricht Gleichstände über den Namen (de-DE); Gruppen ohne Namen über die ref', () => {
    const entries = [
      { deviationPp: 5, name: 'Zebra', ref: 'z' },
      { deviationPp: -5, name: 'Anton', ref: 'a' },
      { deviationPp: 5, name: null, ref: 'gold' },
    ]
    const sorted = sortRebalancingEntries(entries)
    expect(sorted.map((entry) => entry.ref)).toEqual(['a', 'gold', 'z'])
    // Keine Mutation der Eingabe.
    expect(entries.map((entry) => entry.ref)).toEqual(['z', 'a', 'gold'])
  })

  it('partitioniert nach Handlungsstufe: Verkaufsoption / Empfehlung / nur Anzeige (Seed×tp-job)', () => {
    const groups = groupRecommendations(jobAnalysis().entries)
    expect(groups.saleOption.map((entry) => entry.ref).sort()).toEqual([
      'pos-telekom-aktien',
      'pos-vl-ishares-world',
    ])
    expect(groups.recommendation.map((entry) => entry.ref).sort()).toEqual([
      'pos-ishares-em-imi',
      'pos-spdr-world-acc',
      'pos-xtrackers-world-dist',
    ])
    expect(groups.none.map((entry) => entry.ref)).toEqual(['pos-ishares-gold-etc'])
  })

  it('T9-Mapping bleibt exakt gültig: 3 Pp → none, 6 Pp → recommendation, 12 Pp → sale-option', () => {
    expect(actionLevel(3)).toBe('none')
    expect(actionLevel(6)).toBe('recommendation')
    expect(actionLevel(12)).toBe('recommendation-with-sale-option')
    expect(actionLevel(-12)).toBe('recommendation')
  })
})

describe('Reinheit – M11-Funktionen mutieren Eingaben nicht', () => {
  it('calculateRebalancingAnalysis/-SavingsOnly/-Full lassen mutierbare Eingaben unverändert', () => {
    const positions = loadExample().portfolioPositions.filter(
      (candidate) => candidate.isActive !== false,
    )
    const weights = loadExample()
      .targetProfiles.find((profile) => profile.id === 'tp-job')!
      .weights!.map((entry) => ({ ...entry }))
    const plans = monthlyPositionPlans(loadExample().savingsPlans)
    const beforePositions = JSON.stringify(positions)
    const beforeWeights = JSON.stringify(weights)
    const beforePlans = JSON.stringify(plans)
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    calculateSavingsOnlyRebalancing(analysis, 60, plans, positions)
    calculateFullRebalancing(analysis)
    sortRebalancingEntries(analysis.entries)
    groupRecommendations(analysis.entries)
    expect(JSON.stringify(positions)).toBe(beforePositions)
    expect(JSON.stringify(weights)).toBe(beforeWeights)
    expect(JSON.stringify(plans)).toBe(beforePlans)
  })
})

describe('isContractBoundPosition – F16-Randfall VL-Vertragsbindung (finance-analyst M11)', () => {
  it('Seed: VL-Position ist vertraglich gebunden (own_fixed + isFlexible false), Telekom nicht', () => {
    expect(isContractBoundPosition('pos-vl-ishares-world', example.savingsPlans)).toBe(true)
    // Telekom: der EIGENE Plan ist flexibel; der nicht-flexible Bonus ist
    // employer und bindet nur den Zufluss, nicht den Bestand.
    expect(isContractBoundPosition('pos-telekom-aktien', example.savingsPlans)).toBe(false)
    expect(isContractBoundPosition('pos-spdr-world-acc', example.savingsPlans)).toBe(false)
    expect(isContractBoundPosition('pos-unbekannt', example.savingsPlans)).toBe(false)
  })

  it('own_variable mit isFlexible false löst den Hinweis ebenfalls aus', () => {
    const plans = deepFreeze([
      {
        id: 'sp-var-fix',
        name: 'Variabel, vertraglich gebunden',
        targetKind: 'position',
        targetId: 'pos-x',
        amount: 10,
        interval: 'monthly',
        flowType: 'own_variable',
        isFlexible: false,
        validFrom: '2026-01-01',
        validUntil: null,
      },
    ]) as unknown as SavingsPlan[]
    expect(isContractBoundPosition('pos-x', plans)).toBe(true)
  })
})

describe('Randfall-Pins (calculation-tester M11)', () => {
  it('Gruppen-Gewicht mit unbewerteter Position in der Gruppe: Name ausgewiesen, Konsistenz bleibt', () => {
    // groupTotal rechnet nur mit bewerteten Positionen; die unbewertete wird
    // namentlich ausgewiesen (G11) – dokumentiertes Zusammenspiel, hier gepinnt.
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'Bewertet World', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'Unbewertet World', group: 'world', value: null }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'group', ref: 'world', weight: 1 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    expect(analysis.unvaluedPositionNames).toEqual(['Unbewertet World'])
    expect(analysis.totalBuy).toBeCloseTo(analysis.totalSell, 9)
  })

  it('zwei flexible Monats-Pläne auf DIESELBE Zielposition: Lücke zählt je Plan (dokumentierte V1-Regel)', () => {
    // calculation-rules M11: die Kaufbedarfslücke geht je Plan in den
    // F17-Nenner ein – bei zwei Plänen auf dieselbe untergewichtete Position
    // erhält jeder die Hälfte des Budgets (im Seed unerreichbar, hier gepinnt).
    const positions = deepFreeze([
      position({ id: 'pos-a', name: 'A', group: 'world', value: 100 }),
      position({ id: 'pos-b', name: 'B', group: 'em', value: 300 }),
    ]) as unknown as PortfolioPosition[]
    const weights = deepFreeze([
      { refKind: 'position', ref: 'pos-a', weight: 0.5 },
      { refKind: 'position', ref: 'pos-b', weight: 0.5 },
    ]) as unknown as WeightEntry[]
    const analysis = calculateRebalancingAnalysis(positions, weights)!
    const plan = (id: string): SavingsPlan =>
      ({
        id,
        name: id,
        targetKind: 'position',
        targetId: 'pos-a',
        amount: 10,
        interval: 'monthly',
        flowType: 'own_fixed',
        isFlexible: true,
        validFrom: '2026-01-01',
        validUntil: null,
      }) as unknown as SavingsPlan
    const result = calculateSavingsOnlyRebalancing(
      analysis,
      20,
      deepFreeze([plan('sp-1'), plan('sp-2')]) as unknown as SavingsPlan[],
      positions,
    )
    const amounts = result.proposal.proposals
      .filter((entry) => entry.reason === 'proportional')
      .map((entry) => entry.proposedMonthlyAmount)
    expect(amounts).toEqual([10, 10])
  })
})
