/**
 * Snapshot-Vollerfassung (Modul Depot, M9) als reine Datenfunktion – exakt
 * nach data-architect-Vorgabe (docs/data-model.md §3.5):
 *
 * Ein Snapshot speichert nur Metadaten in der Registry; die zugehörigen Werte
 * sind die balanceHistory-/valueHistory-Einträge mit exakt diesem Datum.
 * Die Vollerfassung erwartet Werte für ALLE AKTIVEN Positionen und ALLE
 * AKTIVEN Tagesgeldkonten (W4-Neufassung) – niemals stille 0 für fehlende
 * Werte. Alle Prüfungen laufen VOR jeder Mutation (ganz oder gar nicht);
 * der Registry-Eintrag entsteht mit locked: true und source: "user" und ist
 * ab Speicherung unantastbar (G3/G4). Ein am Datum bereits existierender
 * Snapshot wird UNABHÄNGIG von locked abgelehnt – Korrekturen nur als neuer
 * Snapshot mit neuem Datum.
 */

import type { Account, FinanceData, PortfolioPosition, Snapshot } from '../types/finance'
import { collectAllIds } from './accounts'
import { checkHistoryEntryAllowed } from '../validation/lockedDates'
import { isValidBusinessDate } from '../validation/validateFinanceData'

export interface CaptureSnapshotInput {
  dateIso: string
  /** Wert je AKTIVER Position (Schlüssel = Position-ID); vollständig, nie stille 0. */
  positionValues: ReadonlyMap<string, number>
  /** Saldo je AKTIVEM Tagesgeldkonto (Schlüssel = Konto-ID); vollständig, nie stille 0. */
  accountBalances: ReadonlyMap<string, number>
  label?: string
  /** Referenzdatum (JJJJ-MM-TT) für die Zukunftsprüfung – Zeit wird injiziert. */
  todayIso: string
}

export type CaptureSnapshotResult = { ok: true; data: FinanceData } | { ok: false; error: string }

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

function isPositionActive(position: PortfolioPosition): boolean {
  return position.isActive !== false
}

/**
 * Warnhelfer für die UI: true, wenn das Datum VOR dem jüngsten vorhandenen
 * Snapshot-Datum liegt (rückdatierte Erfassung – erlaubt, aber bestätigungswürdig).
 */
export function isBackdatedBeforeLatestSnapshot(data: FinanceData, dateIso: string): boolean {
  return data.snapshots.some((snapshot) => snapshot.date > dateIso)
}

/** "snap-" + Datum; bei (theoretischer) ID-Kollision Suffix "-2", "-3" – dateiweit eindeutig. */
function generateSnapshotId(dateIso: string, existingIds: ReadonlySet<string>): string {
  const base = `snap-${dateIso}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

/** Ersetzt den Eintrag am Datum oder hängt ihn an (DM23: je Historie jedes Datum nur einmal). */
function upsertEntry<T extends { date: string }>(history: readonly T[], entry: T): T[] {
  const index = history.findIndex((existing) => existing.date === entry.date)
  const next = history.slice()
  if (index === -1) {
    next.push(entry)
  } else {
    next[index] = { ...next[index], ...entry }
  }
  return next
}

export function captureSnapshot(
  data: FinanceData,
  input: CaptureSnapshotInput,
): CaptureSnapshotResult {
  const { dateIso, todayIso, positionValues, accountBalances } = input

  // 1) Gültiges Kalenderdatum.
  if (!isValidBusinessDate(dateIso)) {
    return {
      ok: false,
      error: `Datum: "${dateIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  // 2) Keine Zukunft (Erfassungsfehler, Regel 14).
  if (dateIso > todayIso) {
    return {
      ok: false,
      error: `Datum: "${dateIso}" liegt in der Zukunft (heute: ${todayIso}). Snapshots können nur für heute oder die Vergangenheit erfasst werden.`,
    }
  }
  // 3) Gesperrtes Datum (DM21/G3).
  const lockedIssue = checkHistoryEntryAllowed(data, dateIso)
  if (lockedIssue !== null) {
    return { ok: false, error: `Datum: ${lockedIssue.message}` }
  }
  // 4) Snapshot am Datum existiert bereits – UNABHÄNGIG von locked (kein Ersetzen).
  if (data.snapshots.some((snapshot) => snapshot.date === dateIso)) {
    return {
      ok: false,
      error: `Datum: Am ${dateIso} existiert bereits ein Snapshot. Ein vorhandener Snapshot wird nie ersetzt – eine Korrektur ist nur als neuer Snapshot mit neuem Datum möglich (G4).`,
    }
  }

  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const activeCashAccounts = data.accounts.filter(
    (account) => account.type === 'tagesgeld' && isAccountActive(account),
  )

  // 5) Ohne aktive Positionen und aktive Tagesgeldkonten gibt es nichts zu erfassen.
  if (activePositions.length === 0 && activeCashAccounts.length === 0) {
    return {
      ok: false,
      error:
        'Es gibt keine aktiven Depotpositionen und keine aktiven Tagesgeldkonten – ein Snapshot hätte keinen Inhalt.',
    }
  }

  // 6) Vollständigkeit: jeder aktive Eintrag braucht einen Wert (NIE stille 0).
  const missingNames: string[] = []
  activePositions.forEach((position) => {
    if (!positionValues.has(position.id)) missingNames.push(`Position "${position.name}"`)
  })
  activeCashAccounts.forEach((account) => {
    if (!accountBalances.has(account.id)) missingNames.push(`Tagesgeld-Konto "${account.name}"`)
  })
  if (missingNames.length > 0) {
    return {
      ok: false,
      error: `Der Snapshot ist unvollständig. Es fehlen Werte für: ${missingNames.join(', ')}. Fehlende Werte werden nie stillschweigend als 0 erfasst.`,
    }
  }

  // 7) Keine überzähligen Einträge (unbekannte, inaktive oder typfremde IDs).
  const allowedPositionIds = new Set(activePositions.map((position) => position.id))
  const allowedAccountIds = new Set(activeCashAccounts.map((account) => account.id))
  for (const id of positionValues.keys()) {
    if (!allowedPositionIds.has(id)) {
      return {
        ok: false,
        error: `Der Wert für "${id}" gehört zu keiner aktiven Depotposition und wird nicht erfasst (unbekannte, inaktive oder typfremde ID).`,
      }
    }
  }
  for (const id of accountBalances.keys()) {
    if (!allowedAccountIds.has(id)) {
      return {
        ok: false,
        error: `Der Saldo für "${id}" gehört zu keinem aktiven Tagesgeldkonto und wird nicht erfasst (unbekannte, inaktive oder typfremde ID).`,
      }
    }
  }

  // 8) + 9) Werteprüfung: endlich; Positionswerte nie negativ; Kontosalden nur
  // mit allowNegativeBalance negativ (DM20).
  for (const position of activePositions) {
    const value = positionValues.get(position.id)!
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {
        ok: false,
        error: `Der Wert für die Position "${position.name}" muss eine endliche Zahl sein.`,
      }
    }
    if (value < 0) {
      return {
        ok: false,
        error: `Der Wert für die Position "${position.name}" darf nicht negativ sein (DM20).`,
      }
    }
  }
  for (const account of activeCashAccounts) {
    const amount = accountBalances.get(account.id)!
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return {
        ok: false,
        error: `Der Saldo für das Konto "${account.name}" muss eine endliche Zahl sein.`,
      }
    }
    if (amount < 0 && account.allowNegativeBalance !== true) {
      return {
        ok: false,
        error: `Der Saldo für das Konto "${account.name}" darf nicht negativ sein. Erlaube negative Salden zuerst über „negativer Saldo erlaubt“ (DM20).`,
      }
    }
  }

  // Alle Prüfungen bestanden → jetzt erst mutieren (ganz oder gar nicht).
  const portfolioPositions = data.portfolioPositions.map((position) => {
    if (!allowedPositionIds.has(position.id)) return position
    const value = positionValues.get(position.id)!
    return { ...position, valueHistory: upsertEntry(position.valueHistory, { date: dateIso, value }) }
  })
  const accounts = data.accounts.map((account) => {
    if (!allowedAccountIds.has(account.id)) return account
    const amount = accountBalances.get(account.id)!
    return {
      ...account,
      balanceHistory: upsertEntry(account.balanceHistory, { date: dateIso, amount }),
    }
  })
  const snapshot: Snapshot = {
    id: generateSnapshotId(dateIso, collectAllIds(data)),
    date: dateIso,
    locked: true,
    source: 'user',
  }
  if (input.label !== undefined && input.label.trim() !== '') {
    snapshot.label = input.label.trim()
  }
  return {
    ok: true,
    data: { ...data, portfolioPositions, accounts, snapshots: [...data.snapshots, snapshot] },
  }
}

// --- Snapshot-Auswertungs-Helfer (Modul Übersicht M7, W4-Ableitungen; rein, ohne Mutation) ---

/**
 * W4-Regel: Ein Datum ist vollständig bewertet, wenn ALLE AKTIVEN Positionen
 * und ALLE AKTIVEN Tagesgeldkonten am Datum einen Historien-Eintrag haben.
 * Inaktive Einträge zählen für die Vollständigkeit nicht. Gibt es KEINEN
 * einzigen aktiven Eintrag, ist nichts zu bewerten → NICHT vollständig
 * (keine vakuumwahre Vollständigkeit über leere Listen).
 */
export function isSnapshotComplete(data: FinanceData, dateIso: string): boolean {
  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const activeCashAccounts = data.accounts.filter(
    (account) => account.type === 'tagesgeld' && isAccountActive(account),
  )
  if (activePositions.length === 0 && activeCashAccounts.length === 0) return false
  return (
    activePositions.every((position) =>
      position.valueHistory.some((entry) => entry.date === dateIso),
    ) &&
    activeCashAccounts.every((account) =>
      account.balanceHistory.some((entry) => entry.date === dateIso),
    )
  )
}

/**
 * Jüngstes Datum aus der Snapshot-Registry, das nach W4 vollständig bewertet
 * ist; null, wenn kein Snapshot existiert oder keiner vollständig ist.
 */
export function latestCompleteSnapshotDate(data: FinanceData): string | null {
  let latest: string | null = null
  for (const snapshot of data.snapshots) {
    if (!isSnapshotComplete(data, snapshot.date)) continue
    if (latest === null || snapshot.date > latest) latest = snapshot.date
  }
  return latest
}

/**
 * Gibt es Historien-Einträge (Positionen oder Tagesgeldkonten) mit Datum
 * > dateIso? Bewusst OHNE Aktiv-Filter: auch ein Eintrag an einer inzwischen
 * deaktivierten Position ist eine Wertänderung nach dem Stichtag.
 */
export function hasEntriesAfter(data: FinanceData, dateIso: string): boolean {
  if (
    data.portfolioPositions.some((position) =>
      position.valueHistory.some((entry) => entry.date > dateIso),
    )
  ) {
    return true
  }
  return data.accounts.some(
    (account) =>
      account.type === 'tagesgeld' &&
      account.balanceHistory.some((entry) => entry.date > dateIso),
  )
}

/**
 * Jüngstes Bewertungsdatum über alle AKTIVEN Positionen und AKTIVEN
 * Tagesgeldkonten; null, wenn keine Historien-Einträge existieren.
 */
export function latestValuationDate(data: FinanceData): string | null {
  let latest: string | null = null
  const consider = (date: string): void => {
    if (latest === null || date > latest) latest = date
  }
  data.portfolioPositions
    .filter(isPositionActive)
    .forEach((position) => position.valueHistory.forEach((entry) => consider(entry.date)))
  data.accounts
    .filter((account) => account.type === 'tagesgeld' && isAccountActive(account))
    .forEach((account) => account.balanceHistory.forEach((entry) => consider(entry.date)))
  return latest
}
