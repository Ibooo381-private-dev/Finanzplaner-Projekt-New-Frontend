/**
 * Provider: Reducer + Storage-Funktionen + beforeunload-Effekt (Blueprint §5).
 *
 * Zeit wird injiziert: Alle Zeitwerte kommen aus der now-Prop; der
 * new-Date-Default ist die einzige zulässige Ausnahme (Blueprint §7.7).
 * Keine Netzwerkzugriffe, kein Autosave. localStorage wird ausschließlich
 * für den Auto-Backup-Tagesmerker genutzt (unkritische Gerätemarke,
 * Allowlist in localStoragePolicy.ts – nie Finanzdaten, M14/A5).
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { FinanceData, ImportOutcome } from '../types/finance'
import { parseFinanceJson } from '../validation/parseFinanceJson'
import { isFileSystemAccessSupported, isSaveFilePickerSupported } from '../storage/featureDetection'
import {
  openViaFilePicker,
  readFileAsText,
  saveAsNewFile,
  saveToHandle,
  downloadAsFile,
} from '../storage/fileAccess'
import type { OpenedFile } from '../storage/fileAccess'
import { serializeFinanceData, withUpdatedTimestamp } from '../storage/serializer'
import { backupFileName, exportFileName } from '../storage/fileNames'
import { createEmptyFinanceData } from '../storage/emptyFile'
import {
  readLastAutoBackupDay,
  shouldAutoBackup,
  writeLastAutoBackupDay,
} from '../storage/autoBackup'
import {
  appendImportHistory,
  createImportHistoryEntry,
  importFromFile,
} from '../storage/importFlow'
import { FinanceDataContext } from './financeDataContext'
import type { FinanceActions, FinanceDataContextValue } from './financeDataContext'
import { financeDataReducer, initialFinanceState } from './financeDataReducer'

const CONFIRM_DISCARD_UNSAVED =
  'Es gibt ungespeicherte Änderungen, die dabei verloren gehen. Möchtest du trotzdem fortfahren?'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Lokales Kalenderdatum (JJJJ-MM-TT) als Referenz für die Zukunftsprüfung. */
function toLocalIsoDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Sammelt alle IDs des Bestands (dateiweite Eindeutigkeit neuer Protokoll-IDs). */
function collectAllIds(data: FinanceData): Set<string> {
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

/** input[type=file]-Fallback für Browser ohne File System Access API. */
function openViaInputElement(): Promise<OpenedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files && input.files[0] ? input.files[0] : null
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      // Lesefehler an den Aufrufer durchreichen (Review-Befund 3.1) – nie still hängen bleiben.
      readFileAsText(file).then(resolve, reject)
    })
    input.addEventListener('cancel', () => {
      input.remove()
      resolve(null)
    })
    document.body.append(input)
    input.click()
  })
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function FinanceDataProvider({ children, now }: { children: ReactNode; now?: () => Date }) {
  const [state, dispatch] = useReducer(financeDataReducer, initialFinanceState)

  const getNow = useCallback((): Date => (now ? now() : new Date()), [now])

  const actions = useMemo<FinanceActions>(() => {
    /**
     * Auto-Backup NACH erfolgreichem Speichern (M14/M5, Auflagen A2–A5):
     * - A2: lädt EXAKT den bereits geschriebenen json-String herunter
     *   (Byte-identische Sicherung aus dem next-Bestand mit aktualisiertem
     *   Timestamp) – NIE actions.backupDownload (das läse den alten State).
     * - A3: läuft erst NACH dem SAVE_SUCCEEDED-Dispatch in try/catch – ein
     *   Backup-Fehler erzeugt nur einen zusätzlichen Hinweis und lässt das
     *   Speichern nie rückwirkend scheitern.
     * - A4: wird ausschließlich in den SAVE_SUCCEEDED-Pfaden aufgerufen –
     *   kein Backup beim Download-Fallback (EXPORT_MARKED_SAVED), bei
     *   Abbruch (SAVE_FINISHED) oder Fehler (SAVE_FAILED).
     * - A5: Tagesmerker (Gerätemarke, localStorage) wird nach jedem
     *   erfolgten Auto-Backup gesetzt; fehlender backup.mode wirkt als
     *   'everySave' (KORREKTUR Nr. 3 – shouldAutoBackup(undefined) → true).
     */
    const runAutoBackupAfterSave = (next: FinanceData, json: string, nowDate: Date): void => {
      try {
        const today = toLocalIsoDay(nowDate)
        if (!shouldAutoBackup(next.settings.backup?.mode, readLastAutoBackupDay(), today)) return
        downloadAsFile(backupFileName(nowDate), json)
        writeLastAutoBackupDay(today)
      } catch (err) {
        dispatch({
          type: 'OPERATION_FAILED',
          message: `Die automatische Sicherung konnte nicht erstellt werden (${toErrorMessage(err)}). Das Speichern selbst war erfolgreich; erstelle bei Bedarf unter „Daten & Backups“ manuell eine Sicherungskopie.`,
        })
      }
    }

    const openFile = async (): Promise<void> => {
      if (state.isSaving) return
      // G12: kritische Aktion bei ungespeicherten Änderungen bestätigen lassen.
      if (state.isDirty && !window.confirm(CONFIRM_DISCARD_UNSAVED)) return
      // Review-Befund 3.1: Datei-/Lesefehler abfangen und melden – der Bestand bleibt unverändert.
      let opened: OpenedFile | null
      try {
        opened = isFileSystemAccessSupported()
          ? await openViaFilePicker()
          : await openViaInputElement()
      } catch (err) {
        dispatch({
          type: 'OPERATION_FAILED',
          message: `Die Datei konnte nicht geöffnet werden (${toErrorMessage(err)}). Der aktuell geladene Bestand bleibt unverändert.`,
        })
        return
      }
      if (!opened) return
      const result = parseFinanceJson(opened.text, { todayIso: toLocalIsoDay(getNow()) })
      if (result.ok && result.data) {
        dispatch({
          type: 'LOAD_SUCCEEDED',
          data: result.data,
          fileName: opened.fileName,
          handle: opened.handle,
          warnings: result.warnings,
        })
      } else {
        dispatch({ type: 'LOAD_FAILED', errors: result.errors })
      }
    }

    const importFile = async (file: File): Promise<void> => {
      if (state.isSaving) return
      // Review-Befund 3.1: Lesefehler der Importdatei abfangen und melden.
      try {
        const candidate = await importFromFile(file, toLocalIsoDay(getNow()))
        dispatch({ type: 'IMPORT_PROPOSED', candidate })
      } catch (err) {
        dispatch({
          type: 'OPERATION_FAILED',
          message: `Die Importdatei konnte nicht gelesen werden (${toErrorMessage(err)}). Der aktuell geladene Bestand bleibt unverändert.`,
        })
      }
    }

    const confirmImport = (): void => {
      if (state.isSaving) return
      const candidate = state.pendingImport
      if (!candidate || !candidate.result.ok || !candidate.result.data) return
      const nowIso = getNow().toISOString()
      const entry = createImportHistoryEntry({
        action: 'import',
        fileName: candidate.fileName,
        fileSchemaVersion: candidate.summary ? candidate.summary.schemaVersion : null,
        outcome: 'applied',
        nowIso,
        existingIds: collectAllIds(candidate.result.data),
      })
      // Der applied-Eintrag kommt in die NEUE importHistory (Blueprint §5).
      const nextData = appendImportHistory(candidate.result.data, entry)
      dispatch({
        type: 'IMPORT_APPLIED',
        data: nextData,
        fileName: candidate.fileName,
        warnings: candidate.result.warnings,
      })
    }

    const cancelImport = (): void => {
      if (state.isSaving) return
      const candidate = state.pendingImport
      if (!candidate) return
      const outcome: ImportOutcome = candidate.result.ok ? 'cancelled' : 'rejected'
      if (state.data) {
        // Einzige zulässige Änderung am Bestand: der Protokolleintrag – ohne isDirty (Regel 17, DM5).
        const nowIso = getNow().toISOString()
        const entry = createImportHistoryEntry({
          action: 'import',
          fileName: candidate.fileName,
          fileSchemaVersion: candidate.summary ? candidate.summary.schemaVersion : null,
          outcome,
          note:
            outcome === 'rejected'
              ? `Import abgelehnt: ${candidate.result.errors.length} Validierungsfehler.`
              : 'Import in der Vorschau abgebrochen.',
          nowIso,
          existingIds: collectAllIds(state.data),
        })
        dispatch({ type: 'IMPORT_REJECTED_LOGGED', data: appendImportHistory(state.data, entry) })
      } else {
        dispatch({ type: 'IMPORT_REJECTED_LOGGED', data: null })
      }
    }

    const saveDirect = async (): Promise<void> => {
      const data = state.data
      if (!data || state.isSaving) return
      // Review-Befund 3.3: Aktionen sind während des Schreibens gesperrt (isSaving).
      dispatch({ type: 'SAVE_STARTED' })
      const nowDate = getNow()
      const nowIso = nowDate.toISOString()
      // Verbindlicher Ablauf: withUpdatedTimestamp → serialisieren → Selbstprüfung → schreiben.
      const next = withUpdatedTimestamp(data, nowIso)
      const json = serializeFinanceData(next)
      const selfCheck = parseFinanceJson(json)
      if (!selfCheck.ok) {
        dispatch({
          type: 'SAVE_FAILED',
          message:
            'Die Selbstprüfung vor dem Speichern ist fehlgeschlagen – es wurde nichts geschrieben und der Bestand ist unverändert. Bitte exportiere den Bestand als Download und melde den Fehler.',
        })
        return
      }
      if (state.fileHandle) {
        try {
          await saveToHandle(state.fileHandle, json)
        } catch (err) {
          dispatch({
            type: 'SAVE_FAILED',
            message: `Die Datei konnte nicht geschrieben werden (${toErrorMessage(err)}). Der Bestand im Arbeitsspeicher bleibt vollständig erhalten. Nutze als Ausweg "Exportieren (Download)".`,
          })
          return
        }
        dispatch({ type: 'SAVE_SUCCEEDED', data: next, nowIso })
        runAutoBackupAfterSave(next, json, nowDate)
        return
      }
      // Korrekter Feature-Check für den SPEICHERPFAD: showSaveFilePicker, nicht showOpenFilePicker.
      if (isSaveFilePickerSupported()) {
        // Review-Befund 3.1: auch "Speichern unter"-Fehler melden.
        let saved: Awaited<ReturnType<typeof saveAsNewFile>>
        try {
          saved = await saveAsNewFile('finance-data.json', json)
        } catch (err) {
          dispatch({
            type: 'SAVE_FAILED',
            message: `Die Datei konnte nicht geschrieben werden (${toErrorMessage(err)}). Der Bestand im Arbeitsspeicher bleibt vollständig erhalten. Nutze als Ausweg "Exportieren (Download)".`,
          })
          return
        }
        if (!saved) {
          // Abbruch im Dialog: kein Statuswechsel, aber Sperre aufheben.
          dispatch({ type: 'SAVE_FINISHED' })
          return
        }
        dispatch({
          type: 'SAVE_SUCCEEDED',
          data: next,
          nowIso,
          fileName: saved.fileName,
          handle: saved.handle,
        })
        runAutoBackupAfterSave(next, json, nowDate)
        return
      }
      // Kein direktes Speichern möglich: Hinweis + Export mit "als gespeichert markieren"
      // (Blueprint §5). BEWUSST ohne Auto-Backup (A4): der Export IST bereits
      // die datierte Kopie – ein zweiter Download wäre eine Doppel-Sicherung.
      const proceed = window.confirm(
        'Direktes Speichern in eine Datei wird von diesem Browser nicht unterstützt. Stattdessen wird die Datei als Download exportiert und als gespeichert markiert. Fortfahren?',
      )
      if (!proceed) {
        dispatch({ type: 'SAVE_FINISHED' })
        return
      }
      downloadAsFile(exportFileName(nowDate), json)
      dispatch({ type: 'EXPORT_MARKED_SAVED', data: next, nowIso })
    }

    /** "Speichern unter": öffnet IMMER den Dialog und ersetzt das gehaltene Handle (Erwartung 3). */
    const saveAs = async (): Promise<void> => {
      const data = state.data
      if (!data || state.isSaving) return
      if (!isSaveFilePickerSupported()) return
      dispatch({ type: 'SAVE_STARTED' })
      const nowDate = getNow()
      const nowIso = nowDate.toISOString()
      const next = withUpdatedTimestamp(data, nowIso)
      const json = serializeFinanceData(next)
      const selfCheck = parseFinanceJson(json)
      if (!selfCheck.ok) {
        dispatch({
          type: 'SAVE_FAILED',
          message:
            'Die Selbstprüfung vor dem Speichern ist fehlgeschlagen – es wurde nichts geschrieben und der Bestand ist unverändert. Bitte exportiere den Bestand als Download und melde den Fehler.',
        })
        return
      }
      let saved: Awaited<ReturnType<typeof saveAsNewFile>>
      try {
        saved = await saveAsNewFile(state.fileName ?? 'finance-data.json', json)
      } catch (err) {
        dispatch({
          type: 'SAVE_FAILED',
          message: `Die Datei konnte nicht geschrieben werden (${toErrorMessage(err)}). Der Bestand im Arbeitsspeicher bleibt vollständig erhalten. Nutze als Ausweg "Exportieren (Download)".`,
        })
        return
      }
      if (!saved) {
        // Abbruch im Dialog: kein Statuswechsel, aber Sperre aufheben.
        dispatch({ type: 'SAVE_FINISHED' })
        return
      }
      dispatch({
        type: 'SAVE_SUCCEEDED',
        data: next,
        nowIso,
        fileName: saved.fileName,
        handle: saved.handle,
      })
      runAutoBackupAfterSave(next, json, nowDate)
    }

    const exportDownload = (options?: { markAsSaved?: boolean }): void => {
      const data = state.data
      if (!data || state.isSaving) return
      const nowDate = getNow()
      const fileName = exportFileName(nowDate)
      if (options?.markAsSaved) {
        const nowIso = nowDate.toISOString()
        const next = withUpdatedTimestamp(data, nowIso)
        downloadAsFile(fileName, serializeFinanceData(next))
        dispatch({ type: 'EXPORT_MARKED_SAVED', data: next, nowIso })
        return
      }
      // Reiner Export: unverändert serialisieren, kein Statuswechsel.
      downloadAsFile(fileName, serializeFinanceData(data))
    }

    const backupDownload = (): void => {
      const data = state.data
      if (!data || state.isSaving) return
      // Sicherungskopie: unverändert serialisieren, kein Statuswechsel.
      downloadAsFile(backupFileName(getNow()), serializeFinanceData(data))
    }

    const newFile = (): void => {
      if (state.isSaving) return
      if (state.isDirty && !window.confirm(CONFIRM_DISCARD_UNSAVED)) return
      dispatch({ type: 'NEW_FILE', data: createEmptyFinanceData(getNow().toISOString()) })
    }

    const markDirty = (): void => {
      dispatch({ type: 'MARK_DIRTY' })
    }

    /** Dünne Übernahme eines über reine Datenfunktionen geänderten Bestands (setzt isDirty). */
    const applyDataChange = (data: FinanceData): void => {
      if (state.isSaving) return
      dispatch({ type: 'DATA_CHANGED', data })
    }

    return {
      openFile,
      importFile,
      confirmImport,
      cancelImport,
      saveDirect,
      saveAs,
      exportDownload,
      backupDownload,
      newFile,
      markDirty,
      applyDataChange,
    }
  }, [state, getNow])

  // beforeunload-Warnung bei ungespeicherten Änderungen (M6);
  // stabile Handler-Referenz im Effekt → StrictMode-idempotent (Blueprint §7.5).
  useEffect(() => {
    if (!state.isDirty) return
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [state.isDirty])

  // Stichtag aus der injizierten Zeit – Seiten greifen nie selbst zur Systemuhr.
  const todayIso = toLocalIsoDay(getNow())

  const contextValue = useMemo<FinanceDataContextValue>(
    () => ({ state, dispatch, actions, todayIso }),
    [state, actions, todayIso],
  )

  return <FinanceDataContext.Provider value={contextValue}>{children}</FinanceDataContext.Provider>
}
