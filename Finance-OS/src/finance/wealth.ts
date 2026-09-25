/**
 * Vermögenskennzahlen (Formelkatalog F1–F7, finance-rules S1):
 * Gesamtvermögen = Tagesgeld + Depot; Tagesgeld geht NIE in den Depotnenner ein.
 * Leere Historien bedeuten „unbekannt“, nie 0 (G11) – betroffene IDs werden
 * ausgewiesen. Division durch 0 liefert null („nicht berechenbar“), nie NaN/Infinity.
 * Reine Funktionen; Eingaben werden nicht mutiert.
 */

import type { Account, AccountType, PortfolioPosition, PositionGroup } from '../types/finance'
import { assertFinite } from './rounding'

/** Jüngster Eintrag einer Historie (nach ISO-Datum); null bei leerer Historie. */
export function latestEntry<T extends { date: string }>(history: readonly T[]): T | null {
  if (history.length === 0) return null
  return history.reduce((latest, entry) => (entry.date > latest.date ? entry : latest))
}

export interface AggregatedAmount {
  /** Summe der aktuellen Werte (nur Einträge mit erfasstem Wert). */
  amount: number
  /** IDs ohne erfassten Wert (leere Historie) – unbekannt, zählt nicht als 0 (G11). */
  missingIds: string[]
}

/** F2-Vorstufe für Konten: aktueller Saldo = jüngster balanceHistory-Eintrag. */
function aggregateAccounts(accounts: readonly Account[]): AggregatedAmount {
  const missingIds: string[] = []
  let amount = 0
  for (const account of accounts) {
    const entry = latestEntry(account.balanceHistory)
    if (entry === null) {
      missingIds.push(account.id)
    } else {
      assertFinite(entry.amount, `accounts[${account.id}].amount`)
      amount += entry.amount
    }
  }
  return { amount, missingIds }
}

/** Tagesgeldwert: Σ aktueller Salden aller Konten mit type "tagesgeld" (F1-Eingabe). */
export function cashValue(accounts: readonly Account[]): AggregatedAmount {
  return aggregateAccounts(accounts.filter((account) => account.type === 'tagesgeld'))
}

/**
 * data-model-§4-Baustein (Modul Übersicht M7): Summe der aktuellen Salden aller
 * Konten, deren Typ in der übergebenen Typenliste liegt. Der Aufrufer filtert
 * vorab auf aktive Konten (inaktive fließen in keine aktive Summe ein).
 * Dashboard-Verwendung: „sonstiges aktives Kontovermögen“ über
 * giro/cash/ruecklage/bargeld/sonstiges/krypto – pension NIE (Merkposten ohne
 * Wert, zählt in keine Wertkennzahl). Leere Historien → missingIds (G11).
 */
export function accountsValue(
  accounts: readonly Account[],
  types: readonly AccountType[],
): AggregatedAmount {
  return aggregateAccounts(accounts.filter((account) => types.includes(account.type)))
}

function aggregatePositions(positions: readonly PortfolioPosition[]): AggregatedAmount {
  const missingIds: string[] = []
  let amount = 0
  for (const position of positions) {
    const entry = latestEntry(position.valueHistory)
    if (entry === null) {
      missingIds.push(position.id)
    } else {
      assertFinite(entry.value, `positions[${position.id}].value`)
      amount += entry.value
    }
  }
  return { amount, missingIds }
}

/** F2 – Depotwert: Σ aktueller Werte aller Depotpositionen (nie Tagesgeld, nie TR-Cash). */
export function depotValue(positions: readonly PortfolioPosition[]): AggregatedAmount {
  return aggregatePositions(positions)
}

/**
 * F7-Verallgemeinerung: Summe der Positionen einer Gruppe. Der Aufrufer filtert
 * vorab auf aktive Positionen (inaktive fließen in keine aktive Summe ein);
 * worldTotal delegiert an groupTotal('world').
 */
export function groupTotal(
  positions: readonly PortfolioPosition[],
  group: PositionGroup,
): AggregatedAmount {
  return aggregatePositions(positions.filter((position) => position.group === group))
}

/** F7 – „MSCI World gesamt“: Σ der Positionen mit group "world" (immer berechnet, nie gespeichert). */
export function worldTotal(positions: readonly PortfolioPosition[]): AggregatedAmount {
  return groupTotal(positions, 'world')
}

/** F1 – Gesamtvermögen = Tagesgeld + Depot (S1). */
export function totalWealth(cash: number, depot: number): number {
  assertFinite(cash, 'cash')
  assertFinite(depot, 'depot')
  return cash + depot
}

/**
 * Anteil part/whole als Dezimalzahl (F3–F6). whole ≤ 0 → null („nicht berechenbar“,
 * F20) – nie NaN oder Infinity. part = 0 ist gültig (Anteil 0).
 */
export function share(part: number, whole: number): number | null {
  assertFinite(part, 'part')
  assertFinite(whole, 'whole')
  if (whole <= 0) return null
  return part / whole
}

/** F3 – Tagesgeldanteil am Gesamtvermögen. */
export function cashShareOfTotal(cash: number, total: number): number | null {
  return share(cash, total)
}

/** F4 – Depotanteil am Gesamtvermögen. */
export function depotShareOfTotal(depot: number, total: number): number | null {
  return share(depot, total)
}

/** F5 – Positionsanteil am Depot (Nenner = Depotwert; Tagesgeld NIE im Nenner, S1/S2). */
export function positionShareOfDepot(positionValue: number, depot: number): number | null {
  return share(positionValue, depot)
}

/** F6 – Positionsanteil am Gesamtvermögen (Zusatzinfo; Rebalancing rechnet immer über F5). */
export function positionShareOfTotal(positionValue: number, total: number): number | null {
  return share(positionValue, total)
}
