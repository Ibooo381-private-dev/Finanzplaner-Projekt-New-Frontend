/**
 * Projektionen ohne Kursentwicklung (Formelkatalog F22):
 * Endwert = Startwert + Summe der festen Zuflüsse im Horizont; Jahresereignisse
 * (z. B. Telekom-Zufluss im Juli) fließen in der realen Sicht zum Fälligkeitsmonat
 * ein. Ergebnisse tragen die Pflicht-Kennzeichnung „Projektion ohne Kursentwicklung“
 * (S2/C1) und sind keine Prognose und keine Anlageberatung.
 * Reine Funktionen; Eingaben werden nicht mutiert.
 */

import type {
  EmergencyFund,
  Goal,
  GoalMetric,
  SimulationParams,
} from '../types/finance'
import { assertFinite } from './rounding'
import { effectiveGoalTarget, isEmergencyFundGoal } from './goals'
import { formatEuro } from '../format/money'
import { formatIsoDateGerman } from '../format/date'

export interface ProjectionStart {
  /** Tagesgeld-Startwert. */
  cash: number
  /** Depot-Startwert. */
  depot: number
}

export interface MonthlyRates {
  /** Fester monatlicher Tagesgeld-Zufluss (z. B. 25). */
  cashPerMonth: number
  /** Fester bzw. geglätteter monatlicher Depot-Zufluss (real 100; geglättet 225). */
  depotPerMonth: number
}

export interface AnnualDepotEvent {
  /** Fälligkeitsmonat 1–12 (Telekom: 7). */
  dueMonth: number
  /** Realer Jahreszufluss ins Depot (Telekom: 1.500). */
  amount: number
}

export interface ProjectionResult {
  months: number
  cash: number
  depot: number
  total: number
  /** Pflicht-Kennzeichnung: immer als Projektion ohne Kursentwicklung ausweisen (S2). */
  kind: 'projection-no-growth'
}

/**
 * F22 – Projektion ohne Kursentwicklung über n Monate.
 * Geglättete Sicht: ohne annual-Parameter (die Jahresbeträge stecken in depotPerMonth).
 * Reale Sicht: mit annual-Parameter; startMonth ist der Kalendermonat (1–12) des
 * ERSTEN projizierten Monats; Ereignisse zählen je Vorkommen ihres dueMonth im Horizont.
 * Variable Zuflüsse (Saveback/Round-up) sind nie enthalten (nicht garantiert).
 */
export function projectNoGrowth(
  start: ProjectionStart,
  months: number,
  rates: MonthlyRates,
  annual?: { events: readonly AnnualDepotEvent[]; startMonth: number },
): ProjectionResult {
  assertFinite(start.cash, 'start.cash')
  assertFinite(start.depot, 'start.depot')
  assertFinite(rates.cashPerMonth, 'rates.cashPerMonth')
  assertFinite(rates.depotPerMonth, 'rates.depotPerMonth')
  if (!Number.isInteger(months) || months < 0) {
    throw new Error(`»months« muss eine Ganzzahl ≥ 0 sein. Ist-Wert: ${String(months)}.`)
  }

  let annualTotal = 0
  if (annual) {
    if (!Number.isInteger(annual.startMonth) || annual.startMonth < 1 || annual.startMonth > 12) {
      throw new Error(
        `»startMonth« muss ein Kalendermonat 1–12 sein. Ist-Wert: ${String(annual.startMonth)}.`,
      )
    }
    for (const event of annual.events) {
      assertFinite(event.amount, 'annual.event.amount')
      if (!Number.isInteger(event.dueMonth) || event.dueMonth < 1 || event.dueMonth > 12) {
        throw new Error(
          `»dueMonth« muss ein Kalendermonat 1–12 sein. Ist-Wert: ${String(event.dueMonth)}.`,
        )
      }
      for (let offset = 0; offset < months; offset += 1) {
        const calendarMonth = ((annual.startMonth - 1 + offset) % 12) + 1
        if (calendarMonth === event.dueMonth) annualTotal += event.amount
      }
    }
  }

  const cash = start.cash + months * rates.cashPerMonth
  const depot = start.depot + months * rates.depotPerMonth + annualTotal
  return { months, cash, depot, total: cash + depot, kind: 'projection-no-growth' }
}

// ---------------------------------------------------------------------------
// M13 – Simulations-Bausteine (calculation-rules „Simulations-Bausteine (M13)“)
//
// Die Auftrags-Funktionsnamen simulateNoGrowth/simulateConstantGrowth/
// projectSavings/projectTargets/projectWealth/projectLiquidity sind KEINE
// eigenen Funktionen (M11-Präzedenz: keine Duplikat-Hüllen) – sie sind
// Bestandteile von simulateScenario/summarizeSimulation; projectNoGrowth
// bleibt die 0-%-Referenz (Konsistenz-Pin: r = 0 → identischer Endwert).
// Alle Funktionen: pur, deterministisch, mutationsfrei, stichtags-injiziert,
// keine NaN/Infinity-Ausgaben. Kein Ergebnis löst eine Aktion aus.
// ---------------------------------------------------------------------------

/** Harte Obergrenze des Simulationshorizonts (100 Jahre, M13). */
export const SIMULATION_MAX_MONTHS = 1200

/** Obergrenze der jährlichen Renditeannahme (15 %; negative Renditen sind in V1 nicht vorgesehen). */
export const SIMULATION_MAX_RETURN_RATE = 0.15

/** Ab dieser Annahme (> 8 % p. a.) gilt „sehr optimistische Annahme“ (Warnung, nie Fehler). */
export const SIMULATION_RETURN_WARN_THRESHOLD = 0.08

/**
 * Telekom-Jahresereignis des realen Modus (telekomMode 'real'), dokumentierte
 * Konstante (Restpunkt M13): Juli-Zufluss 1.500 = 1.000 eigener Beitrag
 * (T1/G7-Zählpunkt Equatex) + 500 Arbeitgeberbonus. Die G8-Partition
 * (eigen vs. gesamt) MUSS diese Aufteilung verwenden; im Modus 'smoothed'
 * gibt es das Ereignis NIE (die geglätteten 125 €/Monat stecken in den
 * Beiträgen – sonst Doppelzählung, G9).
 */
export const TELEKOM_ANNUAL_EVENT = {
  dueMonth: 7,
  totalAmount: 1500,
  ownAmount: 1000,
  employerAmount: 500,
} as const

/** Umbuchungs-Zuflussarten – in Simulations-Beiträgen unzulässig (G7). */
const TRANSFER_FLOW_TYPES = ['reserve_transfer', 'liquidity_transfer'] as const

export interface SimulationMonthPoint {
  /** 0 = Startwerte (Stichtag), k = Stand nach k projizierten Monaten. */
  monthIndex: number
  cash: number
  depot: number
  total: number
}

export interface SimulationScenarioResult {
  /** Monatliche Reihe mit months + 1 Punkten (Index 0 = Start). */
  points: SimulationMonthPoint[]
  months: number
  /** Kalendermonat (1–12) des ERSTEN projizierten Monats (= Folgemonat des Stichtags, F22). */
  startMonth: number
  annualReturnRate: number
  telekomMode: 'real' | 'smoothed'
  end: { cash: number; depot: number; total: number }
  /** Eingezahlte Summen im Horizont, G8-partitioniert (gesamt vs. eigen). */
  contributed: { total: number; own: number }
  /** Pflicht-Kennzeichnung: immer als Projektion (keine Prognose) ausweisen. */
  kind: 'simulation-projection'
}

/**
 * Kalendermonat (1–12) des ersten projizierten Monats = FOLGEMONAT des
 * Stichtags (KORREKTUR 2.1, F22: Juli-Stichtag → „Start August“). Rein
 * string-basiert, kein Systemdatum.
 */
export function firstProjectionStartMonth(todayIso: string): number {
  const month = Number(todayIso.slice(5, 7))
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`»todayIso« muss ein ISO-Datum JJJJ-MM-TT sein. Ist-Wert: ${String(todayIso)}.`)
  }
  return (month % 12) + 1
}

/**
 * Kalendermonat ('JJJJ-MM') eines Reihen-Index: Index 0 = Stichtagsmonat,
 * Index k = k Monate danach (Index 1 = erster projizierter Monat = Folgemonat).
 */
export function projectionMonthIso(todayIso: string, monthIndex: number): string {
  const year = Number(todayIso.slice(0, 4))
  const month = Number(todayIso.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`»todayIso« muss ein ISO-Datum JJJJ-MM-TT sein. Ist-Wert: ${String(todayIso)}.`)
  }
  if (!Number.isInteger(monthIndex) || monthIndex < 0) {
    throw new Error(`»monthIndex« muss eine Ganzzahl ≥ 0 sein. Ist-Wert: ${String(monthIndex)}.`)
  }
  const index = year * 12 + (month - 1) + monthIndex
  const targetYear = Math.floor(index / 12)
  const targetMonth = (index % 12) + 1
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}`
}

/**
 * M13 – Szenario-Projektion über n Monate (Aggregatmodell Tagesgeld + Depot).
 * Rechenregeln (dokumentiert in calculation-rules „Simulations-Bausteine (M13)“):
 * - Monatsfaktor = (1 + r)^(1/12) (geometrisch); verzinst wird NUR das Depot
 *   (keine Tagesgeld-Zinsannahme); je Monat erst Verzinsung des Bestands,
 *   DANN Beiträge (Beiträge des Zuführungsmonats werden nicht verzinst –
 *   konservative Monatsende-Regel).
 * - Beiträge fließen je target ('depot' Default | 'cash'); Umbuchungs-
 *   Zuflussarten sind unzulässig (G7). G8-Partition: eigen = own_fixed/
 *   own_variable; gesamt = alle Beiträge.
 * - telekomMode 'real': Jahresereignis Juli 1.500 (1.000 eigen + 500
 *   Arbeitgeber) ab startMonth; 'smoothed': KEIN Ereignis (G9).
 * - r = 0 → Reihe exakt der projectNoGrowth-Pfad (Endwert = Start + Σ Zuflüsse).
 */
export function simulateScenario(
  params: SimulationParams,
  startMonth: number,
): SimulationScenarioResult {
  assertFinite(params.startDepotValue, 'params.startDepotValue')
  assertFinite(params.startTagesgeldValue, 'params.startTagesgeldValue')
  if (params.startDepotValue < 0 || params.startTagesgeldValue < 0) {
    throw new Error('Startwerte dürfen nicht negativ sein.')
  }
  const months = params.months
  if (!Number.isInteger(months) || months < 1 || months > SIMULATION_MAX_MONTHS) {
    throw new Error(
      `»months« muss eine Ganzzahl zwischen 1 und ${SIMULATION_MAX_MONTHS} sein. Ist-Wert: ${String(months)}.`,
    )
  }
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new Error(`»startMonth« muss ein Kalendermonat 1–12 sein. Ist-Wert: ${String(startMonth)}.`)
  }
  const rate = params.annualReturnRate
  assertFinite(rate, 'params.annualReturnRate')
  if (rate < 0 || rate > SIMULATION_MAX_RETURN_RATE) {
    throw new Error(
      `»annualReturnRate« muss zwischen 0 und ${SIMULATION_MAX_RETURN_RATE} liegen (0–15 % pro Jahr; negative Renditeannahmen sind in Version 1 nicht vorgesehen). Ist-Wert: ${String(rate)}.`,
    )
  }
  let depotPerMonth = 0
  let cashPerMonth = 0
  let ownPerMonth = 0
  for (const contribution of params.monthlyContributions) {
    assertFinite(contribution.amount, `Beitrag „${contribution.label}“`)
    if (contribution.amount < 0) {
      throw new Error(`Der Beitrag „${contribution.label}“ darf nicht negativ sein.`)
    }
    if ((TRANSFER_FLOW_TYPES as readonly string[]).includes(contribution.flowType)) {
      throw new Error(
        `Der Beitrag „${contribution.label}“ ist eine Umbuchung – Umbuchungen sind in Simulationen unzulässig (G7).`,
      )
    }
    if (contribution.target === 'cash') {
      cashPerMonth += contribution.amount
    } else {
      depotPerMonth += contribution.amount
    }
    if (contribution.flowType === 'own_fixed' || contribution.flowType === 'own_variable') {
      ownPerMonth += contribution.amount
    }
  }

  // Geometrischer Monatsfaktor (dokumentiert): 12 Monate ergeben exakt (1 + r).
  const monthlyFactor = Math.pow(1 + rate, 1 / 12)
  let cash = params.startTagesgeldValue
  let depot = params.startDepotValue
  let contributedTotal = 0
  let contributedOwn = 0
  const points: SimulationMonthPoint[] = [
    { monthIndex: 0, cash, depot, total: cash + depot },
  ]
  for (let offset = 0; offset < months; offset += 1) {
    const calendarMonth = ((startMonth - 1 + offset) % 12) + 1
    // Erst Verzinsung des Bestands (NUR Depot), dann die Beiträge des Monats.
    depot *= monthlyFactor
    depot += depotPerMonth
    cash += cashPerMonth
    contributedTotal += depotPerMonth + cashPerMonth
    contributedOwn += ownPerMonth
    if (params.telekomMode === 'real' && calendarMonth === TELEKOM_ANNUAL_EVENT.dueMonth) {
      depot += TELEKOM_ANNUAL_EVENT.totalAmount
      contributedTotal += TELEKOM_ANNUAL_EVENT.totalAmount
      contributedOwn += TELEKOM_ANNUAL_EVENT.ownAmount
    }
    assertFinite(depot, 'depot')
    assertFinite(cash, 'cash')
    points.push({ monthIndex: offset + 1, cash, depot, total: cash + depot })
  }
  const last = points[points.length - 1]
  return {
    points,
    months,
    startMonth,
    annualReturnRate: rate,
    telekomMode: params.telekomMode,
    end: { cash: last.cash, depot: last.depot, total: last.total },
    contributed: { total: contributedTotal, own: contributedOwn },
    kind: 'simulation-projection',
  }
}

export interface SimulationSummary {
  endDepot: number
  endCash: number
  endTotal: number
  /** Eingezahlt gesamt (alle Zuflüsse inkl. Arbeitgeber; G8: getrennt von „eigen“). */
  contributedTotal: number
  /** Eingezahlt eigen (own_fixed/own_variable + 1.000-€-Anteil des Ereignisses). */
  contributedOwn: number
  /**
   * Rechnerischer Wertzuwachs aus der Annahme (Endwert − Start − Einzahlungen);
   * NUR bei r > 0 (bei r = 0 null – es gibt keinen Annahme-Anteil).
   */
  growthFromAssumption: number | null
}

/** M13 – Zusammenfassung eines Szenario-Ergebnisses (G8-getrennt, F20-sicher). */
export function summarizeSimulation(result: SimulationScenarioResult): SimulationSummary {
  const start = result.points[0]
  const growth =
    result.annualReturnRate > 0
      ? result.end.total - start.total - result.contributed.total
      : null
  if (growth !== null) assertFinite(growth, 'growthFromAssumption')
  return {
    endDepot: result.end.depot,
    endCash: result.end.cash,
    endTotal: result.end.total,
    contributedTotal: result.contributed.total,
    contributedOwn: result.contributed.own,
    growthFromAssumption: growth,
  }
}

/** Im Aggregatmodell projizierbare Ziel-Kennzahlen (NUR diese drei). */
export type SimulationSeriesMetric = 'tagesgeld' | 'depotValue' | 'totalWealth'

const PROJECTABLE_METRICS: readonly SimulationSeriesMetric[] = [
  'tagesgeld',
  'depotValue',
  'totalWealth',
]

/**
 * true nur für Kennzahlen des Aggregatmodells (Tagesgeld + Depot).
 * accountBalance/positionValue/manual/monthlySavingsRate sind NICHT
 * projizierbar → „keine Aussage möglich“ (analyzeGoalsInSimulation).
 */
export function isProjectableSimulationMetric(
  metric: GoalMetric | null | undefined,
): metric is SimulationSeriesMetric {
  return (
    typeof metric === 'string' &&
    (PROJECTABLE_METRICS as readonly string[]).includes(metric)
  )
}

/**
 * M13 – erster Monatsindex der Reihe, an dem die Kennzahl das Ziel erreicht
 * (Wert ≥ Ziel), oder null (im Horizont nicht erreicht). Index 0 = Start.
 */
export function goalReachMonthInSeries(
  points: readonly SimulationMonthPoint[],
  metric: SimulationSeriesMetric,
  target: number,
): number | null {
  assertFinite(target, 'target')
  if (target <= 0) {
    throw new Error(`»target« muss größer als 0 sein. Ist-Wert: ${String(target)}.`)
  }
  for (const point of points) {
    const value =
      metric === 'tagesgeld' ? point.cash : metric === 'depotValue' ? point.depot : point.total
    if (value >= target) return point.monthIndex
  }
  return null
}

export type SimulationGoalOutcome = 'reachable' | 'late' | 'not-in-horizon' | 'no-statement'

export interface SimulationGoalAnalysis {
  goal: Goal
  outcome: SimulationGoalOutcome
  /** Begründungssatz („weil …“) – deutsch, ohne technische IDs. */
  reason: string
  /** Erreichungs-Monatsindex (0 = bereits zum Start) oder null. */
  reachMonthIndex: number | null
  /** Kalendermonat der Erreichung ('JJJJ-MM') oder null. */
  reachMonthIso: string | null
}

const GERMAN_MONTH_YEAR = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** 'JJJJ-MM' als deutscher Monatsname mit Jahr (z. B. „August 2026“). */
export function formatIsoMonthGerman(isoMonth: string): string {
  const year = Number(isoMonth.slice(0, 4))
  const month = Number(isoMonth.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return isoMonth
  }
  return GERMAN_MONTH_YEAR.format(new Date(Date.UTC(year, month - 1, 1)))
}

/**
 * M13 – Zielanalyse innerhalb einer Simulation. Je projizierbarem Ziel:
 * 'reachable' (Erreichungsmonat ≤ Horizont und ≤ Zieltermin, falls gesetzt),
 * 'late' (im Horizont erreicht, aber nach dem Zieltermin), 'not-in-horizon',
 * 'no-statement' (nicht projizierbare Kennzahl, keine Kennzahl oder kein
 * wirksamer Zielbetrag) – IMMER mit Begründungssatz („weil …“).
 * Archivierte und pausierte Ziele sind ausgenommen (dokumentiert); der
 * Zieltermin wird auf Monatsebene verglichen. Pflicht-Kennzeichnung
 * („Projektion mit Annahme – keine Prognose“) ist Sache jeder Anzeige.
 * Der Notgroschen läuft über effectiveGoalTarget (Override-Vorrang).
 */
export function analyzeGoalsInSimulation(
  goals: readonly Goal[],
  emergencyFund: EmergencyFund,
  points: readonly SimulationMonthPoint[],
  todayIso: string,
): SimulationGoalAnalysis[] {
  const horizon = points.length > 0 ? points[points.length - 1].monthIndex : 0
  const analyses: SimulationGoalAnalysis[] = []
  for (const goal of goals) {
    // Ausgenommen (dokumentiert): archivierte und pausierte Ziele.
    if (goal.status === 'archived' || goal.status === 'deferred') continue
    const metric: GoalMetric | null = isEmergencyFundGoal(goal) ? 'tagesgeld' : (goal.metric ?? null)
    if (metric === null) {
      analyses.push({
        goal,
        outcome: 'no-statement',
        reason: 'Keine Aussage möglich, weil dem Ziel keine Kennzahl zugeordnet ist.',
        reachMonthIndex: null,
        reachMonthIso: null,
      })
      continue
    }
    if (!isProjectableSimulationMetric(metric)) {
      analyses.push({
        goal,
        outcome: 'no-statement',
        reason:
          'Keine Aussage möglich, weil die Ziel-Kennzahl nicht Teil des Aggregatmodells (Tagesgeld + Depot) ist – projizierbar sind nur Tagesgeld, Depotwert und Gesamtvermögen.',
        reachMonthIndex: null,
        reachMonthIso: null,
      })
      continue
    }
    const target = effectiveGoalTarget(goal, emergencyFund)
    if (target === null) {
      analyses.push({
        goal,
        outcome: 'no-statement',
        reason:
          'Keine Aussage möglich, weil kein wirksamer Zielbetrag hinterlegt ist (Ziel „offen“ – es wird kein Betrag erfunden).',
        reachMonthIndex: null,
        reachMonthIso: null,
      })
      continue
    }
    const reach = goalReachMonthInSeries(points, metric, target)
    if (reach === null) {
      analyses.push({
        goal,
        outcome: 'not-in-horizon',
        reason: `Im Horizont nicht erreicht, weil der Zielbetrag ${formatEuro(target)} innerhalb der ${horizon} projizierten Monate nicht erreicht würde.`,
        reachMonthIndex: null,
        reachMonthIso: null,
      })
      continue
    }
    const reachIso = projectionMonthIso(todayIso, reach)
    const reachName = formatIsoMonthGerman(reachIso)
    const dueDate = typeof goal.targetDate === 'string' ? goal.targetDate : null
    if (reach === 0) {
      // N2 (M12-Philosophie „erreicht schlägt überfällig“): ein bereits zum
      // Start erreichtes Ziel ist IMMER 'reachable' – nie 'late', auch wenn
      // der Zieltermin in der Vergangenheit liegt.
      analyses.push({
        goal,
        outcome: 'reachable',
        reason: `Erreichbar, weil der Zielbetrag ${formatEuro(target)} bereits zum Start der Projektion erreicht ist.`,
        reachMonthIndex: 0,
        reachMonthIso: reachIso,
      })
      continue
    }
    if (dueDate !== null && reachIso > dueDate.slice(0, 7)) {
      analyses.push({
        goal,
        outcome: 'late',
        reason: `Voraussichtlich verspätet, weil der Zielbetrag ${formatEuro(target)} laut Projektion erst im ${reachName} (Monat ${reach} von ${horizon}) erreicht würde, der Zieltermin aber der ${formatIsoDateGerman(dueDate)} ist.`,
        reachMonthIndex: reach,
        reachMonthIso: reachIso,
      })
      continue
    }
    const dueText =
      dueDate === null
        ? '; ein Zieltermin ist nicht gesetzt.'
        : ` – rechtzeitig vor bzw. bis zum Zieltermin ${formatIsoDateGerman(dueDate)}.`
    analyses.push({
      goal,
      outcome: 'reachable',
      reason: `Erreichbar, weil der Zielbetrag ${formatEuro(target)} laut Projektion im ${reachName} (Monat ${reach} von ${horizon}) erreicht würde${dueText}`,
      reachMonthIndex: reach,
      reachMonthIso: reachIso,
    })
  }
  return analyses
}

export interface SimulationComparisonInput {
  /** Anzeigename der Simulation (nie eine ID). */
  name: string
  result: SimulationScenarioResult
}

export interface SimulationComparisonColumn {
  name: string
  months: number
  annualReturnRate: number
  telekomMode: 'real' | 'smoothed'
  endTotal: number
  endDepot: number
  endCash: number
  contributedTotal: number
  contributedOwn: number
  growthFromAssumption: number | null
}

export interface SimulationComparison {
  columns: SimulationComparisonColumn[]
  /**
   * true = reale und geglättete Sicht gemischt → die Anzeige MUSS den
   * G9-Hinweis tragen (Sichten nie unmarkiert mischen).
   */
  viewsMixed: boolean
}

/**
 * M13 – Vergleich von mindestens 2 Simulationen (Endvermögen/Depot/Liquidität,
 * eingezahlt gesamt und eigen, Annahmen). Weniger als 2 → null (definierter
 * Zustand, kein Fehler). Der Zielerreichungs-Kurzstatus je Simulation kommt
 * aus analyzeGoalsInSimulation (Aufrufer).
 */
export function compareSimulations(
  entries: readonly SimulationComparisonInput[],
): SimulationComparison | null {
  if (entries.length < 2) return null
  const modes = new Set(entries.map((entry) => entry.result.telekomMode))
  return {
    columns: entries.map((entry) => {
      const summary = summarizeSimulation(entry.result)
      return {
        name: entry.name,
        months: entry.result.months,
        annualReturnRate: entry.result.annualReturnRate,
        telekomMode: entry.result.telekomMode,
        endTotal: summary.endTotal,
        endDepot: summary.endDepot,
        endCash: summary.endCash,
        contributedTotal: summary.contributedTotal,
        contributedOwn: summary.contributedOwn,
        growthFromAssumption: summary.growthFromAssumption,
      }
    }),
    viewsMixed: modes.size > 1,
  }
}
