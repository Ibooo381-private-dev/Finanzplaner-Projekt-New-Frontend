/**
 * UI-Tests der Konten-Seite (M8): Liste mit deutschen Typ-Labels und
 * „unbekannt“ statt 0, Depot-Hinweis statt Wert-Aktion, Hinzufügen/Bearbeiten
 * mit Feldfehlern, Deaktivieren mit Bestätigung + Summenwirkung,
 * Saldo-Erfassung inkl. Sperrdatum sowie Provider-Guard (applyDataChange wird
 * während isSaving ignoriert). Muster wie tests/layout/appLayout.test.tsx
 * (echter Provider + Capture + LOAD_SUCCEEDED mit loadExample()).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { setAccountActive } from '../../src/data/accounts'
import { AppLayout } from '../../src/layout/AppLayout'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { FinanceData } from '../../src/types/finance'
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

function renderAccountsPage(): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <AppLayout initialPage="konten" />
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

function getTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Kontenliste' })
}

function rowOf(accountName: string): HTMLElement {
  const cell = within(getTable()).getByText(accountName)
  const row = cell.closest('tr')
  if (!row) throw new Error(`Keine Tabellenzeile für "${accountName}" gefunden.`)
  return row
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AccountsPage – Leerzustände', () => {
  it('ohne geladene Datei: Startzustand mit Weg zu „Daten & Backups“', () => {
    renderAccountsPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Konten' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import und weitere Optionen' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('mit Datei, aber 0 Konten: verständlicher Hinweis + „Konto hinzufügen“', () => {
    const captured = renderAccountsPage()
    const example = loadExample()
    loadData(captured, { ...example, accounts: [], portfolioPositions: [] })
    expect(screen.getByText(/enthält noch keine Konten/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Konto hinzufügen' })).toBeInTheDocument()
  })
})

describe('AccountsPage – Liste', () => {
  it('zeigt die Konten der Beispieldatei mit deutschen Typ-Labels und „unbekannt“ für leere Historien', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())
    const table = getTable()

    expect(within(table).getByText('Girokonto Sparkasse')).toBeInTheDocument()
    expect(within(table).getByText('Girokonto')).toBeInTheDocument()
    expect(within(table).getByText('Rücklagenkonto')).toBeInTheDocument()
    expect(within(table).getByText('Verrechnungskonto')).toBeInTheDocument()
    expect(within(table).getByText('Kryptokonto')).toBeInTheDocument()
    expect(within(table).getByText('Pensionskonto')).toBeInTheDocument()
    expect(within(table).getAllByText('Depot')).toHaveLength(3)
    expect(within(table).getByText('Tagesgeld')).toBeInTheDocument()

    // Leere Historien (giro, ruecklage, cash, krypto): „unbekannt“, nie 0 (G11).
    expect(within(table).getAllByText('unbekannt')).toHaveLength(4)

    // Tagesgeld-Konto: jüngster Saldo + Datum.
    const vwRow = rowOf('Volkswagen Bank Tagesgeld')
    expect(within(vwRow).getByText(euroText(627.59))).toBeInTheDocument()
    expect(within(vwRow).getByText('17.07.2026')).toBeInTheDocument()
    expect(vwRow.textContent).not.toContain('2026-07-17')
    expect(within(vwRow).getByText('Aktiv')).toBeInTheDocument()

    // Summe unter der Tabelle über cashValue(aktive Konten).
    expect(screen.getByText('Tagesgeld gesamt (aktive Konten):')).toBeInTheDocument()
    expect(screen.getByText(euroText(627.59), { selector: 'strong' })).toBeInTheDocument()
  })

  it('Depot-Konto zeigt den Positionswert-Hinweis statt einer Wert-Aktion; Pension ist Merkposten', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    const depotRow = rowOf('Trade Republic Depot')
    // 237,45 + 204,86 + 99,11 + 33,92 = 575,34 (depotValue über die Positionen des Kontos).
    expect(
      within(depotRow).getByText(
        `Wert ergibt sich aus den Depotpositionen: ${euroText(575.34)}`,
      ),
    ).toBeInTheDocument()
    expect(
      within(depotRow).queryByRole('button', {
        name: 'Wert von „Trade Republic Depot“ aktualisieren',
      }),
    ).toBeNull()

    const pensionRow = rowOf('Telekom Pensionsfonds')
    expect(within(pensionRow).getByText('Merkposten ohne Wert')).toBeInTheDocument()
    expect(
      within(pensionRow).queryByRole('button', {
        name: 'Wert von „Telekom Pensionsfonds“ aktualisieren',
      }),
    ).toBeNull()
  })

  it('sortiert per Kopf-Button nach Name (auf- und absteigend)', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(within(getTable()).getByRole('button', { name: 'Name' }))
    let names = within(getTable())
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(names[0]).toBe('Bitget Krypto')
    expect(names[names.length - 1]).toBe('Volkswagen Bank Tagesgeld')

    // Zweiter Klick auf denselben (jetzt aufsteigend markierten) Button dreht die Richtung.
    fireEvent.click(within(getTable()).getByRole('button', { name: 'Name ▲' }))
    names = within(getTable())
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(names[0]).toBe('Volkswagen Bank Tagesgeld')
  })
})

describe('AccountsPage – Hinzufügen', () => {
  it('legt ein Konto an: erscheint in der Liste, Ungespeichert-Indikator im Kopfbereich', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Konto hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Konto hinzufügen' })
    fireEvent.change(within(form).getByLabelText('Name *'), {
      target: { value: 'Bargeld Portemonnaie' },
    })
    fireEvent.change(within(form).getByLabelText('Typ *'), { target: { value: 'bargeld' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Konto anlegen' }))

    const row = rowOf('Bargeld Portemonnaie')
    expect(within(row).getByText('Bargeld')).toBeInTheDocument()
    expect(within(row).getByText('unbekannt')).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
    // Formular ist nach dem Anlegen geschlossen.
    expect(screen.queryByRole('form', { name: 'Konto hinzufügen' })).toBeNull()
  })

  it('zeigt den Pflichtfeld-Fehler direkt neben dem Namensfeld (aria-describedby)', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(screen.getByRole('button', { name: 'Konto hinzufügen' }))
    const form = screen.getByRole('form', { name: 'Konto hinzufügen' })
    fireEvent.click(within(form).getByRole('button', { name: 'Konto anlegen' }))

    const error = within(form).getByText('Der Name darf nicht leer sein.')
    expect(error).toHaveAttribute('id', 'account-name-error')
    const input = within(form).getByLabelText('Name *')
    expect(input).toHaveAttribute('aria-describedby', 'account-name-error')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    // Fehler steht im selben Feld-Container wie das Eingabefeld.
    expect(input.parentElement).toBe(error.parentElement)
    // Kein Konto angelegt, kein Ungespeichert-Status.
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('AccountsPage – Bearbeiten', () => {
  it('ändert Institut und Zweck; der Typ ist nur Text', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(screen.getByRole('button', { name: 'Konto „Girokonto Sparkasse“ bearbeiten' }))
    const form = screen.getByRole('form', { name: 'Konto bearbeiten: Girokonto Sparkasse' })
    expect(within(form).queryByLabelText('Typ *')).toBeNull()
    expect(within(form).getByText(/nicht änderbar/)).toBeInTheDocument()

    fireEvent.change(within(form).getByLabelText('Institut'), {
      target: { value: 'Sparkasse Neu' },
    })
    fireEvent.change(within(form).getByLabelText('Zweck'), {
      target: { value: 'Gehaltseingang' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Änderungen übernehmen' }))

    const row = rowOf('Girokonto Sparkasse')
    expect(within(row).getByText('Sparkasse Neu')).toBeInTheDocument()
    expect(within(row).getByText('Gehaltseingang')).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })
})

describe('AccountsPage – Deaktivieren/Aktivieren', () => {
  it('deaktiviert nach Bestätigung: Status „Inaktiv“, Tagesgeld-Summe ohne das Konto', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderAccountsPage()
    loadData(captured, loadExample())
    expect(screen.getByText(euroText(627.59), { selector: 'strong' })).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ deaktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0][0]).toContain('fließt danach nicht mehr in Summen ein')

    const row = rowOf('Volkswagen Bank Tagesgeld')
    expect(within(row).getByText('Inaktiv')).toBeInTheDocument()
    // Deaktivierte Konten fließen in keine Summen ein: Betrag verschwindet aus der Summe.
    expect(screen.getByText(euroText(0), { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByText(euroText(627.59), { selector: 'strong' })).toBeNull()

    // Aktivieren ohne erneute Bestätigung.
    fireEvent.click(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ aktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(within(rowOf('Volkswagen Bank Tagesgeld')).getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText(euroText(627.59), { selector: 'strong' })).toBeInTheDocument()
  })

  it('bricht ohne Bestätigung ab: Konto bleibt aktiv', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ deaktivieren' }),
    )
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(within(rowOf('Volkswagen Bank Tagesgeld')).getByText('Aktiv')).toBeInTheDocument()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('AccountsPage – Wert aktualisieren', () => {
  it('erfasst einen neuen Saldo: Wert + Datum sichtbar, Ungespeichert-Status', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(
      screen.getByRole('button', { name: 'Wert von „Girokonto Sparkasse“ aktualisieren' }),
    )
    const form = screen.getByRole('form', { name: 'Wert aktualisieren: Girokonto Sparkasse' })
    fireEvent.change(within(form).getByLabelText('Betrag in Euro *'), {
      target: { value: '1234,56' },
    })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))

    const row = rowOf('Girokonto Sparkasse')
    expect(within(row).getByText(euroText(1234.56))).toBeInTheDocument()
    expect(within(row).getByText('01.08.2026')).toBeInTheDocument()
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()

    // Konsistenz (F1/S1): Der Giro-Saldo fließt NICHT in „Tagesgeld gesamt“ ein –
    // die Summe bleibt beim Tagesgeld-Wert 627,59 (nur Konten mit type "tagesgeld"),
    // nicht 627,59 + 1.234,56 = 1.862,15.
    expect(screen.getByText(euroText(627.59), { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByText(euroText(1862.15), { selector: 'strong' })).toBeNull()
  })

  it('zeigt Fehler der Datenfunktion feldnah: gesperrtes Datum am Datumsfeld, negativer Betrag am Betragsfeld', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(
      screen.getByRole('button', { name: 'Wert von „Volkswagen Bank Tagesgeld“ aktualisieren' }),
    )
    const form = screen.getByRole('form', {
      name: 'Wert aktualisieren: Volkswagen Bank Tagesgeld',
    })

    // Gesperrtes Snapshot-Datum (DM21) → Fehler neben dem Datumsfeld.
    fireEvent.change(within(form).getByLabelText('Betrag in Euro *'), { target: { value: '700' } })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-07-17' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const dateError = within(form).getByText(/gesperrten Snapshot/)
    expect(dateError).toHaveAttribute('id', 'balance-date-error')
    expect(within(form).getByLabelText('Datum *')).toHaveAttribute(
      'aria-describedby',
      'balance-date-error',
    )

    // Negativer Betrag ohne allowNegativeBalance (DM20) → Fehler neben dem Betragsfeld.
    fireEvent.change(within(form).getByLabelText('Betrag in Euro *'), { target: { value: '-5' } })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const amountError = within(form).getByText(/negativer Saldo/)
    expect(amountError).toHaveAttribute('id', 'balance-amount-error')
    expect(within(form).getByLabelText('Betrag in Euro *')).toHaveAttribute(
      'aria-describedby',
      'balance-amount-error',
    )

    // Keine Änderung übernommen.
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()
  })
})

describe('Provider-Guard – applyDataChange während isSaving', () => {
  it('ignoriert Datenänderungen, solange gespeichert wird (kein DATA_CHANGED)', () => {
    const captured = renderAccountsPage()
    const example = loadExample()
    loadData(captured, example)
    const before = captured.current!.state.data

    // Speichern beginnt: isSaving sperrt fachliche Aktionen (Review-Befund 3.3).
    act(() => {
      captured.current!.dispatch({ type: 'SAVE_STARTED' })
    })
    expect(captured.current!.state.isSaving).toBe(true)

    const changed = setAccountActive(example, 'acc-vw-tagesgeld', false)
    if (!changed.ok) throw new Error(changed.error)
    act(() => {
      captured.current!.actions.applyDataChange(changed.data)
    })

    // Erwartung: Bestand referenzgleich unverändert, kein isDirty, Sperre bleibt.
    expect(captured.current!.state.data).toBe(before)
    expect(captured.current!.state.isDirty).toBe(false)
    expect(captured.current!.state.isSaving).toBe(true)

    // Nach SAVE_FINISHED wird dieselbe Änderung wieder übernommen (isDirty).
    act(() => {
      captured.current!.dispatch({ type: 'SAVE_FINISHED' })
    })
    act(() => {
      captured.current!.actions.applyDataChange(changed.data)
    })
    expect(captured.current!.state.data).toBe(changed.data)
    expect(captured.current!.state.isDirty).toBe(true)
  })
})

describe('Review-Befunde 3.1/3.2 – Formular-Zielwechsel und de-DE-Betragseingabe', () => {
  it('3.1: Zielwechsel Bearbeiten A → Bearbeiten B zeigt B-Werte (frische Formularinstanz per key)', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    // Bearbeiten A öffnen und einen Wert ändern (Zustand in der Instanz).
    fireEvent.click(screen.getByRole('button', { name: 'Konto „Girokonto Sparkasse“ bearbeiten' }))
    const formA = screen.getByRole('form', { name: 'Konto bearbeiten: Girokonto Sparkasse' })
    fireEvent.change(within(formA).getByLabelText('Name *'), {
      target: { value: 'Umbenannt A' },
    })

    // Ohne Schließen direkt Bearbeiten B: Das Formular MUSS B-Werte zeigen,
    // nicht die eingetippten A-Werte (sonst würde auf B geschrieben).
    fireEvent.click(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ bearbeiten' }),
    )
    const formB = screen.getByRole('form', { name: 'Konto bearbeiten: Volkswagen Bank Tagesgeld' })
    expect(within(formB).getByLabelText('Name *')).toHaveValue('Volkswagen Bank Tagesgeld')
    expect(within(formB).queryByDisplayValue('Umbenannt A')).toBeNull()
  })

  it('3.2: "1.234" wird als 1.234,00 € gespeichert (Tausenderpunkt), "12.34" wird abgelehnt', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(
      screen.getByRole('button', { name: 'Wert von „Volkswagen Bank Tagesgeld“ aktualisieren' }),
    )
    const form = screen.getByRole('form', {
      name: 'Wert aktualisieren: Volkswagen Bank Tagesgeld',
    })

    // Ungültig: "12.34" (kein de-DE-Format – Punkt wäre mehrdeutig) → Feldfehler, nichts gespeichert.
    fireEvent.change(within(form).getByLabelText('Betrag in Euro *'), {
      target: { value: '12.34' },
    })
    fireEvent.change(within(form).getByLabelText('Datum *'), { target: { value: '2026-08-01' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    expect(within(form).getByText(/gültigen Betrag/)).toBeInTheDocument()
    expect(screen.queryByText('● Ungespeicherte Änderungen')).toBeNull()

    // Gültig: "1.234" ist der deutsche Tausenderpunkt → exakt 1234 €, nie 1,234 €.
    fireEvent.change(within(form).getByLabelText('Betrag in Euro *'), {
      target: { value: '1.234' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Wert übernehmen' }))
    const history = captured.current!.state.data!.accounts.find(
      (account) => account.id === 'acc-vw-tagesgeld',
    )!.balanceHistory
    expect(history[history.length - 1]).toMatchObject({ date: '2026-08-01', amount: 1234 })
    expect(screen.getByText('● Ungespeicherte Änderungen')).toBeInTheDocument()
  })
})

describe('AccountsPage – Redesign: klare Beschriftungen und Darstellung', () => {
  it('Formular-Buttons nennen das Ergebnis (anlegen/übernehmen) – nie „Speichern“', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    fireEvent.click(screen.getByRole('button', { name: 'Konto hinzufügen' }))
    const addForm = screen.getByRole('form', { name: 'Konto hinzufügen' })
    expect(within(addForm).getByRole('button', { name: 'Konto anlegen' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(within(addForm).queryByRole('button', { name: 'Speichern' })).toBeNull()
    fireEvent.click(within(addForm).getByRole('button', { name: 'Abbrechen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Konto „Girokonto Sparkasse“ bearbeiten' }))
    const editForm = screen.getByRole('form', { name: 'Konto bearbeiten: Girokonto Sparkasse' })
    expect(within(editForm).getByRole('button', { name: 'Änderungen übernehmen' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(within(editForm).queryByRole('button', { name: 'Konto anlegen' })).toBeNull()
    expect(within(editForm).queryByRole('button', { name: 'Speichern' })).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Wert von „Girokonto Sparkasse“ aktualisieren' }),
    )
    const balanceForm = screen.getByRole('form', {
      name: 'Wert aktualisieren: Girokonto Sparkasse',
    })
    expect(within(balanceForm).getByRole('button', { name: 'Wert übernehmen' })).toHaveAttribute(
      'type',
      'submit',
    )
    expect(within(balanceForm).queryByRole('button', { name: 'Speichern' })).toBeNull()
  })

  it('Hauptaktion „Konto hinzufügen“ ist primär mit dekorativem Plus-Icon', () => {
    const captured = renderAccountsPage()
    loadData(captured, loadExample())
    const addButton = screen.getByRole('button', { name: 'Konto hinzufügen' })
    expect(addButton).toHaveClass('btn-primary')
    expect(addButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('„Deaktivieren“ ist als Gefahr-Aktion markiert, „Aktivieren“ und „Bearbeiten“ nicht', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    const deactivate = screen.getByRole('button', {
      name: 'Konto „Volkswagen Bank Tagesgeld“ deaktivieren',
    })
    expect(deactivate).toHaveClass('btn-danger')
    expect(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ bearbeiten' }),
    ).not.toHaveClass('btn-danger')

    fireEvent.click(deactivate)
    expect(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ aktivieren' }),
    ).not.toHaveClass('btn-danger')
  })

  it('„Aktueller Wert“ ist Zahlenspalte; Status als Plakette mit unverändertem Text', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderAccountsPage()
    loadData(captured, loadExample())

    expect(within(getTable()).getByRole('columnheader', { name: 'Aktueller Wert' })).toHaveClass(
      'num',
    )
    const vwRow = rowOf('Volkswagen Bank Tagesgeld')
    expect(within(vwRow).getByText(euroText(627.59)).closest('td')).toHaveClass('num')
    const depotCell = within(rowOf('Trade Republic Depot'))
      .getByText(`Wert ergibt sich aus den Depotpositionen: ${euroText(575.34)}`)
      .closest('td')
    expect(depotCell).toHaveClass('num')

    const activeBadge = within(vwRow).getByText('Aktiv')
    expect(activeBadge).toHaveClass('badge', 'badge--ok')

    fireEvent.click(
      screen.getByRole('button', { name: 'Konto „Volkswagen Bank Tagesgeld“ deaktivieren' }),
    )
    const inactiveBadge = within(rowOf('Volkswagen Bank Tagesgeld')).getByText('Inaktiv')
    expect(inactiveBadge).toHaveClass('badge')
    expect(inactiveBadge).not.toHaveClass('badge--ok')
  })

  it('Depot-Wert mit Zeilenumbrüchen: Text inkl. Fehlwert-Hinweis unverändert', () => {
    const captured = renderAccountsPage()
    const example = loadExample()
    loadData(captured, {
      ...example,
      portfolioPositions: example.portfolioPositions.map((position) =>
        position.name === 'iShares Physical Gold ETC'
          ? { ...position, valueHistory: [] }
          : position,
      ),
    })
    const text = within(rowOf('Trade Republic Depot')).getByText(
      /^Wert ergibt sich aus den Depotpositionen: .+ € \(enthält Positionen ohne erfassten Wert\)$/,
    )
    // Umbrüche nur als <br> (kein zusätzlicher Text) – Betrag steht in eigener Zeile.
    expect(text.querySelectorAll('br')).toHaveLength(2)
  })
})
