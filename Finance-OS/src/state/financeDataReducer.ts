/**
 * Reiner, unabhängig testbarer Reducer (Blueprint §5).
 * G10: Fehlgeschlagene Lade-/Import-/Speichervorgänge lassen den Bestand unverändert.
 */

import type { FinanceAction, FinanceState } from './financeDataContext'

export const initialFinanceState: FinanceState = {
  data: null,
  fileName: null,
  fileHandle: null,
  lastSavedAt: null,
  isDirty: false,
  isSaving: false,
  errors: [],
  warnings: [],
  operationError: null,
  pendingImport: null,
}

export function financeDataReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD_SUCCEEDED':
      // isDirty=false, lastSavedAt=null – die UI zeigt ersatzweise metadata.updatedAt als "Stand der Datei".
      return {
        ...state,
        data: action.data,
        fileName: action.fileName,
        fileHandle: action.handle,
        lastSavedAt: null,
        isDirty: false,
        errors: [],
        warnings: action.warnings,
        operationError: null,
        pendingImport: null,
      }
    case 'LOAD_FAILED':
      // Bestand bleibt vollständig erhalten (G10).
      return { ...state, errors: action.errors, operationError: null }
    case 'IMPORT_PROPOSED':
      return { ...state, pendingImport: action.candidate, operationError: null }
    case 'IMPORT_APPLIED':
      // Atomare Übernahme; Import löst das Handle (Blueprint §7.12).
      return {
        ...state,
        data: action.data,
        fileName: action.fileName,
        fileHandle: null,
        lastSavedAt: null,
        isDirty: true,
        errors: [],
        warnings: action.warnings,
        operationError: null,
        pendingImport: null,
      }
    case 'IMPORT_REJECTED_LOGGED':
      // Nur importHistory-Anhang; isDirty bleibt unverändert (Regel 17, DM5).
      return { ...state, data: action.data ?? state.data, pendingImport: null }
    case 'SAVE_SUCCEEDED':
      return {
        ...state,
        data: action.data,
        lastSavedAt: action.nowIso,
        isDirty: false,
        isSaving: false,
        operationError: null,
        fileName: action.fileName ?? state.fileName,
        fileHandle: action.handle ?? state.fileHandle,
      }
    case 'SAVE_FAILED':
      // Schreibfehler: State bleibt, nur Meldung (Blueprint §4 saveDirect-Ablauf).
      return { ...state, operationError: action.message, isSaving: false }
    case 'SAVE_STARTED':
      // Sperrt alle Aktionen während des asynchronen Schreibens (Review-Befund 3.3).
      return { ...state, isSaving: true, operationError: null }
    case 'SAVE_FINISHED':
      // Speichervorgang ohne Statuswechsel beendet (z. B. Dialog-Abbruch).
      return { ...state, isSaving: false }
    case 'OPERATION_FAILED':
      // Öffnen/Import-Lesen fehlgeschlagen: Bestand bleibt vollständig erhalten (G10).
      return { ...state, operationError: action.message, isSaving: false }
    case 'EXPORT_MARKED_SAVED':
      return {
        ...state,
        data: action.data,
        lastSavedAt: action.nowIso,
        isDirty: false,
        isSaving: false,
        operationError: null,
      }
    case 'NEW_FILE':
      return {
        ...state,
        data: action.data,
        fileName: null,
        fileHandle: null,
        lastSavedAt: null,
        isDirty: true,
        errors: [],
        warnings: [],
        operationError: null,
        pendingImport: null,
      }
    case 'MARK_DIRTY':
      return state.isDirty ? state : { ...state, isDirty: true }
    case 'DATA_CHANGED':
      // Jede fachliche Änderung setzt den Status „ungespeichert“ (M6).
      return { ...state, data: action.data, isDirty: true, operationError: null }
  }
}
