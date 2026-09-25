/**
 * UI-Tests für das App-Grundlayout: Navigation (9 Punkte in fester
 * Reihenfolge, aria-current), Kopfbereich (Dateiname, Speicherstatus,
 * Ungespeichert-Hinweis auf jeder Seite), Speicher-UI auf „Daten & Backups“
 * und mobiler Menü-Button (aria-expanded, Menü schließt nach Auswahl).
 * Daten werden über den echten Provider geladen (LOAD_SUCCEEDED + loadExample).
 */

import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { AppLayout } from '../../src/layout/AppLayout'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import { formatIsoTimestampGerman } from '../../src/format/date'
import { loadExample } from '../storage/fixtures'

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

const NAV_LABELS = [
  'Übersicht',
  'Konten',
  'Depot',
  'Sparpläne',
  'Rebalancing',
  'Ziele',
  'Simulation',
  'Einstellungen',
  'Daten & Backups',
]

interface Captured {
  current: FinanceDataContextValue | null
}

function Capture({ into }: { into: Captured }) {
  into.current = useFinanceData()
  return null
}

function renderLayout(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <AppLayout />
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  return captured
}

function loadExampleData(captured: Captured): void {
  act(() => {
    captured.current!.dispatch({
      type: 'LOAD_SUCCEEDED',
      data: loadExample(),
      fileName: 'finance-data.json',
      handle: null,
      warnings: [],
    })
  })
}

function getNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Hauptnavigation' })
}

function navButton(label: string): HTMLElement {
  return within(getNav()).getByRole('button', { name: label })
}

describe('AppLayout – Navigation', () => {
  it('zeigt alle 9 Navigationspunkte in der festgelegten Reihenfolge', () => {
    renderLayout()
    const labels = within(getNav())
      .getAllByRole('list')
      .flatMap((list) => within(list).getAllByRole('button'))
      .map((button) => (button.textContent ?? '').trim())
    expect(labels).toEqual(NAV_LABELS)
  })

  it('gliedert die Navigation in benannte Gruppen (Start · Vermögen · Planung · Verwaltung)', () => {
    renderLayout()
    const groupLabels = (name: string): string[] =>
      within(within(getNav()).getByRole('list', { name }))
        .getAllByRole('button')
        .map((button) => (button.textContent ?? '').trim())
    expect(groupLabels('Start')).toEqual(['Übersicht'])
    expect(groupLabels('Vermögen')).toEqual(['Konten', 'Depot', 'Sparpläne'])
    expect(groupLabels('Planung')).toEqual(['Rebalancing', 'Ziele', 'Simulation'])
    expect(groupLabels('Verwaltung')).toEqual(['Einstellungen', 'Daten & Backups'])
  })

  it('wechselt die Seite und markiert den aktiven Punkt mit aria-current="page"', () => {
    renderLayout()
    // Startseite: Übersicht ist aktiv und als Seitentitel sichtbar.
    expect(navButton('Übersicht')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht' })).toBeInTheDocument()

    act(() => {
      navButton('Konten').click()
    })

    expect(navButton('Konten')).toHaveAttribute('aria-current', 'page')
    expect(navButton('Übersicht')).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('heading', { level: 2, name: 'Konten' })).toBeInTheDocument()
  })

  it('Startzustand ohne Datei: Button führt direkt zur Seite „Daten & Backups“', () => {
    renderLayout()
    act(() => {
      screen.getByRole('button', { name: 'Import und weitere Optionen' }).click()
    })
    expect(navButton('Daten & Backups')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Daten & Backups' })).toBeInTheDocument()
  })

  it('Startzustand ohne Datei: „Neue leere Datei anlegen“ legt direkt einen Bestand an', () => {
    const captured = renderLayout()
    expect(screen.getByRole('button', { name: 'Datei öffnen …' })).toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: 'Neue leere Datei anlegen' }).click()
    })
    expect(captured.current!.state.data).not.toBeNull()
    // Die Übersicht zeigt jetzt Inhalte statt des Startzustands.
    expect(screen.queryByText(/noch keine Finanzdaten geladen/)).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Vermögen' })).toBeInTheDocument()
  })
})

describe('AppLayout – Kopfbereich', () => {
  it('zeigt „Keine Datei geöffnet“ ohne Daten und den Dateinamen mit geladenen Daten', () => {
    const captured = renderLayout()
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Keine Datei geöffnet')).toBeInTheDocument()
    expect(within(header).getByText('Keine Daten im Arbeitsspeicher')).toBeInTheDocument()

    loadExampleData(captured)

    expect(within(header).getByText('finance-data.json')).toBeInTheDocument()
    expect(within(header).queryByText('Keine Datei geöffnet')).toBeNull()
    // Noch nicht in dieser Sitzung gespeichert → Stand der Datei (metadata.updatedAt),
    // deutsch formatiert und nie als ISO-Rohtext (M7-A11y-Befund B1).
    const updatedAt = formatIsoTimestampGerman(loadExample().metadata.updatedAt)
    expect(
      within(header).getByText(`noch nicht in dieser Sitzung – Stand der Datei: ${updatedAt}`),
    ).toBeInTheDocument()
    expect(header.textContent).not.toContain('T00:00:00')
  })

  // Rendert alle 9 Seiten in einem Durchlauf; unter paralleler Volllast kann
  // das die 5-s-Standard-Timeout reissen (beobachteter Flake der Finalabnahme,
  // fachlich immer gruen) - grosszuegige eigene Timeout statt Testverzicht.
  it('bietet die Speicheraktion erst mit geladenen Daten an – auf jeder Seite im Kopfbereich', () => {
    const captured = renderLayout()
    const header = screen.getByRole('banner')
    // jsdom ohne Save-Picker → ehrliche Beschriftung „Als Download speichern“.
    expect(within(header).queryByRole('button', { name: 'Als Download speichern' })).toBeNull()

    loadExampleData(captured)
    expect(within(header).getByText('✓ Alle Änderungen gespeichert')).toBeInTheDocument()
    for (const label of NAV_LABELS) {
      act(() => {
        navButton(label).click()
      })
      expect(
        within(header).getByRole('button', { name: 'Als Download speichern' }),
      ).toBeEnabled()
    }
  })

  it('Speichern im Kopfbereich ruft dieselbe Aktion auf wie „Daten & Backups“ (Download-Fallback)', () => {
    const captured = renderLayout()
    loadExampleData(captured)
    act(() => {
      captured.current!.actions.markDirty()
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    act(() => {
      within(screen.getByRole('banner'))
        .getByRole('button', { name: 'Als Download speichern' })
        .click()
    })
    // Ohne Save-Picker fragt saveDirect vor dem Download nach; Abbruch lässt alles unverändert.
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(captured.current!.state.isDirty).toBe(true)
    confirmSpy.mockRestore()
  })

  it('zeigt den Ungespeichert-Hinweis nach markDirty auf JEDER Seite', { timeout: 30000 }, () => {
    const captured = renderLayout()
    loadExampleData(captured)
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()

    act(() => {
      captured.current!.actions.markDirty()
    })

    for (const label of NAV_LABELS) {
      act(() => {
        navButton(label).click()
      })
      expect(navButton(label)).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
    }
  })
})

describe('AppLayout – Seiteninhalte', () => {
  it('„Daten & Backups“ enthält die Speicher-Aktionen und das Import-Feld', () => {
    renderLayout()
    act(() => {
      navButton('Daten & Backups').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Daten & Backups' })).toBeInTheDocument()
    const main = screen.getByRole('main')
    // Aktionen nach Aufgaben gegliedert – je Aufgabe eine benannte Karte.
    for (const card of ['Öffnen & neu anlegen', 'Speichern', 'Exportieren & sichern', 'Importieren']) {
      expect(within(main).getByRole('region', { name: card })).toBeInTheDocument()
    }
    expect(within(main).getByRole('button', { name: 'Datei öffnen …' })).toBeInTheDocument()
    // jsdom ohne Save-Picker → ehrliche Beschriftung „Als Download speichern“.
    expect(within(main).getByRole('button', { name: 'Als Download speichern' })).toBeInTheDocument()
    expect(
      within(main).getByRole('button', { name: 'Kopie exportieren (Download)' }),
    ).toBeInTheDocument()
    expect(
      within(main).getByRole('button', { name: 'Exportieren und als gespeichert markieren' }),
    ).toBeInTheDocument()
    expect(
      within(main).getByRole('button', { name: 'Sicherungskopie herunterladen' }),
    ).toBeInTheDocument()
    expect(within(main).getByRole('button', { name: 'Neue leere Datei anlegen' })).toBeInTheDocument()
    expect(within(main).getByLabelText('JSON-Datei für den Import auswählen')).toBeInTheDocument()
  })

  it('„Sparpläne“ ist seit M10 eine echte Seite (StartHint statt Platzhalter)', () => {
    renderLayout()
    act(() => {
      navButton('Sparpläne').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Sparpläne' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.queryByText('Dieses Modul folgt in einer späteren Phase.')).toBeNull()
  })

  it('„Ziele“ ist seit M12 eine echte Seite (StartHint statt Platzhalter)', () => {
    renderLayout()
    act(() => {
      navButton('Ziele').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Ziele' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.queryByText('Dieses Modul folgt in einer späteren Phase.')).toBeNull()
  })

  it('„Rebalancing“ ist seit M11 eine echte Seite (StartHint statt Platzhalter)', () => {
    renderLayout()
    act(() => {
      navButton('Rebalancing').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Rebalancing' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.queryByText('Dieses Modul folgt in einer späteren Phase.')).toBeNull()
  })

  it('„Simulation“ ist seit M13 eine echte Seite (StartHint statt Platzhalter)', () => {
    renderLayout()
    act(() => {
      navButton('Simulation').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Simulation' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.queryByText('Dieses Modul folgt in einer späteren Phase.')).toBeNull()
  })

  it('„Einstellungen“ ist seit M14 eine echte Seite (StartHint statt Platzhalter) – kein Platzhalter mehr in der App', () => {
    renderLayout()
    act(() => {
      navButton('Einstellungen').click()
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.queryByText('Dieses Modul folgt in einer späteren Phase.')).toBeNull()
  })
})

describe('AppLayout – mobile Navigation', () => {
  it('Menü-Button wechselt aria-expanded; Menü schließt nach Auswahl', () => {
    renderLayout()
    const toggle = screen.getByRole('button', { name: 'Menü öffnen' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    act(() => {
      toggle.click()
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Derselbe Button trägt jetzt die Schließen-Beschriftung.
    expect(screen.getByRole('button', { name: 'Menü schließen' })).toBe(toggle)

    act(() => {
      navButton('Konten').click()
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
