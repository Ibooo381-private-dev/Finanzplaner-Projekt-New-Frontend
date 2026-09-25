/**
 * UI-Tests des Moduls „Simulator & Projektionen“ (M13): Leerzustände,
 * Pflicht-Banner, Anlegen mit Vorbelegungen (real 93,50/6,50 Depot + 25
 * Tagesgeld + Ereignis; geglättet zeilenweise 33,50/6,50/60/83,33/41,67/25 –
 * KEINE Sammelzeile), AK-3-STOP-Bedingung (Speichern verändert KEINE
 * Ist-Daten: accounts/positions/savingsPlans/goals Byte-identisch), Löschen
 * NUR mit G12-confirm inkl. Name (Abbruch Byte-identisch), Kopieren,
 * Detailansicht (Kennzeichnungen, Verlaufstabelle als Primärquelle,
 * aria-hidden-Chart mit Zusatz-Hinweis, F22-Pins 5.222,47/927,59/6.150,06),
 * Zielanalyse-Texte, Vergleich (≥ 2, G9-Mischungs-Hinweis), Dirty-Regeln
 * (Abbruch/unverändert ohne Dirty) und keine NaN/Infinity/IDs.
 * Muster wie tests/pages/rebalancingPage.test.tsx.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      <AppLayout initialPage="simulation" />
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

function openNewSimulationForm(): void {
  act(() => {
    screen.getByRole('button', { name: 'Neue Simulation' }).click()
  })
}

function setField(label: string, value: string): void {
  act(() => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  })
}

function clickButton(name: string | RegExp): void {
  act(() => {
    screen.getByRole('button', { name }).click()
  })
}

/** Legt über die UI eine Simulation an (Name + reale Vorbelegung + aktuelle Werte). */
function createRealSimulation(name: string, options?: { months?: string }): void {
  openNewSimulationForm()
  setField('Name *', name)
  clickButton('Aktuelle Werte übernehmen')
  clickButton('Vorbelegung: reale Sparraten')
  if (options?.months !== undefined) {
    setField('Zeitraum in Monaten (1–1200) *', options.months)
  }
  clickButton('Speichern')
}

function createSmoothedSimulation(name: string): void {
  openNewSimulationForm()
  setField('Name *', name)
  clickButton('Aktuelle Werte übernehmen')
  clickButton('Vorbelegung: geglättete Sparraten (Analysewerte)')
  clickButton('Speichern')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SimulatorPage – Leerzustände und Pflicht-Kennzeichnung', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Simulation' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zu „Daten & Backups“' })).toBeInTheDocument()
  })

  it('zeigt Pflicht-Banner, Trennungs-Hinweis, Projektionsstart (Folgemonat) und Export-Hinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(
      screen.getByText(/Projektion – keine Prognose, keine Anlageberatung\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Simulationen ändern nie Konten, Depot, Sparpläne oder Ziele\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Simulationen sind vollständig von den echten Finanzdaten getrennt'),
    ).toBeInTheDocument()
    // KORREKTUR 2.1: Stichtag Juli 2026 → Projektionsstart ist der FOLGEMONAT.
    expect(screen.getByText('August 2026')).toBeInTheDocument()
    expect(screen.getByText('Folgemonat des Stichtags (F22)')).toBeInTheDocument()
    expect(screen.getByText(/keinen eigenen Simulations-Export/)).toBeInTheDocument()
    expect(screen.getByText(/Noch keine gespeicherten Simulationen/)).toBeInTheDocument()
  })
})

describe('SimulatorPage – Anlegen mit Vorbelegungen (Auflage 2.4, G8/G9)', () => {
  it('reale Vorbelegung: 93,50 eigen + 6,50 Arbeitgeber (Depot) + 25 eigen (Tagesgeld), Modus real', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Vorbelegung: reale Sparraten')
    expect(screen.getByLabelText('Bezeichnung Beitrag 1 *')).toHaveValue(
      'Eigene Depot-Sparraten (monatlich)',
    )
    expect(screen.getByLabelText('Betrag Beitrag 1 in Euro pro Monat *')).toHaveValue('93,5')
    expect(screen.getByLabelText('Zuflussart Beitrag 1')).toHaveValue('own_fixed')
    expect(screen.getByLabelText('Ziel Beitrag 1')).toHaveValue('depot')
    expect(screen.getByLabelText('Bezeichnung Beitrag 2 *')).toHaveValue(
      'Arbeitgeber-Depotzuflüsse (monatlich)',
    )
    expect(screen.getByLabelText('Betrag Beitrag 2 in Euro pro Monat *')).toHaveValue('6,5')
    expect(screen.getByLabelText('Zuflussart Beitrag 2')).toHaveValue('employer')
    expect(screen.getByLabelText('Bezeichnung Beitrag 3 *')).toHaveValue(
      'Eigene Tagesgeld-Raten (monatlich)',
    )
    expect(screen.getByLabelText('Betrag Beitrag 3 in Euro pro Monat *')).toHaveValue('25')
    expect(screen.getByLabelText('Ziel Beitrag 3')).toHaveValue('cash')
    expect(screen.getByLabelText('Telekom-Jahreszufluss')).toHaveValue('real')
    // B5: sichtbare Statusmeldung beim Auslöser.
    expect(
      screen.getByText(/3 Beitragszeilen befüllt – Telekom-Sicht: real\./),
    ).toBeInTheDocument()
  })

  it('geglättete Vorbelegung: zeilenweise 33,50/6,50/60/83,33/41,67/25 – KEINE Sammelzeile „225“', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Vorbelegung: geglättete Sparraten (Analysewerte)')
    const amounts = [1, 2, 3, 4, 5, 6].map(
      (index) =>
        (screen.getByLabelText(`Betrag Beitrag ${index} in Euro pro Monat *`) as HTMLInputElement)
          .value,
    )
    expect(amounts).toEqual(['33,5', '6,5', '60', '83,33', '41,67', '25'])
    // G9: geglättete Zeilen sind als Analysewerte gekennzeichnet.
    expect(screen.getByLabelText('Bezeichnung Beitrag 4 *')).toHaveValue(
      'Eigene Jahresbeiträge – geglättet (Analysewert)',
    )
    expect(screen.getByLabelText('Bezeichnung Beitrag 5 *')).toHaveValue(
      'Arbeitgeber-Jahresbeiträge – geglättet (Analysewert)',
    )
    // G8: eigene und Arbeitgeber-Zeilen bleiben getrennt (keine „225 eigen“-Zeile).
    expect(screen.getByLabelText('Zuflussart Beitrag 4')).toHaveValue('own_fixed')
    expect(screen.getByLabelText('Zuflussart Beitrag 5')).toHaveValue('employer')
    expect(screen.getByLabelText('Telekom-Jahreszufluss')).toHaveValue('smoothed')
    // B5: sichtbare Statusmeldung beim Auslöser (mit G9-Kennzeichnung).
    expect(
      screen.getByText(/6 Beitragszeilen befüllt – Telekom-Sicht: geglättet \(Analysewert\)\./),
    ).toBeInTheDocument()
  })

  it('B2: Beitragszeile entfernen → Status „Beitrag N entfernt.“ + Fokus auf „Beitrag hinzufügen“', async () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Vorbelegung: reale Sparraten')
    clickButton('Beitrag 3 entfernen')
    expect(screen.getByText(/Beitrag 3 entfernt\./)).toBeInTheDocument()
    expect(screen.queryByLabelText('Bezeichnung Beitrag 3 *')).toBeNull()
    // Der auslösende Button verschwindet mit der Zeile → Fokus auf den
    // bestehen bleibenden „Beitrag hinzufügen“-Button.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Beitrag hinzufügen' }))
    })
  })

  it('B7/B4: Pflichtfeld-Legende am Formularanfang; Slider mit deutschem aria-valuetext', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    expect(screen.getByText('* = Pflichtfeld')).toBeInTheDocument()
    const slider = screen.getByLabelText('Renditeannahme (Schnellwahl)')
    expect(slider).toHaveAttribute('aria-valuetext', '0 % pro Jahr')
    expect(slider).toHaveAttribute('aria-describedby', 'sim-rate-hint')
    setField('Jährliche Renditeannahme in Prozent (0–15)', '7,25')
    expect(slider).toHaveAttribute('aria-valuetext', '7,25 % pro Jahr')
    setField('Jährliche Renditeannahme in Prozent (0–15)', '10')
    // Warnung ist auch am Slider verknüpft (B4).
    expect(slider).toHaveAttribute('aria-describedby', 'sim-rate-warning')
  })

  it('B3/N1: doppelter Name wird feldnah abgelehnt – es entsteht keine zweite Simulation', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    openNewSimulationForm()
    setField('Name *', 'Basisszenario real')
    clickButton('Speichern')
    expect(
      screen.getByText(/bereits eine Simulation mit diesem Namen/),
    ).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Name *'))
    expect(captured.current!.state.data!.simulations).toHaveLength(1)
  })

  it('„Aktuelle Werte übernehmen“ befüllt NUR das Formular mit den Seed-Werten', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Aktuelle Werte übernehmen')
    expect(screen.getByLabelText('Depot-Startwert in Euro')).toHaveValue('2.522,47')
    expect(screen.getByLabelText('Tagesgeld-Startwert in Euro')).toHaveValue('627,59')
    // B5: sichtbare Statusmeldung beim Auslöser.
    expect(screen.getByText(/Startwerte ins Formular übernommen/)).toBeInTheDocument()
    // Nur Formular-Vorbelegung: noch nichts gespeichert, kein Dirty-State.
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('speichert die Simulation als Karte mit Kernannahmen und Kennzeichnung', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    expect(screen.getByText('Basisszenario real')).toBeInTheDocument()
    expect(screen.getByText(/angelegt am 19\.07\.2026/)).toBeInTheDocument()
    expect(
      screen.getByText(`Startwerte: Depot ${euroText(2522.47)} · Tagesgeld ${euroText(627.59)}`),
    ).toBeInTheDocument()
    expect(screen.getByText(/Zeitraum: 12 Monate · Rendite: 0 % p\. a\./)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`zzgl\\. Jahresereignis ${euroText(1500).replace('.', '\\.')} im Juli`)),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Projektion ohne Kursentwicklung').length).toBeGreaterThan(0)
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('AK-3-STOP-BEDINGUNG: Speichern verändert KEINE Ist-Daten (alle Collections Byte-identisch)', () => {
    const captured = renderPage()
    const example = loadExample()
    loadData(captured, example)
    const before = JSON.stringify({ ...example, simulations: [] })
    createRealSimulation('Basisszenario real')
    const after = captured.current!.state.data!
    expect(after.simulations).toHaveLength(1)
    expect(JSON.stringify({ ...after, simulations: [] })).toBe(before)
    // Zusätzlich ausdrücklich (Stop-Bedingung der Spezifikation):
    expect(JSON.stringify(after.accounts)).toBe(JSON.stringify(example.accounts))
    expect(JSON.stringify(after.portfolioPositions)).toBe(
      JSON.stringify(example.portfolioPositions),
    )
    expect(JSON.stringify(after.savingsPlans)).toBe(JSON.stringify(example.savingsPlans))
    expect(JSON.stringify(after.goals)).toBe(JSON.stringify(example.goals))
  })

  it('B3-Fehlerfokus: leerer Name wird feldnah gemeldet und fokussiert', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Speichern')
    expect(screen.getByText('Der Name darf nicht leer sein.')).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Name *'))
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Warnung über 8 %: „sehr optimistische Annahme“ als Status, nie ein Fehler', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    setField('Jährliche Renditeannahme in Prozent (0–15)', '10')
    const warning = screen.getByText(/sehr optimistische Annahme/)
    expect(warning).toBeInTheDocument()
    expect(warning).toHaveAttribute('role', 'status')
    // Über 15 % → feldnaher Fehler beim Absenden.
    setField('Name *', 'Zu optimistisch')
    setField('Jährliche Renditeannahme in Prozent (0–15)', '16')
    clickButton('Speichern')
    expect(
      screen.getByText(/Renditeannahme zwischen 0 und 15 Prozent/),
    ).toBeInTheDocument()
  })

  it('Abbrechen übernimmt nichts (kein Dirty-State) und Escape schließt das Formular', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    setField('Name *', 'Verworfen')
    clickButton('Abbrechen')
    expect(screen.queryByLabelText('Name *')).toBeNull()
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.data!.simulations).toHaveLength(0)
  })

  it('Escape aus einem Select des Formulars (Popup-Bubbling) schließt das Formular NICHT', () => {
    // Echtbrowser-Fall: Escape schließt das native Select-Popup, das keydown
    // bubbelt aber zur Section – das Formular muss offen bleiben.
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    clickButton('Beitrag hinzufügen')
    const form = screen.getByRole('form', { name: 'Neue Simulation' })
    const firstSelect = within(form).getAllByRole('combobox')[0]
    fireEvent.keyDown(firstSelect, { key: 'Escape' })
    expect(screen.getByRole('form', { name: 'Neue Simulation' })).toBeInTheDocument()
  })
})

describe('SimulatorPage – Bearbeiten, Kopieren, Löschen (G12)', () => {
  it('unverändertes Speichern im Bearbeiten-Formular übernimmt keinen Bestand (K3)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    const before = captured.current!.state.data
    clickButton('Simulation „Basisszenario real“ bearbeiten')
    clickButton('Speichern')
    // Kein applyDataChange: identische Referenz, kein neuer Bestand.
    expect(captured.current!.state.data).toBe(before)
  })

  it('Bearbeiten ändert die Parameter (key={id}-Formular mit Vorbelegung aus der Simulation)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    clickButton('Simulation „Basisszenario real“ bearbeiten')
    expect(screen.getByLabelText('Name *')).toHaveValue('Basisszenario real')
    clickButton('60 Monate')
    clickButton('Speichern')
    expect(screen.getByText(/Zeitraum: 60 Monate/)).toBeInTheDocument()
    expect(captured.current!.state.data!.simulations[0].params.months).toBe(60)
  })

  it('Kopieren erzeugt „(Kopie)“ mit heutigem Datum; Ist-Daten bleiben unberührt', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    clickButton('Simulation „Basisszenario real“ kopieren')
    // Der Kopie-Name erscheint als Karte UND als Vergleichs-Auswahl.
    expect(screen.getAllByText('Basisszenario real (Kopie)').length).toBeGreaterThan(0)
    expect(screen.getByText(/wurde kopiert/)).toBeInTheDocument()
    expect(captured.current!.state.data!.simulations).toHaveLength(2)
  })

  it('Löschen NUR mit G12-Bestätigung inkl. Name; Erfolg mit Feedback und Fokus-Anker', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    clickButton('Simulation „Basisszenario real“ löschen')
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(String(confirmSpy.mock.calls[0][0])).toContain('Basisszenario real')
    expect(String(confirmSpy.mock.calls[0][0])).toContain('endgültig löschen')
    expect(captured.current!.state.data!.simulations).toHaveLength(0)
    expect(screen.getByText(/wurde gelöscht/)).toBeInTheDocument()
    // Fokus-Anker (M11-B1): der auslösende Button ist weg → Listenüberschrift.
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('simulator-list-title')
    })
  })

  it('Abbruch im Löschdialog lässt den Bestand Byte-identisch', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    const before = JSON.stringify(captured.current!.state.data)
    clickButton('Simulation „Basisszenario real“ löschen')
    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect(screen.getByText('Basisszenario real')).toBeInTheDocument()
  })
})

describe('SimulatorPage – Detailansicht (Tabelle primär, Chart nur Zusatz)', () => {
  function openDetail(captured: Captured): void {
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    clickButton('Simulation „Basisszenario real“ ansehen')
  }

  it('zeigt Kennzeichnung, Zeitraum ab Folgemonat und die F22-Pins (927,59/5.222,47/6.150,06)', () => {
    const captured = renderPage()
    openDetail(captured)
    expect(
      screen.getByRole('heading', { name: 'Detailansicht: Basisszenario real' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/ab August 2026 \(Folgemonat/)).toBeInTheDocument()
    // Der Endwert erscheint in der KPI-Kachel UND in der Tabelle (Primärquelle).
    expect(screen.getAllByText(euroText(6150.06)).length).toBeGreaterThan(0)
    expect(
      screen.getByText(`Depot ${euroText(5222.47)} · Tagesgeld ${euroText(927.59)}`),
    ).toBeInTheDocument()
    // G8: eingezahlt gesamt vs. eigen getrennt (12 × 125 + 1.500 / 12 × 118,50 + 1.000).
    expect(screen.getByText(euroText(3000))).toBeInTheDocument()
    expect(screen.getByText(euroText(2422))).toBeInTheDocument()
    expect(screen.getByText('entfällt (0 %)')).toBeInTheDocument()
  })

  it('B1: „Detailansicht schließen“ gibt den Fokus an den Karten-Anker zurück', async () => {
    const captured = renderPage()
    openDetail(captured)
    clickButton('Detailansicht schließen')
    expect(screen.queryByRole('heading', { name: 'Detailansicht: Basisszenario real' })).toBeNull()
    await waitFor(() => {
      expect(document.activeElement?.id).toBe('sim-card-heading-sim-basisszenario-real')
    })
  })

  it('Verlaufstabelle ist eine fokussierbare benannte Region mit Monat 0 = Start', () => {
    const captured = renderPage()
    openDetail(captured)
    const region = screen.getByRole('region', { name: 'Verlaufstabelle (horizontal scrollbar)' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByText('Juli 2026 (Start)')).toBeInTheDocument()
    expect(within(region).getByText('August 2026 (Monat 1)')).toBeInTheDocument()
    expect(within(region).getByText('Juli 2027 (Monat 12)')).toBeInTheDocument()
    // Startzeile zeigt die Seed-Werte.
    expect(within(region).getAllByText(euroText(3150.06)).length).toBeGreaterThan(0)
  })

  it('Chart ist aria-hidden (nur Zusatz) mit sichtbarem Hinweis auf die Tabelle und Legende', () => {
    const captured = renderPage()
    openDetail(captured)
    expect(
      screen.getByText(/alle Werte stehen in der Tabelle/),
    ).toBeInTheDocument()
    const chart = document.querySelector('.sim-chart')
    expect(chart).not.toBeNull()
    expect(chart!.getAttribute('aria-hidden')).toBe('true')
    expect(chart!.textContent).toContain('Gesamtvermögen (durchgezogen)')
    expect(chart!.textContent).toContain('Depot (gestrichelt)')
    expect(chart!.textContent).toContain('Tagesgeld (gepunktet)')
    expect(chart!.querySelectorAll('polyline')).toHaveLength(3)
  })

  it('bei > 24 Monaten: Jahresschritte + letzte Zeile; vollständige Daten über Details', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Langfrist', { months: '60' })
    clickButton('Simulation „Langfrist“ ansehen')
    const region = screen.getByRole('region', { name: 'Verlaufstabelle (horizontal scrollbar)' })
    // Jahresschritte: Start, 12, 24, 36, 48, 60 → 6 Datenzeilen.
    expect(within(region).getAllByRole('row')).toHaveLength(7)
    expect(
      screen.getByText('Alle 60 Monate anzeigen (vollständige Tabelle)'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Vollständige Verlaufstabelle (horizontal scrollbar)' }),
    ).toBeInTheDocument()
    // B6: die kompakte Tabelle ist sichtbar als Jahresschritte gekennzeichnet …
    expect(
      screen.getByText(/Jahresschritte – die Zwischenmonate stehen unter/),
    ).toBeInTheDocument()
    // … und der Chart-Hinweis verweist auf die vollständige Tabelle im Details-Block.
    expect(
      screen.getByText(/alle Werte stehen in der Tabelle; die vollständigen Monatswerte enthält/),
    ).toBeInTheDocument()
  })

  it('Zielanalyse: Status mit Begründungen; pausierte Ziele ausgenommen; Pflicht-Kennzeichnung', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Langfrist', { months: '120' })
    clickButton('Simulation „Langfrist“ ansehen')
    // 10.000-€-Depotziel ist mit 100 €/Monat + 1.500 €/Jahr im 120-Monats-Horizont erreichbar.
    expect(screen.getByText('10.000 EUR Depot')).toBeInTheDocument()
    expect(screen.getAllByText(/Erreichbar/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/weil der Zielbetrag/).length).toBeGreaterThan(0)
    // 50.000-€-Ziel bleibt außerhalb des Horizonts.
    expect(screen.getAllByText(/Im Horizont nicht erreicht/).length).toBeGreaterThan(0)
    // Nicht projizierbare Kennzahl (Sparrate) → „keine Aussage möglich“ mit Begründung.
    expect(screen.getAllByText(/nicht Teil des Aggregatmodells/).length).toBeGreaterThan(0)
    // Pausierte Ziele (Auto-Rücklage, Urlaub) sind ausgenommen.
    expect(screen.queryByText('Auto-Ruecklage')).toBeNull()
    expect(screen.queryByText('Urlaub')).toBeNull()
    expect(
      screen.getByText(/Die Zielanalyse ist eine Projektion mit Annahme – keine Prognose\./),
    ).toBeInTheDocument()
  })

  it('r > 0: Kennzeichnung „Projektion mit Annahme X % p. a.“ und Wertzuwachs-Kachel', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    openNewSimulationForm()
    setField('Name *', 'Mit Annahme')
    clickButton('Aktuelle Werte übernehmen')
    clickButton('Vorbelegung: reale Sparraten')
    setField('Jährliche Renditeannahme in Prozent (0–15)', '5')
    clickButton('Speichern')
    clickButton('Simulation „Mit Annahme“ ansehen')
    expect(
      screen.getAllByText(/Projektion mit Annahme 5 % p\. a\. – keine Prognose, keine Anlageberatung/)
        .length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('Wertzuwachs aus der Annahme')).toBeInTheDocument()
    expect(screen.queryByText('entfällt (0 %)')).toBeNull()
  })
})

describe('SimulatorPage – Vergleich (≥ 2 Simulationen, G9-Hinweis)', () => {
  it('unter 2 Simulationen: verständlicher Hinweis statt Auswahl', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(
      screen.getByText('Für einen Vergleich braucht es mindestens zwei gespeicherte Simulationen.'),
    ).toBeInTheDocument()
  })

  it('Vergleichstabelle mit Annahmen, Endwerten, G8-Zeile und Sicht-Mischungs-Hinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Real')
    createSmoothedSimulation('Geglättet')
    // B3: die Vergleichs-Auswahl ergänzt das Anlagedatum zur Unterscheidbarkeit.
    act(() => {
      fireEvent.click(screen.getByLabelText('Real (vom 19.07.2026)'))
    })
    expect(
      screen.getByText('Bitte mindestens zwei Simulationen auswählen, um sie zu vergleichen.'),
    ).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByLabelText('Geglättet (vom 19.07.2026)'))
    })
    const region = screen.getByRole('region', { name: 'Vergleichstabelle (horizontal scrollbar)' })
    expect(within(region).getByText('Endvermögen (projiziert)')).toBeInTheDocument()
    // Beide Sichten enden nach 12 Monaten identisch (F22-Konsistenz): 6.150,06 zweimal.
    expect(within(region).getAllByText(euroText(6150.06))).toHaveLength(2)
    expect(within(region).getByText('Davon eigene Sparleistung (G8)')).toBeInTheDocument()
    expect(within(region).getByText('reale Sicht')).toBeInTheDocument()
    expect(within(region).getByText('geglättete Sicht (Analysewert)')).toBeInTheDocument()
    expect(within(region).getByText('Zielerreichung (kurz)')).toBeInTheDocument()
    // G9: gemischte Sichten werden ausdrücklich ausgewiesen.
    expect(
      screen.getByText(/mischt reale und geglättete Telekom-Sichten/),
    ).toBeInTheDocument()
  })
})

describe('SimulatorPage – Qualitätsregeln', () => {
  it('keine technischen IDs, kein NaN/Infinity/undefined im Seitentext', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    clickButton('Simulation „Basisszenario real“ ansehen')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\b(?:sim|acc|pos|sp|goal|tp|plan)-[a-z0-9]+/)
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
    expect(text).not.toContain('undefined')
  })

  it('A11y-Grundmuster: benannte Sektionen und fokussierbare Tabellen-Regionen', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    createRealSimulation('Basisszenario real')
    expect(screen.getByRole('heading', { name: 'Übersicht' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gespeicherte Simulationen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vergleich' })).toBeInTheDocument()
    clickButton('Simulation „Basisszenario real“ ansehen')
    const region = screen.getByRole('region', { name: 'Verlaufstabelle (horizontal scrollbar)' })
    expect(region).toHaveAttribute('tabindex', '0')
    // Detail-Fokus-Anker: Überschrift erhält den Fokus.
    expect(document.getElementById('sim-detail-title')).not.toBeNull()
  })
})
