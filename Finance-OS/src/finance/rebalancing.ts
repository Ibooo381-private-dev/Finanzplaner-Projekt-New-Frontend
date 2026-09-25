/**
 * Sparraten-Rebalancing (Formelkatalog F17/F18, rebalancing-Skill S2):
 * Das flexible Budget wird proportional zur Kaufbedarfslücke auf untergewichtete
 * Positionen verteilt (definierte V1-Standardmethode). Nicht flexible Pläne bleiben
 * unverändert (feste Mindestbeträge, F18); pausierte und übergewichtete flexible
 * Pläne erhalten 0. Keine vorgeschlagene Rate ist negativ; die Summe überschreitet
 * nie das Budget; Rundungsdifferenzen werden sichtbar zurückgegeben (F19).
 * Ergebnisse sind IMMER nur Empfehlungen (G1/G2/G5).
 * Reine Funktionen; Eingaben werden nicht mutiert.
 */

import { assertFinite, floorToUnit, roundWithVisibleAdjustment } from './rounding'
import type { RoundingUnit } from './rounding'
import type {
  PortfolioPosition,
  PositionGroup,
  SavingsPlan,
  WeightEntry,
  WeightRefKind,
} from '../types/finance'
import { actionLevel, buyRequirement, deviationEur, deviationPp, sellRequirement, targetValues } from './targets'
import type { ActionLevel } from './targets'
import { depotValue, groupTotal, latestEntry, share } from './wealth'
import { isPlanActiveOn } from './savings'

export interface PlanForRebalancing {
  id: string
  /** false = fester Plan: bleibt unverändert, minAmount wird eingehalten (F18). */
  isFlexible: boolean
  /** Pausierte flexible Pläne erhalten 0 (S2-Maßnahme 4). */
  isPaused: boolean
  /** Mindestbetrag nicht flexibler Pläne (null = keiner). */
  minAmount: number | null
  /** Aktuelle Monatsrate (für feste Pläne der unveränderte Vorschlag). */
  currentMonthlyAmount: number
  /** Kaufbedarfslücke der Zielposition (F15), ≥ 0; 0 = nicht untergewichtet. */
  buyRequirement: number
}

export type ProposalReason = 'fixed' | 'paused' | 'no-gap' | 'proportional'

export interface RateProposal {
  id: string
  /** Vorgeschlagene Monatsrate; nie negativ. */
  proposedMonthlyAmount: number
  reason: ProposalReason
}

export interface RebalancingProposal {
  proposals: RateProposal[]
  /** Verteiltes flexibles Budget (0, wenn keine Lücken vorhanden sind). */
  distributedBudget: number
  /** Sichtbare Rundungsdifferenz vor dem Ausgleich (F19); 0 ohne Ausgleich. */
  roundingDifference: number
  /** Plan-ID, an der ausgeglichen wurde (null = kein Ausgleich). */
  adjustedId: string | null
}

/**
 * F17 – Sparraten-Rebalancing: rate_i = budget × kauf_i / Σ kauf über flexible,
 * nicht pausierte Pläne mit Lücke > 0. Randfälle: Budget ≤ 0 oder Σ kauf = 0 →
 * keine Verteilung (keine Division durch 0, F20); genau eine untergewichtete
 * Position → erhält das gesamte Budget.
 */
export function proposeSavingsRates(
  flexibleBudget: number,
  plans: readonly PlanForRebalancing[],
  unit: RoundingUnit = 0.01,
): RebalancingProposal {
  assertFinite(flexibleBudget, 'flexibleBudget')
  plans.forEach((plan) => {
    assertFinite(plan.currentMonthlyAmount, `plan[${plan.id}].currentMonthlyAmount`)
    assertFinite(plan.buyRequirement, `plan[${plan.id}].buyRequirement`)
    if (plan.buyRequirement < 0) {
      throw new Error(`»buyRequirement« von Plan ${plan.id} darf nicht negativ sein (F15).`)
    }
    if (plan.minAmount !== null) {
      assertFinite(plan.minAmount, `plan[${plan.id}].minAmount`)
      if (plan.minAmount < 0) {
        throw new Error(`»minAmount« von Plan ${plan.id} darf nicht negativ sein (C7).`)
      }
    }
  })

  const fixedProposals: RateProposal[] = []
  const receivers: PlanForRebalancing[] = []
  const zeroReceivers: RateProposal[] = []

  for (const plan of plans) {
    if (!plan.isFlexible) {
      // F18: fester Plan bleibt unverändert; Mindestbetrag wird eingehalten.
      const minimum = plan.minAmount ?? 0
      const proposed = Math.max(plan.currentMonthlyAmount, minimum)
      fixedProposals.push({ id: plan.id, proposedMonthlyAmount: proposed, reason: 'fixed' })
    } else if (plan.isPaused) {
      zeroReceivers.push({ id: plan.id, proposedMonthlyAmount: 0, reason: 'paused' })
    } else if (plan.buyRequirement <= 0) {
      // Übergewichtete flexible Positionen dürfen 0 erhalten (S2).
      zeroReceivers.push({ id: plan.id, proposedMonthlyAmount: 0, reason: 'no-gap' })
    } else {
      receivers.push(plan)
    }
  }

  const totalGap = receivers.reduce((sum, plan) => sum + plan.buyRequirement, 0)
  // Review-Befund M1: Nicht einheiten-genaue Budgets werden ABgerundet verteilt –
  // die Verteilung darf das reale Budget nie überschreiten (S2); der nicht
  // verteilbare Rest bleibt als Differenz flexibleBudget − distributedBudget sichtbar.
  const distributable = floorToUnit(Math.max(0, flexibleBudget), unit)
  if (flexibleBudget <= 0 || totalGap <= 0 || distributable <= 0) {
    const proposals = orderLikeInput(plans, [
      ...fixedProposals,
      ...zeroReceivers,
      ...receivers.map(
        (plan): RateProposal => ({ id: plan.id, proposedMonthlyAmount: 0, reason: 'no-gap' }),
      ),
    ])
    return { proposals, distributedBudget: 0, roundingDifference: 0, adjustedId: null }
  }

  const rawAmounts = receivers.map((plan) => (distributable * plan.buyRequirement) / totalGap)
  const distribution = roundWithVisibleAdjustment(rawAmounts, distributable, unit)
  const receiverProposals = receivers.map(
    (plan, index): RateProposal => ({
      id: plan.id,
      proposedMonthlyAmount: distribution.amounts[index],
      reason: 'proportional',
    }),
  )
  // Schutzregeln (S2): keine negative Rate, Summe ≤ Budget.
  receiverProposals.forEach((proposal) => {
    if (proposal.proposedMonthlyAmount < 0) {
      throw new Error(`Vorgeschlagene Rate für ${proposal.id} wäre negativ – nicht zulässig (S2).`)
    }
  })
  const distributedBudget = receiverProposals.reduce(
    (sum, proposal) => sum + proposal.proposedMonthlyAmount,
    0,
  )
  if (distributedBudget - flexibleBudget > 1e-9) {
    throw new Error('Die Summe der vorgeschlagenen Raten überschreitet das Budget (S2).')
  }

  return {
    proposals: orderLikeInput(plans, [...fixedProposals, ...zeroReceivers, ...receiverProposals]),
    distributedBudget,
    roundingDifference: distribution.roundingDifference,
    adjustedId:
      distribution.adjustedIndex >= 0 ? receivers[distribution.adjustedIndex].id : null,
  }
}

/**
 * F16-Randfall (finance-analyst M11): Wird die Position von einem
 * NICHT-flexiblen EIGENEN Plan bespart (z. B. VL-Vertrag), ist ein Verkauf
 * real zusätzlich durch die Vertragsbindung eingeschränkt – reiner
 * Anzeige-Hinweis, keine neue Schwelle. employer-/provider-Pläne zählen nicht
 * (sie binden den Arbeitgeber-/Anbieterfluss, nicht den Bestand).
 */
export function isContractBoundPosition(
  positionId: string,
  plans: readonly SavingsPlan[],
): boolean {
  return plans.some(
    (plan) =>
      plan.targetKind === 'position' &&
      plan.targetId === positionId &&
      (plan.flowType === 'own_fixed' || plan.flowType === 'own_variable') &&
      plan.isFlexible === false,
  )
}

/** Stellt die Eingabereihenfolge der Vorschläge wieder her (stabil, ohne Mutation). */
function orderLikeInput(
  plans: readonly PlanForRebalancing[],
  proposals: readonly RateProposal[],
): RateProposal[] {
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]))
  return plans.map((plan) => {
    const proposal = byId.get(plan.id)
    if (!proposal) {
      throw new Error(`Interner Fehler: kein Vorschlag für Plan ${plan.id}.`)
    }
    return proposal
  })
}

// ============================================================================
// Rebalancing-Bausteine (M11) – dünne, deterministische Kompositionen ÜBER den
// bestehenden Formelkatalog-Funktionen (F5/F11–F17, F20/F21). Bewusste
// Entscheidung (dokumentiert): Die Auftragsnamen calculateCurrentAllocation/
// calculateTargetAllocation/calculateDeviation/calculateDeviationEuro/
// calculateActionLevel werden NICHT als Duplikate angelegt – sie sind
// Bestandteile von calculateRebalancingAnalysis; die bestehenden F-Funktionen
// (share/targetValues/deviationPp/deviationEur/buyRequirement/sellRequirement/
// actionLevel) SIND die Implementierung. Alle Funktionen sind pur,
// deterministisch, mutationsfrei, NaN/Infinity-sicher und stichtagsfrei
// (Stichtage werden, wo nötig, injiziert – nie new Date()).
// ============================================================================

export interface RebalancingAnalysisEntry {
  refKind: WeightRefKind
  ref: string
  /** Positionsname (refKind "position"); null bei Gruppen – die UI übersetzt Gruppen-Labels. */
  name: string | null
  /** Ist-Wert in EUR (jüngster Eintrag bzw. Gruppensumme). */
  actualValue: number
  /** F5 – Ist-Anteil am Depot (Dezimalzahl). */
  actualShare: number
  /** Zielgewicht (Dezimalzahl, normativ aus dem Profil). */
  targetShare: number
  /** F11/F12 – Sollwert in EUR (ungerundet). */
  targetValue: number
  /** F14 – Abweichung in Prozentpunkten (Vorzeichen: + = übergewichtet). */
  deviationPp: number
  /** F13 – Abweichung in EUR (Vorzeichen: + = übergewichtet). */
  deviationEur: number
  /** F15 – Kaufbedarf ≥ 0. */
  buyRequirement: number
  /** F16 – Verkaufsbedarf ≥ 0 (reine Information, G1). */
  sellRequirement: number
  /** Handlungsstufe (unverändert actionLevel: none / recommendation / recommendation-with-sale-option). */
  level: ActionLevel
}

export interface RebalancingAnalysis {
  /** F2 – Depotwert-Basis (nur bewertete Positionen; unbewertete zählen NIE als 0, G11). */
  depotValue: number
  /** Einträge in Gewichts-Reihenfolge (Anzeige-Sortierung über sortRebalancingEntries). */
  entries: RebalancingAnalysisEntry[]
  /** Σ Kaufbedarf (F15). */
  totalBuy: number
  /** Σ Verkaufsbedarf (F16). */
  totalSell: number
  /**
   * Sichtbare Konsistenz-Differenz Σ Kauf − Σ Verkauf (S2-Pflichtprüfung):
   * bei vollständiger Abdeckung ≈ 0; bei Abdeckungslücken sichtbar ≠ 0.
   */
  buySellDifference: number
  /**
   * Definierte „Gesamtabweichung" (M11): Σ Kaufbedarf (= Σ Verkaufsbedarf bei
   * vollständiger Abdeckung); die größte |Pp|-Abweichung steht daneben.
   */
  totalDeviation: number
  /** Eintrag mit der größten |Pp|-Abweichung (null bei leerer Analyse). */
  largestDeviation: RebalancingAnalysisEntry | null
  /** Höchste Handlungsstufe über alle Einträge. */
  overallLevel: ActionLevel
  /**
   * A6 – aktive BEWERTETE Positionen ohne Gewichtseintrag im Profil: sie
   * erhalten KEIN erfundenes Soll 0, sondern werden hier namentlich als
   * Abdeckungslücke ausgewiesen (Σ Kauf = Σ Verkauf gilt dann nicht).
   */
  uncoveredPositionNames: string[]
  /** G11 – aktive Positionen ohne erfassten Wert („unbekannt", nie 0): aus der Rechnung ausgeschlossen. */
  unvaluedPositionNames: string[]
  /** Defensiv (UI-seitig; die Validierung lehnt tote Referenzen bereits beim Laden ab): nicht auflösbare Gewichts-Referenzen. */
  unresolvedRefs: string[]
  /** true = jede bewertete aktive Position ist abgedeckt → Σ Kauf = Σ Verkauf-Pflichtprüfung gilt. */
  fullCoverage: boolean
}

/**
 * M11 – Rebalancing-Analyse: komponiert F5 (share), F11/F12 (targetValues),
 * F13 (deviationEur), F14 (deviationPp), F15/F16 (buy-/sellRequirement) und
 * actionLevel je Gewichtseintrag des Profils. Gruppen-Gewichte werden wie im
 * DepotPage-Zielvergleich über groupTotal aufgelöst. Der Aufrufer übergibt
 * AKTIVE Positionen (inaktive fließen nie ein). null bei leerem/ungültigem
 * Profil („nicht befüllt"/abgelehnt, F21) sowie bei Depotwert ≤ 0 (F20:
 * „nicht berechenbar", nie NaN).
 */
export function calculateRebalancingAnalysis(
  positions: readonly PortfolioPosition[],
  weights: readonly WeightEntry[] | null | undefined,
): RebalancingAnalysis | null {
  const depot = depotValue(positions)
  const targets = targetValues(weights, depot.amount)
  if (targets === null) return null

  const positionById = new Map(positions.map((position) => [position.id, position]))
  const nameById = new Map(positions.map((position) => [position.id, position.name]))
  const unvaluedPositionNames = positions
    .filter((position) => position.valueHistory.length === 0)
    .map((position) => position.name)

  const entries: RebalancingAnalysisEntry[] = []
  const unresolvedRefs: string[] = []
  /** IDs der über Gewichte abgedeckten Positionen (direkt oder über die Gruppe). */
  const coveredIds = new Set<string>()
  let droppedUnvaluedRef = false

  for (const target of targets) {
    let actualValue: number | null = null
    let name: string | null = null
    if (target.refKind === 'group') {
      const group = groupTotal(positions, target.ref as PositionGroup)
      actualValue = group.amount
      positions.forEach((position) => {
        if (position.group === target.ref) coveredIds.add(position.id)
      })
    } else {
      const position = positionById.get(target.ref)
      if (position === undefined) {
        // Defensiv: tote Referenz (Validierung lehnt sie beim Laden bereits ab).
        unresolvedRefs.push(target.ref)
        continue
      }
      coveredIds.add(position.id)
      name = position.name
      const entry = latestEntry(position.valueHistory)
      if (entry === null) {
        // G11: unbewertet = „unbekannt", nie 0 – Eintrag fällt aus der Rechnung.
        droppedUnvaluedRef = true
        continue
      }
      actualValue = entry.value
    }
    // depot.amount > 0 ist durch targetValues gesichert (F20) – share ist nie null.
    const actualShare = share(actualValue, depot.amount)!
    const pp = deviationPp(actualShare, target.weight)
    entries.push({
      refKind: target.refKind,
      ref: target.ref,
      name,
      actualValue,
      actualShare,
      targetShare: target.weight,
      targetValue: target.target,
      deviationPp: pp,
      deviationEur: deviationEur(actualValue, target.target),
      buyRequirement: buyRequirement(actualValue, target.target),
      sellRequirement: sellRequirement(actualValue, target.target),
      level: actionLevel(pp),
    })
  }

  const totalBuy = entries.reduce((sum, entry) => sum + entry.buyRequirement, 0)
  const totalSell = entries.reduce((sum, entry) => sum + entry.sellRequirement, 0)
  const largestDeviation = entries.reduce<RebalancingAnalysisEntry | null>(
    (largest, entry) =>
      largest === null || Math.abs(entry.deviationPp) > Math.abs(largest.deviationPp)
        ? entry
        : largest,
    null,
  )
  const overallLevel: ActionLevel = entries.some(
    (entry) => entry.level === 'recommendation-with-sale-option',
  )
    ? 'recommendation-with-sale-option'
    : entries.some((entry) => entry.level === 'recommendation')
      ? 'recommendation'
      : 'none'
  // A6: bewertete aktive Positionen ohne Gewichtseintrag – KEIN erfundenes Soll 0.
  const uncoveredPositionNames = positions
    .filter((position) => position.valueHistory.length > 0 && !coveredIds.has(position.id))
    .map((position) => nameById.get(position.id) ?? position.id)

  return {
    depotValue: depot.amount,
    entries,
    totalBuy,
    totalSell,
    buySellDifference: totalBuy - totalSell,
    totalDeviation: totalBuy,
    largestDeviation,
    overallLevel,
    uncoveredPositionNames,
    unvaluedPositionNames,
    unresolvedRefs,
    fullCoverage:
      uncoveredPositionNames.length === 0 && unresolvedRefs.length === 0 && !droppedUnvaluedRef,
  }
}

/**
 * A1 (data-architect-ratifiziert) – abgeleitetes flexibles F17-Monatsbudget:
 * Summe der Pläne mit aktiv (isPlanActiveOn am injizierten Stichtag),
 * isFlexible !== false, flowType ∈ {own_fixed, own_variable},
 * interval === "monthly", targetKind === "position" und endlichem amount > 0.
 * Seed: 23 + 22 + 10 + 5 = 60,00 (Tagesgeld-/Konto-Pläne, Umbuchungen,
 * Saveback/Round-up ohne Betrag und Jahrespläne fallen korrekt heraus);
 * mit pausiertem Gold-Plan 55,00. Budget 0 ist der definierte
 * „keine Empfehlung"-Zustand. Die beitragenden Pläne werden für die sichtbare
 * Budget-Herleitung mit zurückgegeben.
 */
export function deriveFlexibleMonthlyBudget(
  plans: readonly SavingsPlan[],
  todayIso: string,
): { budget: number; plans: SavingsPlan[] } {
  const contributing = plans.filter(
    (plan) =>
      isPlanActiveOn(plan, todayIso) &&
      plan.isFlexible !== false &&
      (plan.flowType === 'own_fixed' || plan.flowType === 'own_variable') &&
      plan.interval === 'monthly' &&
      plan.targetKind === 'position' &&
      typeof plan.amount === 'number' &&
      Number.isFinite(plan.amount) &&
      plan.amount > 0,
  )
  const budget = contributing.reduce((sum, plan) => sum + (plan.amount ?? 0), 0)
  return { budget, plans: contributing }
}

export interface RemainingDeviation {
  refKind: WeightRefKind
  ref: string
  name: string | null
  /** Verbleibender Verkaufsbedarf (F16) – ohne Verkäufe nicht abbaubar. */
  remainingSellRequirement: number
}

export interface SavingsOnlyRebalancing {
  /** F17/F18-Ergebnis (proposeSavingsRates) in Plan-Reihenfolge. */
  proposal: RebalancingProposal
  /** Zuordnung Plan → Kaufbedarfslücke (für Anzeige und Dauer je Position). */
  mappedPlans: PlanForRebalancing[]
  /**
   * Verbleibende Abweichung, wenn NUR Zuflüsse fließen: übergewichtete
   * Positionen behalten ihren Verkaufsbedarf – Übergewichtungen sind ohne
   * Verkäufe nicht abbaubar (dokumentierte Pflicht-Kennzeichnung).
   */
  remainingAfterSavings: RemainingDeviation[]
  /** Σ der verbleibenden Verkaufsbedarfe. */
  totalRemainingSell: number
}

/**
 * M11 – sparratenbasiertes Rebalancing als Wrapper um proposeSavingsRates
 * (F17/F18): mappt je Plan die Kaufbedarfslücke seiner Zielposition aus der
 * Analyse. Gruppen-Gewichte: die Gruppen-Lücke wird GLEICHMÄSSIG auf die
 * empfangsberechtigten flexiblen Pläne der Gruppe verteilt (keine
 * Doppelzählung der Lücke in der proportionalen F17-Verteilung – dokumentierte
 * V1-Regel). Nicht flexible sowie employer-/provider-Pläne bleiben unverändert
 * (F18: externe Zuflüsse sind grundsätzlich nicht umlenkbar). Der Aufrufer
 * übergibt die anzuzeigenden Pläne (aktiv oder pausiert) und die AKTIVEN
 * Positionen zur Gruppenauflösung.
 */
export function calculateSavingsOnlyRebalancing(
  analysis: RebalancingAnalysis,
  flexibleBudget: number,
  plans: readonly SavingsPlan[],
  positions: readonly PortfolioPosition[],
  unit: RoundingUnit = 0.01,
): SavingsOnlyRebalancing {
  const positionById = new Map(positions.map((position) => [position.id, position]))
  const entryByPositionRef = new Map(
    analysis.entries
      .filter((entry) => entry.refKind === 'position')
      .map((entry) => [entry.ref, entry]),
  )
  const entryByGroup = new Map(
    analysis.entries
      .filter((entry) => entry.refKind === 'group')
      .map((entry) => [entry.ref, entry]),
  )

  const isReceiver = (plan: SavingsPlan): boolean =>
    plan.isFlexible !== false &&
    (plan.flowType === 'own_fixed' || plan.flowType === 'own_variable') &&
    plan.isPaused !== true

  /** Anzahl empfangsberechtigter Pläne je Gruppen-Eintrag (gleichmäßige Lücken-Aufteilung). */
  const receiversPerGroup = new Map<string, number>()
  for (const plan of plans) {
    if (!isReceiver(plan) || plan.targetKind !== 'position') continue
    if (entryByPositionRef.has(plan.targetId)) continue
    const group = positionById.get(plan.targetId)?.group
    if (group !== undefined && entryByGroup.has(group)) {
      receiversPerGroup.set(group, (receiversPerGroup.get(group) ?? 0) + 1)
    }
  }

  const gapOf = (plan: SavingsPlan): number => {
    if (plan.targetKind !== 'position') return 0
    const direct = entryByPositionRef.get(plan.targetId)
    if (direct !== undefined) return direct.buyRequirement
    const group = positionById.get(plan.targetId)?.group
    if (group === undefined) return 0
    const groupEntry = entryByGroup.get(group)
    if (groupEntry === undefined) return 0
    const receiverCount = receiversPerGroup.get(group) ?? 0
    return receiverCount > 0 ? groupEntry.buyRequirement / receiverCount : 0
  }

  const mappedPlans: PlanForRebalancing[] = plans.map((plan) => ({
    id: plan.id,
    // F18: employer/provider sind grundsätzlich nicht umlenkbar → wie fest behandeln.
    isFlexible:
      plan.isFlexible !== false &&
      (plan.flowType === 'own_fixed' || plan.flowType === 'own_variable'),
    isPaused: plan.isPaused === true,
    minAmount: typeof plan.minAmount === 'number' ? plan.minAmount : null,
    currentMonthlyAmount:
      typeof plan.amount === 'number' && Number.isFinite(plan.amount) ? plan.amount : 0,
    buyRequirement: gapOf(plan),
  }))

  const proposal = proposeSavingsRates(flexibleBudget, mappedPlans, unit)
  const remainingAfterSavings: RemainingDeviation[] = analysis.entries
    .filter((entry) => entry.sellRequirement > 0)
    .map((entry) => ({
      refKind: entry.refKind,
      ref: entry.ref,
      name: entry.name,
      remainingSellRequirement: entry.sellRequirement,
    }))
  return {
    proposal,
    mappedPlans,
    remainingAfterSavings,
    totalRemainingSell: remainingAfterSavings.reduce(
      (sum, entry) => sum + entry.remainingSellRequirement,
      0,
    ),
  }
}

/**
 * M11 – geschätzte Dauer in Monaten, bis der Kaufbedarf über das monatliche
 * Budget gedeckt ist: CEIL(Σ Kauf / Budget). KEINE Renditeannahme – jede
 * Anzeige trägt die Pflicht-Kennzeichnung „ungefähr, ohne Kursentwicklung"
 * (F22-Analogie). Budget ≤ 0 oder nicht endlich → null („keine Schätzung
 * möglich", F20 – nie NaN/Infinity); Kaufbedarf ≤ 0 → 0 Monate.
 * Auch je Position nutzbar: estimateSavingsDuration(kauf_i, rate_i).
 * Seed × Job-Profil: CEIL(1.573,80444 / 60) = 27 Monate.
 */
export function estimateSavingsDuration(
  totalBuyRequirement: number,
  monthlyBudget: number,
): number | null {
  assertFinite(totalBuyRequirement, 'totalBuyRequirement')
  if (typeof monthlyBudget !== 'number' || !Number.isFinite(monthlyBudget) || monthlyBudget <= 0) {
    return null
  }
  if (totalBuyRequirement <= 0) return 0
  return Math.ceil(totalBuyRequirement / monthlyBudget)
}

export interface FullRebalancingEntry {
  refKind: WeightRefKind
  ref: string
  name: string | null
  /** Hypothetischer Kauf (F15). */
  buyAmount: number
  /** Hypothetischer Verkauf (F16) – nur Text-Erwähnung, nie Ausführung (G1). */
  sellAmount: number
  /** Neuer Wert = Sollwert (per Definition; Restabweichung 0 je bewerteter Position). */
  newValue: number
  /** Neuer Anteil = Zielgewicht. */
  newShare: number
}

export interface FullRebalancing {
  entries: FullRebalancingEntry[]
  totalBuy: number
  totalSell: number
  /** Unbewertete/nicht abgedeckte Positionen bleiben als Rest ausgewiesen (A6/G11). */
  unvaluedPositionNames: string[]
  uncoveredPositionNames: string[]
}

/**
 * M11/A7 – hypothetische Voll-Simulation: je bewerteter Position Kauf (F15)
 * bzw. Verkauf (F16); die neue Verteilung IST die Zielverteilung
 * (Restabweichung 0 per Definition). REINE ANZEIGE mit Pflicht-Kennzeichnung
 * „Simulation – wird nie automatisch übernommen": es wird NIE ein
 * simulations[]-Eintrag erzeugt (das ist M13-Territorium) und nie eine
 * Aktion ausgelöst (Abschnitt 0/G1).
 */
export function calculateFullRebalancing(analysis: RebalancingAnalysis): FullRebalancing {
  const entries = analysis.entries.map(
    (entry): FullRebalancingEntry => ({
      refKind: entry.refKind,
      ref: entry.ref,
      name: entry.name,
      buyAmount: entry.buyRequirement,
      sellAmount: entry.sellRequirement,
      newValue: entry.targetValue,
      newShare: entry.targetShare,
    }),
  )
  return {
    entries,
    totalBuy: analysis.totalBuy,
    totalSell: analysis.totalSell,
    unvaluedPositionNames: [...analysis.unvaluedPositionNames],
    uncoveredPositionNames: [...analysis.uncoveredPositionNames],
  }
}

/** Sortierung für die Anzeige: |Pp|-Abweichung absteigend, dann Name (de-DE; Gruppen über ref). */
export function sortRebalancingEntries<
  T extends { deviationPp: number; name: string | null; ref: string },
>(entries: readonly T[]): T[] {
  return entries.slice().sort((a, b) => {
    const diff = Math.abs(b.deviationPp) - Math.abs(a.deviationPp)
    if (diff !== 0) return diff
    return (a.name ?? a.ref).localeCompare(b.name ?? b.ref, 'de')
  })
}

export interface GroupedRecommendations<T> {
  /** Übergewichtungen ≥ +10 Pp: Empfehlung inkl. Verkaufsoption (als LETZTE Möglichkeit erwähnt). */
  saleOption: T[]
  /** |Abweichung| ≥ 5 Pp: Handlungsempfehlung ohne Verkaufsoption. */
  recommendation: T[]
  /** < 5 Pp: nur Anzeige, keine Empfehlung. */
  none: T[]
}

/** Partition der Einträge nach Handlungsstufe (T9: 3 Pp → none, 6 Pp → recommendation, 12 Pp → sale-option). */
export function groupRecommendations<T extends { level: ActionLevel }>(
  entries: readonly T[],
): GroupedRecommendations<T> {
  return {
    saleOption: entries.filter((entry) => entry.level === 'recommendation-with-sale-option'),
    recommendation: entries.filter((entry) => entry.level === 'recommendation'),
    none: entries.filter((entry) => entry.level === 'none'),
  }
}
