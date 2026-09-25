/**
 * React-Kontext + State-/Action-Typen für den geladenen Finanzbestand
 * (Blueprint §5). Der Arbeitsspeicher hält genau einen Bestand; die
 * JSON-Datei ist die einzige dauerhafte Datenquelle (C1).
 */

import { createContext } from 'react'
import type { Dispatch } from 'react'
import type { FinanceData } from '../types/finance'
import type { ValidationIssue } from '../validation/issues'
import type { WritableHandle } from '../storage/fileAccess'
import type { ImportCandidate } from '../storage/importFlow'

export interface FinanceState {
  data: FinanceData | null
  fileName: string | null
  fileHandle: WritableHandle | null
  lastSavedAt: string | null
  isDirty: boolean
  /** Sperrt alle Aktionen, solange ein Speichervorgang läuft (Review-Befund 3.3, G10). */
  isSaving: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  operationError: string | null
  pendingImport: ImportCandidate | null
}

export type FinanceAction =
  | {
      type: 'LOAD_SUCCEEDED'
      data: FinanceData
      fileName: string
      handle: WritableHandle | null
      warnings: ValidationIssue[]
    }
  | { type: 'LOAD_FAILED'; errors: ValidationIssue[] }
  | { type: 'IMPORT_PROPOSED'; candidate: ImportCandidate }
  | { type: 'IMPORT_APPLIED'; data: FinanceData; fileName: string; warnings: ValidationIssue[] }
  /** Nur importHistory-Anhang im bestehenden Bestand; isDirty bleibt unverändert (Regel 17, DM5). */
  | { type: 'IMPORT_REJECTED_LOGGED'; data: FinanceData | null }
  | {
      type: 'SAVE_SUCCEEDED'
      data: FinanceData
      nowIso: string
      /** Nur bei "Speichern unter" (neues Handle) gesetzt. */
      fileName?: string
      handle?: WritableHandle
    }
  | { type: 'SAVE_FAILED'; message: string }
  /** Beginn eines Speichervorgangs: sperrt alle Aktionen (Review-Befund 3.3). */
  | { type: 'SAVE_STARTED' }
  /** Ende eines Speichervorgangs ohne Statuswechsel (z. B. Dialog-Abbruch). */
  | { type: 'SAVE_FINISHED' }
  /** Fehlgeschlagene Datei-Operation außerhalb des Speicherns (Öffnen/Import-Lesen; Review-Befund 3.1). */
  | { type: 'OPERATION_FAILED'; message: string }
  | { type: 'EXPORT_MARKED_SAVED'; data: FinanceData; nowIso: string }
  | { type: 'NEW_FILE'; data: FinanceData }
  | { type: 'MARK_DIRTY' }
  /** Fachliche Änderung über reine Datenfunktionen (z. B. Konten): neuer Bestand + isDirty. */
  | { type: 'DATA_CHANGED'; data: FinanceData }

export interface FinanceActions {
  openFile(): Promise<void>
  importFile(file: File): Promise<void>
  confirmImport(): void
  cancelImport(): void
  saveDirect(): Promise<void>
  /** "Speichern unter": öffnet IMMER den Dialog und ersetzt das gehaltene Handle. Nur bei Save-Picker-Unterstützung. */
  saveAs(): Promise<void>
  exportDownload(options?: { markAsSaved?: boolean }): void
  backupDownload(): void
  newFile(): void
  /** Schnittstelle für spätere Fachmodule. */
  markDirty(): void
  /** Übernimmt einen über reine Datenfunktionen geänderten Bestand (DATA_CHANGED, setzt isDirty). */
  applyDataChange(data: FinanceData): void
}

export interface FinanceDataContextValue {
  state: FinanceState
  dispatch: Dispatch<FinanceAction>
  actions: FinanceActions
  /**
   * Injizierter Stichtag (lokales Kalenderdatum JJJJ-MM-TT) aus der now-Prop
   * des Providers – Seiten nutzen IHN statt einer eigenen Systemuhr
   * (z. B. Aktivitätsfilter der Sparpläne im Dashboard).
   */
  todayIso: string
}

export const FinanceDataContext = createContext<FinanceDataContextValue | null>(null)
