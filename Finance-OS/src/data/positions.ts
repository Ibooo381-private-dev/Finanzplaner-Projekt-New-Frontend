/**
 * Reine Datenfunktionen für das Modul „Depot“ (M9) – ohne React, unabhängig
 * testbar (Muster src/data/accounts.ts). Alle Funktionen sind pur, mutieren
 * nie die Eingabe (Top-Level-Shallow-Klon-Kette) und geben entweder neues
 * FinanceData oder ein Fehlerobjekt mit deutscher, feldbezogener Meldung zurück.
 *
 * Verbindliche Regeln:
 * 1. Kein Löschen von Positionen in V1 – nur Deaktivieren/Reaktivieren
 *    (stabile Referenzen savingsPlans.targetId / weights.ref /
 *    transactions.targetId).
 * 2. Die Gruppe (group) ist nach Anlage NICHT änderbar: Zielprofile und
 *    Kennzahlen referenzieren Gruppen (weights.ref, F7/groupTotal) – ein
 *    Gruppenwechsel würde Gewichts-/Profilreferenzen stillschweigend
 *    verschieben.
 * 3. Inaktive Positionen fließen in keine aktive Summe ein; die Filterung
 *    übernimmt der Aufrufer über isPositionActive (nicht die Datenfunktion).
 * 4. Sperrregel DM21 (G3/G4): Werte an Daten gesperrter Snapshots werden über
 *    checkHistoryEntryAllowed abgelehnt.
 */

import type { AssetClass, FinanceData, PortfolioPosition, PositionGroup } from '../types/finance'
import { collectAllIds } from './accounts'
import { checkHistoryEntryAllowed } from '../validation/lockedDates'
import { isValidBusinessDate } from '../validation/validateFinanceData'

export interface PositionInput {
  name: string
  group: PositionGroup
  accountId: string
  assetClass?: AssetClass | null
  isin?: string | null
  note?: string | null
}

export type PositionActionResult = { ok: true; data: FinanceData } | { ok: false; error: string }

/** Die vier zulässigen Gruppen (docs/data-model.md §3.4; bewusst keine Gruppe „Sonstige“). */
export const POSITION_GROUPS: readonly PositionGroup[] = ['world', 'em', 'gold', 'telekom']

/** isActive-Default true: nur ein explizites false deaktiviert (Muster accounts). */
export function isPositionActive(position: PortfolioPosition): boolean {
  return position.isActive !== false
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
  return slug === '' ? 'position' : slug
}

/** "pos-" + kebab(name); bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model.md §2). */
export function generatePositionId(name: string, existingIds: ReadonlySet<string>): string {
  const base = `pos-${kebab(name)}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

/** ISIN-Eingabe normalisieren: trimmen; leer → null (nichts erfinden). */
function normalizeIsin(isin: string | null | undefined): string | null {
  if (isin == null) return null
  const trimmed = isin.trim()
  return trimmed === '' ? null : trimmed
}

/** Ersetzt genau eine Position (Top-Level-Shallow-Klon, Eingabe bleibt unverändert). */
function replacePosition(
  data: FinanceData,
  index: number,
  position: PortfolioPosition,
): FinanceData {
  const portfolioPositions = data.portfolioPositions.slice()
  portfolioPositions[index] = position
  return { ...data, portfolioPositions }
}

function findPositionIndex(data: FinanceData, positionId: string): number {
  return data.portfolioPositions.findIndex((position) => position.id === positionId)
}

/**
 * Prüft das Zielkonto einer Position: es muss existieren und den Typ "depot"
 * haben. Die Aktivität des Kontos wird hier bewusst NICHT geprüft – beim
 * Anlegen ist ein inaktives Depot-Konto zulässig (die UI warnt sichtbar).
 */
function checkDepotAccount(data: FinanceData, accountId: string): string | null {
  const account = data.accounts.find((entry) => entry.id === accountId)
  if (!account) {
    return `Depotkonto: Das Konto "${accountId}" existiert nicht.`
  }
  if (account.type !== 'depot') {
    return `Depotkonto: Das Konto "${account.name}" ist kein Depot-Konto (Ist-Typ: "${account.type}"). Positionen können nur zu Depot-Konten gehören (B1).`
  }
  return null
}

/**
 * Legt eine neue Depotposition an: isActive true, leere valueHistory
 * (Wert unbekannt, nie 0 – G11). Die Gruppe muss eine der vier bestehenden
 * Gruppen sein (keine Gruppe „Sonstige“, dokumentierter Restpunkt).
 */
export function addPosition(data: FinanceData, input: PositionInput): PositionActionResult {
  const name = input.name.trim()
  if (name === '') {
    return { ok: false, error: 'Name: Der Name darf nicht leer sein.' }
  }
  if (!POSITION_GROUPS.includes(input.group)) {
    return {
      ok: false,
      error: `Gruppe: "${String(input.group)}" ist keine gültige Gruppe. Wählbar sind: World, Emerging Markets, Gold, Telekom.`,
    }
  }
  const accountError = checkDepotAccount(data, input.accountId)
  if (accountError !== null) {
    return { ok: false, error: accountError }
  }
  const position: PortfolioPosition = {
    id: generatePositionId(name, collectAllIds(data)),
    name,
    isin: normalizeIsin(input.isin),
    accountId: input.accountId,
    group: input.group,
    isActive: true,
    valueHistory: [],
    note: input.note ?? null,
  }
  // assetClass ist optional ohne null-Wert (§3.4): nur schreiben, wenn gewählt.
  if (input.assetClass != null) {
    position.assetClass = input.assetClass
  }
  return {
    ok: true,
    data: { ...data, portfolioPositions: [...data.portfolioPositions, position] },
  }
}

/**
 * Aktualisiert Stammdaten einer Position. Die Gruppe ist NICHT änderbar
 * (Zielprofil-/Gewichtsreferenzen und Gruppensummen blieben sonst nicht
 * nachvollziehbar); das Depotkonto ist änderbar (Konto-Umzug), aber nur auf
 * ein existierendes AKTIVES Depot-Konto. Unbekannte Felder der Position
 * bleiben erhalten (Spread auf dem bestehenden Objekt, Regel 16).
 */
export function updatePosition(
  data: FinanceData,
  positionId: string,
  changes: Partial<PositionInput>,
): PositionActionResult {
  const index = findPositionIndex(data, positionId)
  if (index === -1) {
    return { ok: false, error: `Die Depotposition "${positionId}" existiert nicht.` }
  }
  const existing = data.portfolioPositions[index]
  if (changes.group !== undefined && changes.group !== existing.group) {
    return {
      ok: false,
      error:
        'Gruppe: Die Gruppe einer bestehenden Position kann nicht geändert werden – Zielprofile und Kennzahlen (z. B. „MSCI World gesamt“) referenzieren Gruppen; ein Wechsel würde diese Referenzen stillschweigend verschieben. Lege bei Bedarf eine neue Position an und deaktiviere die alte.',
    }
  }
  if (changes.name !== undefined && changes.name.trim() === '') {
    return { ok: false, error: 'Name: Der Name darf nicht leer sein.' }
  }
  if (changes.accountId !== undefined && changes.accountId !== existing.accountId) {
    const accountError = checkDepotAccount(data, changes.accountId)
    if (accountError !== null) {
      return { ok: false, error: accountError }
    }
    const target = data.accounts.find((entry) => entry.id === changes.accountId)
    if (target && target.isActive === false) {
      return {
        ok: false,
        error: `Depotkonto: Das Konto "${target.name}" ist deaktiviert. Ein Konto-Umzug ist nur auf ein aktives Depot-Konto möglich – aktiviere das Konto zuerst.`,
      }
    }
  }
  const updated: PortfolioPosition = { ...existing }
  if (changes.name !== undefined) updated.name = changes.name.trim()
  if (changes.accountId !== undefined) updated.accountId = changes.accountId
  if (changes.isin !== undefined) updated.isin = normalizeIsin(changes.isin)
  if (changes.note !== undefined) updated.note = changes.note
  if (changes.assetClass !== undefined) {
    if (changes.assetClass === null) {
      // Abwahl: Feld entfernen statt null zu schreiben (§3.4: optional ohne null).
      delete updated.assetClass
    } else {
      updated.assetClass = changes.assetClass
    }
  }
  return { ok: true, data: replacePosition(data, index, updated) }
}

/**
 * Aktiviert/deaktiviert eine Position (deaktiviert = zählt in keine aktive
 * Summe, bleibt gelistet; valueHistory bleibt erhalten und pflegbar).
 */
export function setPositionActive(
  data: FinanceData,
  positionId: string,
  isActive: boolean,
): PositionActionResult {
  const index = findPositionIndex(data, positionId)
  if (index === -1) {
    return { ok: false, error: `Die Depotposition "${positionId}" existiert nicht.` }
  }
  return {
    ok: true,
    data: replacePosition(data, index, { ...data.portfolioPositions[index], isActive }),
  }
}

/**
 * Erfasst einen Positionswert: endlich und >= 0 (valueHistory kennt kein
 * Negativ); an gesperrten Snapshot-Daten abgelehnt (DM21 über
 * checkHistoryEntryAllowed); existiert bereits ein Eintrag mit exakt diesem
 * (nicht gesperrten) Datum, wird er ERSETZT (verhindert DM23-Duplikat), sonst
 * angehängt. Auch auf INAKTIVEN Positionen zulässig (Historienpflege bleibt
 * möglich; die Summenfilterung nach isActive erfolgt beim Aufrufer).
 */
export function setPositionValue(
  data: FinanceData,
  positionId: string,
  value: number,
  dateIso: string,
): PositionActionResult {
  const index = findPositionIndex(data, positionId)
  if (index === -1) {
    return { ok: false, error: `Die Depotposition "${positionId}" existiert nicht.` }
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: 'Betrag: Der Wert muss eine endliche Zahl sein.' }
  }
  if (value < 0) {
    return {
      ok: false,
      error: 'Betrag: Der Positionswert darf nicht negativ sein (DM20).',
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
  const position = data.portfolioPositions[index]
  const entryIndex = position.valueHistory.findIndex((entry) => entry.date === dateIso)
  const valueHistory = position.valueHistory.slice()
  if (entryIndex === -1) {
    valueHistory.push({ date: dateIso, value })
  } else {
    // Ersetzen statt anhängen: je Historie ist jedes Datum nur einmal zulässig (DM23).
    valueHistory[entryIndex] = { ...valueHistory[entryIndex], value }
  }
  return { ok: true, data: replacePosition(data, index, { ...position, valueHistory }) }
}
