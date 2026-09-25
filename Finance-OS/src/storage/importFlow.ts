/**
 * Import-Ablauf (Blueprint §4, storage-concept.md Abschnitt 4).
 *
 * importFromFile liest und validiert nur – es ÜBERNIMMT NICHTS in den
 * Arbeitsbestand. Übernahme geschieht ausschließlich nach Vorschau und
 * ausdrücklicher Bestätigung (M4/G10/G12, Regel 17).
 */

import type { FinanceData, ImportAction, ImportHistoryEntry, ImportOutcome } from '../types/finance'
import type { ValidationResult } from '../validation/issues'
import { parseFinanceJson } from '../validation/parseFinanceJson'
import { readFileAsText } from './fileAccess'

export interface ImportSummary {
  schemaVersion: number
  isExampleData: boolean
  description: string | null
  counts: {
    accounts: number
    portfolioPositions: number
    snapshots: number
    savingsPlans: number
    goals: number
    transactions: number
  }
  latestDate: string | null
}

export interface ImportCandidate {
  fileName: string
  result: ValidationResult
  summary: ImportSummary | null
}

/** Liest + validiert die Datei; todayIso (optional) steuert nur die W_FUTURE_DATE-Warnung. */
export async function importFromFile(file: File, todayIso?: string): Promise<ImportCandidate> {
  const { text } = await readFileAsText(file)
  const result = parseFinanceJson(text, todayIso === undefined ? undefined : { todayIso })
  return {
    fileName: file.name,
    result,
    summary: result.ok && result.data ? buildImportSummary(result.data) : null,
  }
}

/** Kennzahlen für die Importvorschau (M4) – nur Zählungen, keine Finanzlogik. */
export function buildImportSummary(data: FinanceData): ImportSummary {
  const dates: string[] = []
  data.snapshots.forEach((snapshot) => dates.push(snapshot.date))
  data.accounts.forEach((account) =>
    account.balanceHistory.forEach((entry) => dates.push(entry.date)),
  )
  data.portfolioPositions.forEach((position) =>
    position.valueHistory.forEach((entry) => dates.push(entry.date)),
  )
  data.transactions.forEach((transaction) => dates.push(transaction.date))
  // ISO-Daten (JJJJ-MM-TT) sind lexikografisch vergleichbar.
  const latestDate =
    dates.length === 0 ? null : dates.reduce((max, date) => (date > max ? date : max))
  return {
    schemaVersion: data.schemaVersion,
    isExampleData: data.metadata.isExampleData === true,
    description: typeof data.metadata.description === 'string' ? data.metadata.description : null,
    counts: {
      accounts: data.accounts.length,
      portfolioPositions: data.portfolioPositions.length,
      snapshots: data.snapshots.length,
      savingsPlans: data.savingsPlans.length,
      goals: data.goals.length,
      transactions: data.transactions.length,
    },
    latestDate,
  }
}

/**
 * Erzeugt einen Protokolleintrag. id: "imp-" + kompakter Zeitstempel aus nowIso
 * (z. B. "imp-2026-07-19-1030-00"), bei Kollision Suffix "-2", "-3", …
 */
export function createImportHistoryEntry(args: {
  action: ImportAction
  fileName: string | null
  fileSchemaVersion: number | null
  outcome: ImportOutcome
  note?: string | null
  nowIso: string
  existingIds: ReadonlySet<string>
}): ImportHistoryEntry {
  const datePart = args.nowIso.slice(0, 10)
  const timePart = `${args.nowIso.slice(11, 13)}${args.nowIso.slice(14, 16)}-${args.nowIso.slice(17, 19)}`
  const baseId = `imp-${datePart}-${timePart}`
  let id = baseId
  let suffix = 2
  while (args.existingIds.has(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  return {
    id,
    timestamp: args.nowIso,
    action: args.action,
    fileName: args.fileName,
    fileSchemaVersion: args.fileSchemaVersion,
    outcome: args.outcome,
    note: args.note ?? null,
  }
}

/**
 * Hängt einen Protokolleintrag an (flacher Top-Level-Klon) und kappt auf
 * maximal 50 Einträge – der älteste fällt weg (DM22). Alle übrigen
 * Finanzdaten bleiben referenzidentisch erhalten.
 */
export function appendImportHistory(data: FinanceData, entry: ImportHistoryEntry): FinanceData {
  const importHistory = [...data.importHistory, entry]
  const capped =
    importHistory.length > 50 ? importHistory.slice(importHistory.length - 50) : importHistory
  return { ...data, importHistory: capped }
}
