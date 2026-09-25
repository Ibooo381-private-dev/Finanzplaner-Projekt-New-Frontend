/**
 * UI-Tests der Übersicht (M7, rein lesend): Dateistatus, Vermögens-Kacheln
 * (F1–F4, F7) inkl. „unbekannt“-Kennzeichnung (G11), Sparen und Zuflüsse
 * (F8/F9, geglättet gekennzeichnet), Zielfortschritt (§7/T7, konservative
 * Sparraten-Regel), Datenqualität/Warnungen (W4, keine technischen IDs) und
 * Navigation. Muster wie tests/pages/depotPage.test.tsx (echter Provider +
 * Capture + LOAD_SUCCEEDED mit loadExample()).
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
import { formatIsoTimestampGerman } from '../../src/format/date'
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

function renderDashboard(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <AppLayout initialPage="uebersicht" />
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

/** KPI-Kachel über ihren dt-Text finden (scoped Assertions auf den dd-Inhalt). */
function kpiTile(label: string): HTMLElement {
  const tile = screen.getByText(label).closest('.kpi-tile')
  if (!(tile instanceof HTMLElement)) throw new Error(`Keine KPI-Kachel für "${label}" gefunden.`)
  return tile
}

/** Wert (dd) einer Fakten-Zeile über ihren dt-Text finden. */
function factValue(region: HTMLElement, label: string): string {
  const term = within(region).getByText(label)
  const value = term.nextElementSibling
  if (!(value instanceof HTMLElement)) throw new Error(`Kein Wert für "${label}" gefunden.`)
  return value.textContent ?? ''
}

function fileStatusRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Dateistatus' })
}

function wealthRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Vermögen' })
}

function goalsRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Ziele' })
}

function qualityRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Datenqualität und Warnungen' })
}

/** Ziel-Eintrag (li) über den Zielnamen finden. */
function goalItem(name: string): HTMLElement {
  const title = within(goalsRegion()).getByText(name)
  const item = title.closest('li')
  if (!item) throw new Error(`Kein Ziel-Eintrag für "${name}" gefunden.`)
  return item
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

describe('DashboardPage – Leerzustand', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“ und KEINE weiteren Sektionen', () => {
    renderDashboard()
    expect(screen.getByRole('heading', { level: 2, name: 'Übersicht' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import und weitere Optionen' })).toBeInTheDocument()
    // Keine weiteren Sektionen: die h3-Überschriften der Fachblöcke fehlen.
    // („Ziele“ existiert als Navigationspunkt – deshalb Überschriften-Queries.)
    expect(screen.queryByRole('heading', { level: 3, name: 'Dateistatus' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3, name: 'Vermögen' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3, name: 'Ziele' })).toBeNull()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Datenqualität und Warnungen' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Depotwerte erfassen' })).toBeNull()
  })
})

describe('DashboardPage – Dateistatus', () => {
  it('zeigt Dateiname, „Stand der Datei“, Ungespeichert-Status und Bewertungsdatum 17.07.2026', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const region = fileStatusRegion()
    expect(within(region).getByText('finance-data.json')).toBeInTheDocument()
    // Zeitstempel erscheinen deutsch formatiert, nie als ISO-Rohtext (A11y-Befund B1).
    const updatedAt = formatIsoTimestampGerman(loadExample().metadata.updatedAt)
    expect(
      within(region).getByText(`noch nicht in dieser Sitzung – Stand der Datei: ${updatedAt}`),
    ).toBeInTheDocument()
    expect(region.textContent).not.toContain('T00:00:00')
    expect(
      within(region).getByText('✓ Keine ungespeicherten Änderungen vorhanden'),
    ).toBeInTheDocument()
    expect(within(region).getByText('17.07.2026')).toBeInTheDocument()
  })

  it('Dirty-Status: nach markDirty ist der Ungespeichert-Hinweis im Dateistatus sichtbar', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    act(() => {
      captured.current!.actions.markDirty()
    })
    expect(
      within(fileStatusRegion()).getByText('● Ungespeicherte Änderungen vorhanden'),
    ).toBeInTheDocument()
    expect(
      within(fileStatusRegion()).queryByText('✓ Keine ungespeicherten Änderungen vorhanden'),
    ).toBeNull()
  })

  it('zeigt nach SAVE_SUCCEEDED den Speicherzeitpunkt (lastSavedAt) an', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    act(() => {
      captured.current!.dispatch({
        type: 'SAVE_SUCCEEDED',
        data: captured.current!.state.data!,
        nowIso: NOW_ISO,
      })
    })
    // Auch der Speicherzeitpunkt erscheint deutsch formatiert (nie ISO-Rohtext).
    expect(
      within(fileStatusRegion()).getByText(formatIsoTimestampGerman(NOW_ISO)),
    ).toBeInTheDocument()
    expect(fileStatusRegion().textContent).not.toContain(NOW_ISO)
  })
})

describe('DashboardPage – Vermögen (Seed)', () => {
  it('Kacheln: GV 3.150,06; Depot 2.522,47; Tagesgeld 627,59; Sonstiges „unbekannt“ (kein Summand bewertet)', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    expect(
      within(kpiTile('Gesamtvermögen (Tagesgeld + Depot)')).getByText(euroText(3150.06)),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Depotwert (aktive Positionen)')).getByText(euroText(2522.47)),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Tagesgeld gesamt (aktive Konten)')).getByText(euroText(627.59)),
    ).toBeInTheDocument()

    // Giro, ING-Rücklage, TR-Cash und Bitget haben im Seed LEERE Historien →
    // KEIN Summand ist bewertet, also zeigt die Kachel „unbekannt“ und nie
    // eine leere 0-Summe (G11, Grundregel „fehlende Werte nie als 0“).
    const other = kpiTile('Sonstiges aktives Kontovermögen')
    expect(within(other).getByText('unbekannt')).toBeInTheDocument()
    expect(within(other).queryByText(euroText(0))).toBeNull()
    expect(within(other).getByText('⚠ enthält unbekannte Werte')).toBeInTheDocument()
    expect(
      within(other).getByText('zusätzlich zum Gesamtvermögen – zählt zum Finanzvermögen'),
    ).toBeInTheDocument()

    // Depot und Tagesgeld sind im Seed vollständig → dort KEIN „unbekannt“-Zusatz.
    expect(
      within(kpiTile('Depotwert (aktive Positionen)')).queryByText('⚠ enthält unbekannte Werte'),
    ).toBeNull()
    expect(
      within(kpiTile('Tagesgeld gesamt (aktive Konten)')).queryByText(
        '⚠ enthält unbekannte Werte',
      ),
    ).toBeNull()
  })

  it('Weitere Kennzahlen: World 1.020,30; Anteile 80,08 %/19,92 %; 9 aktive Konten; 6 aktive Positionen', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const region = wealthRegion()
    expect(factValue(region, 'MSCI World gesamt')).toBe(formatEuro(1020.3))
    expect(factValue(region, 'Anteil Depot am Gesamtvermögen')).toBe('80,08 %')
    expect(factValue(region, 'Anteil Tagesgeld am Gesamtvermögen')).toBe('19,92 %')
    // ERWARTUNG DOKUMENTIERT: Der Seed enthält 9 Konten, alle aktiv (isActive
    // fehlt = aktiv): Giro, ING-Rücklage, VW-Tagesgeld, TR-Cash, 3 Depotkonten,
    // Bitget-Krypto UND das Telekom-Pensionskonto. Das Pensionskonto ist ein
    // Merkposten OHNE Wert – es zählt im Konten-Zähler mit (es IST ein aktives
    // Konto), fließt aber in keine Wertkennzahl ein.
    expect(factValue(region, 'Aktive Konten')).toBe('9')
    expect(factValue(region, 'Aktive Positionen')).toBe('6')
  })

  it('percentDecimals 0 wirkt auf die Anteilsanzeigen: „80 %" statt „80,08 %" (calculation-tester M14)', () => {
    const captured = renderDashboard()
    const data = loadExample()
    loadData(captured, {
      ...data,
      settings: {
        ...data.settings,
        display: { ...data.settings.display, percentDecimals: 0 },
      },
    })
    const region = wealthRegion()
    expect(factValue(region, 'Anteil Depot am Gesamtvermögen')).toBe('80 %')
    expect(factValue(region, 'Anteil Tagesgeld am Gesamtvermögen')).toBe('20 %')
  })

  it('inaktive Position und inaktives Konto: Summen und Zähler sinken entsprechend', () => {
    const captured = renderDashboard()
    let data = withPositionPatched(loadExample(), 'pos-telekom-aktien', { isActive: false })
    data = withAccountPatched(data, 'acc-bitget-krypto', { isActive: false })
    loadData(captured, data)
    // Depot ohne Telekom: 2.522,47 − 1.369,14 = 1.153,33; GV = 627,59 + 1.153,33.
    expect(
      within(kpiTile('Depotwert (aktive Positionen)')).getByText(euroText(1153.33)),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Gesamtvermögen (Tagesgeld + Depot)')).getByText(euroText(1780.92)),
    ).toBeInTheDocument()
    const region = wealthRegion()
    expect(factValue(region, 'Aktive Konten')).toBe('8')
    expect(factValue(region, 'Aktive Positionen')).toBe('5')
    // Das inaktive Bitget-Konto erscheint nicht mehr unter den fehlenden Salden.
    expect(within(qualityRegion()).queryByText(/Bitget/)).toBeNull()
  })

  it('GV unbekannt (alle Historien leer): Kacheln „unbekannt“, Anteile „nicht berechenbar“, nirgends NaN', () => {
    const captured = renderDashboard()
    let data = loadExample()
    for (const position of data.portfolioPositions) {
      data = withPositionPatched(data, position.id, { valueHistory: [] })
    }
    data = withAccountPatched(data, 'acc-vw-tagesgeld', { balanceHistory: [] })
    loadData(captured, data)
    // KEIN Summand bewertet → GV/Depot/Tagesgeld zeigen „unbekannt“, nie 0 (G11).
    for (const label of [
      'Gesamtvermögen (Tagesgeld + Depot)',
      'Depotwert (aktive Positionen)',
      'Tagesgeld gesamt (aktive Konten)',
    ]) {
      expect(within(kpiTile(label)).getByText('unbekannt')).toBeInTheDocument()
      expect(within(kpiTile(label)).queryByText(euroText(0))).toBeNull()
    }
    const region = wealthRegion()
    expect(factValue(region, 'Anteil Depot am Gesamtvermögen')).toBe('nicht berechenbar')
    expect(factValue(region, 'Anteil Tagesgeld am Gesamtvermögen')).toBe('nicht berechenbar')
    // Auch die World-Zeile folgt der G11-Regel: kein Summand bewertet → „unbekannt“.
    expect(factValue(region, 'MSCI World gesamt')).toContain('unbekannt')
    // Ohne Einträge gibt es kein Bewertungsdatum – als Text, nie nur „–“ (A11y-Befund B2).
    expect(
      within(fileStatusRegion()).getByText('unbekannt – noch kein Bewertungsdatum erfasst'),
    ).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('World-Zeile mit Teilsumme: 1.020,30 − 577,99 = 442,31 plus „enthält unbekannte Werte“-Hinweis', () => {
    // Reviewer-Auflage M1 (M7): Auch die Sekundär-Zeile „MSCI World gesamt“
    // folgt der G11-Regel – Teilsummen tragen den Hinweis, vollständig
    // unbewertete Summen zeigen „unbekannt“.
    const captured = renderDashboard()
    const data = withPositionPatched(loadExample(), 'pos-vl-ishares-world', { valueHistory: [] })
    loadData(captured, data)
    const region = wealthRegion()
    expect(factValue(region, 'MSCI World gesamt')).toContain(formatEuro(442.31))
    expect(factValue(region, 'MSCI World gesamt')).toContain('enthält unbekannte Werte')
  })

  it('fehlender Positionswert: Depotwert 2.488,55, Kachel-Kennzeichnung und Name im Warnpanel', () => {
    const captured = renderDashboard()
    const data = withPositionPatched(loadExample(), 'pos-ishares-gold-etc', { valueHistory: [] })
    loadData(captured, data)
    const depotTile = kpiTile('Depotwert (aktive Positionen)')
    // 2.522,47 − 33,92 = 2.488,55 – unbekannt zählt nie als 0 (G11).
    expect(within(depotTile).getByText(euroText(2488.55))).toBeInTheDocument()
    expect(within(depotTile).getByText('⚠ enthält unbekannte Werte')).toBeInTheDocument()
    const quality = qualityRegion()
    expect(
      within(quality).getByText(/Positionen ohne aktuellen Wert: iShares Physical Gold ETC/),
    ).toBeInTheDocument()
    expect(
      within(quality).getByText('⚠ Für eine vollständige Berechnung fehlen Daten.'),
    ).toBeInTheDocument()
  })
})

describe('DashboardPage – Vermögensband (Redesign)', () => {
  it('Band ist rein dekorativ (aria-hidden); die Anteile stehen als Text-Legende', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const region = wealthRegion()
    const band = region.querySelector('.band')
    expect(band).not.toBeNull()
    expect(band).toHaveAttribute('aria-hidden', 'true')
    // Breiten folgen den Anteilen aus der reinen Schicht (80,08 % / 19,92 %).
    const parts = Array.from(band!.querySelectorAll<HTMLElement>('.band-part'))
    expect(parts.map((part) => part.textContent)).toEqual(['Depot', 'Tagesgeld'])
    expect(parseFloat(parts[0].style.flexBasis)).toBeCloseTo(80.08, 1)
    expect(parseFloat(parts[1].style.flexBasis)).toBeCloseTo(19.92, 1)
    expect(factValue(region, 'Anteil Depot am Gesamtvermögen')).toBe('80,08 %')
    expect(within(region).getByText('Bewertungsstand 17.07.2026.', { exact: false })).toBeInTheDocument()
  })

  it('ohne bewertete Werte: leeres Band, Legende „nicht berechenbar“, nie NaN', () => {
    const captured = renderDashboard()
    const data = loadExample()
    loadData(captured, {
      ...data,
      accounts: data.accounts.map((account) => ({ ...account, balanceHistory: [] })),
      portfolioPositions: data.portfolioPositions.map((position) => ({
        ...position,
        valueHistory: [],
      })),
    })
    const region = wealthRegion()
    expect(region.querySelectorAll('.band-part')).toHaveLength(0)
    expect(factValue(region, 'Anteil Tagesgeld am Gesamtvermögen')).toBe('nicht berechenbar')
    expect(region.textContent).not.toContain('NaN')
  })
})

describe('DashboardPage – Sparen und Zuflüsse (Seed)', () => {
  it('real 118,50/125,00 und geglättet 201,83/250,00 – geglättete Werte sind gekennzeichnet', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    expect(
      within(kpiTile('Eigene Sparleistung (real)')).getByText(euroText(118.5)),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Eigene Sparleistung – geglättet (Analysewert)')).getByText(
        euroText(201.83),
      ),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Gesamtzufluss (real)')).getByText(euroText(125)),
    ).toBeInTheDocument()
    expect(
      within(kpiTile('Gesamtzufluss – geglättet (Analysewert)')).getByText(euroText(250)),
    ).toBeInTheDocument()
  })

  it('Erklärtext über das Details-Muster (kein title-only): eigene vs. Gesamt, real vs. geglättet', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    expect(screen.getByText('So unterscheiden sich die Sparkennzahlen')).toBeInTheDocument()
    expect(screen.getByText(/nur eigenes Geld/)).toBeInTheDocument()
    expect(screen.getByText(/VL-Zuschuss, Shares2you-Bonus, Saveback/)).toBeInTheDocument()
    expect(screen.getByText(/Jahresbeträge wie der Telekom-Jahresbeitrag sind hier NICHT enthalten/)).toBeInTheDocument()
    expect(screen.getByText(/reine Analysewerte/)).toBeInTheDocument()
  })
})

describe('DashboardPage – Ziele', () => {
  it('Notgroschen (Seed): Ziel 4.680,00, Ist 627,59, Rest 4.052,41, 13,41 % mit Fortschrittsanzeige', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const item = goalItem('Notgroschen')
    expect(
      within(item).getByText(
        `Ist: ${euroText(627.59)} · Ziel: ${euroText(4680)} · Restbetrag: ${euroText(4052.41)}`,
      ),
    ).toBeInTheDocument()
    expect(within(item).getByText('13,41 %')).toBeInTheDocument()
    const bar = within(item).getByRole('progressbar', { name: 'Fortschritt „Notgroschen“' })
    expect(bar).toHaveAttribute('max', '4680')
    expect(bar).toHaveAttribute('value', '627.59')
    // Der ECHTE Prozentwert ist programmatisch mit dem Balken verknüpft (A11y-Befund B4).
    const describedBy = bar.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toBe('13,41 %')
  })

  it('Depot-Ziel 10.000 (25,22 %) und Gesamtvermögens-Ziel 50.000 (6,30 %)', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const depotGoal = goalItem('10.000 EUR Depot')
    expect(
      within(depotGoal).getByText(
        `Ist: ${euroText(2522.47)} · Ziel: ${euroText(10000)} · Restbetrag: ${euroText(7477.53)}`,
      ),
    ).toBeInTheDocument()
    expect(within(depotGoal).getByText('25,22 %')).toBeInTheDocument()
    const wealthGoal = goalItem('50.000 EUR Gesamtvermoegen')
    expect(
      within(wealthGoal).getByText(
        `Ist: ${euroText(3150.06)} · Ziel: ${euroText(50000)} · Restbetrag: ${euroText(46849.94)}`,
      ),
    ).toBeInTheDocument()
    expect(within(wealthGoal).getByText('6,30 %')).toBeInTheDocument()
  })

  it('Sparraten-Ziel (U3, M10): primärer Fortschritt 11,85 % auf Basis der eigenen realen Sparleistung + Analysewert 20,18 %', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const item = goalItem('Monatlich 1.000 EUR Sparrate')
    expect(within(item).getByText(`Ziel: ${euroText(1000)} pro Monat`)).toBeInTheDocument()
    expect(
      within(item).getByText('Fortschritt auf Basis deiner eigenen realen monatlichen Sparleistung:'),
    ).toBeInTheDocument()
    // Primärer Fortschritt = F8 realMonthly 118,50 / 1.000 = 11,85 % (U3).
    const bar = within(item).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“',
    })
    expect(bar).toHaveAttribute('max', '1000')
    expect(bar).toHaveAttribute('value', '118.5')
    const describedBy = bar.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toContain('11,85 %')
    // Geglätteter Analysewert 201,83 / 1.000 = 20,18 % – klar gekennzeichnet.
    expect(
      within(item).getByText(/Geglätteter Analysewert – nicht der primäre Zielfortschritt: 20,18 %/),
    ).toBeInTheDocument()
    // Der frühere „offen“-Hinweis existiert nicht mehr.
    expect(within(item).queryByText(/noch nicht festgelegt/)).toBeNull()
  })

  it('Sparraten-Ziel: externe Zuflüsse erhöhen den primären Fortschritt NICHT (nur der Gesamtzufluss steigt)', () => {
    const captured = renderDashboard()
    const data = loadExample()
    loadData(captured, {
      ...data,
      savingsPlans: data.savingsPlans.map((plan) =>
        plan.id === 'sp-vl-employer' ? { ...plan, amount: 500 } : plan,
      ),
    })
    const item = goalItem('Monatlich 1.000 EUR Sparrate')
    const bar = within(item).getByRole('progressbar', {
      name: 'Fortschritt „Monatlich 1.000 EUR Sparrate“',
    })
    // Eigene reale Sparleistung bleibt 118,50 → weiterhin 11,85 %.
    expect(bar).toHaveAttribute('value', '118.5')
    const describedBy = bar.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy!)?.textContent).toContain('11,85 %')
    // Der Gesamtzufluss (getrennte Kachel) steigt dagegen sichtbar: 118,50 + 500 = 618,50.
    expect(
      within(kpiTile('Gesamtzufluss (real)')).getByText(euroText(618.5)),
    ).toBeInTheDocument()
  })

  it('zurückgestellte Ziele (Auto/Urlaub): nur Status, kein Fortschritt; Ziele ohne Kennzahl mit Hinweis', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    for (const name of ['Auto-Ruecklage', 'Urlaub']) {
      const item = goalItem(name)
      // Status als Text MIT Symbol (B4, konsistent zu den M12-Zielkarten).
      expect(within(item).getByText('⏸ zurückgestellt')).toBeInTheDocument()
      expect(
        within(item).getByText('Zurückgestellt – es wird kein Fortschritt berechnet.'),
      ).toBeInTheDocument()
      expect(within(item).queryByRole('progressbar')).toBeNull()
    }
    // Aktive Ziele ohne zugeordnete Kennzahl (metric null): kein erfundener Wert.
    for (const name of ['Physisches Gold', 'Berufseinstieg']) {
      const item = goalItem(name)
      expect(
        within(item).getByText('Fortschritt nicht berechenbar (keine Kennzahl zugeordnet).'),
      ).toBeInTheDocument()
      expect(within(item).queryByRole('progressbar')).toBeNull()
    }
  })

  it('Notgroschen ÜBERTROFFEN (5.000 > 4.680): Balken auf max gedeckelt, Text zeigt echte 106,84 %', () => {
    const captured = renderDashboard()
    const data = withAccountPatched(loadExample(), 'acc-vw-tagesgeld', {
      balanceHistory: [{ date: '2026-07-17', amount: 5000 }],
    })
    loadData(captured, data)
    const item = goalItem('Notgroschen')
    // Der ECHTE Prozentwert (5.000/4.680 = 106,84 %) steht als Text …
    expect(within(item).getByText('106,84 %')).toBeInTheDocument()
    expect(
      within(item).getByText(
        '✓ Ziel erreicht – die App schlägt nur vor, ändert aber nie automatisch Sparraten.',
      ),
    ).toBeInTheDocument()
    // … der Balken selbst bleibt auf max gedeckelt (Anzeige-Cap).
    const bar = within(item).getByRole('progressbar', { name: 'Fortschritt „Notgroschen“' })
    expect(bar).toHaveAttribute('max', '4680')
    expect(bar).toHaveAttribute('value', '4680')
  })

  it('negatives Tagesgeld (erlaubter Negativsaldo): Balken auf 0 geklemmt, Text zeigt echten negativen Anteil', () => {
    const captured = renderDashboard()
    const data = withAccountPatched(loadExample(), 'acc-vw-tagesgeld', {
      balanceHistory: [{ date: '2026-07-17', amount: -100 }],
    })
    loadData(captured, data)
    const item = goalItem('Notgroschen')
    // −100/4.680 = −2,14 % als ehrlicher Text; Rest 4.780 > Ziel bleibt sichtbar.
    expect(within(item).getByText('-2,14 %')).toBeInTheDocument()
    expect(
      within(item).getByText(
        `Ist: ${euroText(-100)} · Ziel: ${euroText(4680)} · Restbetrag: ${euroText(4780)}`,
      ),
    ).toBeInTheDocument()
    const bar = within(item).getByRole('progressbar', { name: 'Fortschritt „Notgroschen“' })
    expect(bar).toHaveAttribute('value', '0')
    expect(document.body.textContent).not.toContain('NaN')
  })

  it('keine Ziele im Bestand: verständlicher Leerzustand', () => {
    const captured = renderDashboard()
    loadData(captured, { ...loadExample(), goals: [] })
    expect(screen.getByText(/enthält noch keine Ziele/)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('ALLE Ziele archiviert: verständlicher Hinweis statt leerem Kartenrest (A11y B1)', () => {
    const captured = renderDashboard()
    const data = loadExample()
    loadData(captured, {
      ...data,
      goals: data.goals.map((goal) => ({ ...goal, status: 'archived' as const })),
    })
    expect(screen.getByText(/Alle Ziele sind archiviert/)).toBeInTheDocument()
    expect(within(goalsRegion()).queryByRole('progressbar')).toBeNull()
    expect(within(goalsRegion()).queryByRole('list')).toBeNull()
  })

  it('Auto-Ziel mit FREMDER Kennzahl wird nie stillschweigend als Notgroschen behandelt', () => {
    // Guard: isAutoCalculated greift nur für die Tagesgeld-Kennzahl (Notgroschen).
    // Ein Auto-Ziel mit metric "depotValue" läuft in den Depot-Zweig und nutzt
    // den hinterlegten Zielbetrag – nicht das Notgroschen-Ziel 4.680.
    const captured = renderDashboard()
    const data = loadExample()
    loadData(captured, {
      ...data,
      goals: [
        ...data.goals,
        {
          ...data.goals.find((goal) => goal.id === 'goal-notgroschen')!,
          id: 'goal-auto-depot',
          name: 'Auto-Depotziel',
          metric: 'depotValue',
          targetAmount: 20000,
        },
      ],
    })
    const item = goalItem('Auto-Depotziel')
    expect(
      within(item).getByText(
        `Ist: ${euroText(2522.47)} · Ziel: ${euroText(20000)} · Restbetrag: ${euroText(17477.53)}`,
      ),
    ).toBeInTheDocument()
  })
})

describe('DashboardPage – Datenqualität und Warnungen', () => {
  it('Seed: fehlende Kontosalden als NAMEN, Sammelhinweis und Snapshot-Datum 17.07.2026 – keine IDs', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    const quality = qualityRegion()
    expect(
      within(quality).getByText(
        '⚠ Aktive Konten ohne bekannten Saldo: Girokonto Sparkasse, ING Ruecklagenkonto Shares2you, Trade Republic Cash, Bitget Krypto.',
      ),
    ).toBeInTheDocument()
    expect(
      within(quality).getByText('⚠ Für eine vollständige Berechnung fehlen Daten.'),
    ).toBeInTheDocument()
    expect(
      within(quality).getByText('ℹ Neuester vollständiger Snapshot: 17.07.2026.'),
    ).toBeInTheDocument()
    // Seed ohne spätere Einträge: kein Veränderungs-Hinweis.
    expect(
      within(quality).queryByText(/Seit dem letzten vollständigen Snapshot/),
    ).toBeNull()
    // Keine technischen IDs im Endnutzertext.
    expect(quality.textContent).not.toContain('acc-')
    expect(quality.textContent).not.toContain('pos-')
  })

  it('positiver Fall: alle Historien befüllt → „Keine Auffälligkeiten“, kein Sammelhinweis', () => {
    const captured = renderDashboard()
    let data = loadExample()
    for (const id of ['acc-sparkasse-giro', 'acc-ing-ruecklage', 'acc-tr-cash', 'acc-bitget-krypto']) {
      data = withAccountPatched(data, id, {
        balanceHistory: [{ date: '2026-07-17', amount: 100 }],
      })
    }
    loadData(captured, data)
    const quality = qualityRegion()
    expect(
      within(quality).getByText(
        '✓ Keine Auffälligkeiten – alle aktiven Konten und Positionen haben erfasste Werte.',
      ),
    ).toBeInTheDocument()
    expect(
      within(quality).queryByText('⚠ Für eine vollständige Berechnung fehlen Daten.'),
    ).toBeNull()
    // Sonstiges Kontovermögen: 4 × 100 = 400,00 € ohne „unbekannt“-Zusatz.
    const other = kpiTile('Sonstiges aktives Kontovermögen')
    expect(within(other).getByText(euroText(400))).toBeInTheDocument()
    expect(within(other).queryByText('⚠ enthält unbekannte Werte')).toBeNull()
  })

  it('nach Werterfassung mit späterem Datum: Veränderungs-Hinweis mit Navigations-Button zur Depot-Seite', () => {
    const captured = renderDashboard()
    const data = withPositionPatched(loadExample(), 'pos-ishares-gold-etc', {
      valueHistory: [
        { date: '2026-07-17', value: 33.92 },
        { date: '2026-07-18', value: 34.5 },
      ],
    })
    loadData(captured, data)
    // Das Bewertungsdatum folgt dem jüngsten Eintrag.
    expect(within(fileStatusRegion()).getByText('18.07.2026')).toBeInTheDocument()
    const quality = qualityRegion()
    expect(
      within(quality).getByText(
        /Seit dem letzten vollständigen Snapshot wurden Werte verändert – ein neuer Snapshot friert den aktuellen Stand ein\./,
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      within(quality).getByRole('button', { name: 'Neuen Snapshot im Depot erfassen' }),
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Depot' })).toBeInTheDocument()
  })

  it('geladene Warnungen: nur Meldungstext, ohne Code/Pfad; IDs werden über Namen aufgelöst', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample(), [
      {
        code: 'W_SNAPSHOT_INCOMPLETE',
        path: 'snapshots[0]',
        message:
          'Der Snapshot vom 2026-07-17 ist unvollständig. Es fehlen Einträge für: Position "Testposition".',
      },
      {
        code: 'W_EMPTY_HISTORY',
        path: 'portfolioPositions[4].valueHistory',
        message: 'Für pos-ishares-gold-etc ist noch kein Wert erfasst.',
      },
    ])
    const quality = qualityRegion()
    expect(
      within(quality).getByText(/Der Snapshot vom 2026-07-17 ist unvollständig/),
    ).toBeInTheDocument()
    // Die technische ID aus der Meldung wurde über den Namen aufgelöst.
    expect(
      within(quality).getByText('⚠ Für iShares Physical Gold ETC ist noch kein Wert erfasst.'),
    ).toBeInTheDocument()
    expect(quality.textContent).not.toContain('pos-ishares-gold-etc')
    expect(quality.textContent).not.toContain('W_SNAPSHOT_INCOMPLETE')
    expect(quality.textContent).not.toContain('snapshots[0]')
  })
})

describe('DashboardPage – Navigation', () => {
  it('„Zum Depot“ wechselt die Seite und aria-current in der Hauptnavigation', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Depotwerte erfassen' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Depot' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('button', { name: 'Depot' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('button', { name: 'Übersicht' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('„Zu Konten“ und „Zu Daten & Backups“ führen zu den jeweiligen Seiten', () => {
    const captured = renderDashboard()
    loadData(captured, loadExample())
    fireEvent.click(screen.getByRole('button', { name: 'Kontostände erfassen' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Konten' })).toBeInTheDocument()

    // Zurück zur Übersicht über die Hauptnavigation, dann weiter zu Daten & Backups.
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Übersicht' }))
    fireEvent.click(screen.getByRole('button', { name: 'Datei speichern & sichern' }))
    expect(
      screen.getByRole('heading', { level: 2, name: 'Daten & Backups' }),
    ).toBeInTheDocument()
  })

  it('Snapshot-Erfassung nur im Depot: „Zum Depot“ führt dorthin, das Dashboard bleibt lesend', () => {
    // A11y-Befund B5: der frühere Zusatz-Button „Snapshot erfassen (Depot)“
    // war eine Dublette von „Zum Depot“ mit irreführender Erwartung und wurde
    // entfernt; der kontextbezogene Snapshot-Button im Warnpanel bleibt.
    const captured = renderDashboard()
    loadData(captured, loadExample())
    expect(screen.queryByRole('button', { name: 'Snapshot erfassen (Depot)' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Depotwerte erfassen' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Depot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snapshot erfassen' })).toBeInTheDocument()
    // Rein lesend: die Navigation hat keine Daten verändert.
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})
