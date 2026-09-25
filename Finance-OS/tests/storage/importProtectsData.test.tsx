/**
 * ST6 (Mapping DM5, DM22): Import zerstört nie den Bestand.
 * Ungültiger Import: fachliche Daten behalten Referenzidentität, nur
 * importHistory erhält einen rejected-Eintrag, isDirty bleibt false.
 * cancelImport bei gültiger Datei → cancelled. 51. Eintrag → ältester entfällt.
 * Erfolgreicher Import ersetzt atomar (fileHandle null, isDirty true).
 */

import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { StorageScreen } from '../../src/App'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { FinanceData, ImportHistoryEntry } from '../../src/types/finance'
import { appendImportHistory, createImportHistoryEntry } from '../../src/storage/importFlow'
import { loadExample, makeJsonFile, mutateExample } from './fixtures'
import { createMockFileHandle } from './helpers/mockFileHandle'

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

interface Captured {
  current: FinanceDataContextValue | null
}

function Capture({ into }: { into: Captured }) {
  into.current = useFinanceData()
  return null
}

/** Rendert die Speicher-UI und lädt die Beispieldatei als Bestand (Mock-Handle). */
function renderWithLoadedData(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <StorageScreen />
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  act(() => {
    captured.current!.dispatch({
      type: 'LOAD_SUCCEEDED',
      data: loadExample(),
      fileName: 'finance-data.json',
      handle: createMockFileHandle('finance-data.json'),
      warnings: [],
    })
  })
  return captured
}

describe('ST6 – fehlgeschlagener oder abgebrochener Import zerstört nichts (DM5)', () => {
  it('ungültige Importdatei: Bestand referenzidentisch, nur importHistory + rejected-Eintrag, isDirty bleibt false', async () => {
    const captured = renderWithLoadedData()
    const before = captured.current!.state.data!
    expect(captured.current!.state.isDirty).toBe(false)

    // Ungültig: Betrag als String (E_MONEY_TYPE).
    const invalidDraft = mutateExample((data) => {
      data.accounts[2].balanceHistory[0].amount = '627,59'
    })
    await act(async () => {
      await captured.current!.actions.importFile(makeJsonFile(invalidDraft, 'kaputt.json'))
    })

    // Vorschau zeigt die Ablehnung; nichts wurde übernommen.
    expect(screen.getByRole('heading', { name: 'Importvorschau' })).toBeInTheDocument()
    expect(screen.getByText('Diese Datei kann nicht importiert werden')).toBeInTheDocument()
    expect(captured.current!.state.data).toBe(before)

    // Schließen → rejected-Protokolleintrag im BESTEHENDEN Bestand.
    act(() => {
      screen.getByRole('button', { name: 'Schließen' }).click()
    })

    const after = captured.current!.state.data!
    // Fachliche Daten behalten Referenzidentität (toBe).
    expect(after.accounts).toBe(before.accounts)
    expect(after.portfolioPositions).toBe(before.portfolioPositions)
    expect(after.snapshots).toBe(before.snapshots)
    expect(after.savingsPlans).toBe(before.savingsPlans)
    expect(after.targetProfiles).toBe(before.targetProfiles)
    expect(after.goals).toBe(before.goals)
    expect(after.transactions).toBe(before.transactions)
    expect(after.settings).toBe(before.settings)
    expect(after.metadata).toBe(before.metadata)
    // Nur importHistory ist neu – mit genau einem rejected-Eintrag.
    expect(after.importHistory).not.toBe(before.importHistory)
    expect(after.importHistory).toHaveLength(before.importHistory.length + 1)
    const entry = after.importHistory[after.importHistory.length - 1]
    expect(entry.action).toBe('import')
    expect(entry.outcome).toBe('rejected')
    expect(entry.fileName).toBe('kaputt.json')
    expect(entry.timestamp).toBe(NOW_ISO)
    // Regel 17: Protokolleintrag löst keinen Ungespeichert-Status aus.
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.pendingImport).toBeNull()
  })

  it('Abbruch bei gültiger Datei → cancelled-Eintrag, Bestand unverändert', async () => {
    const captured = renderWithLoadedData()
    const before = captured.current!.state.data!

    await act(async () => {
      await captured.current!.actions.importFile(
        makeJsonFile(
          mutateExample(() => {}),
          'gueltig.json',
        ),
      )
    })
    expect(screen.getByRole('heading', { name: 'Importvorschau' })).toBeInTheDocument()

    act(() => {
      screen.getByRole('button', { name: 'Abbrechen' }).click()
    })

    const after = captured.current!.state.data!
    expect(after.accounts).toBe(before.accounts)
    expect(after.importHistory).toHaveLength(before.importHistory.length + 1)
    expect(after.importHistory[after.importHistory.length - 1].outcome).toBe('cancelled')
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.fileName).toBe('finance-data.json')
  })

  it('erfolgreicher Import ersetzt den Bestand atomar: fileHandle null, isDirty true, applied-Eintrag', async () => {
    const captured = renderWithLoadedData()
    const before = captured.current!.state.data!
    expect(captured.current!.state.fileHandle).not.toBeNull()

    await act(async () => {
      await captured.current!.actions.importFile(
        makeJsonFile(
          mutateExample(() => {}),
          'import-neu.json',
        ),
      )
    })
    act(() => {
      screen.getByRole('button', { name: 'Import bestätigen' }).click()
    })

    const state = captured.current!.state
    expect(state.data).not.toBe(before)
    expect(state.data!.accounts).toHaveLength(9)
    // Import löst das Handle (Blueprint §7.12) – Direkt-Speichern verlangt danach "Speichern unter".
    expect(state.fileHandle).toBeNull()
    expect(state.fileName).toBe('import-neu.json')
    expect(state.isDirty).toBe(true)
    expect(state.lastSavedAt).toBeNull()
    expect(state.pendingImport).toBeNull()
    // Der applied-Eintrag steht in der NEUEN importHistory.
    const entry = state.data!.importHistory[state.data!.importHistory.length - 1]
    expect(entry.action).toBe('import')
    expect(entry.outcome).toBe('applied')
    expect(entry.fileName).toBe('import-neu.json')
    expect(entry.fileSchemaVersion).toBe(1)
  })
})

describe('ST6 – importHistory-Kappung auf 50 Einträge (DM22)', () => {
  function makeEntry(id: string): ImportHistoryEntry {
    return {
      id,
      timestamp: NOW_ISO,
      action: 'import',
      fileName: null,
      fileSchemaVersion: 1,
      outcome: 'applied',
      note: null,
    }
  }

  it('beim 51. Eintrag entfällt der älteste; alle Finanzdaten bleiben unverändert', () => {
    const base = loadExample()
    // Bestand mit exakt 50 Protokolleinträgen (imp-000 … imp-049).
    const fifty: FinanceData = {
      ...base,
      importHistory: Array.from({ length: 50 }, (_, index) =>
        makeEntry(`imp-${String(index).padStart(3, '0')}`),
      ),
    }
    const entry51 = makeEntry('imp-050')
    const next = appendImportHistory(fifty, entry51)

    expect(next.importHistory).toHaveLength(50)
    expect(next.importHistory[0].id).toBe('imp-001') // ältester (imp-000) entfällt
    expect(next.importHistory[49].id).toBe('imp-050') // neuester ist angehängt
    // Alle übrigen Finanzdaten referenzidentisch unverändert.
    expect(next.accounts).toBe(fifty.accounts)
    expect(next.portfolioPositions).toBe(fifty.portfolioPositions)
    expect(next.settings).toBe(fifty.settings)
    expect(next.metadata).toBe(fifty.metadata)
  })

  it('Grenzfall: der 50. Eintrag (49 → 50) wird ohne Verlust angehängt', () => {
    const base = loadExample()
    // Bestand mit exakt 49 Protokolleinträgen (imp-000 … imp-048).
    const fortyNine: FinanceData = {
      ...base,
      importHistory: Array.from({ length: 49 }, (_, index) =>
        makeEntry(`imp-${String(index).padStart(3, '0')}`),
      ),
    }
    const entry50 = makeEntry('imp-049')
    const next = appendImportHistory(fortyNine, entry50)

    // Genau 50: nichts entfällt, der älteste bleibt erhalten.
    expect(next.importHistory).toHaveLength(50)
    expect(next.importHistory[0].id).toBe('imp-000')
    expect(next.importHistory[49].id).toBe('imp-049')
  })
})

describe('ST6 – createImportHistoryEntry: ID-Schema und Kollisionsauflösung', () => {
  const baseArgs = {
    action: 'import' as const,
    fileName: 'import.json',
    fileSchemaVersion: 1,
    outcome: 'applied' as const,
    nowIso: NOW_ISO, // 2026-07-19T10:30:00.000Z
  }

  it('ID aus nowIso: "imp-2026-07-19-1030-00", alle Felder übernommen, note default null', () => {
    const entry = createImportHistoryEntry({ ...baseArgs, existingIds: new Set() })
    expect(entry.id).toBe('imp-2026-07-19-1030-00')
    expect(entry.timestamp).toBe(NOW_ISO)
    expect(entry.action).toBe('import')
    expect(entry.fileName).toBe('import.json')
    expect(entry.fileSchemaVersion).toBe(1)
    expect(entry.outcome).toBe('applied')
    expect(entry.note).toBeNull()
  })

  it('ID-Kollision: Suffix "-2"; Doppel-Kollision: Suffix "-3"', () => {
    const collision = createImportHistoryEntry({
      ...baseArgs,
      existingIds: new Set(['imp-2026-07-19-1030-00']),
    })
    expect(collision.id).toBe('imp-2026-07-19-1030-00-2')

    const doubleCollision = createImportHistoryEntry({
      ...baseArgs,
      existingIds: new Set(['imp-2026-07-19-1030-00', 'imp-2026-07-19-1030-00-2']),
    })
    expect(doubleCollision.id).toBe('imp-2026-07-19-1030-00-3')
  })
})
