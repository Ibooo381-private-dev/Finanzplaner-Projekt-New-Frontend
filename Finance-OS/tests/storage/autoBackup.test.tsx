/**
 * Provider-Tests des Auto-Backup-Hooks (M14/M5, Auflagen A2–A5):
 * - everySave: nach jedem erfolgreichen Speichern EIN Backup-Download,
 *   dessen Bytes EXAKT dem geschriebenen Serialisat entsprechen (A2) und
 *   der als vollständige Finanzdatei wieder ladbar ist (Stop-Test).
 * - fehlender backup-Block: Auto-Backup läuft trotzdem (KORREKTUR Nr. 3 –
 *   undefined wirkt als everySave).
 * - dailyFirstSave: nur einmal pro Kalendertag (localStorage-Tagesmerker);
 *   die manuelle Sicherung wird davon NIE gegated.
 * - Backup-Fehler lässt das Speichern nie rückwirkend scheitern (A3).
 * - Download-Fallback (EXPORT_MARKED_SAVED) und Dialog-Abbruch lösen KEIN
 *   zusätzliches Auto-Backup aus (A4).
 * Muster: tests/storage/saveHandle.test.tsx (Modul-Mock fileAccess).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { BackupMode, FinanceData } from '../../src/types/finance'
import { downloadAsFile, saveAsNewFile } from '../../src/storage/fileAccess'
import { backupFileName } from '../../src/storage/fileNames'
import {
  readLastAutoBackupDay,
  writeLastAutoBackupDay,
} from '../../src/storage/autoBackup'
import { LAST_AUTO_BACKUP_DAY_KEY } from '../../src/state/localStoragePolicy'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { loadExample } from './fixtures'
import { createMockFileHandle } from './helpers/mockFileHandle'

vi.mock('../../src/storage/fileAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage/fileAccess')>()
  return { ...actual, downloadAsFile: vi.fn(), saveAsNewFile: vi.fn() }
})
vi.mock('../../src/storage/featureDetection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage/featureDetection')>()
  // Steuerbar je Test: Default = echtes jsdom-Verhalten (kein Save-Picker →
  // Fallback-Pfade der A4-Tests bleiben unverändert testbar).
  return { ...actual, isSaveFilePickerSupported: vi.fn(actual.isSaveFilePickerSupported) }
})

const downloadAsFileMock = vi.mocked(downloadAsFile)
const saveAsNewFileMock = vi.mocked(saveAsNewFile)

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

interface Captured {
  current: FinanceDataContextValue | null
}

function Capture({ into }: { into: Captured }) {
  into.current = useFinanceData()
  return null
}

function renderProvider(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  return captured
}

function exampleWithBackupMode(mode: BackupMode | undefined): FinanceData {
  const data = loadExample()
  if (mode === undefined) {
    delete data.settings.backup
  } else {
    data.settings.backup = { ...(data.settings.backup ?? {}), mode }
  }
  return data
}

function loadWithHandle(captured: Captured, data: FinanceData) {
  const handle = createMockFileHandle('finance-data.json')
  act(() => {
    captured.current!.dispatch({
      type: 'LOAD_SUCCEEDED',
      data,
      fileName: 'finance-data.json',
      handle,
      warnings: [],
    })
  })
  return handle
}

async function saveDirect(captured: Captured): Promise<void> {
  await act(async () => {
    await captured.current!.actions.saveDirect()
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(async () => {
  downloadAsFileMock.mockReset()
  saveAsNewFileMock.mockReset()
  // mockReset stellt die an vi.fn() übergebene Original-Implementierung wieder
  // her → Folge-Tests sehen wieder das echte jsdom-Verhalten (kein Save-Picker).
  const { isSaveFilePickerSupported } = await import('../../src/storage/featureDetection')
  vi.mocked(isSaveFilePickerSupported).mockReset()
})

describe('Auto-Backup nach erfolgreichem Speichern (A2/A3/A5)', () => {
  it('everySave: Backup-Bytes = gespeicherte Bytes; Dateiname nach Backup-Schema; Tagesmerker gesetzt', async () => {
    const captured = renderProvider()
    const handle = loadWithHandle(captured, exampleWithBackupMode('everySave'))
    act(() => {
      captured.current!.actions.markDirty()
    })

    await saveDirect(captured)

    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.lastSavedAt).toBe(NOW_ISO)
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    const [fileName, backupJson] = downloadAsFileMock.mock.calls[0]
    expect(fileName).toBe(backupFileName(new Date(NOW_ISO)))
    // A2: EXAKT der bereits geschriebene json-String – Byte-identisch.
    expect(backupJson).toBe(handle.getWrittenText())
    // A5: Tagesmerker (Gerätemarke) trägt den lokalen Kalendertag des Speicherns.
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBe(captured.current!.todayIso)
  })

  it('Stop-Test: die Backup-Datei ist eine vollständige, wieder ladbare Finanzdatei (Deep-Equal)', async () => {
    const captured = renderProvider()
    const handle = loadWithHandle(captured, exampleWithBackupMode('everySave'))
    await saveDirect(captured)

    const backupJson = downloadAsFileMock.mock.calls[0][1]
    const reloaded = parseFinanceJson(backupJson)
    expect(reloaded.ok).toBe(true)
    expect(reloaded.data).toEqual(JSON.parse(handle.getWrittenText()!))
    // Der zurückgelesene Bestand entspricht dem gespeicherten State (mit neuem updatedAt).
    expect(reloaded.data).toEqual(captured.current!.state.data)
  })

  it('saveAs („Speichern unter"): Auto-Backup mit Byte-identischem Serialisat + Tagesmerker (calculation-tester M14)', async () => {
    const { isSaveFilePickerSupported } = await import('../../src/storage/featureDetection')
    vi.mocked(isSaveFilePickerSupported).mockReturnValue(true)
    const captured = renderProvider()
    loadWithHandle(captured, exampleWithBackupMode('everySave'))
    const newHandle = createMockFileHandle('neuer-name.json')
    saveAsNewFileMock.mockResolvedValue({ fileName: 'neuer-name.json', handle: newHandle })

    await act(async () => {
      await captured.current!.actions.saveAs()
    })

    expect(captured.current!.state.fileName).toBe('neuer-name.json')
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    const [fileName, backupJson] = downloadAsFileMock.mock.calls[0]
    expect(fileName).toBe(backupFileName(new Date(NOW_ISO)))
    // A2 auch auf dem saveAs-Pfad: Backup-Bytes = exakt der an saveAsNewFile
    // übergebene (geschriebene) json-String.
    expect(backupJson).toBe(saveAsNewFileMock.mock.calls[0][1])
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBe(captured.current!.todayIso)
  })

  it('Merker-Randfälle: ungültiger Wert liest als null (sichere Richtung); Schreibfehler wirft nie', () => {
    window.localStorage.setItem(LAST_AUTO_BACKUP_DAY_KEY, 'gestern')
    expect(readLastAutoBackupDay()).toBeNull()
    window.localStorage.setItem(LAST_AUTO_BACKUP_DAY_KEY, '2026-7-1')
    expect(readLastAutoBackupDay()).toBeNull()
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Speicher voll')
      })
    expect(() => writeLastAutoBackupDay('2026-07-19')).not.toThrow()
    spy.mockRestore()
  })

  it('KORREKTUR Nr. 3: fehlender backup-Block → Auto-Backup läuft trotzdem (wirkt als everySave)', async () => {
    const captured = renderProvider()
    loadWithHandle(captured, exampleWithBackupMode(undefined))
    await saveDirect(captured)

    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    // K2: der fehlende backup-Block wurde dabei NICHT in die Datei materialisiert.
    expect('backup' in captured.current!.state.data!.settings).toBe(false)
  })

  it('dailyFirstSave: nur beim ersten Speichern des Kalendertags ein Backup', async () => {
    const captured = renderProvider()
    loadWithHandle(captured, exampleWithBackupMode('dailyFirstSave'))

    await saveDirect(captured)
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBe(captured.current!.todayIso)

    act(() => {
      captured.current!.actions.markDirty()
    })
    await saveDirect(captured)

    // Zweites Speichern desselben Tages: gespeichert ja, Backup nein.
    expect(captured.current!.state.isDirty).toBe(false)
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
  })

  it('dailyFirstSave: Merker von gestern → heute wird wieder gesichert', async () => {
    window.localStorage.setItem(LAST_AUTO_BACKUP_DAY_KEY, '2026-07-18')
    const captured = renderProvider()
    loadWithHandle(captured, exampleWithBackupMode('dailyFirstSave'))
    await saveDirect(captured)

    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBe(captured.current!.todayIso)
  })

  it('die manuelle Sicherung wird vom Tagesmerker NIE gegated (A5)', async () => {
    const captured = renderProvider()
    loadWithHandle(captured, exampleWithBackupMode('dailyFirstSave'))
    await saveDirect(captured)
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)

    act(() => {
      captured.current!.actions.backupDownload()
    })

    // Manuelle Sicherung läuft trotz gesetztem Tagesmerker.
    expect(downloadAsFileMock).toHaveBeenCalledTimes(2)
  })

  it('A3: ein Backup-Fehler lässt das Speichern erfolgreich und erzeugt nur einen Hinweis', async () => {
    const captured = renderProvider()
    const handle = loadWithHandle(captured, exampleWithBackupMode('everySave'))
    downloadAsFileMock.mockImplementation(() => {
      throw new Error('Download blockiert')
    })

    await saveDirect(captured)

    // Speichern bleibt erfolgreich: Datei geschrieben, nicht mehr dirty.
    expect(handle.getWriteCount()).toBe(1)
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.lastSavedAt).toBe(NOW_ISO)
    // Nur ein zusätzlicher Hinweis – kein SAVE_FAILED.
    expect(captured.current!.state.operationError).toContain(
      'Die automatische Sicherung konnte nicht erstellt werden',
    )
    expect(captured.current!.state.operationError).toContain('Das Speichern selbst war erfolgreich')
    // Fehlgeschlagenes Backup setzt KEINEN Tagesmerker.
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBeNull()
  })
})

describe('Kein Auto-Backup außerhalb der SAVE_SUCCEEDED-Pfade (A4)', () => {
  it('Download-Fallback (EXPORT_MARKED_SAVED): genau EIN Download – der Export, kein Extra-Backup', async () => {
    // jsdom ohne showSaveFilePicker und ohne Handle → Fallback-Pfad.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderProvider()
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: exampleWithBackupMode('everySave'),
        fileName: 'finance-data.json',
        handle: null,
        warnings: [],
      })
    })

    await saveDirect(captured)

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(captured.current!.state.isDirty).toBe(false)
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    // Der eine Download ist der Export selbst (finance-data-…), keine Backup-Datei.
    expect(downloadAsFileMock.mock.calls[0][0]).not.toContain('backup')
    // Der Fallback setzt auch keinen Auto-Backup-Tagesmerker.
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBeNull()
    confirmSpy.mockRestore()
  })

  it('Dialog-Abbruch im Fallback: kein Download, kein Backup, kein Statuswechsel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderProvider()
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: exampleWithBackupMode('everySave'),
        fileName: 'finance-data.json',
        handle: null,
        warnings: [],
      })
    })
    act(() => {
      captured.current!.actions.markDirty()
    })

    await saveDirect(captured)

    expect(downloadAsFileMock).not.toHaveBeenCalled()
    expect(captured.current!.state.isDirty).toBe(true)
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBeNull()
    confirmSpy.mockRestore()
  })

  it('SAVE_FAILED (Schreibfehler): kein Backup, Bestand und Dirty-Status bleiben erhalten', async () => {
    const captured = renderProvider()
    const handle = createMockFileHandle('finance-data.json', { failWrites: true })
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: exampleWithBackupMode('everySave'),
        fileName: 'finance-data.json',
        handle,
        warnings: [],
      })
    })
    act(() => {
      captured.current!.actions.markDirty()
    })

    await saveDirect(captured)

    expect(captured.current!.state.isDirty).toBe(true)
    expect(captured.current!.state.operationError).toContain('konnte nicht geschrieben werden')
    expect(downloadAsFileMock).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)).toBeNull()
  })
})
