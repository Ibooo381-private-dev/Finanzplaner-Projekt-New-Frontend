/**
 * UI-Tests des Moduls „Einstellungen & Datenverwaltung“ (M14): StartHint,
 * Notgroschen-Vorschau (Seed 4 × 1.170 = 4.680) über
 * effectiveEmergencyFundTarget, Override-Flow mit G12-confirm (setzen,
 * zurücksetzen, Abbruch Byte-identisch, Unterschreitungs-Warnung),
 * percentDecimals-Vorschau, Zielprofil-Wechsel mit confirm + Job-Warnung vor
 * dem 01.10.2027 (injizierter Stichtag, A8), Dirty-Regeln (unverändert
 * speichern/Verwerfen/Escape ohne Dirty), read-only-Darstellungszeilen,
 * Backup-Modus setzen, Statuszeile aus dem localStorage-Tagesmerker,
 * manuelle Sicherung, B3-Fehlerfokus und keine IDs/NaN.
 * Muster wie tests/pages/simulatorPage.test.tsx (echter Provider + Capture).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FinanceDataProvider } from '../../src/state/FinanceDataProvider'
import { SettingsPage } from '../../src/pages/SettingsPage'
import { useFinanceData } from '../../src/state/useFinanceData'
import type { FinanceDataContextValue } from '../../src/state/financeDataContext'
import type { FinanceData } from '../../src/types/finance'
import { formatEuro } from '../../src/format/money'
import { downloadAsFile } from '../../src/storage/fileAccess'
import { LAST_AUTO_BACKUP_DAY_KEY } from '../../src/state/localStoragePolicy'
import { loadExample } from '../storage/fixtures'

vi.mock('../../src/storage/fileAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/storage/fileAccess')>()
  return { ...actual, downloadAsFile: vi.fn() }
})

const downloadAsFileMock = vi.mocked(downloadAsFile)

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

function renderPage(onOpenDataBackups: () => void = () => {}): Captured {
  const captured: Captured = { current: null }
  render(
    <FinanceDataProvider now={FIXED_NOW}>
      <SettingsPage onOpenDataBackups={onOpenDataBackups} />
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

function exampleWithOverride(override: number): FinanceData {
  const data = loadExample()
  return {
    ...data,
    settings: {
      ...data.settings,
      emergencyFund: { ...data.settings.emergencyFund, manualOverrideAmount: override },
    },
  }
}

function setField(label: string | RegExp, value: string): void {
  act(() => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  })
}

function clickButton(name: string | RegExp): void {
  act(() => {
    screen.getByRole('button', { name }).click()
  })
}

function bodyText(): string {
  return document.body.textContent!.replace(/\s/g, ' ')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  downloadAsFileMock.mockReset()
  vi.restoreAllMocks()
})

describe('SettingsPage – Leerzustand und Grundgerüst', () => {
  it('ohne geladene Datei: StartHint mit Weg zu „Daten & Backups“', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 2, name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByText(/noch keine Finanzdaten geladen/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zu „Daten & Backups“' })).toBeInTheDocument()
  })

  it('zeigt Pflichtfeld-Legende, Sektionen und den localStorage-Transparenzhinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(screen.getByText('* = Pflichtfeld')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Einstellungen in der Finanzdatei' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Zielprofil (global)' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Sicherung & Wiederherstellung' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Import & Export' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Speicherorte (Transparenz)' })).toBeInTheDocument()
    // B9: der technische Schlüsselname erscheint NICHT im Endnutzertext –
    // nur die Klartext-Beschreibung der Gerätemarke.
    expect(bodyText()).not.toContain(LAST_AUTO_BACKUP_DAY_KEY)
    expect(bodyText()).toContain('ein einzelner Tagesmerker dieses Geräts')
    expect(bodyText()).toContain('Finanzdaten liegen NIE im Browser-Speicher')
    // Speicherort-/Berechtigungsstatus der Dateizugriffe (M14): ohne Handle → Download-Weg.
    expect(bodyText()).toContain('Dateiverbindung dieser Sitzung: finance-data.json')
    expect(bodyText()).toContain('kein direktes Datei-Handle')
  })

  it('„Zu „Daten & Backups““ ruft den Navigations-Callback auf', () => {
    const onOpen = vi.fn()
    const captured = renderPage(onOpen)
    loadData(captured, loadExample())
    const ioRegion = screen.getByRole('region', { name: 'Import & Export' })
    act(() => {
      within(ioRegion).getByRole('button', { name: 'Zu „Daten & Backups“' }).click()
    })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('SettingsPage – Notgroschen (Vorschau, Override, M12-Regel)', () => {
  it('Seed-Vorschau: berechnet 4 × 1.170,00 € = 4.680,00 € und wirksam (automatisch berechnet)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(bodyText()).toContain(`4 × ${euroText(1170)} = ${euroText(4680)}`)
    expect(bodyText()).toContain(`${euroText(4680)} (automatisch berechnet)`)
  })

  it('Live-Vorschau folgt den Eingaben (Faktor 5 × Netto 2.000 = 10.000)', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Notgroschen-Faktor (3–5) *', '5')
    setField('Monatliches Netto in Euro *', '2.000')
    expect(bodyText()).toContain(`5 × ${euroText(2000)} = ${euroText(10000)}`)
    // Faktor-Randwert-Hinweis (3 oder 5).
    expect(bodyText()).toContain('liegt am Rand des empfohlenen Bereichs')
  })

  it('Override setzen: G12-confirm mit BEIDEN Werten; speichert und zeigt „(manuell)“', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    setField(/Manuelle Übersteuerung des Zielbetrags/, '5.000')
    clickButton('Übersteuerung setzen …')

    const confirmText = confirmSpy.mock.calls[0][0]!.replace(/\s/g, ' ')
    expect(confirmText).toContain(euroText(5000))
    expect(confirmText).toContain(`berechnet wäre ${euroText(4680)}`)
    expect(confirmText).toContain('nie ungefragt ersetzt')

    expect(captured.current!.state.data!.settings.emergencyFund.manualOverrideAmount).toBe(5000)
    expect(captured.current!.state.isDirty).toBe(true)
    expect(bodyText()).toContain(`${euroText(5000)} (manuell)`)
    expect(bodyText()).toContain(`berechnet wäre ${euroText(4680)}`)
    // Feedback beim Auslöser (role=status).
    expect(screen.getByText(/Manuelle Übersteuerung .* übernommen/)).toBeInTheDocument()
  })

  it('Override-Abbruch im confirm: Bestand Byte-identisch, kein Dirty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    const data = loadExample()
    const before = JSON.stringify(data)
    loadData(captured, data)
    setField(/Manuelle Übersteuerung des Zielbetrags/, '5.000')
    clickButton('Übersteuerung setzen …')

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Override unter der Empfehlung: sichtbare Warnung „liegt unter der Empfehlung Faktor × Netto“', () => {
    const captured = renderPage()
    loadData(captured, exampleWithOverride(1000))
    const warning = screen.getByText(/liegt unter der Empfehlung Faktor × Netto/)
    const text = warning.textContent!.replace(/\s/g, ' ')
    expect(text).toContain(euroText(1000))
    expect(text).toContain(euroText(4680))
    expect(text).toContain('⚠')
  })

  it('Rücksetzen: G12-confirm mit beiden Werten; B2: Fokus wandert auf den bleibenden Anker (Override-Feld)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, exampleWithOverride(5000))
    clickButton('Auf automatische Berechnung zurücksetzen …')

    const confirmText = confirmSpy.mock.calls[0][0]!.replace(/\s/g, ' ')
    expect(confirmText).toContain(euroText(5000))
    expect(confirmText).toContain(euroText(4680))

    // A7: der Schlüssel bleibt als null erhalten (kein Entfernen).
    expect(captured.current!.state.data!.settings.emergencyFund.manualOverrideAmount).toBeNull()
    expect(captured.current!.state.isDirty).toBe(true)
    expect(bodyText()).toContain(`${euroText(4680)} (automatisch berechnet)`)
    // B2 (M13-Muster): der Zurücksetzen-Button verschwindet mit dem Erfolg –
    // der Fokus landet auf dem bestehen bleibenden Override-Eingabefeld.
    expect(screen.queryByRole('button', { name: 'Auf automatische Berechnung zurücksetzen …' })).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText(/Manuelle Übersteuerung des Zielbetrags/),
      ),
    )
  })

  it('Grauzone 11: Faktor außerhalb 3–5 → Vorschau rechnet weiter, weist den Bereich aber ehrlich aus', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Notgroschen-Faktor (3–5) *', '6')
    expect(bodyText()).toContain(`6 × ${euroText(1170)} = ${euroText(7020)}`)
    expect(bodyText()).toContain(
      'Faktor außerhalb des zulässigen Bereichs 3–5 – wird beim Übernehmen abgelehnt',
    )
  })

  it('ungültiger Override-Betrag: feldnaher Fehler ohne confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    setField(/Manuelle Übersteuerung des Zielbetrags/, 'abc')
    clickButton('Übersteuerung setzen …')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/Bitte einen Betrag größer als 0 eingeben/)).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })
})

describe('SettingsPage – Formular (Dirty-Regeln, B3, Darstellung, Backup)', () => {
  it('unverändertes Übernehmen: kein Dirty, Status „Keine Änderungen“ (K2-Byte-Identität)', () => {
    const captured = renderPage()
    const data = loadExample()
    const before = JSON.stringify(data)
    loadData(captured, data)
    clickButton('Einstellungen übernehmen')
    expect(captured.current!.state.isDirty).toBe(false)
    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect(screen.getByText(/Keine Änderungen – der Bestand bleibt unverändert/)).toBeInTheDocument()
  })

  it('geänderte Werte werden übernommen (Netto, Budget, Faktor) und setzen Dirty; B1: Fokus auf der Statusmeldung', async () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Monatliches Netto in Euro *', '1.500')
    setField('Monatliches Sparbudget in Euro (leer = offen)', '250')
    setField('Notgroschen-Faktor (3–5) *', '3,5')
    clickButton('Einstellungen übernehmen')

    const settings = captured.current!.state.data!.settings
    expect(settings.emergencyFund.netIncomeMonthly).toBe(1500)
    expect(settings.emergencyFund.factor).toBe(3.5)
    expect(settings.monthlySavingsBudget).toBe(250)
    expect(captured.current!.state.isDirty).toBe(true)
    const status = screen.getByText(/Einstellungen übernommen/)
    // B1: Der key-Remount des Formulars wirft den Fokus NICHT auf
    // document.body – er landet gezielt auf der Erfolgs-Statusmeldung.
    await waitFor(() => expect(document.activeElement).toBe(status))
  })

  it('B3: „Eingaben verwerfen“ setzt zurück (role=status-Meldung); No-Op ohne Meldung; Escape setzt NICHT zurück', () => {
    // Gewollte Musterangleichung (A11y B3): das immer offene Formular ist
    // kein Dialog/Editor – Escape hat KEINE Rücksetz-Wirkung mehr (Escape
    // kann aus Select/IME bubbeln); die einzige Rücksetz-Geste ist der Button.
    const captured = renderPage()
    const data = loadExample()
    const before = JSON.stringify(data)
    loadData(captured, data)

    // No-Op: Verwerfen ohne Änderungen erzeugt keine Meldung.
    clickButton('Eingaben verwerfen')
    expect(screen.queryByText(/auf den gespeicherten Stand zurückgesetzt/)).toBeNull()

    setField('Monatliches Netto in Euro *', '9.999')
    clickButton('Eingaben verwerfen')
    expect(screen.getByLabelText('Monatliches Netto in Euro *')).toHaveValue('1.170')
    expect(
      screen.getByText('✓ Eingaben auf den gespeicherten Stand zurückgesetzt.'),
    ).toBeInTheDocument()

    setField('Monatliches Netto in Euro *', '8.888')
    act(() => {
      fireEvent.keyDown(screen.getByLabelText('Monatliches Netto in Euro *'), { key: 'Escape' })
    })
    // Escape lässt die Eingabe unangetastet.
    expect(screen.getByLabelText('Monatliches Netto in Euro *')).toHaveValue('8.888')

    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('B3-Fehlerfokus: ungültiges Netto → Fehler am Feld, Fokus auf dem ersten Fehlerfeld', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Monatliches Netto in Euro *', 'abc')
    clickButton('Einstellungen übernehmen')
    expect(screen.getByText(/Bitte einen gültigen Betrag eingeben \(z\. B\. 1\.170/)).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Monatliches Netto in Euro *'))
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Datenlayer-Fehler feldnah: Faktor 6 → Bereichsfehler am Faktor-Feld', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Notgroschen-Faktor (3–5) *', '6')
    clickButton('Einstellungen übernehmen')
    expect(screen.getByText(/zwischen 3 und 5 liegen/)).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByLabelText('Notgroschen-Faktor (3–5) *'))
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('percentDecimals-Vorschau: Standard „80,08 %“, mit 0 Dezimalstellen „80 %“; Wert wird gespeichert', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(bodyText()).toContain('Vorschau: 80,08 %')
    setField('Dezimalstellen der Prozentanzeige (0–4)', '0')
    expect(bodyText()).toContain('Vorschau: 80 %')
    clickButton('Einstellungen übernehmen')
    expect(captured.current!.state.data!.settings.display?.percentDecimals).toBe(0)
    expect(captured.current!.state.isDirty).toBe(true)
  })

  it('B5: Dezimalstellen-Select ist an den Hinweis gekoppelt und ohne Fehler nicht aria-invalid', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    const select = screen.getByLabelText('Dezimalstellen der Prozentanzeige (0–4)')
    expect(select).toHaveAttribute('aria-describedby', 'settings-decimals-hint')
    expect(select).not.toHaveAttribute('aria-invalid')
    // Präzisierte Formulierung: Anteils-/Abweichungsanzeigen, nicht „alle Prozentanzeigen“.
    expect(bodyText()).toContain('Anteils- und Abweichungsanzeigen')
  })

  it('K2-Regression (Grauzone 10): Datei OHNE display-Block + unverändertes Übernehmen bleibt Byte-identisch', () => {
    const captured = renderPage()
    const data = loadExample()
    delete data.settings.display
    const before = JSON.stringify(data)
    loadData(captured, data)
    // Das Select zeigt den berechneten Default 2 – ohne Änderung darf der
    // display-Block NICHT materialisiert werden.
    expect(screen.getByLabelText('Dezimalstellen der Prozentanzeige (0–4)')).toHaveValue('2')
    clickButton('Einstellungen übernehmen')
    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect('display' in captured.current!.state.data!.settings).toBe(false)
    expect(captured.current!.state.isDirty).toBe(false)
    expect(screen.getByText(/Keine Änderungen/)).toBeInTheDocument()
  })

  it('read-only-Darstellungszeilen: de-DE/EUR/TT.MM.JJJJ fest in V1, ohne Schreibpfad', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(bodyText()).toContain('de-DE – fest in V1')
    expect(bodyText()).toContain('EUR – fest in V1')
    expect(bodyText()).toContain('TT.MM.JJJJ – fest in V1')
    // Kein Eingabefeld für das Zahlenformat – reine Anzeige (A7).
    expect(screen.queryByLabelText(/Zahlenformat/)).toBeNull()
    expect(bodyText()).toContain('hätte in V1 KEINE Wirkung')
  })

  it('Backup-Modus setzen: dailyFirstSave wird gespeichert; retentionCount bleibt erhalten', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Sicherungsmodus', 'dailyFirstSave')
    clickButton('Einstellungen übernehmen')
    expect(captured.current!.state.data!.settings.backup?.mode).toBe('dailyFirstSave')
    expect(captured.current!.state.data!.settings.backup?.retentionCount).toBe(10)
    expect(captured.current!.state.isDirty).toBe(true)
    // Keine „aus“-Option (bewusste V1-Grenze).
    const options = within(screen.getByLabelText('Sicherungsmodus'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['bei jedem Speichern (Standard)', 'täglich beim ersten Speichern'])
  })

  it('Aufbewahrungsanzahl 0 → feldnaher Datenlayer-Fehler', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField(/Empfohlene Aufbewahrungsanzahl/, '0')
    clickButton('Einstellungen übernehmen')
    expect(screen.getByText(/Ganzzahl größer oder gleich 1/)).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })
})

describe('SettingsPage – Zielprofil (G12, Job-Warnung A8)', () => {
  it('Job-Profil vor dem 01.10.2027: sichtbare Warnung UND Warnung im confirm; Aktivierung speichert', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())

    setField('Zielprofil wählen', 'tp-job')
    // AK 3: sichtbarer Warnhinweis VOR der Aktivierung (Stichtag injiziert).
    expect(screen.getByText(/erst ab dem 01\.10\.2027 vorgesehen/)).toBeInTheDocument()
    expect(bodyText()).toContain('heute: 19.07.2026')

    clickButton('Zielprofil aktivieren …')
    const confirmText = confirmSpy.mock.calls[0][0]!.replace(/\s/g, ' ')
    expect(confirmText).toContain('Bisher aktiv: „Student - tatsaechlicher Sparplan (Ebene A)“')
    expect(confirmText).toContain('neu: „Job-Profil“')
    expect(confirmText).toContain('WARNUNG')
    expect(confirmText).toContain('01.10.2027')

    expect(captured.current!.state.data!.settings.activeTargetProfileId).toBe('tp-job')
    expect(captured.current!.state.isDirty).toBe(true)
    expect(screen.getByText(/Zielprofil „Job-Profil“ aktiviert/)).toBeInTheDocument()
  })

  it('Abbruch im confirm: Profil unverändert, Bestand Byte-identisch', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const captured = renderPage()
    const data = loadExample()
    const before = JSON.stringify(data)
    loadData(captured, data)
    setField('Zielprofil wählen', 'tp-job')
    clickButton('Zielprofil aktivieren …')
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(captured.current!.state.data!.settings.activeTargetProfileId).toBe(
      'tp-student-sparplan',
    )
    expect(JSON.stringify(captured.current!.state.data)).toBe(before)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('Nicht-Job-Profil: keine Job-Warnung; Hinweis auf die lokale Rebalancing-Auswahl vorhanden', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    setField('Zielprofil wählen', 'tp-student-bestand')
    expect(screen.queryByText(/erst ab dem 01\.10\.2027/)).toBeNull()
    expect(bodyText()).toContain('behält ihre eigene lokale Analyse-Auswahl')
    expect(bodyText()).toContain('Profile werden in V1 nicht bearbeitet')
  })

  it('B6: Aktivieren ohne Auswahl → Fehler feldnah am Select (aria-invalid + describedby) + Fokus', () => {
    const captured = renderPage()
    const data = loadExample()
    delete data.settings.activeTargetProfileId
    loadData(captured, data)

    clickButton('Zielprofil aktivieren …')

    const select = screen.getByLabelText('Zielprofil wählen')
    expect(screen.getByText('Bitte zuerst ein Zielprofil wählen.')).toHaveAttribute(
      'id',
      'settings-profile-error',
    )
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAttribute('aria-describedby', 'settings-profile-error')
    expect(document.activeElement).toBe(select)
    expect(captured.current!.state.isDirty).toBe(false)
  })

  it('bereits aktives Profil aktivieren: Status „bereits aktiv“, kein confirm, kein Dirty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const captured = renderPage()
    loadData(captured, loadExample())
    clickButton('Zielprofil aktivieren …')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(
      screen.getByText(/„Student - tatsaechlicher Sparplan \(Ebene A\)“ ist bereits das aktive Zielprofil/),
    ).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
  })
})

describe('SettingsPage – Sicherungen (Statuszeile, manuelle Sicherung)', () => {
  it('ohne Tagesmerker: „unbekannt“; mit Merker: deutsches Datum mit Tagesgranularitäts-Hinweis', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    expect(bodyText()).toContain('unbekannt (noch keine automatische Sicherung')

    window.localStorage.setItem(LAST_AUTO_BACKUP_DAY_KEY, '2026-07-18')
    // Re-Render über eine Datenänderung anstoßen (Merker wird beim Rendern gelesen).
    act(() => {
      captured.current!.actions.markDirty()
    })
    expect(bodyText()).toContain('18.07.2026 (Tagesgranularität')
  })

  it('„Sicherung jetzt erstellen“: Backup-Download + Feedback beim Auslöser; kein Statuswechsel', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    clickButton('Sicherung jetzt erstellen')
    expect(downloadAsFileMock).toHaveBeenCalledTimes(1)
    expect(downloadAsFileMock.mock.calls[0][0]).toContain('finance-data-backup-')
    expect(screen.getByText(/Sicherungskopie wurde als Download erstellt/)).toBeInTheDocument()
    expect(captured.current!.state.isDirty).toBe(false)
    // Empfehlungs-Anzeige inkl. Nicht-durchsetzbar-Hinweis.
    expect(bodyText()).toContain('Bewahre die letzten 10 Sicherungen auf')
    expect(bodyText()).toContain('nicht durchsetzbar')
    // Wiederherstellung = Import-Flow (G10) – Erklärung vorhanden.
    expect(bodyText()).toContain('Wiederherstellung = Import einer Sicherungsdatei')
  })
})

describe('SettingsPage – Datenqualität', () => {
  it('keine technischen IDs, kein NaN/Infinity im sichtbaren Text', () => {
    const captured = renderPage()
    loadData(captured, loadExample())
    // Die Datenprüfungs-Liste NENNT „NaN oder Infinity“ bewusst als
    // Erklärtext (Spezifikations-Pflicht) – nur dieser eine Erklärsatz ist
    // ausgenommen; als RECHENWERT darf NaN/Infinity nirgends erscheinen.
    const text = bodyText().replace('endliche Zahlen – niemals NaN oder Infinity', '')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
    expect(text).not.toContain('undefined')
    // Profil-/Konto-IDs erscheinen nie im Endnutzertext (nur Namen).
    expect(text).not.toMatch(/\b(?:acc|pos|goal|plan|tp|sim)-[a-z0-9]+(?:-[a-z0-9]+)*\b/)
  })
})
