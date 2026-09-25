/**
 * UI-Tests des Moduls „Finanzziele“ (M12): Zusammenfassung (inkl.
 * Überschneidungs-Kennzeichnung, bewusst keine Ist-Summen-Kachel), Zielliste
 * als Karten (Seed-Werte, G11-Anzeigen, Fortschrittsbalken inkl. > 100 %),
 * Monatsrate/Prognose (ohne Rendite-Kennzeichnung, Auflage F für
 * Sparraten-Ziele), Formulare (key-A→B, Abbruch/unverändert ohne Dirty,
 * deutsche Beträge, Fokus aufs Fehlerfeld), Statusaktionen mit Bestätigung
 * und Dirty-Vergleich (K3) sowie Referenz-Warnungen (Namen, nie IDs).
 * Muster wie tests/pages/savingsPlansPage.test.tsx (echter Provider + Capture
 * + LOAD_SUCCEEDED mit loadExample()); Stichtag injiziert über FIXED_NOW.
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

/** formatEuro nutzt geschützte Leerzeichen; der Normalizer kollabiert sie. */
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
      <AppLayout initialPage="ziele" />
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

function summaryRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Zusammenfassung' })
}

function listRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Zielliste' })
}

/** KPI-Kachel über ihren dt-Text finden. */
function kpiTile(label: string): HTMLElement {
  const tile = within(summaryRegion()).getByText(label).closest('.kpi-tile')
  if (!(tile instanceof HTMLElement)) throw new Error(`Keine KPI-Kachel für "${label}" gefunden.`)
  return tile
}

/** Ziel-Karte (li) über den Zielnamen finden. */
function goalCard(name: string): HTMLElement {
  const title = within(listRegion()).getByText(name)
  const item = title.closest('li')
  if (!item) throw new Error(`Keine Ziel-Karte für "${name}" gefunden.`)
  return item
}

/** Ein zusätzliches Ziel in den Bestand einfügen (programmatisch, Seed bleibt unangetastet). */
function withExtraGoal(data: FinanceData, goal: Record<string, unknown>): FinanceData {
  return { ...data, goals: [...data.goals, goal as unknown as FinanceData['goals'][number]] }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GoalsPage – Leerzustände', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Ziele' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import und weitere Optionen' })).toBeInTheDocument()
  })

  it('Bestand ohne Ziele: verständlicher Leerzustand mit nächstem Schritt', () => {
    const captured = renderPage()
    loadData(captured, { ...loadExample(), goals: [] })
    expect(screen.getByText(/noch keine Ziele/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ziel hinzufügen' })).toBeInTheDocument()
  })
})

describe('GoalsPage – Zusammenfassung (Seed)', () => {
  it('4 aktive Ziele; Summen 64.680,00/58.379,88 mit Pflicht-Überschneidungs-Kennzeichnung; keine Ist-Summen-Kachel', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(within(kpiTile('Aktive Ziele')).getByText('4')).toBeInTheDocument()
    expect(within(kpiTile('Rechnerisch erreicht')).getByText('0')).toBeInTheDocument()
    // Summe OHNE Sparraten-Ziel (€/Monat ist keine Vermögensgröße):
    // 4.680 + 10.000 + 50.000 = 64.680.
    const targetTile = kpiTile('Summe Zielbeträge')
    expect(within(targetTile).getByText(euroText(64680))).toBeInTheDocument()
    expect(within(targetTile).getByText(/Bezugswerte können sich überschneiden/)).toBeInTheDocument()
    // 4.052,41 + 7.477,53 + 46.849,94 = 58.379,88.
    expect(within(kpiTile('Summe verbleibend')).getByText(euroText(58379.88))).toBeInTheDocument()
    // Bewusste Entscheidung: KEINE Summe der Ist-Werte.
    expect(within(summaryRegion()).queryByText('Summe Ist-Werte')).toBeNull()
    expect(
      within(summaryRegion()).getByText(/Bewusst keine Summe der Ist-Werte/),
    ).toBeInTheDocument()
    // Aufmerksamkeitsbedarf: die beiden Ziele ohne Kennzahl sind nicht berechenbar.
    expect(within(summaryRegion()).getByText(/„Physisches Gold“/)).toBeInTheDocument()
    expect(within(summaryRegion()).getByText(/„Berufseinstieg“/)).toBeInTheDocument()
  })
})

describe('GoalsPage – Zielliste (Seed)', () => {
  it('Notgroschen: Ist 627,59, Ziel 4.680 (berechnet), 13,41 % mit Balken-Muster (aria-describedby)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const card = goalCard('Notgroschen')
    expect(
      within(card).getByText(`Ist: ${euroText(627.59)} · Ziel: ${euroText(4680)}`),
    ).toBeInTheDocument()
    expect(within(card).getByText('Rest: ' + euroText(4052.41))).toBeInTheDocument()
    const bar = within(card).getByRole('progressbar', { name: 'Fortschritt „Notgroschen“' })
    expect(bar).toHaveAttribute('max', '4680')
    expect(bar).toHaveAttribute('value', '627.59')
    const describedBy = bar.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toBe('13,41 %')
    // Zugeordnete eigene Sparleistung (Tagesgeld-Pläne): 25,00 €.
    expect(
      within(card).getByText(
        new RegExp(`Zugeordnete eigene Sparleistung \\(real\\): ${euroText(25).replace('.', '\\.')}`),
      ),
    ).toBeInTheDocument()
    expect(within(card).getByText(/Tagesgeld-Sparrate VW Bank/)).toBeInTheDocument()
  })

  it('offene Ziele ohne Kennzahl: „offen / nutzerdefinierbar“ + „nicht berechenbar“, keine erfundenen Werte', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const card = goalCard('Physisches Gold')
    expect(within(card).getByText(/Ziel: offen \/ nutzerdefinierbar/)).toBeInTheDocument()
    expect(within(card).getByText(/nicht berechenbar \(keine Kennzahl zugeordnet\)/)).toBeInTheDocument()
    expect(within(card).getByText(/∅ Nicht berechenbar/)).toBeInTheDocument()
    expect(within(card).queryByRole('progressbar')).toBeNull()
  })

  it('pausierte Ziele: Status „Pausiert (zurückgestellt)“ ohne Fortschrittsbalken', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const card = goalCard('Auto-Ruecklage')
    expect(within(card).getByText(/⏸ Pausiert \(zurückgestellt\)/)).toBeInTheDocument()
    expect(within(card).queryByRole('progressbar')).toBeNull()
  })

  it('Sparraten-Ziel (Auflage F): keine Monatsrate/Prognose/verbleibende Monate – auch MIT Zieldatum', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      goals: data.goals.map((goal) =>
        goal.id === 'goal-sparrate-1000' ? { ...goal, targetDate: '2026-12-31' } : goal,
      ),
    })
    const card = goalCard('Monatlich 1.000 EUR Sparrate')
    expect(within(card).getByText(/Zieldatum: 31\.12\.2026/)).toBeInTheDocument()
    expect(within(card).queryByText(/Benötigte Monatsrate/)).toBeNull()
    expect(within(card).queryByText(/Prognose:/)).toBeNull()
    expect(within(card).queryByText(/volle Kalendermonate/)).toBeNull()
    expect(
      within(card).getByText(/benötigte Monatsrate und Prognose entfallen/),
    ).toBeInTheDocument()
    // Ist/Ziel als Monatsraten gekennzeichnet (11,85 %-Basis U3).
    expect(
      within(card).getByText(
        `Ist: ${euroText(118.5)} pro Monat (eigene reale Sparleistung) · Ziel: ${euroText(1000)} pro Monat`,
      ),
    ).toBeInTheDocument()
  })

  it('Ziel ÜBERTROFFEN: Balken auf max gedeckelt, echter Prozentwert als Text, informativer Überschuss', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld'
          ? { ...account, balanceHistory: [{ date: '2026-07-17', amount: 5000 }] }
          : account,
      ),
    })
    const card = goalCard('Notgroschen')
    expect(card.querySelector('.goal-heading')!.textContent).toContain('✓ Rechnerisch erreicht')
    expect(
      within(card).getByText(/Rechnerisch erreicht – die App schlägt nur vor/),
    ).toBeInTheDocument()
    const bar = within(card).getByRole('progressbar', { name: 'Fortschritt „Notgroschen“' })
    expect(bar).toHaveAttribute('max', '4680')
    expect(bar).toHaveAttribute('value', '4680')
    expect(within(card).getByText('106,84 %')).toBeInTheDocument()
    expect(
      within(card).getByText(`Rest: ${euroText(0)} · Überschuss (informativ): ${euroText(320)}`),
    ).toBeInTheDocument()
  })

  it('unbekannter Ist-Wert (Auflage E): „unbekannt“ + „Nicht berechenbar“, NIE „überfällig mit 0 %“ trotz vergangenem Zieldatum', () => {
    const captured = renderPage()
    loadData(
      captured,
      withExtraGoal(loadExample(), {
        id: 'goal-giro-puffer',
        name: 'Giro-Puffer',
        targetAmount: 500,
        targetDate: '2026-01-01',
        metric: 'accountBalance',
        refId: 'acc-sparkasse-giro',
        isAutoCalculated: false,
        status: 'active',
        note: null,
      }),
    )
    const card = goalCard('Giro-Puffer')
    expect(within(card).getByText(/unbekannt \(noch kein Wert erfasst\)/)).toBeInTheDocument()
    expect(within(card).getByText(/∅ Nicht berechenbar/)).toBeInTheDocument()
    expect(within(card).queryByText(/Überfällig/)).toBeNull()
    expect(within(card).queryByText('0,00 %')).toBeNull()
    // Fehlende Daten als NAME (nie ID) – mehrfach genannt (Zielart, Details).
    expect(within(card).getAllByText(/Girokonto Sparkasse/).length).toBeGreaterThan(0)
  })

  it('Referenz-Warnung bei deaktivierter Referenz: Name, nie ID; Wert wird weiter berechnet', () => {
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, {
      ...withExtraGoal(data, {
        id: 'goal-vw-puffer',
        name: 'VW-Puffer',
        targetAmount: 2000,
        targetDate: null,
        metric: 'accountBalance',
        refId: 'acc-vw-tagesgeld',
        isAutoCalculated: false,
        status: 'active',
        note: null,
      }),
      accounts: data.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld' ? { ...account, isActive: false } : account,
      ),
    })
    const card = goalCard('VW-Puffer')
    expect(
      within(card).getByText(/Die Referenz „Volkswagen Bank Tagesgeld“ \(Konto\) ist deaktiviert/),
    ).toBeInTheDocument()
    expect(
      within(card).getByText(`Ist: ${euroText(627.59)} · Ziel: ${euroText(2000)}`),
    ).toBeInTheDocument()
    // Auch die Zusammenfassung meldet den Aufmerksamkeitsbedarf.
    expect(within(summaryRegion()).getByText(/„VW-Puffer“/)).toBeInTheDocument()
  })

  it('keine technischen IDs, kein NaN/Infinity/undefined im Seiteninhalt', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const main = document.querySelector('main')!
    expect(main.textContent).not.toContain('NaN')
    expect(main.textContent).not.toContain('Infinity')
    expect(main.textContent).not.toContain('undefined')
    expect(main.textContent).not.toContain('acc-')
    expect(main.textContent).not.toContain('pos-')
    expect(main.textContent).not.toContain('goal-')
  })
})

describe('GoalsPage – Monatsrate und Prognose (Zieldatum)', () => {
  it('Tagesgeld-Ziel mit Zieldatum: 5 volle Monate, benötigte Rate 874,48 €, Prognose mit Pflichttext „ohne Rendite-/Kursannahme“', () => {
    const captured = renderPage()
    loadData(
      captured,
      withExtraGoal(loadExample(), {
        id: 'goal-tagesgeld-5000',
        name: 'Tagesgeld 5000',
        targetAmount: 5000,
        targetDate: '2026-12-31',
        metric: 'tagesgeld',
        isAutoCalculated: false,
        status: 'active',
        note: null,
      }),
    )
    const card = goalCard('Tagesgeld 5000')
    // Rest 5.000 − 627,59 = 4.372,41; 5 volle Monatswechsel bis Dez (Stichtag 19.07.2026).
    expect(
      within(card).getByText(
        /Benötigte Monatsrate: 874,48\s?€ pro Monat \(Basis: 5 volle Kalendermonate bis 31\.12\.2026; der angebrochene Monat zählt nicht\)/,
      ),
    ).toBeInTheDocument()
    expect(within(card).getByText(/noch 5 volle Kalendermonate/)).toBeInTheDocument()
    // Prognose auf Basis der zugeordneten eigenen realen Rate (25 €):
    // ceil(4.372,41 / 25) = 175 Monate → voraussichtlich verspätet.
    expect(
      within(card).getByText(/voraussichtlich noch 175 Monate/),
    ).toBeInTheDocument()
    expect(within(card).getByText(/voraussichtlich verspätet/)).toBeInTheDocument()
    expect(
      within(card).getByText(/Benötigt: 874,48\s?€ pro Monat · vorhanden \(real\): 25,00\s?€ pro Monat · Differenz: 849,48\s?€ pro Monat/),
    ).toBeInTheDocument()
    expect(
      within(card).getByText('Ohne Rendite-/Kursannahme – keine Prognosegarantie.'),
    ).toBeInTheDocument()
  })
})

describe('GoalsPage – Formulare', () => {
  it('Anlegen eines Kontostand-Ziels mit deutschem Betrag „2.000“: Karte erscheint, Dirty-State gesetzt', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'VW Puffer' } })
    fireEvent.change(screen.getByLabelText('Zielart (Kennzahl)'), {
      target: { value: 'accountBalance' },
    })
    fireEvent.change(screen.getByLabelText('Referenziertes Konto *'), {
      target: { value: 'acc-vw-tagesgeld' },
    })
    fireEvent.change(screen.getByLabelText('Zielbetrag in Euro (leer = offen)'), {
      target: { value: '2.000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ziel anlegen' }))
    const card = goalCard('VW Puffer')
    expect(
      within(card).getByText(`Ist: ${euroText(627.59)} · Ziel: ${euroText(2000)}`),
    ).toBeInTheDocument()
    expect(
      within(card).getByText(/Kontostand eines Kontos: Volkswagen Bank Tagesgeld/),
    ).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('Anlegen eines freien Geldziels (manuell): Ist-Wert aus dem Formular; leer = offen', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Konzertkasse' } })
    fireEvent.change(screen.getByLabelText('Zielart (Kennzahl)'), { target: { value: 'manual' } })
    fireEvent.change(screen.getByLabelText('Zielbetrag in Euro (leer = offen)'), {
      target: { value: '1.000' },
    })
    fireEvent.change(screen.getByLabelText('Aktueller Ist-Wert in Euro (leer = offen)'), {
      target: { value: '250,50' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ziel anlegen' }))
    const card = goalCard('Konzertkasse')
    expect(
      within(card).getByText(`Ist: ${euroText(250.5)} · Ziel: ${euroText(1000)}`),
    ).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('ungültiger Betrag: feldnaher Fehler mit Fokus aufs Fehlerfeld (B3), kein Dirty-State', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Fehlerziel' } })
    const amountInput = screen.getByLabelText('Zielbetrag in Euro (leer = offen)')
    fireEvent.change(amountInput, { target: { value: '12.34' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ziel anlegen' }))
    expect(screen.getByText(/Bitte einen gültigen Betrag eingeben/)).toBeInTheDocument()
    expect(amountInput).toHaveAttribute('aria-invalid', 'true')
    expect(document.activeElement).toBe(amountInput)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Kontostand-Ziel ohne Referenz: feldnaher Fehler an der Referenzauswahl', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Ohne Referenz' } })
    fireEvent.change(screen.getByLabelText('Zielart (Kennzahl)'), {
      target: { value: 'accountBalance' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ziel anlegen' }))
    expect(screen.getByText('Bitte eine Referenz wählen.')).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('A→B-Wechsel: das Bearbeiten-Formular übernimmt NIE den Zustand des vorherigen Ziels (key)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ bearbeiten' }))
    const nameInput = screen.getByLabelText('Name *')
    expect(nameInput).toHaveValue('10.000 EUR Depot')
    fireEvent.change(nameInput, { target: { value: 'Umbenannt aber nicht gespeichert' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Ziel „50.000 EUR Gesamtvermoegen“ bearbeiten' }),
    )
    expect(screen.getByLabelText('Name *')).toHaveValue('50.000 EUR Gesamtvermoegen')
  })

  it('Abbrechen und unverändertes Übernehmen lösen NIE einen Dirty-State aus (K2/K3)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    // Abbrechen nach Änderung.
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ bearbeiten' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Anderer Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(captured.current!.state.isDirty).toBe(false)
    // Dialog öffnen und unverändert übernehmen (Byte-identisch, K2).
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ bearbeiten' }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen übernehmen' }))
    expect(captured.current!.state.isDirty).toBe(false)
    expect(screen.getByText('10.000 EUR Depot')).toBeInTheDocument()
  })

  it('Notgroschen bearbeiten: Zielart/Zielbetrag nicht editierbar, berechneter Wert mit Einstellungs-Hinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „Notgroschen“ bearbeiten' }))
    expect(screen.getByLabelText('Zielart (Kennzahl)')).toBeDisabled()
    expect(screen.queryByLabelText('Zielbetrag in Euro (leer = offen)')).toBeNull()
    expect(screen.getByText(/Zielbetrag \(berechnet\):/)).toBeInTheDocument()
    expect(screen.getByText(/nie ungefragt ersetzt/)).toBeInTheDocument()
    // Unverändertes Übernehmen bleibt ohne Dirty-State (kein targetAmount-Patch).
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen übernehmen' }))
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Escape schließt das Formular ohne Übernahme', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Escape-Test' } })
    fireEvent.keyDown(screen.getByLabelText('Name *'), { key: 'Escape' })
    expect(screen.queryByLabelText('Name *')).toBeNull()
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Escape aus dem Referenz-Select (Popup-Bubbling) schließt das Formular NICHT und erhält die Auswahl', () => {
    // Echtbrowser-Fall (Fehlerbericht „Dropdown Konto/Depotposition“): Escape
    // schließt das native Select-Popup, das keydown bubbelt aber zur Section.
    // Das Formular muss offen bleiben, sonst gehen die Eingaben verloren.
    const captured = renderPage()
    const data = loadExample()
    loadData(captured, data)
    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }))
    fireEvent.change(screen.getByLabelText('Zielart (Kennzahl)'), {
      target: { value: 'accountBalance' },
    })
    const refSelect = screen.getByLabelText(/Referenziertes Konto/) as HTMLSelectElement
    fireEvent.change(refSelect, { target: { value: data.accounts[1].id } })
    fireEvent.keyDown(refSelect, { key: 'Escape' })
    expect(screen.getByRole('form', { name: 'Ziel hinzufügen' })).toBeInTheDocument()
    expect((screen.getByLabelText(/Referenziertes Konto/) as HTMLSelectElement).value).toBe(
      data.accounts[1].id,
    )
    // Escape außerhalb der Popup-Felder schließt weiterhin (bestehendes Verhalten).
    fireEvent.keyDown(screen.getByLabelText('Name *'), { key: 'Escape' })
    expect(screen.queryByRole('form', { name: 'Ziel hinzufügen' })).toBeNull()
  })
})

describe('GoalsPage – Beschriftungen und Darstellung (Redesign)', () => {
  it('Absende-Button: „Ziel anlegen“ bzw. „Änderungen übernehmen“, nie „Speichern“', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const addButton = screen.getByRole('button', { name: 'Ziel hinzufügen' })
    expect(addButton).toHaveClass('btn-primary')
    fireEvent.click(addButton)
    const addForm = screen.getByRole('form', { name: 'Ziel hinzufügen' })
    expect(within(addForm).getByRole('button', { name: 'Ziel anlegen' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(within(addForm).queryByRole('button', { name: 'Speichern' })).toBeNull()
    fireEvent.click(within(addForm).getByRole('button', { name: 'Abbrechen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „Urlaub“ bearbeiten' }))
    const editForm = screen.getByRole('form', { name: 'Ziel bearbeiten: Urlaub' })
    expect(
      within(editForm).getByRole('button', { name: 'Änderungen übernehmen' }),
    ).toHaveAttribute('type', 'submit')
    expect(within(editForm).queryByRole('button', { name: 'Speichern' })).toBeNull()
  })

  it('Zielkarten: nur „Archivieren“ als Gefahr-Aktion; Status-Plakette mit gleichem Text', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(
      screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ archivieren' }),
    ).toHaveClass('btn-danger')
    for (const action of ['bearbeiten', 'pausieren', 'abschließen']) {
      expect(
        screen.getByRole('button', { name: `Ziel „10.000 EUR Depot“ ${action}` }),
      ).not.toHaveClass('btn-danger')
    }
    // Symbol + Text bleiben Bedeutungsträger; die Farbe der Plakette ist Zusatz.
    const activeCard = goalCard('Notgroschen')
    expect(within(activeCard).getByText('● Aktiv')).toHaveClass('badge', 'badge--ok')
    expect(within(goalCard('Physisches Gold')).getByText('∅ Nicht berechenbar')).toHaveClass(
      'badge',
      'badge--warn',
    )
    // Screenreader hören weiterhin „Name – Status: …“.
    expect(activeCard.querySelector('.goal-heading')!.textContent).toBe(
      'Notgroschen – Status: ● Aktiv',
    )
  })
})

describe('GoalsPage – Statusaktionen (Bestätigung + Dirty-Vergleich)', () => {
  it('Pausieren nach Bestätigung: Status „Pausiert“, Dirty-State gesetzt; Reaktivieren erscheint', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ pausieren' }))
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(confirmSpy.mock.calls[0][0]).toContain('10.000 EUR Depot')
    const card = goalCard('10.000 EUR Depot')
    expect(within(card).getByText(/⏸ Pausiert \(zurückgestellt\)/)).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ reaktivieren' }),
    ).toBeInTheDocument()
  })

  it('abgebrochene Bestätigung ändert nichts (kein Dirty-State, K3)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ pausieren' }))
    expect(captured.current!.state.isDirty).toBe(false)
    expect(within(goalCard('10.000 EUR Depot')).queryByText(/Pausiert/)).toBeNull()
  })

  it('Abschließen speichert den MANUELLEN Abschluss (Begründung im Dialog); Status bleibt bei sinkendem Ist', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ abschließen' }))
    expect(confirmSpy.mock.calls[0][0]).toContain('manuell abgeschlossen')
    expect(confirmSpy.mock.calls[0][0]).toContain('unabhängig vom rechnerischen Fortschritt')
    const card = goalCard('10.000 EUR Depot')
    expect(within(card).getByText(/✔ Manuell abgeschlossen/)).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(true)
    // Reaktivieren bleibt möglich, Pausieren/Abschließen nicht.
    expect(
      screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ reaktivieren' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ziel „10.000 EUR Depot“ abschließen' }),
    ).toBeNull()
  })

  it('Archivieren ist endgültig: Karte bleibt (kein Löschen), keine Aktionen mehr, Dashboard blendet aus', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „Urlaub“ archivieren' }))
    expect(confirmSpy.mock.calls[0][0]).toContain('endgültig archivieren')
    expect(confirmSpy.mock.calls[0][0]).toContain('nie gelöscht')
    const card = goalCard('Urlaub')
    expect(within(card).getByText(/■ Archiviert/)).toBeInTheDocument()
    expect(
      within(card).getByText('Archiviert – endgültig, keine weitere Bearbeitung.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ziel „Urlaub“ bearbeiten' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ziel „Urlaub“ archivieren' })).toBeNull()
    expect(captured.current!.state.isDirty).toBe(true)
    // Dashboard-Ausblendung: das archivierte Ziel erscheint dort nicht mehr.
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Übersicht' }))
    const goalsRegion = screen.getByRole('region', { name: 'Ziele' })
    expect(within(goalsRegion).queryByText('Urlaub')).toBeNull()
  })

  it('archiviertes Ziel MIT Zielbetrag fällt aus den Übersichts-Summen (64.680 → 54.680, L4)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Ziel „10.000 EUR Depot“ archivieren' }))
    // 64.680 − 10.000 = 54.680; verbleibend 58.379,88 − 7.477,53 = 50.902,35.
    expect(within(kpiTile('Summe Zielbeträge')).getByText(euroText(54680))).toBeInTheDocument()
    expect(within(kpiTile('Summe verbleibend')).getByText(euroText(50902.35))).toBeInTheDocument()
  })
})
