/**
 * UI-Tests des Moduls „Sparpläne und Zuflüsse“ (M10): Summen (real/geglättet,
 * Jahressicht, Monats-Realsicht), Liste inkl. Filter/Sortierung/Statusgruppen,
 * Formulare (A→B-Wechsel, Abbruch, unverändertes Speichern, deutsche Beträge),
 * Pausieren/Beenden mit Bestätigung, 1.000-€-Sparziel (U3), F10-Referenz und
 * Datenqualität (keine technischen IDs, kein NaN, G11).
 * Muster wie tests/pages/dashboardPage.test.tsx (echter Provider + Capture +
 * LOAD_SUCCEEDED mit loadExample()); Stichtag injiziert über FIXED_NOW.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { AppLayout } from '../../src/layout/AppLayout'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { FinanceData } from '../../src/types/finance'
import { formatEuro } from '../../src/format/money'
import { loadExample } from '../storage/fixtures'

const NOW_ISO = '2026-07-19T10:30:00.000Z'
const FIXED_NOW = () => new Date(NOW_ISO)

/** formatEuro nutzt geschützte Leerzeichen; der RTL-Normalizer kollabiert sie. */
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

function renderPage(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <AppLayout initialPage="sparplaene" />
      <Capture into={captured} />
    </FinanceDataProvider>,
  )
  return captured
}

function loadData(captured: Captured, data: FinanceData): void {
  act(() => {
    captured.current!.dispatch({
      type: 'LOAD_SUCCEEDED',
      data,
      fileName: 'finance-data.json',
      handle: null,
      warnings: [],
    })
  })
}

function sumsRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Summen' })
}

function goalRegion(): HTMLElement {
  // Überschrift kommt aus den DATEN (goal.name des Seeds), nie hartkodiert (K4).
  return screen.getByRole('region', { name: 'Sparziel „Monatlich 1.000 EUR Sparrate“' })
}

function f10Region(): HTMLElement {
  return screen.getByRole('region', {
    name: 'Referenzverteilung der Sparraten (F10, nur Orientierung)',
  })
}

function listRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Sparplanliste' })
}

/** KPI-Kachel innerhalb der Summen-Sektion über ihren dt-Text finden. */
function kpiTile(label: string): HTMLElement {
  const tile = within(sumsRegion()).getByText(label).closest('.kpi-tile')
  if (!(tile instanceof HTMLElement)) throw new Error(`Keine KPI-Kachel für "${label}" gefunden.`)
  return tile
}

/** Wert (dd) einer Fakten-Zeile über ihren dt-Text finden. */
function factValue(region: HTMLElement, label: string): string {
  const term = within(region).getByText(label)
  const value = term.nextElementSibling
  if (!(value instanceof HTMLElement)) throw new Error(`Kein Wert für "${label}" gefunden.`)
  return (value.textContent ?? '').replace(/\s/g, ' ')
}

function planTable(): HTMLElement {
  return within(listRegion()).getByRole('table')
}

function bodyRowCount(): number {
  // Alle Zeilen minus Kopfzeile.
  return within(planTable()).getAllByRole('row').length - 1
}

function withPlanPatched(
  data: FinanceData,
  planId: string,
  patch: Record<string, unknown>,
): FinanceData {
  return {
    ...data,
    savingsPlans: data.savingsPlans.map((plan) =>
      plan.id === planId ? { ...plan, ...patch } : plan,
    ),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SavingsPlansPage – Leerzustände', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Sparpläne' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zu „Daten & Backups“' })).toBeInTheDocument()
  })

  it('Bestand ohne Sparpläne: verständlicher Leerzustand mit nächstem Schritt', () => {
    const captured = renderPage()
    loadData(captured, { ...loadExample(), savingsPlans: [] })
    expect(screen.getByText(/noch keine Sparpläne/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sparplan hinzufügen' })).toBeInTheDocument()
  })
})

describe('SavingsPlansPage – Summen (Seed)', () => {
  it('KPIs: eigen 118,50/201,83; extern 6,50/48,17; gesamt 125,00/250,00 – geglättet gekennzeichnet', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(within(kpiTile('Eigene Sparleistung (real)')).getByText(euroText(118.5))).toBeInTheDocument()
    expect(
      within(kpiTile('Eigene Sparleistung – geglättet (Analysewert)')).getByText(euroText(201.83)),
    ).toBeInTheDocument()
    expect(within(kpiTile('Externe Zuflüsse (real)')).getByText(euroText(6.5))).toBeInTheDocument()
    expect(
      within(kpiTile('Externe Zuflüsse – geglättet (Analysewert)')).getByText(euroText(48.17)),
    ).toBeInTheDocument()
    expect(within(kpiTile('Gesamtzufluss (real)')).getByText(euroText(125))).toBeInTheDocument()
    expect(
      within(kpiTile('Gesamtzufluss – geglättet (Analysewert)')).getByText(euroText(250)),
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('Monats-Realsicht Juli 2026: 1.625,00 (inkl. Telekom-Jahresfälligkeiten), klar beschriftet', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const tile = kpiTile('Monats-Realsicht Juli 2026')
    expect(within(tile).getByText(euroText(1625))).toBeInTheDocument()
    expect(within(tile).getByText(/nicht die monatliche Sparrate/)).toBeInTheDocument()
  })

  it('Jahreswerte: eigen 2.422,00, extern 578,00, gesamt 3.000,00; Anzeige-Rundung 0,04 sichtbar (F19)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const region = sumsRegion()
    expect(factValue(region, 'Jahresbetrag eigen')).toBe(euroText(2422))
    expect(factValue(region, 'Jahresbetrag extern')).toBe(euroText(578))
    expect(factValue(region, 'Jahresbetrag gesamt')).toBe(euroText(3000))
    expect(within(region).getByText(/Anzeige-Rundung \(F19\)/)).toBeInTheDocument()
    expect(within(region).getByText(/0,04/)).toBeInTheDocument()
  })

  it('Umbuchungen als eigene informative Zeile (75,00 €/Monat, keine Sparleistung); variable Pläne als Hinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(factValue(sumsRegion(), 'Umbuchungen (keine Sparleistung)')).toContain(euroText(75))
    expect(
      within(sumsRegion()).getByText(/zzgl. variable Zuflüsse \(nicht garantiert\)/),
    ).toBeInTheDocument()
    const variableHint = screen.getByText(/Variable Pläne ohne garantierten Betrag/)
    expect(variableHint.textContent).toContain('TR Saveback in Gold, TR Round-up in Gold')
  })

  it('Gruppierung nach Ziel und Herkunft (geglättet, Analysewert): VL-Ziel 40,00; Telekom 125,00; eigen 201,83', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const region = sumsRegion()
    expect(factValue(region, 'VL iShares Core MSCI World (Position)')).toBe(euroText(40))
    expect(factValue(region, 'Deutsche Telekom Aktien (Position)')).toBe(euroText(125))
    expect(factValue(region, 'Volkswagen Bank Tagesgeld (Konto)')).toBe(euroText(25))
    expect(factValue(region, 'eigen')).toBe(euroText(201.83))
    expect(factValue(region, 'extern')).toBe(euroText(48.17))
  })

  it('G11: nur variable Pläne → Summen „unbekannt“, nie eine leere 0', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      savingsPlans: data.savingsPlans.filter(
        (plan) => plan.id === 'sp-tr-saveback' || plan.id === 'sp-tr-roundup',
      ),
    })
    expect(within(kpiTile('Eigene Sparleistung (real)')).getByText('unbekannt')).toBeInTheDocument()
    expect(within(kpiTile('Externe Zuflüsse (real)')).getByText('unbekannt')).toBeInTheDocument()
    expect(within(kpiTile('Gesamtzufluss (real)')).getByText('unbekannt')).toBeInTheDocument()
    expect(within(kpiTile('Eigene Sparleistung (real)')).queryByText(euroText(0))).toBeNull()
  })
})

describe('SavingsPlansPage – Liste, Filter, Sortierung', () => {
  it('zeigt alle 12 Seed-Pläne ohne technische IDs; variable Beträge als „variabel (nicht garantiert)“', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(bodyRowCount()).toBe(12)
    expect(screen.getByRole('rowheader', { name: 'VL Eigenanteil' })).toBeInTheDocument()
    expect(within(planTable()).getAllByText('variabel (nicht garantiert)')).toHaveLength(2)
    // Endnutzertexte ohne technische IDs und ohne NaN.
    expect(document.body.textContent).not.toContain('sp-')
    expect(document.body.textContent).not.toContain('acc-')
    expect(document.body.textContent).not.toContain('pos-')
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('Filter Herkunft „eigen“ → 8 Pläne; „einmalig“ ohne Treffer → Leerzustand mit „Filter zurücksetzen“', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const eigenButton = within(listRegion()).getByRole('button', { name: 'eigen' })
    fireEvent.click(eigenButton)
    expect(eigenButton).toHaveAttribute('aria-pressed', 'true')
    expect(bodyRowCount()).toBe(8)
    fireEvent.click(eigenButton) // Filter wieder lösen
    fireEvent.click(within(listRegion()).getByRole('button', { name: 'einmalig' }))
    expect(
      within(listRegion()).getByText(/Kein Sparplan entspricht den gewählten Filtern/),
    ).toBeInTheDocument()
    // Bei leerem Filterergebnis existiert der Zurücksetzen-Button doppelt
    // (Filterleiste + Leerzustand) – beide führen zum selben Ergebnis.
    fireEvent.click(
      within(listRegion()).getAllByRole('button', { name: 'Filter zurücksetzen' })[0],
    )
    expect(bodyRowCount()).toBe(12)
  })

  it('Filter Zieltyp „Konto“ → 2 Pläne (VW-Tagesgeld + ING-Umbuchung)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(within(listRegion()).getByRole('button', { name: 'Konto' }))
    expect(bodyRowCount()).toBe(2)
    expect(screen.getByRole('rowheader', { name: 'Tagesgeld-Sparrate VW Bank' })).toBeInTheDocument()
    expect(
      screen.getByRole('rowheader', { name: 'Ruecklagenuebertragung ING Shares2you' }),
    ).toBeInTheDocument()
  })

  it('Sortier-Buttons setzen aria-sort am Header (Name auf-/absteigend)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const nameButton = within(planTable()).getByRole('button', { name: 'Name' })
    fireEvent.click(nameButton)
    const nameHeader = nameButton.closest('th')
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    fireEvent.click(within(planTable()).getByRole('button', { name: /Name/ }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('inaktives Ziel: sichtbare Warnung in Liste und Datenqualität (Namen, keine IDs)', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) =>
        position.id === 'pos-ishares-gold-etc' ? { ...position, isActive: false } : position,
      ),
    })
    expect(within(planTable()).getAllByText('⚠ Ziel inaktiv').length).toBeGreaterThanOrEqual(3)
    expect(
      screen.getByText(
        '⚠ „TR Sparplan Physical Gold“: Das Ziel „iShares Physical Gold ETC“ ist deaktiviert – Zuflüsse zählen in keine aktive Summe.',
      ),
    ).toBeInTheDocument()
  })
})

describe('SavingsPlansPage – Pausieren, Reaktivieren, Beenden (Bestätigung)', () => {
  it('Pausieren nach Bestätigung: Status „Pausiert“, KPIs sinken, Dirty-State gesetzt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(
      screen.getByRole('button', { name: 'Sparplan „TR Sparplan Physical Gold“ pausieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(confirmSpy.mock.calls[0][0]).toContain('TR Sparplan Physical Gold')
    expect(within(planTable()).getByText('⏸ Pausiert')).toBeInTheDocument()
    // 118,50 − 5,00 = 113,50: pausierte Pläne zählen in keine Kennzahl.
    expect(within(kpiTile('Eigene Sparleistung (real)')).getByText(euroText(113.5))).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Sparplan „TR Sparplan Physical Gold“ reaktivieren' }),
    ).toBeInTheDocument()
  })

  it('abgebrochene Bestätigung ändert nichts (kein Dirty-State)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(
      screen.getByRole('button', { name: 'Sparplan „TR Sparplan Physical Gold“ pausieren' }),
    )
    expect(captured.current!.state.isDirty).toBe(false)
    expect(within(planTable()).queryByText('⏸ Pausiert')).toBeNull()
  })

  it('Beenden nach Bestätigung: Enddatum = Stichtag (19.07.2026) erscheint in der Zeile', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(
      screen.getByRole('button', { name: 'Sparplan „TR Sparplan Physical Gold“ beenden' }),
    )
    expect(confirmSpy.mock.calls[0][0]).toContain('19.07.2026')
    const row = screen.getByRole('rowheader', { name: 'TR Sparplan Physical Gold' }).closest('tr')!
    expect(within(row as HTMLElement).getAllByText('19.07.2026').length).toBeGreaterThanOrEqual(2)
    expect(captured.current!.state.isDirty).toBe(true)
  })
})

describe('SavingsPlansPage – Formulare', () => {
  it('Hinzufügen mit deutschem Betrag „1.234“ = 1234 €: neue Zeile + Dirty-State', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Neuer ETF Plan' } })
    fireEvent.change(screen.getByLabelText('Betrag in Euro *'), { target: { value: '1.234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const row = screen.getByRole('rowheader', { name: 'Neuer ETF Plan' }).closest('tr')!
    // Betrag erscheint in der Zeile (Betrags- UND Geglättet-Spalte bei monatlich).
    expect(within(row as HTMLElement).getAllByText(euroText(1234)).length).toBeGreaterThan(0)
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('deutsche Beträge „1.234,56“, „1234,56“ und „0,01“ werden korrekt geparst', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    for (const [text, expected, name] of [
      ['1.234,56', 1234.56, 'Plan A'],
      ['1234,56', 1234.56, 'Plan B'],
      ['0,01', 0.01, 'Plan C'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
      fireEvent.change(screen.getByLabelText('Name *'), { target: { value: name } })
      fireEvent.change(screen.getByLabelText('Betrag in Euro *'), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
      const row = screen.getByRole('rowheader', { name }).closest('tr')!
      expect(within(row as HTMLElement).getAllByText(euroText(expected)).length).toBeGreaterThan(0)
    }
  })

  it('ungültige und negative Beträge: feldnaher Fehler, kein Dirty-State', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Fehlerplan' } })
    const amountInput = screen.getByLabelText('Betrag in Euro *')
    fireEvent.change(amountInput, { target: { value: '12.34' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(
      screen.getByText('Bitte einen gültigen Betrag eingeben (z. B. 250,00 oder 1.234,56).'),
    ).toBeInTheDocument()
    expect(amountInput).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(amountInput, { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText('Der Betrag darf nicht negativ sein.')).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Enddatum vor Startdatum: feldnaher Fehler am Enddatum', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Datumsfehler' } })
    fireEvent.change(screen.getByLabelText('Betrag in Euro *'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Startdatum *'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Enddatum (optional)'), {
      target: { value: '2026-07-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText('Das Enddatum darf nicht vor dem Startdatum liegen.')).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('A→B-Wechsel: das Bearbeiten-Formular übernimmt NIE den Zustand des vorherigen Plans (key)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan „VL Eigenanteil“ bearbeiten' }))
    const nameInput = screen.getByLabelText('Name *')
    expect(nameInput).toHaveValue('VL Eigenanteil')
    fireEvent.change(nameInput, { target: { value: 'Umbenannt aber nicht gespeichert' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Sparplan „TR Sparplan SPDR World“ bearbeiten' }),
    )
    expect(screen.getByLabelText('Name *')).toHaveValue('TR Sparplan SPDR World')
  })

  it('Abbrechen verwirft Änderungen ohne applyDataChange (kein Dirty-State)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan „VL Eigenanteil“ bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Anderer Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(captured.current!.state.isDirty).toBe(false)
    expect(screen.getByRole('rowheader', { name: 'VL Eigenanteil' })).toBeInTheDocument()
    expect(screen.queryByRole('rowheader', { name: 'Anderer Name' })).toBeNull()
  })

  it('unverändertes Speichern löst KEIN applyDataChange aus (Vergleich vor Übernahme)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan „VL Eigenanteil“ bearbeiten' }))
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(captured.current!.state.isDirty).toBe(false)
    // Formular ist geschlossen (Speichern ohne Änderung ist ein stiller Abschluss).
    expect(screen.queryByLabelText('Name *')).toBeNull()
  })

  it('echte Änderung: Zeile aktualisiert + Dirty-State', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan „VL Eigenanteil“ bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Betrag in Euro *'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const row = screen.getByRole('rowheader', { name: 'VL Eigenanteil' }).closest('tr')!
    expect(within(row as HTMLElement).getAllByText(euroText(40)).length).toBeGreaterThan(0)
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('Escape schließt das offene Formular (Fokusführung wie Depot-Seite)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    const nameInput = screen.getByLabelText('Name *')
    fireEvent.keyDown(nameInput, { key: 'Escape' })
    expect(screen.queryByLabelText('Name *')).toBeNull()
  })

  it('Escape aus einem Select des Formulars (Popup-Bubbling) schließt das Formular NICHT', () => {
    // Echtbrowser-Fall: Escape schließt das native Select-Popup, das keydown
    // bubbelt aber zur Section – das Formular muss offen bleiben.
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Sparplan hinzufügen' })
    const firstSelect = within(form).getAllByRole('combobox')[0]
    fireEvent.keyDown(firstSelect, { key: 'Escape' })
    expect(screen.getByRole('form', { name: 'Sparplan hinzufügen' })).toBeInTheDocument()
  })

  it('einmaliger Zufluss: Formular ohne Enddatum; Zeile mit Einmal-Kennzeichnung; Jahressicht getrennt (2h)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Sparplan hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Sonderzahlung Gold' } })
    fireEvent.change(screen.getByLabelText('Rhythmus *'), { target: { value: 'once' } })
    expect(screen.queryByLabelText('Enddatum (optional)')).toBeNull()
    expect(
      screen.getByText(/Das Startdatum ist bei einmaligen Zuflüssen das Ausführungsdatum/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Betrag in Euro *'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const row = screen.getByRole('rowheader', { name: 'Sonderzahlung Gold' }).closest('tr')!
    expect(within(row as HTMLElement).getByText('einmalig')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText(`${euroText(500)} (einmalig)`)).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('– (einmalig, nicht geglättet)')).toBeInTheDocument()
    // Jahressicht: Einmalbeträge GETRENNT (2h); geglättete KPI bleibt 201,83.
    expect(factValue(sumsRegion(), 'Einmalige Zuflüsse 2026 (getrennt)')).toContain(euroText(500))
    expect(
      within(kpiTile('Eigene Sparleistung – geglättet (Analysewert)')).getByText(euroText(201.83)),
    ).toBeInTheDocument()
    // Monats-Realsicht Juli enthält die Einmalzahlung: 1.625 + 500 = 2.125.
    expect(within(kpiTile('Monats-Realsicht Juli 2026')).getByText(euroText(2125))).toBeInTheDocument()
  })

  it('GEPLANTER einmaliger Zufluss (September) erscheint in der Jahressicht, nicht in der Monats-Realsicht (F1)', () => {
    // finance-analyst-Befund M10-F1: die Jahressicht zählt Einmalzuflüsse des
    // LAUFENDEN JAHRES unabhängig vom Aktivfenster (auch geplante/abgeschlossene).
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      savingsPlans: [
        ...data.savingsPlans,
        {
          id: 'sp-once-september',
          name: 'Sonderzahlung September',
          targetKind: 'position',
          targetId: 'pos-ishares-gold-etc',
          amount: 300,
          interval: 'once',
          flowType: 'own_fixed',
          isFlexible: true,
          minAmount: null,
          validFrom: '2026-09-15',
          validUntil: '2026-09-15',
          note: null,
        },
      ],
    })
    expect(factValue(sumsRegion(), 'Einmalige Zuflüsse 2026 (getrennt)')).toContain(euroText(300))
    // Juli-Realsicht bleibt ohne den September-Zufluss (1.625,00).
    expect(within(kpiTile('Monats-Realsicht Juli 2026')).getByText(euroText(1625))).toBeInTheDocument()
    // Der Plan selbst ist als „Geplant“ gelistet; 15.09.2026 erscheint als
    // Startdatum UND als nächster Termin (einmalig: Ausführungsdatum).
    const row = screen.getByRole('rowheader', { name: 'Sonderzahlung September' }).closest('tr')!
    expect(within(row as HTMLElement).getByText(/Geplant/)).toBeInTheDocument()
    expect(within(row as HTMLElement).getAllByText('15.09.2026').length).toBeGreaterThanOrEqual(1)
  })
})

describe('SavingsPlansPage – 1.000-€-Sparziel (U3)', () => {
  it('Seed: primär 11,85 % (Balken 118,5/1.000) + geglätteter Analysewert 20,18 % + Gesamtzufluss-Einordnung', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const region = goalRegion()
    const bar = within(region).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“ (eigene reale Sparleistung)',
    })
    expect(bar).toHaveAttribute('max', '1000')
    expect(bar).toHaveAttribute('value', '118.5')
    const describedBy = bar.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toContain('11,85 %')
    expect(
      within(region).getByText('Geglätteter Analysewert – nicht der primäre Zielfortschritt:'),
    ).toBeInTheDocument()
    const analysisBar = within(region).getByRole('progressbar', {
      name: 'Analysewert „Monatlich 1.000 EUR Sparrate“ (eigene geglättete Sparleistung)',
    })
    expect(document.getElementById(analysisBar.getAttribute('aria-describedby')!)?.textContent).toContain(
      '20,18 %',
    )
    expect(
      within(region).getByText('Zur Einordnung: Gesamtzufluss (zählt NICHT als Zielfortschritt)'),
    ).toBeInTheDocument()
    expect(within(region).getByText(/misst per Nutzerentscheidung U3/)).toBeInTheDocument()
  })

  it('nur externe Zuflüsse: primärer Fortschritt 0,00 % (extern zählt nie)', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      savingsPlans: data.savingsPlans.filter((plan) => plan.flowType === 'employer'),
    })
    const bar = within(goalRegion()).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“ (eigene reale Sparleistung)',
    })
    expect(bar).toHaveAttribute('value', '0')
    expect(
      document.getElementById(bar.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('0,00 %')
  })

  it('exakt 1.000 → 100,00 % mit Erreicht-Hinweis; über 1.000 → Balken gedeckelt, Text zeigt echten Wert', () => {
    const captured = renderPage()
    // 118,50 − 33,50 + 915 = 1.000,00 exakt.
    loadData(captured, withPlanPatched(loadExample(), 'sp-vl-own', { amount: 915 }))
    const region = goalRegion()
    const bar = within(region).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“ (eigene reale Sparleistung)',
    })
    expect(bar).toHaveAttribute('value', '1000')
    expect(document.getElementById(bar.getAttribute('aria-describedby')!)?.textContent).toContain(
      '100,00 %',
    )
    expect(within(region).getByText(/Ziel erreicht/)).toBeInTheDocument()

    // Über dem Ziel: 1.033,50 + 85 = 1.118,50 → 111,85 %, Balken bleibt bei 1.000.
    loadData(captured, withPlanPatched(loadExample(), 'sp-vl-own', { amount: 1033.5 }))
    const overBar = within(goalRegion()).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“ (eigene reale Sparleistung)',
    })
    expect(overBar).toHaveAttribute('value', '1000')
    expect(
      document.getElementById(overBar.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('111,85 %')
  })

  it('pausierte eigene Pläne zählen nicht in den Zielfortschritt (113,50 → 11,35 %)', () => {
    const captured = renderPage()
    loadData(captured, withPlanPatched(loadExample(), 'sp-tr-gold', { isPaused: true }))
    const bar = within(goalRegion()).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“ (eigene reale Sparleistung)',
    })
    expect(bar).toHaveAttribute('value', '113.5')
    expect(
      document.getElementById(bar.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('11,35 %')
  })

  it('kein Ziel mit Kennzahl „monatliche Sparrate“ → Leerzustand; Zielbetrag null → „kein gültiger Zielbetrag“', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      goals: data.goals.filter((goal) => goal.metric !== 'monthlySavingsRate'),
    })
    // Ohne Ziel trägt die Sektion die neutrale Fallback-Überschrift (K4).
    const emptyRegion = screen.getByRole('region', { name: 'Sparziel „monatliche Sparrate“' })
    expect(
      within(emptyRegion).getByText(/kein Ziel mit der Kennzahl „monatliche Sparrate“/),
    ).toBeInTheDocument()
    loadData(captured, {
      ...data,
      goals: data.goals.map((goal) =>
        goal.metric === 'monthlySavingsRate' ? { ...goal, targetAmount: null } : goal,
      ),
    })
    expect(within(goalRegion()).getByText(/kein gültiger Zielbetrag/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })
})

describe('SavingsPlansPage – F10-Referenzverteilung (nur Orientierung)', () => {
  it('Seed: Datenbasis benannt; je Ziel Betrag + Anteil (VL 17,78 %, Telekom 55,56 %); Pflichthinweis wörtlich', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const region = f10Region()
    expect(
      within(region).getByText(
        'Datenbasis: geglättete feste Zuflüsse (inkl. Arbeitgeberanteile) je Depot-Ziel – ohne variable Zuflüsse, ohne Umbuchungen.',
      ),
    ).toBeInTheDocument()
    expect(factValue(region, 'VL iShares Core MSCI World')).toBe(`${euroText(40)} · 17,78 %`)
    expect(factValue(region, 'Deutsche Telekom Aktien')).toBe(`${euroText(125)} · 55,56 %`)
    // World-gesamt-Aggregat (F10-Testergebnis): 85/225 = 37,78 % (finance-analyst-Befund F3).
    const worldLine = within(region).getByText(/MSCI World gesamt/)
    expect(worldLine.textContent!.replace(/\s/g, ' ')).toBe(
      `Zusammen als „MSCI World gesamt“: ${euroText(85)} · 37,78 %`,
    )
    // Aktives Profil tp-student-sparplan ohne gespeicherte Gewichte → Ebene-A-Hinweis.
    expect(
      within(region).getByText(
        'Die Referenz der Studienphase IST die aktuelle Verteilung (Ebene A) – ein gespeichertes Soll gibt es nicht.',
      ),
    ).toBeInTheDocument()
    expect(
      within(region).getByText(
        'Die Referenzverteilung dient nur zur Orientierung und ändert keine Sparpläne automatisch.',
      ),
    ).toBeInTheDocument()
    // KEIN Rebalancing-Vokabular in der reinen Orientierungssicht.
    expect(within(region).queryByText(/Empfehlung/)).toBeNull()
  })

  it('ohne feste Depot-Zuflüsse: „nicht berechenbar“ statt Zahlen', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      savingsPlans: data.savingsPlans.filter((plan) => plan.targetKind !== 'position'),
    })
    expect(within(f10Region()).getByText(/nicht berechenbar/)).toBeInTheDocument()
  })

  it('Soll-Vergleich mit Gruppen-Gewichten: deutsche Gruppen-Namen statt roher Schlüssel (B1)', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      targetProfiles: data.targetProfiles.map((profile) =>
        profile.id === 'tp-student-sparplan'
          ? {
              ...profile,
              weights: [
                { refKind: 'group' as const, ref: 'world', weight: 0.38 },
                { refKind: 'group' as const, ref: 'em', weight: 0.04 },
                { refKind: 'group' as const, ref: 'gold', weight: 0.03 },
                { refKind: 'group' as const, ref: 'telekom', weight: 0.55 },
              ],
            }
          : profile,
      ),
    })
    const region = f10Region()
    expect(within(region).getByRole('rowheader', { name: 'World (Gruppe)' })).toBeInTheDocument()
    expect(within(region).getByRole('rowheader', { name: 'Emerging Markets (Gruppe)' })).toBeInTheDocument()
    // Kein roher Gruppen-Schlüssel im Endnutzertext.
    expect(region.textContent).not.toContain('Gruppe world')
    expect(region.textContent).not.toContain('Gruppe em')
    // Keine Empfehlungen – der Vergleich bleibt reine Anzeige.
    expect(within(region).queryByText(/Empfehlung/)).toBeNull()
  })
})

describe('Budget-Warnung gegen das M14-Sparbudget (M10-Restpunkt, S2)', () => {
  /** Beispieldaten mit gesetztem monatlichem Sparbudget (settings.monthlySavingsBudget). */
  function withBudget(budget: number | null): FinanceData {
    const data = loadExample()
    return { ...data, settings: { ...data.settings, monthlySavingsBudget: budget } }
  }

  const WARNING_RE = /überschreitet das in den Einstellungen hinterlegte monatliche Sparbudget/

  it('Budget 100 < eigene feste Sparleistung 118,50 → sichtbare Warnung (Text + Symbol, nie blockierend)', () => {
    const captured = renderPage()
    loadData(captured, withBudget(100))
    const warning = within(sumsRegion()).getByText(WARNING_RE)
    const text = warning.textContent!.replace(/\s/g, ' ')
    // F8 real (ownMonthlySavings) gegen den Grenzwert – beide Beträge sichtbar.
    expect(text).toContain(euroText(118.5))
    expect(text).toContain(euroText(100))
    expect(text).toContain('⚠')
    expect(text).toContain('Nur ein Hinweis')
    // Nie blockierend: die Seite bleibt vollständig bedienbar (Anlegen-Button aktiv).
    expect(screen.getByRole('button', { name: 'Sparplan hinzufügen' })).toBeEnabled()
  })

  it('Budget 118 (knapp unter der Sparleistung 118,50) → Warnung (Grenznähe, calculation-tester M14)', () => {
    const captured = renderPage()
    loadData(captured, withBudget(118))
    expect(within(sumsRegion()).getByText(WARNING_RE)).toBeInTheDocument()
  })

  it('Budget exakt 118,50 (Grenzwert erreicht, nicht überschritten) → KEINE Warnung (strikt >)', () => {
    const captured = renderPage()
    loadData(captured, withBudget(118.5))
    expect(within(sumsRegion()).queryByText(WARNING_RE)).toBeNull()
  })

  it('Budget null („offen“) → keine Prüfung, keine Warnung', () => {
    const captured = renderPage()
    loadData(captured, withBudget(null))
    expect(within(sumsRegion()).queryByText(WARNING_RE)).toBeNull()
  })
})
