/**
 * Reine Datenfunktionen für das Modul „Finanzziele“ (M12) – ohne React,
 * unabhängig testbar (Muster src/data/savingsPlans.ts). Alle Funktionen sind
 * pur, mutieren nie die Eingabe (Top-Level-Shallow-Klon) und geben entweder
 * neues FinanceData oder ein Fehlerobjekt mit deutscher, feldbezogener
 * Meldung zurück. Fehlertexte nennen NAMEN, nie technische IDs.
 *
 * Verbindliche Regeln (Spec M12, data-architect-ratifiziert):
 * - KEIN Löschen von Zielen – Archivieren (status 'archived') ist der einzige
 *   Abschlussweg „beendet“; manuell abschließen = status 'reached'
 *   (GESPEICHERTER Nutzerwille); rechnerisch erreicht wird NIE gespeichert.
 * - refId nur bei accountBalance/positionValue (Referenz muss existieren und
 *   zur Kennzahl passen; eine DEAKTIVIERTE Referenz ist wählbar – die UI
 *   warnt deutlich, Blockieren wäre eine neue stille Regel).
 * - manualCurrentAmount (≥ 0 oder null = offen) nur fachlich bei metric
 *   'manual'; targetDate ≥ startDate, falls beide gesetzt.
 * - Metrikwechsel-Normalisierung (Auflage C, M10-2/3-Präzedenz): weg von
 *   accountBalance/positionValue → nicht ausdrücklich mitgegebenes refId wird
 *   verworfen; weg von manual → manualCurrentAmount wird verworfen.
 * - isAutoCalculated bleibt exklusiv dem Notgroschen und ist über updateGoal
 *   NICHT änderbar (per Spread erhalten, nie im Patch).
 * - K2-Regel: optionale Schlüssel (targetAmount/targetDate/metric/note UND
 *   refId/manualCurrentAmount/startDate) werden nie als Default-null-Schlüssel
 *   NEU materialisiert – unverändertes Speichern bleibt Byte-identisch.
 */

import type { FinanceData, Goal, GoalMetric } from '../types/finance'
import { collectAllIds } from './accounts'
import { isValidBusinessDate } from '../validation/validateFinanceData'

export interface GoalInput {
  name: string
  /** Zahl > 0 oder null (= „offen“ – nichts erfinden, G11). */
  targetAmount?: number | null
  targetDate?: string | null
  metric?: GoalMetric | null
  /** Nur bei accountBalance/positionValue (Pflicht dort). */
  refId?: string | null
  /** Nur bei metric 'manual': Zahl ≥ 0 oder null (= offen). */
  manualCurrentAmount?: number | null
  startDate?: string | null
  note?: string | null
}

export type GoalActionResult = { ok: true; data: FinanceData } | { ok: false; error: string }

const REF_METRICS: readonly GoalMetric[] = ['accountBalance', 'positionValue']

/** Kebab-Case aus dem Namen (deutsche Umlaute transliteriert), nie leer. */
function kebab(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'ziel' : slug
}

/** "goal-" + kebab(name); bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model §2). */
export function generateGoalId(name: string, existingIds: ReadonlySet<string>): string {
  const base = `goal-${kebab(name)}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

function findGoalIndex(data: FinanceData, goalId: string): number {
  return data.goals.findIndex((goal) => goal.id === goalId)
}

/** Ersetzt genau ein Ziel (Top-Level-Shallow-Klon, Eingabe bleibt unverändert). */
function replaceGoal(data: FinanceData, index: number, goal: Goal): FinanceData {
  const goals = data.goals.slice()
  goals[index] = goal
  return { ...data, goals }
}

/**
 * Fachliche Prüfung eines (zusammengeführten) Ziel-Stands. Liefert null bei
 * Erfolg, sonst die deutsche, feldbezogene Meldung (Feld-Präfix wie „Name:“).
 */
function checkGoalInput(data: FinanceData, input: GoalInput): string | null {
  if (input.name.trim() === '') {
    return 'Name: Der Name darf nicht leer sein.'
  }
  const targetAmount = input.targetAmount ?? null
  if (targetAmount !== null) {
    if (typeof targetAmount !== 'number' || !Number.isFinite(targetAmount)) {
      return 'Zielbetrag: Der Zielbetrag muss eine endliche Zahl sein.'
    }
    if (targetAmount <= 0) {
      return 'Zielbetrag: Der Zielbetrag muss größer als 0 sein – ohne Betrag bleibt das Ziel „offen“.'
    }
  }
  const metric = input.metric ?? null
  const refId = input.refId ?? null
  if (metric !== null && REF_METRICS.includes(metric)) {
    if (refId === null) {
      return metric === 'accountBalance'
        ? 'Referenz: Ein Kontostand-Ziel braucht ein referenziertes Konto.'
        : 'Referenz: Ein Positionswert-Ziel braucht eine referenzierte Depotposition.'
    }
    const exists =
      metric === 'accountBalance'
        ? data.accounts.some((account) => account.id === refId)
        : data.portfolioPositions.some((position) => position.id === refId)
    if (!exists) {
      return metric === 'accountBalance'
        ? 'Referenz: Das gewählte Konto existiert nicht (oder die Referenz ist eine Depotposition). Bitte eine gültige Referenz wählen.'
        : 'Referenz: Die gewählte Depotposition existiert nicht (oder die Referenz ist ein Konto). Bitte eine gültige Referenz wählen.'
    }
  } else if (refId !== null) {
    return 'Referenz: Eine Konto-/Positionsreferenz ist nur bei Kontostand- und Positionswert-Zielen möglich.'
  }
  const manualCurrentAmount = input.manualCurrentAmount ?? null
  if (manualCurrentAmount !== null) {
    if (metric !== 'manual') {
      return 'Ist-Wert: Ein manuell gepflegter Ist-Wert ist nur bei freien Geldzielen (Kennzahl „manuell“) möglich.'
    }
    if (typeof manualCurrentAmount !== 'number' || !Number.isFinite(manualCurrentAmount)) {
      return 'Ist-Wert: Der Ist-Wert muss eine endliche Zahl sein.'
    }
    if (manualCurrentAmount < 0) {
      return 'Ist-Wert: Der Ist-Wert darf nicht negativ sein.'
    }
  }
  const startDate = input.startDate ?? null
  if (startDate !== null && !isValidBusinessDate(startDate)) {
    return `Startdatum: "${startDate}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`
  }
  const targetDate = input.targetDate ?? null
  if (targetDate !== null && !isValidBusinessDate(targetDate)) {
    return `Zieldatum: "${targetDate}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`
  }
  if (startDate !== null && targetDate !== null && targetDate < startDate) {
    return 'Zieldatum: Das Zieldatum darf nicht vor dem Startdatum liegen.'
  }
  return null
}

/**
 * Legt ein neues Ziel an (status 'active', isAutoCalculated false – das
 * Auto-Verhalten bleibt exklusiv dem bestehenden Notgroschen-Ziel). Die neuen
 * optionalen Schlüssel werden nur bei gesetztem Wert materialisiert.
 */
export function addGoal(data: FinanceData, input: GoalInput): GoalActionResult {
  const issue = checkGoalInput(data, input)
  if (issue !== null) return { ok: false, error: issue }
  const name = input.name.trim()
  const goal: Goal = {
    id: generateGoalId(name, collectAllIds(data)),
    name,
    targetAmount: input.targetAmount ?? null,
    targetDate: input.targetDate ?? null,
    metric: input.metric ?? null,
    isAutoCalculated: false,
    status: 'active',
    note: input.note ?? null,
  }
  if ((input.refId ?? null) !== null) goal.refId = input.refId
  if ((input.manualCurrentAmount ?? null) !== null) {
    goal.manualCurrentAmount = input.manualCurrentAmount
  }
  if ((input.startDate ?? null) !== null) goal.startDate = input.startDate
  return { ok: true, data: { ...data, goals: [...data.goals, goal] } }
}

/**
 * Aktualisiert Stammdaten eines Ziels (Teil-Patch). Unbekannte Felder und
 * isAutoCalculated bleiben per Spread erhalten (Regel 16; isAutoCalculated
 * ist über updateGoal NICHT änderbar). Metrikwechsel-Normalisierung
 * (Auflage C): weg von accountBalance/positionValue → nicht ausdrücklich
 * mitgegebenes refId wird verworfen; weg von manual → manualCurrentAmount
 * wird verworfen. K2: optionale Schlüssel werden nie als Default-null-
 * Schlüssel NEU angelegt – unverändertes Speichern bleibt Byte-identisch.
 */
export function updateGoal(
  data: FinanceData,
  goalId: string,
  changes: Partial<GoalInput>,
): GoalActionResult {
  const index = findGoalIndex(data, goalId)
  if (index === -1) {
    return {
      ok: false,
      error: 'Das Ziel existiert nicht (womöglich wurde es umbenannt oder die Datei neu geladen).',
    }
  }
  const existing = data.goals[index]
  // Archivierte Ziele sind endgültig – auch Bearbeiten ist ausgeschlossen
  // (A11y-Befund M12-B5; konsistent mit pause/resume/complete).
  if (existing.status === 'archived') {
    return {
      ok: false,
      error: `Das Ziel „${existing.name}“ ist archiviert und kann nicht mehr bearbeitet werden.`,
    }
  }
  const merged: GoalInput = {
    name: changes.name ?? existing.name,
    targetAmount:
      changes.targetAmount !== undefined ? changes.targetAmount : (existing.targetAmount ?? null),
    targetDate:
      changes.targetDate !== undefined ? changes.targetDate : (existing.targetDate ?? null),
    metric: changes.metric !== undefined ? changes.metric : (existing.metric ?? null),
    refId: changes.refId !== undefined ? changes.refId : (existing.refId ?? null),
    manualCurrentAmount:
      changes.manualCurrentAmount !== undefined
        ? changes.manualCurrentAmount
        : (existing.manualCurrentAmount ?? null),
    startDate: changes.startDate !== undefined ? changes.startDate : (existing.startDate ?? null),
    note: changes.note !== undefined ? changes.note : (existing.note ?? null),
  }
  // Auflage C (M10-2/3-Präzedenz): Metrikwechsel-Normalisierung statt Ablehnung.
  const mergedMetric = merged.metric ?? null
  if (
    (mergedMetric === null || !REF_METRICS.includes(mergedMetric)) &&
    changes.refId === undefined
  ) {
    merged.refId = null
  }
  if (mergedMetric !== 'manual' && changes.manualCurrentAmount === undefined) {
    merged.manualCurrentAmount = null
  }
  const issue = checkGoalInput(data, merged)
  if (issue !== null) return { ok: false, error: issue }
  // Spread auf dem Bestand: unbekannte Felder, Schlüsselreihenfolge, status
  // und isAutoCalculated bleiben erhalten (Regel 16).
  const updated: Goal = { ...existing }
  updated.name = merged.name.trim()
  const assignOptional = <K extends 'targetAmount' | 'targetDate' | 'metric' | 'refId' | 'manualCurrentAmount' | 'startDate' | 'note'>(
    key: K,
    value: Goal[K],
  ): void => {
    // K2: den optionalen Schlüssel nur dann NEU anlegen, wenn der Wert vom
    // Default (null) abweicht – sonst erzeugte ein unverändertes Speichern
    // eines Ziels ohne diesen Schlüssel einen falschen Dirty-State.
    if (value !== null || existing[key] !== undefined) {
      updated[key] = value
    }
  }
  assignOptional('targetAmount', merged.targetAmount ?? null)
  assignOptional('targetDate', merged.targetDate ?? null)
  assignOptional('metric', merged.metric ?? null)
  assignOptional('refId', merged.refId ?? null)
  assignOptional('manualCurrentAmount', merged.manualCurrentAmount ?? null)
  assignOptional('startDate', merged.startDate ?? null)
  assignOptional('note', merged.note ?? null)
  return { ok: true, data: replaceGoal(data, index, updated) }
}

/** Pausiert ein Ziel (status 'deferred' = „zurückgestellt“): bleibt gelistet, kein Fortschritt. */
export function pauseGoal(data: FinanceData, goalId: string): GoalActionResult {
  const index = findGoalIndex(data, goalId)
  if (index === -1) {
    return { ok: false, error: 'Das Ziel existiert nicht.' }
  }
  const goal = data.goals[index]
  if (goal.status === 'archived') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist archiviert und kann nicht mehr geändert werden.` }
  }
  if (goal.status === 'deferred') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist bereits pausiert.` }
  }
  if (goal.status === 'reached') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist manuell abgeschlossen – zum Weiterverfolgen zuerst reaktivieren.` }
  }
  return { ok: true, data: replaceGoal(data, index, { ...goal, status: 'deferred' }) }
}

/** Reaktiviert ein pausiertes ODER manuell abgeschlossenes Ziel (status 'active'). */
export function resumeGoal(data: FinanceData, goalId: string): GoalActionResult {
  const index = findGoalIndex(data, goalId)
  if (index === -1) {
    return { ok: false, error: 'Das Ziel existiert nicht.' }
  }
  const goal = data.goals[index]
  if (goal.status === 'archived') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist archiviert und kann nicht mehr geändert werden.` }
  }
  if (goal.status === 'active') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist bereits aktiv.` }
  }
  return { ok: true, data: replaceGoal(data, index, { ...goal, status: 'active' }) }
}

/**
 * Schließt ein Ziel MANUELL ab (status 'reached' – gespeicherter Nutzerwille;
 * der rechnerische Zustand „erreicht“ wird dagegen NIE gespeichert, nur
 * abgeleitet). Erlaubt aus aktiv/pausiert.
 */
export function completeGoal(data: FinanceData, goalId: string): GoalActionResult {
  const index = findGoalIndex(data, goalId)
  if (index === -1) {
    return { ok: false, error: 'Das Ziel existiert nicht.' }
  }
  const goal = data.goals[index]
  if (goal.status === 'archived') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist archiviert und kann nicht mehr geändert werden.` }
  }
  if (goal.status === 'reached') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist bereits manuell abgeschlossen.` }
  }
  return { ok: true, data: replaceGoal(data, index, { ...goal, status: 'reached' }) }
}

/**
 * Archiviert ein Ziel (status 'archived' = beendet). Ziele werden NIE
 * gelöscht – Archivieren ist endgültig (keine weitere Statusänderung) und
 * blendet das Ziel aus dem Dashboard aus; es bleibt in der Datei erhalten.
 */
export function archiveGoal(data: FinanceData, goalId: string): GoalActionResult {
  const index = findGoalIndex(data, goalId)
  if (index === -1) {
    return { ok: false, error: 'Das Ziel existiert nicht.' }
  }
  const goal = data.goals[index]
  if (goal.status === 'archived') {
    return { ok: false, error: `Das Ziel „${goal.name}“ ist bereits archiviert.` }
  }
  return { ok: true, data: replaceGoal(data, index, { ...goal, status: 'archived' }) }
}
