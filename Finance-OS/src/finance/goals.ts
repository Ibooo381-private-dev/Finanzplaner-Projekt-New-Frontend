/**
 * Zielfortschritts-Bausteine (calculation-rules §7/T7 und „Ziel-Bausteine
 * (M12)“): wirksames Notgroschen-Ziel, generischer Zielfortschritt sowie die
 * M12-Bausteine Ist-Wert je Zielart, Monatszählregel, benötigte Monatsrate,
 * Prognose OHNE Rendite-/Kursannahme und abgeleiteter Zielstatus. Reine
 * Anzeige- und Berechnungsregeln – kein Ergebnis löst eine Aktion aus
 * (Abschnitt 0); die App ändert insbesondere nie automatisch Sparraten (T7).
 * Kein React, kein Systemdatum (der Stichtag wird IMMER injiziert).
 * Reine Funktionen; Eingaben werden nicht mutiert.
 */

import type {
  Account,
  EmergencyFund,
  FinanceData,
  Goal,
  PortfolioPosition,
  SavingsPlan,
} from '../types/finance'
import { assertFinite } from './rounding'
import type { SavingsView } from './savings'
import { isPlanActiveOn, monthlyAmount, ownMonthlySavings } from './savings'
import { cashValue, depotValue, latestEntry, share } from './wealth'

/**
 * calculation-rules §7: wirksames Notgroschen-Ziel =
 * manualOverrideAmount ?? factor × netIncomeMonthly (Seed: 4 × 1.170 = 4.680).
 * Ein manuell überschriebener Zielwert hat Vorrang und wird durch die
 * Neuberechnung nie ungefragt ersetzt (T7).
 */
export function effectiveEmergencyFundTarget(fund: EmergencyFund): number {
  if (typeof fund.manualOverrideAmount === 'number') {
    assertFinite(fund.manualOverrideAmount, 'manualOverrideAmount')
    return fund.manualOverrideAmount
  }
  assertFinite(fund.factor, 'factor')
  assertFinite(fund.netIncomeMonthly, 'netIncomeMonthly')
  return fund.factor * fund.netIncomeMonthly
}

export interface GoalProgress {
  target: number
  actual: number
  /** Restbetrag = MAX(0, Ziel − Ist); nie negativ. */
  remaining: number
  /**
   * Fortschrittsanteil share(ist, ziel) als Dezimalzahl (F20); kann > 1 sein
   * (Ziel übertroffen) – ein Anzeige-Cap ist Sache der UI, der Rechenwert
   * bleibt ehrlich.
   */
  share: number | null
  reached: boolean
}

/**
 * §7/T7-Baustein: Zielfortschritt aus Ist- und Zielbetrag.
 * target ≤ 0 → null („nicht berechenbar“, F20) – nie NaN/Infinity.
 */
export function goalProgress(actual: number, target: number): GoalProgress | null {
  assertFinite(actual, 'actual')
  assertFinite(target, 'target')
  if (target <= 0) return null
  return {
    target,
    actual,
    remaining: Math.max(0, target - actual),
    share: share(actual, target),
    reached: actual >= target,
  }
}

// ---------------------------------------------------------------------------
// M12 – Ziel-Bausteine (calculation-rules „Ziel-Bausteine (M12)“)
// ---------------------------------------------------------------------------

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

function isPositionActive(position: PortfolioPosition): boolean {
  return position.isActive !== false
}

/**
 * Notgroschen-Doppel-Guard (Auflage D – EXAKTE Parität mit dem historischen
 * Dashboard-Guard, regressionstreue Umstellung): NUR ein Auto-Ziel mit
 * Kennzahl tagesgeld ODER ganz ohne Kennzahl verhält sich als Notgroschen.
 * Ein Auto-Ziel mit ANDERER Kennzahl wird nie stillschweigend als
 * Notgroschen behandelt, sondern läuft in seinen Kennzahl-Zweig.
 */
export function isEmergencyFundGoal(goal: Goal): boolean {
  return goal.isAutoCalculated === true && (goal.metric === 'tagesgeld' || goal.metric == null)
}

/**
 * Wirksamer Zielbetrag: Notgroschen-Ziel (Auflage-D-Guard) → berechnetes
 * Notgroschen-Ziel (§7, Override-Vorrang); sonst der hinterlegte targetAmount,
 * wenn er eine endliche Zahl > 0 ist; sonst null („offen“ – nichts erfinden, G11).
 */
export function effectiveGoalTarget(goal: Goal, fund: EmergencyFund): number | null {
  if (isEmergencyFundGoal(goal)) return effectiveEmergencyFundTarget(fund)
  const target = goal.targetAmount
  if (typeof target === 'number' && Number.isFinite(target) && target > 0) return target
  return null
}

export interface GoalActualValue {
  /** Summe der bekannten Werte (Teilsummen rechnen mit Betrag + Hinweis, G11). */
  amount: number
  /** IDs relevanter Einträge OHNE erfassten Wert („unbekannt“, nie 0, G11). */
  missingIds: string[]
  /** Anzahl der relevanten Einträge (für die „vollständig unbekannt“-Erkennung). */
  relevantCount: number
  /** true, wenn die AUSDRÜCKLICH referenzierte Referenz deaktiviert ist (UI-Warnung). */
  refInactive: boolean
}

/**
 * Ist-Wert eines Ziels je Kennzahl (die metric-Verzweigung existiert NUR hier –
 * nie doppelt in React-Komponenten):
 * - Notgroschen-Guard (Auflage D) und 'tagesgeld' → cashValue der AKTIVEN Konten;
 * - 'depotValue' → depotValue der AKTIVEN Positionen;
 * - 'totalWealth' → Tagesgeld + Depot (F1);
 * - 'accountBalance'/'positionValue' → jüngster Wert der referenzierten
 *   Referenz (latestEntry); Referenz fehlt → null („nicht berechenbar“);
 *   Referenz ohne Historie → amount 0 + missingIds („unbekannt“, nie 0);
 *   DEAKTIVIERTE Referenz wird berechnet (das Ziel referenziert sie
 *   AUSDRÜCKLICH) und trägt das Warn-Flag refInactive;
 * - 'manual' → manualCurrentAmount (null → null, „offen“);
 * - 'monthlySavingsRate' → eigene REALE monatliche Sparleistung der am
 *   Stichtag aktiven Pläne (U3-Basis, KEINE Vermischung mit Vermögenswerten);
 * - keine Kennzahl → null („nicht berechenbar“).
 * Der Stichtag wird injiziert (nur für den Sparplan-Aktivitätsfilter genutzt).
 */
export function goalActualValue(
  goal: Goal,
  data: FinanceData,
  todayIso: string,
): GoalActualValue | null {
  const activeAccounts = data.accounts.filter(isAccountActive)
  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const metric = isEmergencyFundGoal(goal) ? 'tagesgeld' : goal.metric
  switch (metric) {
    case 'tagesgeld': {
      const cash = cashValue(activeAccounts)
      return {
        amount: cash.amount,
        missingIds: cash.missingIds,
        relevantCount: activeAccounts.filter((account) => account.type === 'tagesgeld').length,
        refInactive: false,
      }
    }
    case 'depotValue': {
      const depot = depotValue(activePositions)
      return {
        amount: depot.amount,
        missingIds: depot.missingIds,
        relevantCount: activePositions.length,
        refInactive: false,
      }
    }
    case 'totalWealth': {
      const cash = cashValue(activeAccounts)
      const depot = depotValue(activePositions)
      return {
        amount: cash.amount + depot.amount,
        missingIds: [...cash.missingIds, ...depot.missingIds],
        relevantCount:
          activeAccounts.filter((account) => account.type === 'tagesgeld').length +
          activePositions.length,
        refInactive: false,
      }
    }
    case 'accountBalance': {
      const account = data.accounts.find((entry) => entry.id === goal.refId) ?? null
      if (account === null) return null
      const entry = latestEntry(account.balanceHistory)
      const refInactive = !isAccountActive(account)
      if (entry === null) {
        return { amount: 0, missingIds: [account.id], relevantCount: 1, refInactive }
      }
      assertFinite(entry.amount, `accounts[${account.id}].amount`)
      return { amount: entry.amount, missingIds: [], relevantCount: 1, refInactive }
    }
    case 'positionValue': {
      const position = data.portfolioPositions.find((entry) => entry.id === goal.refId) ?? null
      if (position === null) return null
      const entry = latestEntry(position.valueHistory)
      const refInactive = !isPositionActive(position)
      if (entry === null) {
        return { amount: 0, missingIds: [position.id], relevantCount: 1, refInactive }
      }
      assertFinite(entry.value, `positions[${position.id}].value`)
      return { amount: entry.value, missingIds: [], relevantCount: 1, refInactive }
    }
    case 'manual': {
      if (typeof goal.manualCurrentAmount !== 'number') return null
      assertFinite(goal.manualCurrentAmount, `goals[${goal.id}].manualCurrentAmount`)
      return {
        amount: goal.manualCurrentAmount,
        missingIds: [],
        relevantCount: 1,
        refInactive: false,
      }
    }
    case 'monthlySavingsRate': {
      const activePlans = data.savingsPlans.filter((plan) => isPlanActiveOn(plan, todayIso))
      return {
        amount: ownMonthlySavings(activePlans, 'realMonthly'),
        missingIds: [],
        relevantCount: 0,
        refInactive: false,
      }
    }
    default:
      return null
  }
}

/**
 * G11-Normalisierung VOR der Statuskaskade (Auflage E): Ein vollständig
 * unbekannter Ist-Wert (alle relevanten Einträge ohne erfassten Wert, z. B.
 * referenziertes Konto ohne Historieneintrag) geht als null in
 * deriveGoalStatus → notComputable; NIE als erfundene 0 („0 % / überfällig“).
 * Teilsummen rechnen mit ihrem Betrag (der Hinweis ist Sache der UI).
 * Defensives >= wie in der Dashboard-Anzeige (im Zweifel „unbekannt“).
 */
export function normalizedActualForStatus(value: GoalActualValue | null): number | null {
  if (value === null) return null
  if (value.relevantCount > 0 && value.missingIds.length >= value.relevantCount) return null
  return value.amount
}

/** Informativer Überschuss = MAX(0, Ist − Ziel); nie negativ. */
export function goalSurplus(actual: number, target: number): number {
  assertFinite(actual, 'actual')
  assertFinite(target, 'target')
  return Math.max(0, actual - target)
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fortlaufender Monatsindex eines ISO-Datums (rein string-basiert, Muster schedule.ts). */
function monthIndexOfIso(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1)
}

/**
 * Verbindliche Monatszählregel (konservativ, dokumentiert): Anzahl VOLLER
 * Kalendermonatswechsel = Monatsindex(Zieldatum) − Monatsindex(Stichtag).
 * Der angebrochene aktuelle Monat zählt NICHT als Sparmonat (die benötigte
 * Rate fällt dadurch eher höher aus – keine Schein-Präzision nach unten).
 * Zieldatum im aktuellen Monat oder in der Vergangenheit → 0; ungültiges oder
 * fehlendes Datum → null. Rein string-/UTC-basiert, kein Systemdatum.
 */
export function remainingFullMonths(todayIso: string, targetIso: string | null | undefined): number | null {
  if (typeof targetIso !== 'string') return null
  if (!ISO_DATE_RE.test(todayIso) || !ISO_DATE_RE.test(targetIso)) return null
  const months = monthIndexOfIso(targetIso) - monthIndexOfIso(todayIso)
  return months <= 0 ? 0 : months
}

/**
 * Benötigte Monatsrate = Rest / volle Monate (ungerundet; Anzeige rundet, F19).
 * months null oder ≤ 0 → null („nicht berechenbar – das Ziel ist diesen Monat
 * fällig oder überfällig“); Rest ≤ 0 → 0 (bereits erreicht).
 */
export function requiredMonthlyRate(remainingAmount: number, months: number | null): number | null {
  assertFinite(remainingAmount, 'remainingAmount')
  if (remainingAmount <= 0) return 0
  if (months === null || months <= 0) return null
  return remainingAmount / months
}

/**
 * Prognose: voraussichtliche Monate bis zum Ziel = CEIL(Rest / eigene
 * Monatsrate) – reine Division OHNE Rendite-/Zins-/Kursannahme (die
 * Kennzeichnung „ohne Rendite-/Kursannahme“ ist in der Anzeige Pflicht).
 * Rest ≤ 0 → 0 (erreicht); Rate ≤ 0 oder nicht endlich → null
 * („keine Prognose möglich“) – nie NaN/Infinity.
 */
export function forecastMonthsToTarget(
  remainingAmount: number,
  ownMonthlyRate: number,
): number | null {
  assertFinite(remainingAmount, 'remainingAmount')
  if (remainingAmount <= 0) return 0
  if (typeof ownMonthlyRate !== 'number' || !Number.isFinite(ownMonthlyRate) || ownMonthlyRate <= 0) {
    return null
  }
  return Math.ceil(remainingAmount / ownMonthlyRate)
}

/** Differenz benötigte − vorhandene Monatsrate (positiv = es fehlt Rate). */
export function rateGap(required: number, available: number): number {
  assertFinite(required, 'required')
  assertFinite(available, 'available')
  return required - available
}

/**
 * Abgeleiteter Zielstatus (M12): 'completed' = GESPEICHERT manuell
 * abgeschlossen (status 'reached'); 'reachedNow' = RECHNERISCH erreicht –
 * wird NIE gespeichert und fällt bei sinkendem Ist-Wert wieder zurück.
 */
export type DerivedGoalStatus =
  | 'archived'
  | 'completed'
  | 'paused'
  | 'planned'
  | 'notComputable'
  | 'reachedNow'
  | 'overdue'
  | 'active'

export interface GoalStatusContext {
  /** Wirksamer Zielbetrag (effectiveGoalTarget) oder null („offen“). */
  target: number | null
  /** Normalisierter Ist-Wert (normalizedActualForStatus) oder null. */
  actual: number | null
  todayIso: string
}

/**
 * Verbindliche Statusrangfolge (M12):
 * (1) archived (gespeichert, endgültig beendet);
 * (2) completed (gespeichert status 'reached' = manuell abgeschlossen –
 *     schlägt auch einen sinkenden Ist-Wert, gespeicherter Nutzerwille);
 * (3) paused (deferred – gespeicherter Nutzerwille schlägt das Zeitfenster:
 *     ein pausiertes Ziel mit Zukunfts-startDate ist „pausiert“, nie „geplant“);
 * (4) planned (startDate > Stichtag; startDate = Stichtag ist NICHT geplant);
 * (5) notComputable (kein wirksames Ziel > 0 ODER Ist-Wert unbekannt/offen –
 *     nie ein erfundenes „überfällig mit 0 %“, Auflage E);
 * (6) reachedNow (rechnerisch: Ist ≥ Ziel – auch bei überschrittenem Termin);
 * (7) overdue (targetDate < Stichtag und nicht erreicht; targetDate =
 *     Stichtag ist NICHT überfällig);
 * (8) active.
 */
export function deriveGoalStatus(goal: Goal, context: GoalStatusContext): DerivedGoalStatus {
  if (goal.status === 'archived') return 'archived'
  if (goal.status === 'reached') return 'completed'
  if (goal.status === 'deferred') return 'paused'
  if (typeof goal.startDate === 'string' && goal.startDate > context.todayIso) return 'planned'
  if (context.target === null || context.target <= 0 || context.actual === null) {
    return 'notComputable'
  }
  if (context.actual >= context.target) return 'reachedNow'
  if (typeof goal.targetDate === 'string' && goal.targetDate < context.todayIso) return 'overdue'
  return 'active'
}

function isOwnPlanWithAmount(plan: SavingsPlan): boolean {
  return (
    (plan.flowType === 'own_fixed' || plan.flowType === 'own_variable') &&
    plan.amount !== null
  )
}

/**
 * Liefert die dem Ziel ZUORDENBAREN eigenen Sparpläne (own_fixed/own_variable
 * mit festem Betrag) über die vorhandene Zielreferenz – KEIN redundantes
 * goalId-Feld an Sparplänen. Der Aufrufer übergibt die am Stichtag AKTIVEN
 * Pläne (isPlanActiveOn-Filter). null = keine eindeutige Zuordnung möglich
 * (totalWealth/monthlySavingsRate/manual/ohne Kennzahl) – die UI zeigt dann
 * die klar gekennzeichnete ALLGEMEINE eigene Sparleistung und behauptet nie,
 * dass sie vollständig diesem Ziel zufließt.
 */
export function assignedOwnPlans(
  goal: Goal,
  activePlans: readonly SavingsPlan[],
  accounts: readonly Account[],
  positions: readonly PortfolioPosition[],
): SavingsPlan[] | null {
  const metric = isEmergencyFundGoal(goal) ? 'tagesgeld' : goal.metric
  switch (metric) {
    case 'tagesgeld': {
      // Eigene Pläne auf AKTIVE Tagesgeld-Konten.
      const activeCashAccountIds = new Set(
        accounts
          .filter((account) => isAccountActive(account) && account.type === 'tagesgeld')
          .map((account) => account.id),
      )
      return activePlans.filter(
        (plan) =>
          isOwnPlanWithAmount(plan) &&
          plan.targetKind === 'account' &&
          activeCashAccountIds.has(plan.targetId),
      )
    }
    case 'depotValue': {
      // Nur Pläne auf AKTIVE Positionen: das Ziel-Ist (F2) zählt ausschließlich
      // aktive Positionen – ein Plan auf eine deaktivierte Position erhöht das
      // Ziel nie und darf die Zuordnung/Prognosebasis nicht aufblähen
      // (finance-analyst-Befund M12; konsistent mit dem tagesgeld-Zweig).
      // accountBalance/positionValue bleiben dagegen OHNE Aktiv-Filter: dort
      // referenziert das Ziel die Position/das Konto AUSDRÜCKLICH und das Ist
      // wird trotz Deaktivierung berechnet (mit sichtbarer Warnung).
      const activePositionIds = new Set(
        positions.filter(isPositionActive).map((position) => position.id),
      )
      return activePlans.filter(
        (plan) =>
          isOwnPlanWithAmount(plan) &&
          plan.targetKind === 'position' &&
          activePositionIds.has(plan.targetId),
      )
    }
    case 'accountBalance':
      return activePlans.filter(
        (plan) =>
          isOwnPlanWithAmount(plan) &&
          plan.targetKind === 'account' &&
          plan.targetId === goal.refId,
      )
    case 'positionValue':
      return activePlans.filter(
        (plan) =>
          isOwnPlanWithAmount(plan) &&
          plan.targetKind === 'position' &&
          plan.targetId === goal.refId,
      )
    default:
      return null
  }
}

/**
 * Zielbezogene EIGENE Sparleistung (Summe monthlyAmount der zuordenbaren
 * Pläne in der gewählten Sicht) oder null (keine eindeutige Zuordnung).
 * Doppelzählungs-Schutz (dokumentiert): Zielbezogene Werte werden NIE über
 * Ziele summiert – dieselbe Rate kann mehreren Zielen zuordenbar sein
 * (z. B. Positionsziel UND Depotziel); eine Summe über Ziele wäre eine
 * Mehrfachzählung derselben Sparleistung.
 */
export function assignedOwnSavings(
  goal: Goal,
  activePlans: readonly SavingsPlan[],
  accounts: readonly Account[],
  positions: readonly PortfolioPosition[],
  view: SavingsView,
): number | null {
  const plans = assignedOwnPlans(goal, activePlans, accounts, positions)
  if (plans === null) return null
  return plans.reduce((sum, plan) => sum + monthlyAmount(plan, view), 0)
}

/**
 * Rang der abgeleiteten Status für die Übersichts-Sortierung: Handlungsbedarf
 * zuerst (überfällig), dann laufende, rechnerisch erreichte, nicht
 * berechenbare, geplante, pausierte, abgeschlossene, archivierte Ziele.
 */
export const DERIVED_GOAL_STATUS_RANK: Record<DerivedGoalStatus, number> = {
  overdue: 0,
  active: 1,
  reachedNow: 2,
  notComputable: 3,
  planned: 4,
  paused: 5,
  completed: 6,
  archived: 7,
}

/** Anzahl Ziele je abgeleitetem Status (fehlende Status → 0). */
export function countGoalsByStatus(
  statuses: readonly DerivedGoalStatus[],
): Record<DerivedGoalStatus, number> {
  const counts: Record<DerivedGoalStatus, number> = {
    archived: 0,
    completed: 0,
    paused: 0,
    planned: 0,
    notComputable: 0,
    reachedNow: 0,
    overdue: 0,
    active: 0,
  }
  for (const status of statuses) {
    counts[status] += 1
  }
  return counts
}

export interface GoalSortEntry {
  goal: Goal
  status: DerivedGoalStatus
}

/**
 * Übersichts-Sortierung (M12): abgeleiteter Status-Rang, dann Zieldatum
 * aufsteigend (ohne Zieldatum ans Ende), dann Name (de-DE).
 */
export function compareGoalEntries(a: GoalSortEntry, b: GoalSortEntry): number {
  const rankDiff = DERIVED_GOAL_STATUS_RANK[a.status] - DERIVED_GOAL_STATUS_RANK[b.status]
  if (rankDiff !== 0) return rankDiff
  const aDate = typeof a.goal.targetDate === 'string' ? a.goal.targetDate : null
  const bDate = typeof b.goal.targetDate === 'string' ? b.goal.targetDate : null
  if (aDate !== bDate) {
    if (aDate === null) return 1
    if (bDate === null) return -1
    return aDate < bDate ? -1 : 1
  }
  return a.goal.name.localeCompare(b.goal.name, 'de')
}
