/**
 * ST5 (Mapping M6): Ungespeicherte Änderungen.
 * Reducer: MARK_DIRTY / SAVE_SUCCEEDED / EXPORT_MARKED_SAVED.
 * Provider (RTL): Indikator als Text sichtbar, beforeunload wird bei isDirty
 * abgefangen (defaultPrevented), saveDirect über Mock-Handle setzt zurück,
 * reiner Export ohne Markierung ändert isDirty nicht.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { StorageScreen } from '../../src/App'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import { financeDataReducer, initialFinanceState } from '../../src/state/financeDataReducer'
import { LOCALSTORAGE_ALLOWED_KEYS } from '../../src/state/localStoragePolicy'
import { withUpdatedTimestamp } from '../../src/storage/serializer'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { loadExample } from './fixtures'
import { createMockFileHandle } from './helpers/mockFileHandle'

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

// jsdom hat keine ObjectURL-/Download-Implementierung (Blueprint §7.4) → Stubs für den Export-Test.
beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:finance-os'),
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

interface Captured {
  current: FinanceDataContextValue | null
}

function Capture({ into }: { into: Captured }) {
  into.current = useFinanceData()
  return null
}

function renderStorage(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <StorageScreen />
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  return captured
}

function dispatchBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('ST5 – Reducer (rein)', () => {
  const loadedState = financeDataReducer(initialFinanceState, {
    type: 'LOAD_SUCCEEDED',
    data: loadExample(),
    fileName: 'finance-data.json',
    handle: null,
    warnings: [],
  })

  it('MARK_DIRTY setzt isDirty', () => {
    expect(loadedState.isDirty).toBe(false)
    const dirty = financeDataReducer(loadedState, { type: 'MARK_DIRTY' })
    expect(dirty.isDirty).toBe(true)
  })

  it('SAVE_SUCCEEDED setzt isDirty=false, lastSavedAt und updatedAt = nowIso', () => {
    const dirty = financeDataReducer(loadedState, { type: 'MARK_DIRTY' })
    const next = withUpdatedTimestamp(dirty.data!, NOW_ISO)
    const saved = financeDataReducer(dirty, { type: 'SAVE_SUCCEEDED', data: next, nowIso: NOW_ISO })
    expect(saved.isDirty).toBe(false)
    expect(saved.lastSavedAt).toBe(NOW_ISO)
    expect(saved.data!.metadata.updatedAt).toBe(NOW_ISO)
  })

  it('EXPORT_MARKED_SAVED setzt isDirty zurück (Export MIT Markierung)', () => {
    const dirty = financeDataReducer(loadedState, { type: 'MARK_DIRTY' })
    const next = withUpdatedTimestamp(dirty.data!, NOW_ISO)
    const exported = financeDataReducer(dirty, {
      type: 'EXPORT_MARKED_SAVED',
      data: next,
      nowIso: NOW_ISO,
    })
    expect(exported.isDirty).toBe(false)
    expect(exported.lastSavedAt).toBe(NOW_ISO)
  })
})

describe('ST5 – Provider und UI (M6)', () => {
  it('zeigt nach markDirty den Ungespeichert-Indikator (Text + Symbol), fängt beforeunload ab und setzt saveDirect zurück', async () => {
    const captured = renderStorage()
    const handle = createMockFileHandle('finance-data.json')

    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'finance-data.json',
        handle,
        warnings: [],
      })
    })

    // Sauber geladen: kein Indikator, beforeunload nicht abgefangen.
    expect(screen.queryByText(/Ungespeicherte Änderungen/)).toBeNull()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    // markDirty → Indikator sichtbar (Text, nicht nur Farbe) und beforeunload abgefangen.
    act(() => {
      captured.current!.actions.markDirty()
    })
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    // saveDirect über Mock-Handle: Ablauf withUpdatedTimestamp → serialisieren → Selbstprüfung → schreiben.
    await act(async () => {
      await captured.current!.actions.saveDirect()
    })
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.lastSavedAt).toBe(NOW_ISO)
    expect(screen.queryByText(/Ungespeicherte Änderungen/)).toBeNull()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    // Der geschriebene Text ist valide und trägt den injizierten Zeitstempel.
    const written = handle.getWrittenText()
    expect(written).not.toBeNull()
    const reparsed = parseFinanceJson(written!)
    expect(reparsed.ok).toBe(true)
    expect(reparsed.data!.metadata.updatedAt).toBe(NOW_ISO)
  })

  it('reiner Export ohne Markierung ändert isDirty nicht', () => {
    const captured = renderStorage()
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'finance-data.json',
        handle: null,
        warnings: [],
      })
    })
    act(() => {
      captured.current!.actions.markDirty()
    })
    expect(captured.current!.state.isDirty).toBe(true)

    act(() => {
      captured.current!.actions.exportDownload({ markAsSaved: false })
    })
    expect(captured.current!.state.isDirty).toBe(true)
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('Blueprint §5 / DM16: kein Finanzdaten-Autosave in localStorage – Cache-Löschung ist überlebbar', () => {
    // Die dokumentierte Sperre (seit M14 präzisiert): Die Allowlist enthält
    // exakt EINEN Schlüssel – den unkritischen Auto-Backup-Tagesmerker
    // (Gerätemarke, A5). NIE Finanzdaten, nie ein Autosave-Kanal.
    expect(LOCALSTORAGE_ALLOWED_KEYS).toEqual(['financeos.lastAutoBackupDay'])

    window.localStorage.clear()
    const captured = renderStorage()
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'finance-data.json',
        handle: null,
        warnings: [],
      })
    })
    act(() => {
      captured.current!.actions.markDirty()
    })
    act(() => {
      captured.current!.actions.exportDownload({ markAsSaved: false })
    })

    // Laden + Ändern + Export legen NICHTS in localStorage ab: Nach einer
    // Cache-Löschung ist der Zustand allein aus der JSON-Datei wiederherstellbar.
    expect(window.localStorage.length).toBe(0)
  })
})

describe('Review-Befunde 3.1/3.3 – Speicher-Sperre und gemeldete Schreibfehler', () => {
  it('Reducer: SAVE_STARTED sperrt (isSaving), SAVE_FAILED/SAVE_FINISHED heben die Sperre auf', () => {
    const started = financeDataReducer(initialFinanceState, { type: 'SAVE_STARTED' })
    expect(started.isSaving).toBe(true)
    expect(financeDataReducer(started, { type: 'SAVE_FAILED', message: 'x' }).isSaving).toBe(false)
    expect(financeDataReducer(started, { type: 'SAVE_FINISHED' }).isSaving).toBe(false)
  })

  it('saveDirect mit Schreibfehler: Meldung erscheint, Bestand bleibt referenzidentisch, isDirty bleibt true (M2-AK4)', async () => {
    const captured = renderStorage()
    const handle = createMockFileHandle('finance-data.json', { failWrites: true })
    act(() => {
      captured.current!.dispatch({
        type: 'LOAD_SUCCEEDED',
        data: loadExample(),
        fileName: 'finance-data.json',
        handle,
        warnings: [],
      })
    })
    const dataBefore = captured.current!.state.data
    act(() => {
      captured.current!.actions.markDirty()
    })
    await act(async () => {
      await captured.current!.actions.saveDirect()
    })
    // Erwartet: Fehler gemeldet, Sperre wieder frei, Bestand unangetastet, weiterhin ungespeichert.
    expect(captured.current!.state.operationError).toContain('konnte nicht geschrieben werden')
    expect(captured.current!.state.isSaving).toBe(false)
    expect(captured.current!.state.data).toBe(dataBefore)
    expect(captured.current!.state.isDirty).toBe(true)
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })
})
