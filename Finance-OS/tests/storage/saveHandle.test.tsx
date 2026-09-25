/**
 * Regressionstests zum Handle-Verhalten des Speicherns (manuelle Nachprüfung der
 * Speicherfunktion, 2026-07-19):
 *  1. Erstes Speichern ohne Handle ruft "Speichern unter" (saveAsNewFile) auf
 *     und legt den zurückgegebenen Handle im State ab.
 *  2. Zweites Speichern schreibt direkt in denselben Handle – kein neuer Dialog.
 *  3. "Speichern unter" öffnet IMMER den Dialog und ersetzt den Handle.
 *  4. Öffnen einer Datei (Handle im State) + Speichern schreibt direkt in diesen Handle.
 *  5. Normale State-Updates (markDirty, Fehler, abgelehnter Import) verlieren den Handle nicht.
 *
 * jsdom hat keine echten FSA-Picker: Die Feature-Checks werden über definierte
 * window-Properties erfüllt; saveAsNewFile wird als Modul-Mock abgefangen.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import { financeDataReducer, initialFinanceState } from '../../src/state/financeDataReducer'
import { saveAsNewFile } from '../../src/storage/fileAccess'
import { loadExample } from './fixtures'
import { createMockFileHandle } from './helpers/mockFileHandle'

vi.mock('../../src/storage/fileAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage/fileAccess')>()
  return { ...actual, saveAsNewFile: vi.fn() }
})

const saveAsNewFileMock = vi.mocked(saveAsNewFile)

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

beforeAll(() => {
  // Feature-Checks: die Existenz der Properties genügt ('showSaveFilePicker' in window).
  Object.defineProperty(window, 'showOpenFilePicker', { value: vi.fn(), writable: true })
  Object.defineProperty(window, 'showSaveFilePicker', { value: vi.fn(), writable: true })
})

afterEach(() => {
  saveAsNewFileMock.mockReset()
})

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

describe('Handle-Verhalten des Speicherns', () => {
  it('1. erstes Speichern ohne Handle ruft "Speichern unter" auf und speichert den Handle im State', async () => {
    const handleA = createMockFileHandle('gespeichert.json')
    saveAsNewFileMock.mockResolvedValue({ handle: handleA, fileName: 'gespeichert.json' })
    const captured = renderProvider()

    act(() => {
      captured.current!.actions.newFile()
    })
    expect(captured.current!.state.fileHandle).toBeNull()

    await act(async () => {
      await captured.current!.actions.saveDirect()
    })

    expect(saveAsNewFileMock).toHaveBeenCalledTimes(1)
    expect(captured.current!.state.fileHandle).toBe(handleA)
    expect(captured.current!.state.fileName).toBe('gespeichert.json')
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.lastSavedAt).toBe(NOW_ISO)
  })

  it('2. zweites Speichern in derselben Sitzung schreibt direkt in denselben Handle – kein neuer Dialog', async () => {
    const handleA = createMockFileHandle('gespeichert.json')
    saveAsNewFileMock.mockResolvedValue({ handle: handleA, fileName: 'gespeichert.json' })
    const captured = renderProvider()

    act(() => {
      captured.current!.actions.newFile()
    })
    await act(async () => {
      await captured.current!.actions.saveDirect() // erstes Speichern: Dialog
    })
    act(() => {
      captured.current!.actions.markDirty()
    })
    await act(async () => {
      await captured.current!.actions.saveDirect() // zweites Speichern: direkt
    })

    // Kein zweiter Dialog; der zweite Schreibvorgang lief über saveToHandle auf handleA.
    expect(saveAsNewFileMock).toHaveBeenCalledTimes(1)
    expect(handleA.getWriteCount()).toBe(1)
    expect(captured.current!.state.fileHandle).toBe(handleA)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('3. "Speichern unter" öffnet auch mit vorhandenem Handle den Dialog und ersetzt den Handle', async () => {
    const handleA = createMockFileHandle('alt.json')
    const handleB = createMockFileHandle('neu.json')
    saveAsNewFileMock.mockResolvedValue({ handle: handleB, fileName: 'neu.json' })
    const captured = renderProvider()

    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'alt.json',
        handle: handleA,
        warnings: [],
      })
    })

    await act(async () => {
      await captured.current!.actions.saveAs()
    })

    expect(saveAsNewFileMock).toHaveBeenCalledTimes(1)
    expect(captured.current!.state.fileHandle).toBe(handleB)
    expect(captured.current!.state.fileName).toBe('neu.json')
    // Der alte Handle wurde dabei nicht beschrieben.
    expect(handleA.getWriteCount()).toBe(0)
  })

  it('4. Öffnen einer Datei + Speichern schreibt direkt in den geöffneten Handle (kein Dialog)', async () => {
    const openedHandle = createMockFileHandle('finance-data.json')
    const captured = renderProvider()

    // Simuliert das Ergebnis von openFile(): LOAD_SUCCEEDED speichert den Handle.
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'finance-data.json',
        handle: openedHandle,
        warnings: [],
      })
    })
    act(() => {
      captured.current!.actions.markDirty()
    })
    await act(async () => {
      await captured.current!.actions.saveDirect()
    })

    expect(saveAsNewFileMock).not.toHaveBeenCalled()
    expect(openedHandle.getWriteCount()).toBe(1)
    expect(captured.current!.state.fileHandle).toBe(openedHandle)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('5. normale State-Updates entfernen den Handle nicht (markDirty, Fehler, abgelehnter Import)', () => {
    const handle = createMockFileHandle('finance-data.json')
    const loaded = financeDataReducer(initialFinanceState, {
      type: 'LOAD_SUCCEEDED',
      data: loadExample(),
      fileName: 'finance-data.json',
      handle,
      warnings: [],
    })

    expect(financeDataReducer(loaded, { type: 'MARK_DIRTY' }).fileHandle).toBe(handle)
    expect(financeDataReducer(loaded, { type: 'SAVE_FAILED', message: 'x' }).fileHandle).toBe(handle)
    expect(financeDataReducer(loaded, { type: 'OPERATION_FAILED', message: 'x' }).fileHandle).toBe(
      handle,
    )
    expect(financeDataReducer(loaded, { type: 'LOAD_FAILED', errors: [] }).fileHandle).toBe(handle)
    expect(
      financeDataReducer(loaded, { type: 'IMPORT_REJECTED_LOGGED', data: loaded.data }).fileHandle,
    ).toBe(handle)
    // Gewollte Ausnahmen bleiben gewollt: Import-Übernahme und neue Datei lösen den Handle.
    expect(
      financeDataReducer(loaded, {
        type: 'IMPORT_APPLIED',
        data: loaded.data!,
        fileName: 'import.json',
        warnings: [],
      }).fileHandle,
    ).toBeNull()
  })
})
