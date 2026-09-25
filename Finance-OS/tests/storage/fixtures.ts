/**
 * Test-Fixtures (Blueprint §6): Die Beispieldatei wird DIREKT importiert
 * (resolveJsonModule); ungültige Fälle entstehen ausschließlich programmatisch
 * aus einem structuredClone – die Datei selbst wird nie verändert.
 */

import exampleJson from '../../user-data/finance-data.example.json'
import type { FinanceData } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'

// --- Lose Draft-Typen für gezielte Mutationen (unknown erlaubt das Einsetzen ungültiger Werte) ---

export interface HistoryEntryDraft {
  date: unknown
  amount?: unknown
  value?: unknown
  [key: string]: unknown
}

export interface AccountDraft {
  id: unknown
  name: unknown
  type: unknown
  allowNegativeBalance?: unknown
  balanceHistory: HistoryEntryDraft[]
  [key: string]: unknown
}

export interface PositionDraft {
  id: unknown
  accountId: unknown
  group: unknown
  valueHistory: HistoryEntryDraft[]
  [key: string]: unknown
}

export interface SavingsPlanDraft {
  id: unknown
  targetKind: unknown
  targetId: unknown
  amount: unknown
  flowType: unknown
  [key: string]: unknown
}

export interface WeightDraft {
  refKind: unknown
  ref: unknown
  weight: unknown
  [key: string]: unknown
}

export interface TargetProfileDraft {
  id: unknown
  weights?: WeightDraft[] | null
  [key: string]: unknown
}

export interface FinanceDataDraft {
  schemaVersion?: unknown
  metadata: Record<string, unknown>
  settings: Record<string, unknown>
  accounts: AccountDraft[]
  portfolioPositions: PositionDraft[]
  snapshots: Record<string, unknown>[]
  savingsPlans: SavingsPlanDraft[]
  targetProfiles: TargetProfileDraft[]
  goals: Record<string, unknown>[]
  transactions?: unknown
  plannedChanges?: unknown
  simulations?: unknown
  fixedCosts?: unknown
  monthlyClosings?: unknown
  journalEntries?: unknown
  importHistory: unknown[]
  [key: string]: unknown
}

/** Tiefer Klon der Beispieldatei als unknown (Blueprint §6). */
export function cloneExample(): unknown {
  return structuredClone(exampleJson) as unknown
}

/** Tiefer Klon mit losem Draft-Typ für gezielte (auch ungültige) Mutationen. */
export function cloneExampleDraft(): FinanceDataDraft {
  return structuredClone(exampleJson) as unknown as FinanceDataDraft
}

/** Mutations-Helfer: klont die Beispieldatei und wendet die Mutation an. */
export function mutateExample(mutator: (draft: FinanceDataDraft) => void): FinanceDataDraft {
  const draft = cloneExampleDraft()
  mutator(draft)
  return draft
}

/** Der exakte Text der Beispieldatei (aus dem JSON-Import serialisiert). */
export function exampleText(): string {
  return `${JSON.stringify(exampleJson, null, 2)}\n`
}

/** Lädt die Beispieldatei über die echte Validierung; wirft bei Fehlern. */
export function loadExample(): FinanceData {
  const result = parseFinanceJson(exampleText())
  if (!result.ok || result.data === null) {
    throw new Error(
      `Fixture-Fehler: Beispieldatei ist nicht valide: ${JSON.stringify(result.errors)}`,
    )
  }
  return result.data
}

/** Erzeugt eine jsdom-File aus einem beliebigen Wert (JSON-serialisiert). */
export function makeJsonFile(value: unknown, name = 'import.json'): File {
  return new File([JSON.stringify(value, null, 2)], name, { type: 'application/json' })
}
