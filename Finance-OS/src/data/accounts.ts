/**
 * Reine Datenfunktionen für das Modul „Konten“ (M8) – ohne React, unabhängig
 * testbar. Alle Funktionen sind pur, mutieren nie die Eingabe (Top-Level-
 * Shallow-Klon-Kette wie withUpdatedTimestamp) und geben entweder neues
 * FinanceData oder ein Fehlerobjekt mit deutscher, feldbezogener Meldung zurück.
 *
 * Doppelzählungs-Modell (verbindlich; als aufklappbarer Hinweis auch auf der
 * Konten-Seite dokumentiert):
 * 1. Depot-Konten haben KEINEN eigenen „aktuellen Wert“: ihre balanceHistory
 *    bleibt leer (Validierung C2/DM19). Der Depotwert entsteht ausschließlich
 *    aus den portfolioPositions (src/finance depotValue). pension-Konten sind
 *    Merkposten ohne Wert.
 * 2. Jedes Konto zählt genau einmal nach Typ: z. B. Tagesgeld gesamt =
 *    Σ der AKTIVEN Konten mit type "tagesgeld" (cashValue aus src/finance auf
 *    vorgefilterte aktive Konten anwenden – die reine Rechenfunktion bleibt
 *    unverändert, der Aufrufer filtert).
 * 3. Deaktivierte Konten (isActive: false) fließen in KEINE Summen ein,
 *    bleiben aber sichtbar gelistet (Status „inaktiv“ als Text, nicht nur
 *    Farbe).
 *
 * Sperrregel DM21 (G3/G4): Historien-Einträge an Daten gesperrter Snapshots
 * werden über checkHistoryEntryAllowed (src/validation/lockedDates) abgelehnt –
 * hier erstmals verdrahtet.
 */

import type { Account, AccountType, FinanceData } from '../types/finance'
import { checkHistoryEntryAllowed } from '../validation/lockedDates'
import { isValidBusinessDate } from '../validation/validateFinanceData'

export interface AccountInput {
  name: string
  type: AccountType
  institution?: string | null
  purpose?: string | null
  note?: string | null
  countsAsFreeLiquidity?: boolean
  allowNegativeBalance?: boolean
}

export type AccountActionResult = { ok: true; data: FinanceData } | { ok: false; error: string }

/**
 * Im „Hinzufügen“-Formular wählbare Kontotypen. Die Bestandstypen
 * ruecklage/krypto/pension werden nur angezeigt/bearbeitet, nicht neu angelegt.
 */
export const ADDABLE_ACCOUNT_TYPES: readonly AccountType[] = [
  'giro',
  'tagesgeld',
  'depot',
  'cash',
  'bargeld',
  'sonstiges',
]

/** countsAsFreeLiquidity-Default nach Typ (docs/data-model.md §3.3): giro/cash/bargeld → true. */
export function defaultCountsAsFreeLiquidity(type: AccountType): boolean {
  return type === 'giro' || type === 'cash' || type === 'bargeld'
}

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
  return slug === '' ? 'konto' : slug
}

/** "acc-" + kebab(name); bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model.md §2). */
export function generateAccountId(name: string, existingIds: ReadonlySet<string>): string {
  const base = `acc-${kebab(name)}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

/**
 * Alle IDs des Bestands (IDs sind dateiweit eindeutig, data-model.md §2).
 * Exportiert für die Wiederverwendung in src/data/positions.ts und
 * src/data/snapshot.ts (keine weitere Kopie).
 */
export function collectAllIds(data: FinanceData): Set<string> {
  const ids = new Set<string>()
  const collect = (items: ReadonlyArray<{ id: string }>): void => {
    items.forEach((item) => ids.add(item.id))
  }
  collect(data.accounts)
  collect(data.portfolioPositions)
  collect(data.snapshots)
  collect(data.savingsPlans)
  collect(data.targetProfiles)
  collect(data.goals)
  collect(data.transactions)
  collect(data.plannedChanges)
  collect(data.simulations)
  collect(data.importHistory)
  return ids
}

/** Ersetzt genau ein Konto (Top-Level-Shallow-Klon, Eingabe bleibt unverändert). */
function replaceAccount(data: FinanceData, index: number, account: Account): FinanceData {
  const accounts = data.accounts.slice()
  accounts[index] = account
  return { ...data, accounts }
}

function findAccountIndex(data: FinanceData, accountId: string): number {
  return data.accounts.findIndex((account) => account.id === accountId)
}

/**
 * Legt ein neues Konto an: isActive true, leere balanceHistory,
 * countsAsFreeLiquidity-Default nach Typ (giro/cash/bargeld → true).
 */
export function addAccount(data: FinanceData, input: AccountInput): AccountActionResult {
  const name = input.name.trim()
  if (name === '') {
    return { ok: false, error: 'Name: Der Name darf nicht leer sein.' }
  }
  if (!ADDABLE_ACCOUNT_TYPES.includes(input.type)) {
    return {
      ok: false,
      error: `Typ: Konten vom Typ "${input.type}" können nicht neu angelegt werden (nur Bestand). Wählbar sind: Girokonto, Tagesgeld, Depot, Verrechnungskonto, Bargeld, Sonstiges.`,
    }
  }
  const account: Account = {
    id: generateAccountId(name, collectAllIds(data)),
    name,
    institution: input.institution ?? null,
    type: input.type,
    purpose: input.purpose ?? null,
    countsAsFreeLiquidity: input.countsAsFreeLiquidity ?? defaultCountsAsFreeLiquidity(input.type),
    allowNegativeBalance: input.allowNegativeBalance ?? false,
    isActive: true,
    balanceHistory: [],
    note: input.note ?? null,
  }
  return { ok: true, data: { ...data, accounts: [...data.accounts, account] } }
}

/**
 * Aktualisiert Stammdaten eines Kontos. Der Typ ist NICHT änderbar
 * (verhindert Kennzahlen-Sprünge und C2-Konflikte); unbekannte Felder des
 * Kontos bleiben erhalten (Spread auf dem bestehenden Objekt, Regel 16).
 */
export function updateAccount(
  data: FinanceData,
  accountId: string,
  changes: Partial<AccountInput>,
): AccountActionResult {
  const index = findAccountIndex(data, accountId)
  if (index === -1) {
    return { ok: false, error: `Das Konto "${accountId}" existiert nicht.` }
  }
  const existing = data.accounts[index]
  if (changes.type !== undefined && changes.type !== existing.type) {
    return {
      ok: false,
      error: 'Typ: Der Typ eines bestehenden Kontos kann nicht geändert werden.',
    }
  }
  if (changes.name !== undefined && changes.name.trim() === '') {
    return { ok: false, error: 'Name: Der Name darf nicht leer sein.' }
  }
  const updated: Account = { ...existing }
  if (changes.name !== undefined) updated.name = changes.name.trim()
  if (changes.institution !== undefined) updated.institution = changes.institution
  if (changes.purpose !== undefined) updated.purpose = changes.purpose
  if (changes.note !== undefined) updated.note = changes.note
  if (changes.countsAsFreeLiquidity !== undefined) {
    updated.countsAsFreeLiquidity = changes.countsAsFreeLiquidity
  }
  if (changes.allowNegativeBalance !== undefined) {
    updated.allowNegativeBalance = changes.allowNegativeBalance
  }
  return { ok: true, data: replaceAccount(data, index, updated) }
}

/** Aktiviert/deaktiviert ein Konto (deaktiviert = zählt in keine Summe, bleibt gelistet). */
export function setAccountActive(
  data: FinanceData,
  accountId: string,
  isActive: boolean,
): AccountActionResult {
  const index = findAccountIndex(data, accountId)
  if (index === -1) {
    return { ok: false, error: `Das Konto "${accountId}" existiert nicht.` }
  }
  return { ok: true, data: replaceAccount(data, index, { ...data.accounts[index], isActive }) }
}

/**
 * Erfasst einen Saldo: an gesperrten Snapshot-Daten abgelehnt (DM21 über
 * checkHistoryEntryAllowed); existiert bereits ein Eintrag mit exakt diesem
 * (nicht gesperrten) Datum, wird er ERSETZT (verhindert DM23-Duplikat), sonst
 * angehängt. Die übrige Historie bleibt unangetastet (G3/G4).
 * Auch auf DEAKTIVIERTEN Konten zulässig (Werte pflegen bleibt möglich; die
 * Summenfilterung nach isActive erfolgt beim Aufrufer).
 */
export function setAccountBalance(
  data: FinanceData,
  accountId: string,
  amount: number,
  dateIso: string,
): AccountActionResult {
  const index = findAccountIndex(data, accountId)
  if (index === -1) {
    return { ok: false, error: `Das Konto "${accountId}" existiert nicht.` }
  }
  const account = data.accounts[index]
  // C2/DM19: depot- und pension-Konten führen keinen eigenen Wert.
  if (account.type === 'depot' || account.type === 'pension') {
    return {
      ok: false,
      error:
        account.type === 'depot'
          ? 'Konten vom Typ "depot" haben keinen eigenen Wert – der Depotwert ergibt sich ausschließlich aus den Depotpositionen (C2/DM19).'
          : 'Konten vom Typ "pension" sind Merkposten ohne Wert und führen keine Saldo-Historie (C2/DM19).',
    }
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { ok: false, error: 'Betrag: Der Betrag muss eine endliche Zahl sein.' }
  }
  if (amount < 0 && account.allowNegativeBalance !== true) {
    return {
      ok: false,
      error:
        'Betrag: Ein negativer Saldo ist bei diesem Konto nicht erlaubt. Erlaube ihn zuerst über „negativer Saldo erlaubt“ (DM20).',
    }
  }
  if (!isValidBusinessDate(dateIso)) {
    return {
      ok: false,
      error: `Datum: "${dateIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  // DM21: neue/geänderte Einträge an Daten gesperrter Snapshots sind unzulässig.
  const lockedIssue = checkHistoryEntryAllowed(data, dateIso)
  if (lockedIssue !== null) {
    return { ok: false, error: `Datum: ${lockedIssue.message}` }
  }
  const entryIndex = account.balanceHistory.findIndex((entry) => entry.date === dateIso)
  const balanceHistory = account.balanceHistory.slice()
  if (entryIndex === -1) {
    balanceHistory.push({ date: dateIso, amount })
  } else {
    // Ersetzen statt anhängen: je Historie ist jedes Datum nur einmal zulässig (DM23).
    balanceHistory[entryIndex] = { ...balanceHistory[entryIndex], amount }
  }
  return { ok: true, data: replaceAccount(data, index, { ...account, balanceHistory }) }
}
