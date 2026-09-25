/**
 * Reine Datenfunktionen für das Modul „Sparpläne“ (M10) – ohne React,
 * unabhängig testbar (Muster src/data/accounts.ts). Alle Funktionen sind pur,
 * mutieren nie die Eingabe (Top-Level-Shallow-Klon) und geben entweder neues
 * FinanceData oder ein Fehlerobjekt mit deutscher, feldbezogener Meldung
 * zurück. Fehlertexte nennen NAMEN, nie technische IDs.
 *
 * Verbindliche Regeln (Spec M10, data-architect-ratifiziert):
 * - Kein Löschen von Sparplänen (transactions.savingsPlanId und historische
 *   Bezüge bleiben stabil) – nur Beenden über validUntil.
 * - once-Normalisierung (Auflage 2a): addSavingsPlan setzt bei interval "once"
 *   immer validUntil = validFrom; updateSavingsPlan zieht bei einer
 *   validFrom-Änderung eines once-Plans das validUntil mit.
 * - amount null („variabel, nicht garantiert“) nur bei own_variable/provider
 *   und nie bei once; dueMonth nur bei yearly (1–12); Umbuchungs-Zuflussarten
 *   nur auf Konten (C3/G7); Zielreferenz muss existieren UND zum targetKind
 *   passen. Ein DEAKTIVIERTES Ziel ist wählbar (Deaktivieren ist reversibel;
 *   Blockieren wäre eine neue stille Regel) – die UI warnt deutlich.
 */

import type { FinanceData, FlowType, Interval, SavingsPlan, TargetKind } from '../types/finance'
import { collectAllIds } from './accounts'
import { isValidBusinessDate } from '../validation/validateFinanceData'

export interface SavingsPlanInput {
  name: string
  targetKind: TargetKind
  targetId: string
  /** null = variabel (nicht garantiert) – nur bei own_variable/provider, nie bei once. */
  amount: number | null
  interval: Interval
  /** Nur bei interval "yearly" (1–12); sonst null/weglassen. */
  dueMonth?: number | null
  flowType: FlowType
  isFlexible?: boolean
  validFrom: string
  validUntil?: string | null
  note?: string | null
}

export type SavingsPlanActionResult =
  | { ok: true; data: FinanceData }
  | { ok: false; error: string }

const AMOUNT_NULL_FLOW_TYPES: readonly FlowType[] = ['own_variable', 'provider']
const TRANSFER_FLOW_TYPES: readonly FlowType[] = ['reserve_transfer', 'liquidity_transfer']

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
  return slug === '' ? 'sparplan' : slug
}

/** "sp-" + kebab(name); bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model §2). */
export function generateSavingsPlanId(name: string, existingIds: ReadonlySet<string>): string {
  const base = `sp-${kebab(name)}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

function findPlanIndex(data: FinanceData, planId: string): number {
  return data.savingsPlans.findIndex((plan) => plan.id === planId)
}

/** Ersetzt genau einen Plan (Top-Level-Shallow-Klon, Eingabe bleibt unverändert). */
function replacePlan(data: FinanceData, index: number, plan: SavingsPlan): FinanceData {
  const savingsPlans = data.savingsPlans.slice()
  savingsPlans[index] = plan
  return { ...data, savingsPlans }
}

/**
 * Fachliche Prüfung eines (zusammengeführten) Plan-Stands. Liefert null bei
 * Erfolg, sonst die deutsche, feldbezogene Meldung (Feld-Präfix wie „Betrag:“).
 */
function checkPlanInput(data: FinanceData, input: SavingsPlanInput): string | null {
  if (input.name.trim() === '') {
    return 'Name: Der Name darf nicht leer sein.'
  }
  if (input.amount !== null) {
    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount)) {
      return 'Betrag: Der Betrag muss eine endliche Zahl sein.'
    }
    if (input.amount < 0) {
      return 'Betrag: Der Betrag darf nicht negativ sein.'
    }
  } else {
    if (input.interval === 'once') {
      return 'Betrag: Ein einmaliger Zufluss braucht immer einen Betrag – „variabel“ ist bei Einmalzuflüssen nicht möglich.'
    }
    if (!AMOUNT_NULL_FLOW_TYPES.includes(input.flowType)) {
      return 'Betrag: „variabel (kein garantierter Betrag)“ ist nur bei den Zuflussarten „eigene variable Sparleistung“ und „Anbieterleistung“ möglich.'
    }
  }
  if (!isValidBusinessDate(input.validFrom)) {
    return `Startdatum: "${input.validFrom}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`
  }
  const validUntil = input.validUntil ?? null
  if (validUntil !== null) {
    if (!isValidBusinessDate(validUntil)) {
      return `Enddatum: "${validUntil}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`
    }
    if (validUntil < input.validFrom) {
      return 'Enddatum: Das Enddatum darf nicht vor dem Startdatum liegen.'
    }
    if (input.interval === 'once' && validUntil !== input.validFrom) {
      return 'Enddatum: Bei einem einmaligen Zufluss ist das Enddatum immer das Ausführungsdatum (Startdatum).'
    }
  }
  const dueMonth = input.dueMonth ?? null
  if (dueMonth !== null) {
    if (input.interval !== 'yearly') {
      return 'Fälligkeitsmonat: Ein Fälligkeitsmonat ist nur bei jährlichem Rhythmus möglich.'
    }
    if (!Number.isInteger(dueMonth) || dueMonth < 1 || dueMonth > 12) {
      return 'Fälligkeitsmonat: Bitte einen Monat von 1 (Januar) bis 12 (Dezember) wählen.'
    }
  }
  if (TRANSFER_FLOW_TYPES.includes(input.flowType) && input.targetKind !== 'account') {
    return 'Zuflussart: Umbuchungen (Rücklagen-/Liquiditätsübertragung) sind nur auf Konten möglich, nie auf Depotpositionen.'
  }
  // Zielreferenz: existiert UND passt zum targetKind (Fehlertext ohne IDs).
  const targetExists =
    input.targetKind === 'position'
      ? data.portfolioPositions.some((position) => position.id === input.targetId)
      : data.accounts.some((account) => account.id === input.targetId)
  if (!targetExists) {
    return input.targetKind === 'position'
      ? 'Ziel: Die gewählte Depotposition existiert nicht (oder das Ziel ist ein Konto). Bitte ein gültiges Ziel wählen.'
      : 'Ziel: Das gewählte Konto existiert nicht (oder das Ziel ist eine Depotposition). Bitte ein gültiges Ziel wählen.'
  }
  return null
}

/**
 * Legt einen neuen Sparplan an (isFlexible-Default true, minAmount null,
 * once-Normalisierung validUntil = validFrom, Auflage 2a).
 */
export function addSavingsPlan(data: FinanceData, input: SavingsPlanInput): SavingsPlanActionResult {
  const issue = checkPlanInput(data, input)
  if (issue !== null) return { ok: false, error: issue }
  const name = input.name.trim()
  const plan: SavingsPlan = {
    id: generateSavingsPlanId(name, collectAllIds(data)),
    name,
    targetKind: input.targetKind,
    targetId: input.targetId,
    amount: input.amount,
    interval: input.interval,
    dueMonth: input.interval === 'yearly' ? (input.dueMonth ?? null) : null,
    flowType: input.flowType,
    isFlexible: input.isFlexible ?? true,
    minAmount: null,
    validFrom: input.validFrom,
    validUntil:
      input.interval === 'once' ? input.validFrom : (input.validUntil ?? null),
    note: input.note ?? null,
  }
  return { ok: true, data: { ...data, savingsPlans: [...data.savingsPlans, plan] } }
}

/**
 * Aktualisiert Stammdaten eines Sparplans. Unbekannte Felder des Plans bleiben
 * erhalten (Spread auf dem Bestand, Regel 16). once-Normalisierung: nach der
 * Änderung eines once-Plans folgt ein gesetztes validUntil immer dem validFrom
 * (Auflage 2a); ein abweichendes explizites validUntil wird abgelehnt
 * (checkPlanInput).
 */
export function updateSavingsPlan(
  data: FinanceData,
  planId: string,
  changes: Partial<SavingsPlanInput>,
): SavingsPlanActionResult {
  const index = findPlanIndex(data, planId)
  if (index === -1) {
    return { ok: false, error: 'Der Sparplan existiert nicht (womöglich wurde er umbenannt oder die Datei neu geladen).' }
  }
  const existing = data.savingsPlans[index]
  const merged: SavingsPlanInput = {
    name: changes.name ?? existing.name,
    targetKind: changes.targetKind ?? existing.targetKind,
    targetId: changes.targetId ?? existing.targetId,
    amount: changes.amount !== undefined ? changes.amount : existing.amount,
    interval: changes.interval ?? existing.interval,
    dueMonth: changes.dueMonth !== undefined ? changes.dueMonth : (existing.dueMonth ?? null),
    flowType: changes.flowType ?? existing.flowType,
    isFlexible: changes.isFlexible ?? existing.isFlexible,
    validFrom: changes.validFrom ?? existing.validFrom,
    validUntil: changes.validUntil !== undefined ? changes.validUntil : (existing.validUntil ?? null),
    note: changes.note !== undefined ? changes.note : (existing.note ?? null),
  }
  // Auflage 2a: bei once folgt ein bestehendes validUntil der validFrom-Änderung,
  // sofern die Änderung das Enddatum nicht selbst ausdrücklich setzt.
  if (merged.interval === 'once' && changes.validUntil === undefined) {
    merged.validUntil = merged.validFrom
  }
  // Intervallwechsel-Normalisierung (calculation-tester-Befunde M10-2/M10-3):
  // (a) Weg von yearly: ein NICHT ausdrücklich mitgegebener dueMonth wird
  //     verworfen statt die Änderung abzulehnen (analog Auflage 2a).
  if (merged.interval !== 'yearly' && changes.dueMonth === undefined) {
    merged.dueMonth = null
  }
  // (b) Weg von once: das automatisch normalisierte validUntil (= altes
  //     Ausführungsdatum) ist ein Artefakt – ohne ausdrückliches neues Enddatum
  //     wird es zurückgesetzt, sonst endete der Plan still nach einem Monat.
  if (existing.interval === 'once' && merged.interval !== 'once' && changes.validUntil === undefined) {
    merged.validUntil = null
  }
  const issue = checkPlanInput(data, merged)
  if (issue !== null) return { ok: false, error: issue }
  // Spread auf dem Bestand: unbekannte Felder und Schlüsselreihenfolge bleiben
  // erhalten (Regel 16). Optionale Schlüssel werden NICHT neu hinzugefügt,
  // wenn sie fehlen und der Zielwert ohnehin der Default wäre – ein
  // unverändertes Speichern bleibt dadurch Byte-identisch (kein Dirty-State).
  const updated: SavingsPlan = { ...existing }
  updated.name = merged.name.trim()
  updated.targetKind = merged.targetKind
  updated.targetId = merged.targetId
  updated.amount = merged.amount
  updated.interval = merged.interval
  const normalizedDueMonth = merged.interval === 'yearly' ? (merged.dueMonth ?? null) : null
  if (normalizedDueMonth !== null || existing.dueMonth !== undefined) {
    updated.dueMonth = normalizedDueMonth
  }
  updated.flowType = merged.flowType
  // Reviewer K2: den optionalen Schlüssel nur dann NEU anlegen, wenn der Wert
  // vom Default (true) abweicht – sonst würde ein unverändertes Speichern eines
  // Plans ohne isFlexible-Schlüssel einen falschen Dirty-State erzeugen.
  const normalizedIsFlexible = merged.isFlexible ?? true
  if (existing.isFlexible !== undefined || normalizedIsFlexible !== true) {
    updated.isFlexible = normalizedIsFlexible
  }
  updated.validFrom = merged.validFrom
  const normalizedValidUntil =
    merged.interval === 'once' ? merged.validFrom : (merged.validUntil ?? null)
  if (normalizedValidUntil !== null || existing.validUntil !== undefined) {
    updated.validUntil = normalizedValidUntil
  }
  const normalizedNote = merged.note ?? null
  if (normalizedNote !== null || existing.note !== undefined) {
    updated.note = normalizedNote
  }
  return { ok: true, data: replacePlan(data, index, updated) }
}

/** Pausiert einen Sparplan (isPaused true): zählt danach in keine Kennzahl, bleibt gelistet. */
export function pauseSavingsPlan(data: FinanceData, planId: string): SavingsPlanActionResult {
  const index = findPlanIndex(data, planId)
  if (index === -1) {
    return { ok: false, error: 'Der Sparplan existiert nicht.' }
  }
  const plan = data.savingsPlans[index]
  if (plan.isPaused === true) {
    return { ok: false, error: `Der Sparplan „${plan.name}“ ist bereits pausiert.` }
  }
  return { ok: true, data: replacePlan(data, index, { ...plan, isPaused: true }) }
}

/** Reaktiviert einen pausierten Sparplan (isPaused false). */
export function resumeSavingsPlan(data: FinanceData, planId: string): SavingsPlanActionResult {
  const index = findPlanIndex(data, planId)
  if (index === -1) {
    return { ok: false, error: 'Der Sparplan existiert nicht.' }
  }
  const plan = data.savingsPlans[index]
  if (plan.isPaused !== true) {
    return { ok: false, error: `Der Sparplan „${plan.name}“ ist nicht pausiert.` }
  }
  return { ok: true, data: replacePlan(data, index, { ...plan, isPaused: false }) }
}

/**
 * Beendet einen Sparplan zum Enddatum (validUntil). Sparpläne werden NIE
 * gelöscht (stabile historische Bezüge) – Beenden ist der einzige Abschlussweg.
 * once-Pläne enden automatisch mit dem Ausführungsdatum und werden nicht beendet.
 */
export function endSavingsPlan(
  data: FinanceData,
  planId: string,
  endDateIso: string,
): SavingsPlanActionResult {
  const index = findPlanIndex(data, planId)
  if (index === -1) {
    return { ok: false, error: 'Der Sparplan existiert nicht.' }
  }
  const plan = data.savingsPlans[index]
  if (plan.interval === 'once') {
    return {
      ok: false,
      error: `„${plan.name}“ ist ein einmaliger Zufluss – er ist nach dem Ausführungsdatum automatisch abgeschlossen und wird nicht beendet.`,
    }
  }
  if (!isValidBusinessDate(endDateIso)) {
    return {
      ok: false,
      error: `Enddatum: "${endDateIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  if (endDateIso < plan.validFrom) {
    return {
      ok: false,
      error: `Enddatum: Das Enddatum darf nicht vor dem Startdatum des Sparplans „${plan.name}“ liegen.`,
    }
  }
  return { ok: true, data: replacePlan(data, index, { ...plan, validUntil: endDateIso }) }
}
