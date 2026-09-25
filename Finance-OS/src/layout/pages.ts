/**
 * Seitenverzeichnis der App (V1, ohne Router-Paket):
 * Die Reihenfolge in PAGES ist die verbindliche Navigationsreihenfolge.
 * Seit dem Redesign (2026-09) gehört jede Seite zu einer thematischen Gruppe
 * der Seitenleiste; die Gruppen folgen der PAGES-Reihenfolge.
 * Reine Daten/Hilfsfunktionen – keine Komponenten (react-refresh-Regel).
 */

import type { IconName } from '../components/Icon'

export type PageId =
  | 'uebersicht'
  | 'konten'
  | 'depot'
  | 'sparplaene'
  | 'rebalancing'
  | 'ziele'
  | 'simulation'
  | 'einstellungen'
  | 'daten-backups'

export type PageGroupId = 'start' | 'vermoegen' | 'planung' | 'verwaltung'

export interface PageDefinition {
  readonly id: PageId
  readonly label: string
  readonly group: PageGroupId
  readonly icon: IconName
}

export const PAGE_GROUPS: readonly { readonly id: PageGroupId; readonly label: string }[] = [
  { id: 'start', label: 'Start' },
  { id: 'vermoegen', label: 'Vermögen' },
  { id: 'planung', label: 'Planung' },
  { id: 'verwaltung', label: 'Verwaltung' },
]

export const PAGES: readonly PageDefinition[] = [
  { id: 'uebersicht', label: 'Übersicht', group: 'start', icon: 'overview' },
  { id: 'konten', label: 'Konten', group: 'vermoegen', icon: 'accounts' },
  { id: 'depot', label: 'Depot', group: 'vermoegen', icon: 'depot' },
  { id: 'sparplaene', label: 'Sparpläne', group: 'vermoegen', icon: 'savings' },
  { id: 'rebalancing', label: 'Rebalancing', group: 'planung', icon: 'rebalancing' },
  { id: 'ziele', label: 'Ziele', group: 'planung', icon: 'goals' },
  { id: 'simulation', label: 'Simulation', group: 'planung', icon: 'simulation' },
  { id: 'einstellungen', label: 'Einstellungen', group: 'verwaltung', icon: 'settings' },
  { id: 'daten-backups', label: 'Daten & Backups', group: 'verwaltung', icon: 'data' },
]

export const DEFAULT_PAGE: PageId = 'uebersicht'
