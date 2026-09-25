/**
 * UI-Tests der Depot-Seite (M9): Kennzahlen-Kacheln und Positionsliste
 * (Sortierung, „unbekannt“, „nicht berechenbar“), Formulare (Anlegen,
 * Bearbeiten inkl. key-Zielwechsel, Deaktivieren mit Betragsnennung,
 * Wert-Erfassung mit strengem de-DE-Parsing), Snapshot-Vollerfassung und
 * Zielvergleich (nur Anzeige, actionLevel-Stufen). Muster wie
 * tests/pages/accountsPage.test.tsx (echter Provider + Capture +
 * LOAD_SUCCEEDED mit loadExample()).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { AppLayout } from '../../src/layout/AppLayout'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { FinanceData } from '../../src/types/finance'
import type { ValidationIssue } from '../../src/validation/issues'
import { formatEuro } from '../../src/format/money'
import { loadExample } from '../storage/fixtures'

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

/**
 * Erwartungstext für Beträge: formatEuro nutzt geschützte Leerzeichen (Intl),
 * der Testing-Library-Normalizer kollabiert sie zu normalen Leerzeichen.
 */
function euroText(amount: number): string {
  return formatEuro(amount).replace(/\s/g, ' ')
}

interface Captured {
  current: FinanceDataContextValue | null
}

function Capture({ into }: { into: Captured }) {
  into.current = useFinanceData()
  return null
}

function renderDepotPage(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <AppLayout initialPage="depot" />
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  return captured
}

function loadData(
  captured: Captured,
  data: FinanceData,
  warnings: ValidationIssue[] = [],
): void {
  act(() => {
    captured.current!.dispatch({
      type: 'LOAD_SUCCEEDED',
      data,
      fileName: 'finance-data.json',
      handle: null,
      warnings,
    })
  })
}

function getPositionsTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Positionsliste' })
}

function getComparisonTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Zielvergleich' })
}

function rowOf(table: HTMLElement, name: string): HTMLElement {
  const cell = within(table).getByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`Keine Tabellenzeile für "${name}" gefunden.`)
  return row
}

function positionRowNames(): (string | null)[] {
  return within(getPositionsTable())
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent)
}

/** KPI-Kachel über ihren dt-Text finden (scoped Assertions auf den dd-Wert). */
function kpiTile(label: string): HTMLElement {
  const tile = screen.getByText(label).closest('.kpi-tile')
  if (!(tile instanceof HTMLElement)) throw new Error(`Keine KPI-Kachel für "${label}" gefunden.`)
  return tile
}

function withPositionPatched(
  data: FinanceData,
  positionId: string,
  patch: Record<string, unknown>,
): FinanceData {
  return {
    ...data,
    portfolioPositions: data.portfolioPositions.map((position) =>
      position.id === positionId ? { ...position, ...patch } : position,
    ),
  }
}

function withAccountPatched(
  data: FinanceData,
  accountId: string,
  patch: Record<string, unknown>,
): FinanceData {
  return {
    ...data,
    accounts: data.accounts.map((account) =>
      account.id === accountId ? { ...account, ...patch } : account,
    ),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DepotPage – Leerzustände', () => {
  it('ohne geladene Datei: Startzustand mit Weg zu „Daten & Backups“', () => {
    renderDepotPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Depot' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import und weitere Optionen' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('mit Datei, aber 0 Positionen: verständlicher Hinweis + „Position hinzufügen“', () => {
    const captured = renderDepotPage()
    const example = loadExample()
    loadData(captured, { ...example, portfolioPositions: [], targetProfiles: [], snapshots: [] })
    expect(screen.getByText(/enthält noch keine Depotpositionen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Position hinzufügen' })).toBeInTheDocument()
  })

  it('ohne Depotkonto: Kacheln zeigen 0,00 € (Summe 0, nie „unbekannt“), Anlegen scheitert verständlich, nichts wird geändert', () => {
    const captured = renderDepotPage()
    const example = loadExample()
    loadData(captured, {
      ...example,
      // Kein einziges Depot-Konto; Positionen/Pläne/Profile/Snapshots konsistent leer.
      accounts: example.accounts.filter((account) => account.type !== 'depot'),
      portfolioPositions: [],
      savingsPlans: [],
      targetProfiles: [],
      snapshots: [],
    })
    // Leere Summe = 0,00 € in beiden Wert-Kacheln (Summe-0-Fall, kein NaN, kein „unbekannt“).
    expect(within(kpiTile('Depotwert (aktive Positionen)')).getByText(euroText(0))).toBeInTheDocument()
    expect(within(kpiTile('MSCI World gesamt')).getByText(euroText(0))).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')

    // Formular öffnen: die Depotkonto-Auswahl ist leer (kein Konto erfindbar).
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    expect(within(form).getByLabelText('Depotkonto *').querySelectorAll('option')).toHaveLength(0)

    // Anlegen ohne Depotkonto: feldbezogene Ablehnung der Datenfunktion (B1), keine Änderung.
    fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Testposition' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Position anlegen' }))
    expect(within(form).getByText(/existiert nicht/)).toBeInTheDocument()
    expect(captured.current!.state.data!.portfolioPositions).toHaveLength(0)
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('DepotPage – Kennzahlen und Liste (Seed)', () => {
  it('zeigt die Kacheln Depotwert 2.522,47, World 1.020,30 und 6 aktive Positionen', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(screen.getByText('Depotwert (aktive Positionen)')).toBeInTheDocument()
    expect(screen.getByText(euroText(2522.47))).toBeInTheDocument()
    expect(screen.getByText('MSCI World gesamt')).toBeInTheDocument()
    expect(screen.getByText(euroText(1020.3))).toBeInTheDocument()
    expect(screen.getByText('Aktive Positionen')).toBeInTheDocument()
    expect(getPositionsTable()).toBeInTheDocument()
    expect(within(getPositionsTable()).getAllByRole('rowheader')).toHaveLength(6)
  })

  it('zeigt den Pflicht-Hinweis zum Doppelzählungs-Modell wörtlich an', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(
      screen.getByText(
        'Der Depotwert wird ausschließlich aus den Positionen berechnet. Depotkonten besitzen keinen zusätzlichen Saldo.',
      ),
    ).toBeInTheDocument()
  })

  it('Telekom-Zeile: Wert, deutsches Datum, Anteil am Depot 54,28 % und Anteil am Gesamtvermögen', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const row = rowOf(getPositionsTable(), 'Deutsche Telekom Aktien')
    expect(within(row).getByText(euroText(1369.14))).toBeInTheDocument()
    expect(within(row).getByText('17.07.2026')).toBeInTheDocument()
    // F5: 1.369,14 / 2.522,47 = 54,27775 % → gerundet 54,28 % (percentDecimals 2).
    expect(within(row).getByText('54,28 %')).toBeInTheDocument()
    // F6: 1.369,14 / 3.150,06 = 43,46393 % → 43,46 %.
    expect(within(row).getByText('43,46 %')).toBeInTheDocument()
    expect(within(row).getByText('Aktiv')).toBeInTheDocument()
    expect(within(row).getByText('Telekom')).toBeInTheDocument()
    expect(within(row).getByText('Aktie')).toBeInTheDocument()
  })

  it('Position ohne Historie: „unbekannt“, Datum „–“ und Warnhinweis mit Namen (nie 0)', () => {
    const captured = renderDepotPage()
    const data = withPositionPatched(loadExample(), 'pos-ishares-gold-etc', { valueHistory: [] })
    loadData(captured, data)
    const row = rowOf(getPositionsTable(), 'iShares Physical Gold ETC')
    expect(within(row).getByText('unbekannt')).toBeInTheDocument()
    // Depotwert ohne Gold: 2.522,47 − 33,92 = 2.488,55 (unbekannt zählt nie als 0).
    expect(screen.getByText(euroText(2488.55))).toBeInTheDocument()
    expect(
      screen.getByText(/Für folgende aktive Positionen ist noch kein Wert erfasst/),
    ).toBeInTheDocument()
    expect(screen.getByText(/iShares Physical Gold ETC. Sie zählen nicht als 0/)).toBeInTheDocument()
  })

  it('Standardsortierung: Wert absteigend, aktive vor inaktiven Positionen', () => {
    const captured = renderDepotPage()
    // Telekom (größter Wert) wird deaktiviert → trotz Größe ans Ende.
    const data = withPositionPatched(loadExample(), 'pos-telekom-aktien', { isActive: false })
    loadData(captured, data)
    const names = positionRowNames()
    expect(names[0]).toBe('VL iShares Core MSCI World')
    expect(names[1]).toBe('SPDR MSCI World thesaurierend')
    expect(names[names.length - 1]).toBe('Deutsche Telekom Aktien')
    // aria-sort am Wert-Header (Standard: absteigend).
    const wertButton = within(getPositionsTable()).getByRole('button', {
      name: 'Aktueller Wert ▼',
    })
    expect(wertButton.closest('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('alternative Sortierung nach Bezeichnung (auf- und absteigend, aria-sort)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(within(getPositionsTable()).getByRole('button', { name: 'Bezeichnung' }))
    let names = positionRowNames()
    expect(names[0]).toBe('Deutsche Telekom Aktien')
    expect(names[names.length - 1]).toBe('Xtrackers MSCI World ausschuettend')
    const header = within(getPositionsTable())
      .getByRole('button', { name: 'Bezeichnung ▲' })
      .closest('th')
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(within(getPositionsTable()).getByRole('button', { name: 'Bezeichnung ▲' }))
    names = positionRowNames()
    expect(names[0]).toBe('Xtrackers MSCI World ausschuettend')
  })

  it('Depotwert 0: Anteil „nicht berechenbar“, nirgends NaN', () => {
    const captured = renderDepotPage()
    let data = loadExample()
    // Alle Historien leer bis auf eine Position mit Wert 0 → Depotwert 0.
    for (const position of data.portfolioPositions) {
      data = withPositionPatched(data, position.id, {
        valueHistory:
          position.id === 'pos-ishares-gold-etc' ? [{ date: '2026-07-17', value: 0 }] : [],
      })
    }
    loadData(captured, data)
    const row = rowOf(getPositionsTable(), 'iShares Physical Gold ETC')
    expect(within(row).getByText(euroText(0))).toBeInTheDocument()
    expect(within(row).getAllByText('nicht berechenbar').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('alle World-Positionen deaktiviert: „MSCI World gesamt“ 0,00 €, Depotwert 1.502,17 (inaktive in keiner Summe)', () => {
    const captured = renderDepotPage()
    let data = loadExample()
    for (const id of ['pos-vl-ishares-world', 'pos-spdr-world-acc', 'pos-xtrackers-world-dist']) {
      data = withPositionPatched(data, id, { isActive: false })
    }
    loadData(captured, data)
    // Gruppensumme World ohne aktive World-Positionen: 0,00 € (Summe-0-Fall, nie „unbekannt“).
    expect(within(kpiTile('MSCI World gesamt')).getByText(euroText(0))).toBeInTheDocument()
    // Depotwert ohne World: 2.522,47 − 1.020,30 = 1.502,17.
    expect(
      within(kpiTile('Depotwert (aktive Positionen)')).getByText(euroText(1502.17)),
    ).toBeInTheDocument()
    expect(screen.queryByText(euroText(2522.47))).toBeNull()
    // Kachel „Aktive Positionen“: 6 − 3 = 3.
    expect(within(kpiTile('Aktive Positionen')).getByText('3')).toBeInTheDocument()
  })

  it('inaktives Depotkonto wird in der Konto-Spalte gekennzeichnet und als Hinweis gelistet', () => {
    const captured = renderDepotPage()
    const data = withAccountPatched(loadExample(), 'acc-equatex-depot', { isActive: false })
    loadData(captured, data)
    const row = rowOf(getPositionsTable(), 'Deutsche Telekom Aktien')
    expect(
      within(row).getByText('Equatex Telekom-Aktien (inaktives Konto)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Inaktive Depotkonten mit zugeordneten Positionen/),
    ).toBeInTheDocument()
  })

  it('zeigt W4-Warnungen (W_SNAPSHOT_INCOMPLETE) des geladenen Bestands gefiltert an', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample(), [
      {
        code: 'W_SNAPSHOT_INCOMPLETE',
        path: 'snapshots[0]',
        message: 'Der Snapshot vom 2026-07-17 ist unvollständig. Es fehlen Einträge für: Position "X".',
      },
      { code: 'W_EMPTY_HISTORY', path: 'accounts[0]', message: 'Anderer Hinweis.' },
    ])
    expect(screen.getByText(/Unvollständig bewertete Snapshots/)).toBeInTheDocument()
    expect(screen.getByText(/Der Snapshot vom 2026-07-17 ist unvollständig/)).toBeInTheDocument()
    // Andere Warncodes erscheinen NICHT im Depot-Warnblock.
    expect(screen.queryByText('Anderer Hinweis.')).toBeNull()
  })
})

describe('DepotPage – Hinzufügen', () => {
  it('legt eine Position an: erscheint in der Liste, Ungespeichert-Indikator im Kopfbereich', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    fireEvent.change(within(form).getByLabelText('Name *'), {
      target: { value: 'Neuer EM ETF' },
    })
    fireEvent.change(within(form).getByLabelText('Gruppe *'), { target: { value: 'em' } })
    fireEvent.change(within(form).getByLabelText('Asset-Typ'), { target: { value: 'etf' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Position anlegen' }))

    const row = rowOf(getPositionsTable(), 'Neuer EM ETF')
    expect(within(row).getByText('Emerging Markets')).toBeInTheDocument()
    expect(within(row).getByText('unbekannt')).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Position hinzufügen' })).toBeNull()
  })

  it('zeigt den Pflichtfeld-Fehler feldnah (aria-describedby/aria-invalid)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    fireEvent.click(within(form).getByRole('button', { name: 'Position anlegen' }))
    const error = within(form).getByText('Der Name darf nicht leer sein.')
    expect(error).toHaveAttribute('id', 'position-name-error')
    const input = within(form).getByLabelText('Name *')
    expect(input).toHaveAttribute('aria-describedby', 'position-name-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('warnt bei ISIN-Dublette im selben Depotkonto (kein Blocker)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    // Standard-Konto ist das erste aktive Depot-Konto (acc-tr-depot); SPDR liegt dort.
    fireEvent.change(within(form).getByLabelText('ISIN'), {
      target: { value: ' ie00bfy0gt14 ' },
    })
    expect(
      within(form).getByText(/existiert bereits eine Position mit dieser ISIN/),
    ).toBeInTheDocument()
    expect(within(form).getByText(/SPDR MSCI World thesaurierend/)).toBeInTheDocument()
  })

  it('warnt bei Dublette auf INAKTIVER Position mit Reaktivierungs-Hinweis', () => {
    const captured = renderDepotPage()
    const data = withPositionPatched(loadExample(), 'pos-spdr-world-acc', { isActive: false })
    loadData(captured, data)
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    fireEvent.change(within(form).getByLabelText('ISIN'), {
      target: { value: 'IE00BFY0GT14' },
    })
    expect(
      within(form).getByText(/inaktive Position mit gleicher ISIN existiert/),
    ).toBeInTheDocument()
    expect(within(form).getByText(/Reaktivieren statt Neuanlage prüfen/)).toBeInTheDocument()
  })

  it('Abbruch ändert nichts (kein Ungespeichert-Status, Formular geschlossen)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Verworfen' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('form', { name: 'Position hinzufügen' })).toBeNull()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
    expect(within(getPositionsTable()).queryByText('Verworfen')).toBeNull()
  })
})

describe('DepotPage – Bearbeiten', () => {
  it('ändert Name und ISIN; die Gruppe ist nur Text mit Begründung', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „iShares Physical Gold ETC“ bearbeiten' }),
    )
    const form = screen.getByRole('form', { name: 'Position bearbeiten: iShares Physical Gold ETC' })
    expect(within(form).queryByLabelText('Gruppe *')).toBeNull()
    expect(within(form).getByText(/nicht änderbar/)).toBeInTheDocument()

    fireEvent.change(within(form).getByLabelText('Name *'), {
      target: { value: 'iShares Gold ETC (neu)' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Änderungen übernehmen' }))
    expect(within(getPositionsTable()).getByText('iShares Gold ETC (neu)')).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('Zielwechsel Bearbeiten A → Bearbeiten B zeigt B-Werte (frische Formularinstanz per key)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())

    fireEvent.click(
      screen.getByRole('button', { name: 'Position „VL iShares Core MSCI World“ bearbeiten' }),
    )
    const formA = screen.getByRole('form', {
      name: 'Position bearbeiten: VL iShares Core MSCI World',
    })
    fireEvent.change(within(formA).getByLabelText('Name *'), {
      target: { value: 'Umbenannt A' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Position „iShares Physical Gold ETC“ bearbeiten' }),
    )
    const formB = screen.getByRole('form', {
      name: 'Position bearbeiten: iShares Physical Gold ETC',
    })
    expect(within(formB).getByLabelText('Name *')).toHaveValue('iShares Physical Gold ETC')
    expect(within(formB).queryByDisplayValue('Umbenannt A')).toBeNull()
  })

  it('warnt beim Bearbeiten, wenn das gewählte Depotkonto deaktiviert ist', () => {
    const captured = renderDepotPage()
    const data = withAccountPatched(loadExample(), 'acc-equatex-depot', { isActive: false })
    loadData(captured, data)
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ bearbeiten' }),
    )
    const form = screen.getByRole('form', { name: 'Position bearbeiten: Deutsche Telekom Aktien' })
    expect(within(form).getByText(/Depotkonto „Equatex Telekom-Aktien“ ist deaktiviert/)).toBeInTheDocument()
  })
})

describe('DepotPage – Deaktivieren/Aktivieren', () => {
  it('deaktiviert nach Bestätigung MIT Betragsnennung: fällt aus allen Summen', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(screen.getByText(euroText(2522.47))).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ deaktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    // Betragsnennung in der Bestätigung (zuletzt erfasster Wert).
    expect(confirmSpy.mock.calls[0][0]).toContain(formatEuro(1369.14))
    expect(confirmSpy.mock.calls[0][0]).toContain('aus allen Summen')

    const row = rowOf(getPositionsTable(), 'Deutsche Telekom Aktien')
    expect(within(row).getByText('Inaktiv')).toBeInTheDocument()
    // Depotwert ohne Telekom: 2.522,47 − 1.369,14 = 1.153,33.
    expect(screen.getByText(euroText(1153.33))).toBeInTheDocument()
    expect(screen.queryByText(euroText(2522.47))).toBeNull()

    // Reaktivieren ohne erneute Bestätigung.
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ aktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByText(euroText(2522.47))).toBeInTheDocument()
  })

  it('nennt bei fehlendem Wert „ohne erfassten Wert“ in der Bestätigung', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderDepotPage()
    const data = withPositionPatched(loadExample(), 'pos-ishares-gold-etc', { valueHistory: [] })
    loadData(captured, data)
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „iShares Physical Gold ETC“ deaktivieren' }),
    )
    expect(confirmSpy.mock.calls[0][0]).toContain('ohne erfassten Wert')
  })

  it('bricht ohne Bestätigung ab: Position bleibt aktiv', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ deaktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    const row = rowOf(getPositionsTable(), 'Deutsche Telekom Aktien')
    expect(within(row).getByText('Aktiv')).toBeInTheDocument()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('DepotPage – Wert aktualisieren (strenges de-DE-Parsing)', () => {
  function openValueForm(): HTMLElement {
    fireEvent.click(
      screen.getByRole('button', { name: 'Wert von „iShares Physical Gold ETC“ aktualisieren' }),
    )
    return screen.getByRole('form', { name: 'Wert aktualisieren: iShares Physical Gold ETC' })
  }

  it.each([
    ['1.234', 1234],
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['0,01', 0.01],
  ])('akzeptiert "%s" als %d € (Tausenderpunkt/Dezimalkomma)', (text, expected) => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openValueForm()
    fireEvent.change(within(form).getByLabelText('Wert in Euro *'), { target: { value: text } })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const history = captured.current!.state.data!.portfolioPositions.find(
      (position) => position.id === 'pos-ishares-gold-etc',
    )!.valueHistory
    expect(history[history.length - 1]).toMatchObject({ date: '2026-08-01', value: expected })
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })

  it('lehnt "12.34" ab (kein de-DE-Format) – Feldfehler, nichts gespeichert', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openValueForm()
    fireEvent.change(within(form).getByLabelText('Wert in Euro *'), {
      target: { value: '12.34' },
    })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    expect(within(form).getByText(/gültigen Betrag/)).toBeInTheDocument()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('lehnt negative Werte am Betragsfeld und gesperrte/fehlende Daten am Datumsfeld ab', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openValueForm()

    // Negativer Wert (DM20) → Fehler neben dem Betragsfeld.
    fireEvent.change(within(form).getByLabelText('Wert in Euro *'), { target: { value: '-5' } })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const amountError = within(form).getByText(/nicht negativ/)
    expect(amountError).toHaveAttribute('id', 'position-value-amount-error')
    expect(within(form).getByLabelText('Wert in Euro *')).toHaveAttribute(
      'aria-describedby',
      'position-value-amount-error',
    )

    // Gesperrtes Snapshot-Datum (DM21) → Fehler neben dem Datumsfeld.
    fireEvent.change(within(form).getByLabelText('Wert in Euro *'), { target: { value: '40' } })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-17' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const dateError = within(form).getByText(/gesperrten Snapshot/)
    expect(dateError).toHaveAttribute('id', 'position-value-date-error')

    // Fehlendes Datum → verständlicher Feldfehler.
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    expect(within(form).getByText('Bitte ein Datum wählen.')).toBeInTheDocument()

    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('Abbruch der Wert-Erfassung verändert keine Daten (Historie unverändert, kein Dirty)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openValueForm()
    fireEvent.change(within(form).getByLabelText('Wert in Euro *'), {
      target: { value: '99,99' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }))
    expect(
      screen.queryByRole('form', { name: 'Wert aktualisieren: iShares Physical Gold ETC' }),
    ).toBeNull()
    // Die Historie ist exakt der Seed-Stand geblieben – der eingegebene Wert wurde verworfen.
    const gold = captured.current!.state.data!.portfolioPositions.find(
      (position) => position.id === 'pos-ishares-gold-etc',
    )!
    expect(gold.valueHistory).toEqual([{ date: '2026-07-17', value: 33.92 }])
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('DepotPage – Snapshot-Vollerfassung', () => {
  const POSITION_LABELS = [
    'VL iShares Core MSCI World (Euro) *',
    'SPDR MSCI World thesaurierend (Euro) *',
    'Xtrackers MSCI World ausschuettend (Euro) *',
    'iShares MSCI EM IMI (Euro) *',
    'iShares Physical Gold ETC (Euro) *',
    'Deutsche Telekom Aktien (Euro) *',
  ]

  function openSnapshotForm(): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: 'Snapshot erfassen' }))
    return screen.getByRole('form', { name: 'Snapshot erfassen' })
  }

  it('vollständige Erfassung: Erfolgsmeldung, Registry-Eintrag, Dirty-Status', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-18' } })
    // Am neuen Datum ist nichts vorerfasst: alle Felder als „fehlt“ markiert.
    expect(within(form).getAllByText('⚠ fehlt')).toHaveLength(7)
    POSITION_LABELS.forEach((label, index) => {
      fireEvent.change(within(form).getByLabelText(label), {
        target: { value: `${100 + index},50` },
      })
    })
    fireEvent.change(within(form).getByLabelText('Volkswagen Bank Tagesgeld (Euro) *'), {
      target: { value: '650,75' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Snapshot übernehmen' }))

    expect(
      screen.getByText(/Snapshot vom 18\.07\.2026 übernommen und gesperrt/),
    ).toBeInTheDocument()
    // Klarstellung: „übernommen“ heißt Arbeitsstand – in die Datei erst über den Kopfbereich.
    expect(
      screen.getByText(/In deine Datei gelangt er erst über die Speichern-Schaltfläche oben/),
    ).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
    const data = captured.current!.state.data!
    expect(data.snapshots).toHaveLength(2)
    expect(data.snapshots[1]).toMatchObject({
      date: '2026-07-18',
      locked: true,
      source: 'user',
    })
    expect(screen.queryByRole('form', { name: 'Snapshot erfassen' })).toBeNull()
  })

  it('unvollständige Erfassung: Fehlermeldung mit fehlenden Namen, keine stillen 0-Werte', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-18' } })
    // Nur zwei Felder füllen – der Rest bleibt leer.
    fireEvent.change(within(form).getByLabelText(POSITION_LABELS[0]), {
      target: { value: '580' },
    })
    fireEvent.change(within(form).getByLabelText('Volkswagen Bank Tagesgeld (Euro) *'), {
      target: { value: '650' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Snapshot übernehmen' }))

    // Seit dem A11y-Fix B3 gibt es MEHRERE Alerts: die Sammel-Fehlermeldung plus
    // feldnahe Fehler je unausgefülltem Feld (aria-invalid + role="alert").
    const alerts = within(form).getAllByRole('alert')
    const summary = alerts.find((alert) => alert.textContent!.includes('unvollständig'))!
    expect(summary).toBeDefined()
    expect(summary.textContent).toContain('iShares Physical Gold ETC')
    expect(summary.textContent).toContain('Deutsche Telekom Aktien')
    expect(summary.textContent).toContain('nicht als 0 gespeichert')
    // Feldnahe Zuordnung: das leere Gold-Feld ist als ungültig markiert und trägt
    // eine eigene Fehlermeldung; das ausgefüllte erste Feld nicht.
    const goldInput = within(form).getByLabelText('iShares Physical Gold ETC (Euro) *')
    expect(goldInput).toHaveAttribute('aria-invalid', 'true')
    expect(alerts.some((alert) => alert.textContent!.includes('Wert fehlt'))).toBe(true)
    expect(within(form).getByLabelText(POSITION_LABELS[0])).not.toHaveAttribute('aria-invalid')

    // Nichts wurde übernommen: kein Snapshot, keine neuen Einträge, kein Dirty.
    const data = captured.current!.state.data!
    expect(data.snapshots).toHaveLength(1)
    const gold = data.portfolioPositions.find(
      (position) => position.id === 'pos-ishares-gold-etc',
    )!
    expect(gold.valueHistory).toEqual([{ date: '2026-07-17', value: 33.92 }])
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('Seed-Datum: Vorbelegung „bereits erfasst – wird ersetzt“, Übernehmen verständlich abgelehnt', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-17' } })
    // Alle 7 Einträge existieren am Seed-Datum → Vorbelegung + Kennzeichnung.
    expect(within(form).getAllByText('ℹ bereits erfasst – wird ersetzt')).toHaveLength(7)
    expect(within(form).getByLabelText('Volkswagen Bank Tagesgeld (Euro) *')).toHaveValue('627,59')
    expect(within(form).getByLabelText('Deutsche Telekom Aktien (Euro) *')).toHaveValue('1.369,14')

    fireEvent.click(within(form).getByRole('button', { name: 'Snapshot übernehmen' }))
    const error = within(form).getByRole('alert')
    expect(error.textContent).toContain('gesperrten Snapshot')
    expect(captured.current!.state.data!.snapshots).toHaveLength(1)
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('zeigt den Sperr-Hinweis („dauerhaft gesperrt, Korrekturen nur als neuer Snapshot“)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    expect(
      within(form).getByText(
        /Nach „Snapshot übernehmen“ ist das Datum dauerhaft gesperrt; Korrekturen nur als neuer Snapshot mit neuem Datum/,
      ),
    ).toBeInTheDocument()
  })

  it('Abbruch der Snapshot-Erfassung verändert keine Daten (kein Registry-Eintrag, keine Historieneinträge, kein Dirty)', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-18' } })
    // Teilweise ausfüllen und dann bewusst abbrechen.
    fireEvent.change(within(form).getByLabelText(POSITION_LABELS[0]), {
      target: { value: '580' },
    })
    fireEvent.change(within(form).getByLabelText('Volkswagen Bank Tagesgeld (Euro) *'), {
      target: { value: '650,75' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('form', { name: 'Snapshot erfassen' })).toBeNull()

    const data = captured.current!.state.data!
    // Registry unverändert (nur der Seed-Snapshot), keine neuen Einträge am 2026-07-18.
    expect(data.snapshots).toHaveLength(1)
    const vl = data.portfolioPositions.find(
      (position) => position.id === 'pos-vl-ishares-world',
    )!
    expect(vl.valueHistory).toEqual([{ date: '2026-07-17', value: 577.99 }])
    const vw = data.accounts.find((account) => account.id === 'acc-vw-tagesgeld')!
    expect(vw.balanceHistory).toEqual([{ date: '2026-07-17', amount: 627.59 }])
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('rückdatierter Snapshot: Hinweis am Datumsfeld; Abbruch der Bestätigung speichert nichts, Bestätigung speichert und sperrt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const form = openSnapshotForm()
    // 2026-07-16 liegt VOR dem jüngsten Snapshot (Seed 2026-07-17) → sichtbarer Hinweis.
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-16' } })
    expect(
      within(form).getByText(/Das gewählte Datum liegt vor dem jüngsten Snapshot/),
    ).toBeInTheDocument()

    POSITION_LABELS.forEach((label, index) => {
      fireEvent.change(within(form).getByLabelText(label), {
        target: { value: `${100 + index},50` },
      })
    })
    fireEvent.change(within(form).getByLabelText('Volkswagen Bank Tagesgeld (Euro) *'), {
      target: { value: '650,75' },
    })

    // 1) Bestätigung abgelehnt → NICHTS wird gespeichert, das Formular bleibt offen.
    fireEvent.click(within(form).getByRole('button', { name: 'Snapshot übernehmen' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toContain('16.07.2026')
    expect(confirmSpy.mock.calls[0][0]).toContain('rückdatiert')
    expect(captured.current!.state.data!.snapshots).toHaveLength(1)
    expect(screen.getByRole('form', { name: 'Snapshot erfassen' })).toBeInTheDocument()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()

    // 2) Bestätigung angenommen → Snapshot am 2026-07-16 gespeichert, locked, source "user".
    confirmSpy.mockReturnValue(true)
    fireEvent.click(within(form).getByRole('button', { name: 'Snapshot übernehmen' }))
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    const data = captured.current!.state.data!
    expect(data.snapshots).toHaveLength(2)
    expect(data.snapshots[1]).toMatchObject({
      id: 'snap-2026-07-16',
      date: '2026-07-16',
      locked: true,
      source: 'user',
    })
    expect(
      screen.getByText(/Snapshot vom 16\.07\.2026 übernommen und gesperrt/),
    ).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })
})

describe('DepotPage – Zielvergleich (nur Anzeige)', () => {
  it('Standard-Vergleichsprofil ist das erste befüllte holdings-Profil (tp-job); Stufen nach F14', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(screen.getByLabelText('Vergleichsprofil')).toHaveValue('tp-job')
    const table = getComparisonTable()

    // Telekom: +44,28 Pp → Empfehlung inkl. Verkaufsoption; Verkaufsbedarf 1.116,89 (F16).
    const telekomRow = rowOf(table, 'Deutsche Telekom Aktien')
    expect(within(telekomRow).getByText(/\+44,28 Pp/)).toBeInTheDocument()
    expect(within(telekomRow).getByText('Empfehlung inkl. Verkaufsoption')).toBeInTheDocument()
    expect(within(telekomRow).getByText(euroText(1116.89))).toBeInTheDocument()

    // EM: −11,07 Pp → NUR „Empfehlung“ (Untergewichtung: nie Verkaufsoption); Kaufbedarf 279,26 (F15).
    const emRow = rowOf(table, 'iShares MSCI EM IMI')
    expect(within(emRow).getByText(/11,07 Pp/)).toBeInTheDocument()
    expect(within(emRow).getByText('Empfehlung')).toBeInTheDocument()
    expect(within(emRow).queryByText('Empfehlung inkl. Verkaufsoption')).toBeNull()
    expect(within(emRow).getByText(euroText(279.26))).toBeInTheDocument()

    // Gold: −3,66 Pp → unter der 5-Pp-Schwelle: keine Empfehlung („–“).
    const goldRow = rowOf(table, 'iShares Physical Gold ETC')
    expect(within(goldRow).getByText(/3,66 Pp/)).toBeInTheDocument()
    expect(within(goldRow).queryByText(/Empfehlung/)).toBeNull()
  })

  it('Cent-Rundung ohne versteckte Differenzen: Kauf 577,11 + 625,23 + 279,26 + 92,20 = Verkauf 1.116,89 + 456,91 = 1.573,80', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const table = getComparisonTable()

    // VL: Ist 22,91365 % vs. Ziel 4,8 % → +18,11 Pp (≥ 10) → Verkaufsoption;
    // Verkaufsbedarf 577,99 − 121,07856 = 456,91144 → Anzeige 456,91.
    const vlRow = rowOf(table, 'VL iShares Core MSCI World')
    expect(within(vlRow).getByText(/\+18,11 Pp/)).toBeInTheDocument()
    expect(within(vlRow).getByText('Empfehlung inkl. Verkaufsoption')).toBeInTheDocument()
    expect(within(vlRow).getByText(euroText(456.91))).toBeInTheDocument()

    // Kaufbedarf (F15, intern ungerundet, Anzeige auf Cent):
    // Xtrackers 781,9657 − 204,86 = 577,1057 → 577,11.
    expect(
      within(rowOf(table, 'Xtrackers MSCI World ausschuettend')).getByText(euroText(577.11)),
    ).toBeInTheDocument()
    // SPDR 862,68474 − 237,45 = 625,23474 → 625,23.
    expect(
      within(rowOf(table, 'SPDR MSCI World thesaurierend')).getByText(euroText(625.23)),
    ).toBeInTheDocument()
    // EM 378,3705 − 99,11 = 279,2605 → 279,26.
    expect(
      within(rowOf(table, 'iShares MSCI EM IMI')).getByText(euroText(279.26)),
    ).toBeInTheDocument()
    // Gold 126,1235 − 33,92 = 92,2035 → 92,20.
    expect(
      within(rowOf(table, 'iShares Physical Gold ETC')).getByText(euroText(92.2)),
    ).toBeInTheDocument()
    // Telekom-Verkauf 1.369,14 − 252,247 = 1.116,893 → 1.116,89.
    expect(
      within(rowOf(table, 'Deutsche Telekom Aktien')).getByText(euroText(1116.89)),
    ).toBeInTheDocument()

    // Keine versteckte Differenz: die ANGEZEIGTEN (centgerundeten) Beträge summieren sich
    // beidseitig auf 1.573,80 – exakt die Cent-Rundung der ungerundeten 1.573,80444 (F19).
    expect(577.11 + 625.23 + 279.26 + 92.2).toBeCloseTo(1573.8, 9)
    expect(1116.89 + 456.91).toBeCloseTo(1573.8, 9)
  })

  it('Depotwert 0: Zielvergleich zeigt den F20-Hinweis statt einer Tabelle', () => {
    const captured = renderDepotPage()
    let data = loadExample()
    // Alle Historien leer bis auf eine Position mit Wert 0 → Depotwert 0.
    for (const position of data.portfolioPositions) {
      data = withPositionPatched(data, position.id, {
        valueHistory:
          position.id === 'pos-ishares-gold-etc' ? [{ date: '2026-07-17', value: 0 }] : [],
      })
    }
    loadData(captured, data)
    expect(
      screen.getByText(/Der Depotwert ist 0 – Anteile und Zielwerte sind nicht berechenbar/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Zielvergleich' })).toBeNull()
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('leeres Profil → „Profil nicht befüllt“; die Auswahl ändert das aktive Profil nicht', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.change(screen.getByLabelText('Vergleichsprofil'), {
      target: { value: 'tp-student-bestand' },
    })
    expect(screen.getByText(/Profil nicht befüllt/)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Zielvergleich' })).toBeNull()
    // Nur Anzeige: activeTargetProfileId bleibt unverändert, kein Dirty.
    expect(captured.current!.state.data!.settings.activeTargetProfileId).toBe(
      'tp-student-sparplan',
    )
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })

  it('zeigt den Pflicht-Hinweis „rein informativ“ an', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    expect(
      screen.getByText(
        'Empfehlungen sind rein informativ – Finance OS führt niemals automatisch Käufe, Verkäufe oder Sparplanänderungen aus.',
      ),
    ).toBeInTheDocument()
  })
})

describe('DepotPage – Darstellung (Button-Hierarchie, Zahlenspalten, Plaketten)', () => {
  it('Toolbar: „Position hinzufügen“ primär mit Icon, „Snapshot erfassen“ sekundär', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const add = screen.getByRole('button', { name: 'Position hinzufügen' })
    expect(add).toHaveClass('btn-primary')
    // Das Icon ist rein dekorativ – der Accessible Name bleibt der sichtbare Text.
    expect(add.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Snapshot erfassen' })).not.toHaveClass('btn-primary')
    // Die Toolbar steht vor den Kennzahlen (direkt unter dem Einleitungstext).
    const kpis = kpiTile('Depotwert (aktive Positionen)')
    expect(add.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('Deaktivieren ist als Gefahr-Aktion markiert, Aktivieren nicht (zustandsabhängig)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const deactivate = screen.getByRole('button', {
      name: 'Position „Deutsche Telekom Aktien“ deaktivieren',
    })
    expect(deactivate).toHaveClass('btn-danger')
    expect(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ bearbeiten' }),
    ).not.toHaveClass('btn-danger')
    fireEvent.click(deactivate)
    expect(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ aktivieren' }),
    ).not.toHaveClass('btn-danger')
  })

  it('Zahlenspalten rechtsbündig (num auf th + td) in Positionsliste und Zielvergleich', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const positionsTable = getPositionsTable()
    for (const header of ['Anteil am Depot', 'Anteil am Gesamtvermögen']) {
      expect(within(positionsTable).getByRole('columnheader', { name: header })).toHaveClass('num')
    }
    expect(
      within(positionsTable).getByRole('button', { name: 'Aktueller Wert ▼' }).closest('th'),
    ).toHaveClass('num')
    const telekomRow = rowOf(positionsTable, 'Deutsche Telekom Aktien')
    expect(within(telekomRow).getByText(euroText(1369.14))).toHaveClass('num')
    expect(within(telekomRow).getByText('54,28 %')).toHaveClass('num')
    // Datum und Text bleiben linksbündig.
    expect(within(telekomRow).getByText('17.07.2026')).not.toHaveClass('num')

    const comparison = getComparisonTable()
    for (const header of [
      'Ziel-%',
      'Ist-Wert',
      'Ist-%',
      'Abweichung (Pp)',
      'Kaufbedarf',
      'Verkaufsbedarf',
    ]) {
      expect(within(comparison).getByRole('columnheader', { name: header })).toHaveClass('num')
    }
    const levelHeader = within(comparison).getByRole('columnheader', { name: 'Handlungsstufe' })
    expect(levelHeader).not.toHaveClass('num')
    const telekomTarget = rowOf(comparison, 'Deutsche Telekom Aktien')
    expect(within(telekomTarget).getByText(euroText(1116.89))).toHaveClass('num')
    expect(within(telekomTarget).getByText(/\+44,28 Pp/)).toHaveClass('num')
  })

  it('Status und Handlungsstufe als Plakette – Text unverändert, „–“ ohne Plakette', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const positionsTable = getPositionsTable()
    expect(
      within(rowOf(positionsTable, 'Deutsche Telekom Aktien')).getByText('Aktiv'),
    ).toHaveClass('badge', 'badge--ok')

    const comparison = getComparisonTable()
    expect(
      within(rowOf(comparison, 'Deutsche Telekom Aktien')).getByText(
        'Empfehlung inkl. Verkaufsoption',
      ),
    ).toHaveClass('badge', 'badge--warn')
    expect(within(rowOf(comparison, 'iShares MSCI EM IMI')).getByText('Empfehlung')).toHaveClass(
      'badge',
      'badge--info',
    )
    // Gold: keine Handlungsstufe → schlichter Strich, keine Plakette.
    const goldRow = rowOf(comparison, 'iShares Physical Gold ETC')
    expect(goldRow.querySelector('.badge')).toBeNull()

    // Inaktiv: neutrale Plakette (ohne Farb-Modifier), Text exakt „Inaktiv“.
    fireEvent.click(
      screen.getByRole('button', { name: 'Position „Deutsche Telekom Aktien“ deaktivieren' }),
    )
    const inactive = within(rowOf(getPositionsTable(), 'Deutsche Telekom Aktien')).getByText(
      'Inaktiv',
    )
    expect(inactive).toHaveClass('badge')
    expect(inactive).not.toHaveClass('badge--ok')
  })
})

describe('DepotPage – Tastatur und Fokus (Phase E)', () => {
  it('fokussiert nach dem Öffnen das erste Feld; Escape schließt und gibt den Fokus zurück', () => {
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    const trigger = screen.getByRole('button', { name: 'Position hinzufügen' })
    fireEvent.click(trigger)
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    expect(within(form).getByLabelText('Name *')).toHaveFocus()

    fireEvent.keyDown(form, { key: 'Escape' })
    expect(screen.queryByRole('form', { name: 'Position hinzufügen' })).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('Escape aus einem Select des Formulars (Popup-Bubbling) schließt das Formular NICHT', () => {
    // Echtbrowser-Fall: Escape schließt das native Select-Popup, das keydown
    // bubbelt aber zur Section – das Formular muss offen bleiben.
    const captured = renderDepotPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Position hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Position hinzufügen' })
    const firstSelect = within(form).getAllByRole('combobox')[0]
    fireEvent.keyDown(firstSelect, { key: 'Escape' })
    expect(screen.getByRole('form', { name: 'Position hinzufügen' })).toBeInTheDocument()
  })
})
