/**
 * UI-Tests des Moduls „Rebalancing“ (M11): Leerzustände je Profiltyp
 * (Sparraten-Referenz, nicht befüllt, ungültig, Depotwert 0), Seed×tp-job-
 * Anzeige (KPI-Kacheln, Abweichungstabelle mit Summenzeile), Konjunktiv-
 * Pflicht (nie „solltest“), Empfehlungs-Gruppen mit Verkaufsoption als
 * letzter Möglichkeit, Sparraten-Vorschlag (A1-Budget 60/55, F17-Raten,
 * Rundungsausgleich, Dauer „ungefähr 27 Monate, ohne Kursentwicklung“,
 * „Übergewichtungen sind ohne Verkäufe nicht abbaubar“), Übernahme-Flow
 * (G5: confirm inkl. Beträge → plannedChange + Dirty; Abbruch Byte-identisch;
 * Ist-Daten/Sparpläne unverändert), Simulations-Kennzeichnung (A7, kein
 * Übernahme-Button), gespeicherte Planungen inkl. discard sowie
 * keine-IDs/NaN- und A11y-Grundmuster. Muster wie tests/pages/goalsPage.test.tsx.
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
      <AppLayout initialPage="rebalancing" />
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

function selectProfile(profileId: string): void {
  const select = screen.getByLabelText('Zielprofil für die Analyse')
  act(() => {
    fireEvent.change(select, { target: { value: profileId } })
  })
}

/** Seed-Bestand mit ausgewähltem Job-Profil laden (häufigster Testaufbau). */
function loadSeedWithJobProfile(): Captured {
  const captured = renderPage()
  loadData(captured, loadExample())
  selectProfile('tp-job')
  return captured
}

function tableRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Abweichungstabelle (horizontal scrollbar)' })
}

function savingsRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Sparratenbasierter Vorschlag (ohne Verkäufe)' })
}

function simulationRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Voll-Rebalancing (hypothetisch)' })
}

function plannedRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Gespeicherte Planungen' })
}

/** Gespeicherte Beispiel-Planung (programmatisch – die Beispieldatei bleibt unangetastet). */
function withPlannedChange(data: FinanceData, status: 'planned' | 'discarded'): FinanceData {
  return {
    ...data,
    plannedChanges: [
      {
        id: 'plan-2026-07-18',
        createdAt: '2026-07-18',
        basedOnProfileId: 'tp-job',
        status,
        items: [
          { refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: 23.83 },
          { refKind: 'group', ref: 'gold', plannedMonthlyAmount: 3.52 },
        ],
        note: null,
      },
    ] as FinanceData['plannedChanges'],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RebalancingPage – Leerzustände je Profiltyp', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Rebalancing' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zu „Daten & Backups“' })).toBeInTheDocument()
  })

  it('Standard ist das AKTIVE Profil (Ebene A, Sparraten-Referenz): Referenz-Hinweis statt Rechnung', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const select = screen.getByLabelText('Zielprofil für die Analyse')
    expect((select as HTMLSelectElement).value).toBe('tp-student-sparplan')
    expect(
      screen.getByText(/Die Referenz IST die aktuelle Verteilung/),
    ).toBeInTheDocument()
    // Keine Analyse-Abschnitte ohne Bestands-Soll.
    expect(
      screen.queryByRole('region', { name: 'Abweichungstabelle (horizontal scrollbar)' }),
    ).toBeNull()
  })

  it('leeres holdings-Profil (Ebene B): „Profil nicht befüllt – es wird nicht gerechnet.“ (M11-AK 4)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    selectProfile('tp-student-bestand')
    expect(screen.getByText(/Profil nicht befüllt – es wird nicht gerechnet/)).toBeInTheDocument()
  })

  it('ungültige Gewichtssumme → Fehlermeldung am Profil, KEINE Rechnung (F21)', () => {
    const captured = renderPage()
    const data = loadExample()
    const broken: FinanceData = {
      ...data,
      targetProfiles: data.targetProfiles.map((profile) =>
        profile.id === 'tp-custom'
          ? {
              ...profile,
              weights: [
                { refKind: 'group', ref: 'world', weight: 0.6 },
                { refKind: 'group', ref: 'telekom', weight: 0.3 },
              ],
            }
          : profile,
      ) as FinanceData['targetProfiles'],
    }
    loadData(captured, broken)
    selectProfile('tp-custom')
    expect(screen.getByRole('alert').textContent).toContain('ungültig')
    expect(screen.getByRole('alert').textContent).toContain('0.9')
    expect(
      screen.queryByRole('region', { name: 'Abweichungstabelle (horizontal scrollbar)' }),
    ).toBeNull()
  })

  it('Depotwert 0 (keine bewerteten Positionen): „nicht berechenbar“ (F20), kein NaN', () => {
    const captured = renderPage()
    const data = loadExample()
    const empty: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) => ({
        ...position,
        valueHistory: [],
      })) as FinanceData['portfolioPositions'],
    }
    loadData(captured, empty)
    selectProfile('tp-job')
    expect(screen.getByText(/nicht berechenbar \(F20\)/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
  })
})

describe('RebalancingPage – Seed × Job-Profil (Übersicht und Tabelle)', () => {
  it('KPI-Kacheln: Depotwert 2.522,47, Gesamtabweichung 1.573,80, größte Abweichung Telekom +44,28 Pp', () => {
    loadSeedWithJobProfile()
    const overview = screen.getByRole('region', { name: 'Übersicht' })
    expect(within(overview).getByText(euroText(2522.47))).toBeInTheDocument()
    expect(within(overview).getByText(euroText(1573.8))).toBeInTheDocument()
    expect(
      within(overview).getByText('Deutsche Telekom Aktien: +44,28 Pp'),
    ).toBeInTheDocument()
    expect(within(overview).getByText(/6 bewertete Zielpositionen/)).toBeInTheDocument()
    // Handlungsebene gesamt = höchste Stufe (Text + Symbol).
    expect(
      within(overview).getByText(/‼ Empfehlung – Rebalancing sinnvoll/),
    ).toBeInTheDocument()
  })

  it('Job-Profil-Hinweis: Aktivierung nur manuell und frühestens nach dem 30.09.2027', () => {
    loadSeedWithJobProfile()
    expect(screen.getByText(/frühestens nach dem\s+30\.09\.2027/)).toBeInTheDocument()
    expect(screen.getByText(/schaltet nie automatisch um/)).toBeInTheDocument()
  })

  it('Tabelle: Telekom-Zeile mit Ist/Soll/Abweichung/Verkaufsbedarf; Sortierung |Pp| absteigend; Summenzeile konsistent', () => {
    loadSeedWithJobProfile()
    const table = within(tableRegion()).getByRole('table')
    const rows = within(table).getAllByRole('row')
    // Kopfzeile, 6 Datenzeilen, Summenzeile.
    expect(rows).toHaveLength(8)
    // Größte |Pp|-Abweichung zuerst: Telekom.
    const telekomRow = rows[1]
    expect(telekomRow.textContent).toContain('Deutsche Telekom Aktien')
    expect(telekomRow.textContent).toContain('+44,28 Pp')
    expect(telekomRow.textContent?.replace(/\s/g, ' ')).toContain(euroText(1369.14))
    expect(telekomRow.textContent).toContain('10,00 %')
    expect(telekomRow.textContent?.replace(/\s/g, ' ')).toContain(euroText(1116.89))
    // Summenzeile: Σ Kauf = Σ Verkauf = 1.573,80.
    const footer = rows[rows.length - 1]
    const footerText = footer.textContent?.replace(/\s/g, ' ') ?? ''
    expect(footerText).toContain('Summe')
    expect(footerText).toContain(euroText(1573.8))
    // Konsistenztext mit sichtbarer Differenz.
    expect(screen.getByText(/Konsistenzprüfung: Σ Kaufbedarf/)).toBeInTheDocument()
  })

  it('lokale Profilauswahl ändert NIE das aktive Zielprofil oder den Bestand (G5)', () => {
    const captured = loadSeedWithJobProfile()
    expect(captured.current!.state.data!.settings.activeTargetProfileId).toBe(
      'tp-student-sparplan',
    )
    expect(captured.current!.state.isDirty).toBe(false)
  })
})

describe('RebalancingPage – Empfehlungen (Konjunktiv-Pflicht)', () => {
  it('alle Empfehlungssätze im Konjunktiv: „könntest du“ vorhanden, „solltest“ NIE', () => {
    loadSeedWithJobProfile()
    const text = document.body.textContent ?? ''
    expect(text).toContain('könntest du')
    expect(text).not.toContain('solltest')
  })

  it('Verkaufsoption NUR bei ≥ +10 Pp und als LETZTE Möglichkeit; Maßnahmen-Reihenfolge S2 sichtbar', () => {
    loadSeedWithJobProfile()
    const section = screen.getByRole('region', { name: 'Handlungsempfehlungen' })
    expect(
      within(section).getByText(/Verkäufe erst als letzte Möglichkeit prüfen/),
    ).toBeInTheDocument()
    const telekomSentence = within(section)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Deutsche Telekom Aktien'))
    expect(telekomSentence).toBeDefined()
    const sentence = telekomSentence!.textContent!
    expect(sentence).toContain('erst als letzte Möglichkeit')
    expect(sentence.replace(/\s/g, ' ')).toContain(`Verkauf von ungefähr ${euroText(1116.89)}`)
    // Der Verkauf steht NACH den Sparraten-Maßnahmen.
    expect(sentence.indexOf('Sparraten')).toBeLessThan(sentence.indexOf('Verkauf von ungefähr'))
    // Telekom ist NICHT vertraglich gebunden – kein VL-Hinweis in diesem Satz …
    expect(sentence).not.toContain('vertraglich gebundenen Plan')
    // … aber die VL-Position (own_fixed + isFlexible false) trägt den
    // F16-Randfall-Hinweis (finance-analyst M11).
    const vlSentence = within(section)
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('VL iShares Core MSCI World'))
    expect(vlSentence).toBeDefined()
    expect(vlSentence!.textContent).toContain('vertraglich gebundenen Plan')
    expect(vlSentence!.textContent).toContain('nur Hinweis')
    // Gold (−3,66 Pp) ist keine Empfehlung, sondern nur Anzeige.
    expect(within(section).getByText(/Nur Anzeige \(unter 5 Prozentpunkten\)/)).toHaveTextContent(
      'iShares Physical Gold ETC',
    )
    // Pflichthinweis der Empfehlungs-Sektion.
    expect(
      within(section).getByText(
        /Empfehlungen sind rein informativ – die App führt nie Käufe, Verkäufe oder Sparplanänderungen aus\./,
      ),
    ).toBeInTheDocument()
  })

  it('„keine Empfehlung nötig“, wenn alle Abweichungen unter 5 Pp liegen', () => {
    const captured = renderPage()
    const data = loadExample()
    // Eigene Aufteilung exakt auf der Ist-Verteilung (F5-Anteile) → alles unter 5 Pp.
    const matched: FinanceData = {
      ...data,
      targetProfiles: data.targetProfiles.map((profile) =>
        profile.id === 'tp-custom'
          ? {
              ...profile,
              weights: [
                { refKind: 'group', ref: 'world', weight: 0.4044845 },
                { refKind: 'group', ref: 'em', weight: 0.0392909 },
                { refKind: 'group', ref: 'gold', weight: 0.0134471 },
                { refKind: 'group', ref: 'telekom', weight: 0.5427775 },
              ],
            }
          : profile,
      ) as FinanceData['targetProfiles'],
    }
    loadData(captured, matched)
    selectProfile('tp-custom')
    expect(
      screen.getByText(/Alle Abweichungen liegen unter 5 Prozentpunkten – keine Empfehlung nötig/),
    ).toBeInTheDocument()
  })
})

describe('RebalancingPage – Sparraten-Vorschlag (A1-Budget, F17/F18)', () => {
  it('Budget 60,00 mit sichtbarer Herleitung; Raten 23,83/22,00/10,65/3,52; Ausgleich am SPDR; Dauer ungefähr 27 Monate', () => {
    loadSeedWithJobProfile()
    const section = savingsRegion()
    const text = section.textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain(`Flexibles Monatsbudget (abgeleitet): ${euroText(60)}`)
    // Herleitung nennt die beitragenden Pläne mit Beträgen.
    expect(text).toContain('TR Sparplan SPDR World')
    expect(text).toContain(`${euroText(23)} + `)
    const table = within(section).getByRole('table')
    const rowsText = within(table)
      .getAllByRole('row')
      .map((row) => row.textContent?.replace(/\s/g, ' ') ?? '')
    expect(rowsText.some((row) => row.includes('VL Eigenanteil') && row.includes('fest'))).toBe(
      true,
    )
    expect(
      rowsText.some(
        (row) =>
          row.includes('TR Sparplan SPDR World') &&
          row.includes(euroText(23.83)) &&
          row.includes('proportional'),
      ),
    ).toBe(true)
    expect(rowsText.some((row) => row.includes(euroText(10.65)))).toBe(true)
    expect(rowsText.some((row) => row.includes(euroText(3.52)))).toBe(true)
    // Sichtbare Rundungsdifferenz + Ausgleichs-Plan (F19).
    expect(text).toContain(`Rundungsdifferenz ${euroText(0.01)}`)
    expect(text).toContain('ausgeglichen am Plan „TR Sparplan SPDR World“')
    // Pflicht-Kennzeichnung der Dauer.
    expect(text).toContain('ungefähr 27 Monate')
    expect(text).toContain('ohne Kursentwicklung')
    // Pflicht-Kennzeichnung der verbleibenden Übergewichtungen.
    expect(text).toContain('Übergewichtungen sind ohne Verkäufe nicht abbaubar')
    expect(text).toContain('Deutsche Telekom Aktien')
  })

  it('pausierter Gold-Plan: Budget 55,00 und Begründung „pausiert – erhält 0“', () => {
    const captured = renderPage()
    const data = loadExample()
    const paused: FinanceData = {
      ...data,
      savingsPlans: data.savingsPlans.map((plan) =>
        plan.id === 'sp-tr-gold' ? { ...plan, isPaused: true } : plan,
      ) as FinanceData['savingsPlans'],
    }
    loadData(captured, paused)
    selectProfile('tp-job')
    const text = savingsRegion().textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain(`Flexibles Monatsbudget (abgeleitet): ${euroText(55)}`)
    expect(text).toContain('pausiert – erhält 0')
  })

  it('Budget 0 (alle Pläne unflexibel): definierter „keine Empfehlung“-Zustand ohne Tabelle', () => {
    const captured = renderPage()
    const data = loadExample()
    const inflexible: FinanceData = {
      ...data,
      savingsPlans: data.savingsPlans.map((plan) => ({
        ...plan,
        isFlexible: false,
      })) as FinanceData['savingsPlans'],
    }
    loadData(captured, inflexible)
    selectProfile('tp-job')
    const section = savingsRegion()
    expect(
      within(section).getByText(/Kein flexibles Budget vorhanden – es gibt keine Sparraten-Empfehlung/),
    ).toBeInTheDocument()
    expect(within(section).queryByRole('table')).toBeNull()
    expect(
      within(section).queryByRole('button', { name: 'Als geplante Einstellung speichern' }),
    ).toBeNull()
  })
})

describe('RebalancingPage – Übernahme-Flow (G5)', () => {
  it('confirm (inkl. Beträge) → Planung gespeichert, Dirty gesetzt, Ist-Daten und Sparpläne UNVERÄNDERT', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = loadSeedWithJobProfile()
    const before = captured.current!.state.data!
    const positionsBefore = JSON.stringify(before.portfolioPositions)
    const plansBefore = JSON.stringify(before.savingsPlans)
    act(() => {
      within(savingsRegion())
        .getByRole('button', { name: 'Als geplante Einstellung speichern' })
        .click()
    })
    // Bestätigungstext nennt die Beträge (G5).
    const confirmText = String(confirmSpy.mock.calls[0][0])
    expect(confirmText).toContain('23,83')
    expect(confirmText).toContain('TR Sparplan SPDR World')
    const after = captured.current!.state.data!
    expect(after.plannedChanges).toHaveLength(1)
    expect(after.plannedChanges[0].status).toBe('planned')
    expect(after.plannedChanges[0].basedOnProfileId).toBe('tp-job')
    expect(after.plannedChanges[0].createdAt).toBe('2026-07-19')
    expect(after.plannedChanges[0].items).toHaveLength(4)
    expect(captured.current!.state.isDirty).toBe(true)
    // M11-AK 2: gespeicherte Planungen ändern keine Ist-Daten und keine Sparpläne.
    expect(JSON.stringify(after.portfolioPositions)).toBe(positionsBefore)
    expect(JSON.stringify(after.savingsPlans)).toBe(plansBefore)
    // Anzeige mit Pflicht-Kennzeichnung (Status Text + Symbol).
    expect(plannedRegion().textContent).toContain('◷ geplant, nicht ausgeführt')
  })

  it('Abbruch im Bestätigungsdialog: Bestand bleibt Byte-identisch, kein Dirty-State', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = loadSeedWithJobProfile()
    const before = captured.current!.state.data!
    const beforeJson = JSON.stringify(before)
    act(() => {
      within(savingsRegion())
        .getByRole('button', { name: 'Als geplante Einstellung speichern' })
        .click()
    })
    expect(captured.current!.state.data).toBe(before)
    expect(JSON.stringify(captured.current!.state.data)).toBe(beforeJson)
    expect(captured.current!.state.isDirty).toBe(false)
  })
})

describe('RebalancingPage – Voll-Simulation (A7)', () => {
  it('trägt die Pflicht-Kennzeichnung und hat KEINEN Übernahme-Button; neue Verteilung = Zielverteilung', () => {
    loadSeedWithJobProfile()
    const section = simulationRegion()
    expect(
      within(section).getByText(/Simulation – wird nie automatisch übernommen\./),
    ).toBeInTheDocument()
    // A7-Klarstellung: kein simulations[]-Eintrag (M13-Territorium).
    expect(within(section).getByText(/KEINEN Eintrag unter „Simulationen“/)).toBeInTheDocument()
    expect(within(section).queryByRole('button')).toBeNull()
    const text = section.textContent?.replace(/\s/g, ' ') ?? ''
    // Telekom: Verkauf 1.116,89 → neuer Wert 252,25 = 10,00 %.
    expect(text).toContain(euroText(252.25))
    expect(text).toContain('10,00 %')
    expect(text).toContain(euroText(1116.89))
  })
})

describe('RebalancingPage – gespeicherte Planungen (Anzeige + Verwerfen)', () => {
  it('zeigt Datum deutsch, Profil- und Positionsnamen (nie IDs) und das Status-Label', () => {
    const captured = renderPage()
    loadData(captured, withPlannedChange(loadExample(), 'planned'))
    const section = plannedRegion()
    const text = section.textContent?.replace(/\s/g, ' ') ?? ''
    expect(text).toContain('Planung vom 18.07.2026')
    expect(text).toContain('Job-Profil')
    expect(text).toContain('SPDR MSCI World thesaurierend')
    expect(text).toContain('Gold (Gruppe)')
    expect(text).toContain('geplant, nicht ausgeführt')
    expect(text).not.toContain('pos-spdr-world-acc')
    expect(text).not.toContain('tp-job')
  })

  it('Verwerfen nach Bestätigung: Status „verworfen“, Dirty gesetzt; kein Löschen', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, withPlannedChange(loadExample(), 'planned'))
    act(() => {
      within(plannedRegion()).getByRole('button', { name: /verwerfen/i }).click()
    })
    const after = captured.current!.state.data!
    expect(after.plannedChanges).toHaveLength(1)
    expect(after.plannedChanges[0].status).toBe('discarded')
    expect(captured.current!.state.isDirty).toBe(true)
    expect(plannedRegion().textContent).toContain('■ verworfen')
    // B1-Fix (Reviewer K-1): Erfolgs-Feedback beim Auslöser + Fokus auf dem
    // Status-Span, der den verschwundenen Verwerfen-Button ersetzt.
    expect(
      within(plannedRegion()).getByText(/wurde als „verworfen“ markiert/),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(document.activeElement?.id).toMatch(/^planned-change-status-/)
    })
  })

  it('abgebrochenes Verwerfen ändert nichts (Byte-identisch); verworfene Planungen ohne Verwerfen-Button', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    const data = withPlannedChange(loadExample(), 'planned')
    loadData(captured, data)
    act(() => {
      within(plannedRegion()).getByRole('button', { name: /verwerfen/i }).click()
    })
    expect(captured.current!.state.data).toBe(data)
    expect(captured.current!.state.isDirty).toBe(false)

    // Bereits verworfene Planung: kein Button, Historien-Hinweis.
    loadData(captured, withPlannedChange(loadExample(), 'discarded'))
    expect(within(plannedRegion()).queryByRole('button', { name: /verwerfen/i })).toBeNull()
    expect(plannedRegion().textContent).toContain(
      'Verworfen – bleibt zur Historie erhalten und wird nicht gelöscht.',
    )
  })
})

describe('RebalancingPage – A11y-Grundmuster und Textqualität', () => {
  it('keine technischen IDs, kein NaN/Infinity/undefined im sichtbaren Text', () => {
    loadSeedWithJobProfile()
    const text = document.querySelector('main')?.textContent ?? ''
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
    expect(text).not.toContain('undefined')
    expect(text).not.toMatch(/\b(?:pos|sp|tp|acc|goal|plan)-[a-z0-9]+/)
  })

  it('benannte Sektionen und fokussierbare Tabellen-Region (B6-Muster)', () => {
    loadSeedWithJobProfile()
    expect(screen.getByRole('region', { name: 'Übersicht' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Handlungsempfehlungen' }),
    ).toBeInTheDocument()
    expect(plannedRegion()).toBeInTheDocument()
    const wrap = tableRegion()
    expect(wrap).toHaveAttribute('tabindex', '0')
  })
})
