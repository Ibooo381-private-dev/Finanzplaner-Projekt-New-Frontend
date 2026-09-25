/**
 * Seitenverzeichnis der App (V1, ohne Router-Paket):
 * Die Reihenfolge in PAGES ist die verbindliche Navigationsreihenfolge.
 * Reine Daten/Hilfsfunktionen – keine Komponenten (react-refresh-Regel).
 */

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

export interface PageDefinition {
  readonly id: PageId
  readonly label: string
}

export const PAGES: readonly PageDefinition[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'konten', label: 'Konten' },
  { id: 'depot', label: 'Depot' },
  { id: 'sparplaene', label: 'Sparpläne' },
  { id: 'rebalancing', label: 'Rebalancing' },
  { id: 'ziele', label: 'Ziele' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'einstellungen', label: 'Einstellungen' },
  { id: 'daten-backups', label: 'Daten & Backups' },
]

export const DEFAULT_PAGE: PageId = 'uebersicht'
