/**
 * Modul „Einstellungen & Datenverwaltung“ (M14): fachliche Einstellungen der
 * JSON-Datei (Notgroschen, Sparbudget, Darstellung, Sicherungsmodus),
 * globale Zielprofil-Auswahl mit G12-Bestätigung, Sicherungs-/Import-/
 * Export-Erklärungen mit Direktlink zu „Daten & Backups“ und der
 * localStorage-Transparenzhinweis.
 *
 * Keine Finanzlogik in Komponenten: der wirksame/berechnete Notgroschen
 * kommt AUSSCHLIESSLICH aus effectiveEmergencyFundTarget (M12 – keine
 * doppelte Formel; „berechnet“ = Aufruf mit entfernter Übersteuerung).
 * Alle Datenänderungen laufen über die reine Funktion updateSettings
 * (src/data/settings.ts, K2-Byte-Identität) + applyDataChange; Dirty
 * entsteht NUR nach JSON-Vergleich – Abbruch/unveränderte Eingaben lassen
 * den Bestand Byte-identisch. Der Stichtag (Job-Profil-Warnung, A8) kommt
 * IMMER aus dem injizierten todayIso des Provider-Kontexts.
 */

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { BackupMode, EmergencyFund, FinanceData, TargetProfile } from '../types/finance'
import { effectiveEmergencyFundTarget } from '../finance'
import { formatEuro, parseGermanAmount } from '../format/money'
import { formatIsoDateGerman } from '../format/date'
import { updateSettings } from '../data/settings'
import type { SettingsInput } from '../data/settings'
import { readLastAutoBackupDay } from '../storage/autoBackup'
import { useFinanceData } from '../state/useFinanceData'
import { StartHint } from '../components/StartHint'

/** Job-Profil-Aktivierung ist laut Plan erst ab diesem Tag vorgesehen (AK 3). */
const JOB_PROFILE_EARLIEST_ISO = '2027-10-01'

const BACKUP_MODE_LABELS: Record<BackupMode, string> = {
  everySave: 'bei jedem Speichern (Standard)',
  dailyFirstSave: 'täglich beim ersten Speichern',
}

/** Anzeige-Default der Aufbewahrungsempfehlung (data-model §3.2 – reine Empfehlung). */
const RETENTION_DISPLAY_DEFAULT = 10

/** Beispiel-Dezimalanteil der Prozent-Vorschau (Anzeigebeispiel, kein Finanzwert). */
const PERCENT_PREVIEW_DECIMAL = 0.8008

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

/** Zahl als de-DE-Eingabetext (parseGermanAmount-kompatibel). */
function amountToInputText(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Berechneter Notgroschen (Faktor × Netto) über die M12-Funktion – die
 * Übersteuerung wird dafür entfernt, NIE eine zweite Formel implementiert.
 */
function computedEmergencyTarget(fund: EmergencyFund): number {
  return effectiveEmergencyFundTarget({ ...fund, manualOverrideAmount: null })
}

// --- Hauptformular (Datei-Einstellungen; key-stabil über die gespeicherten Werte) ---

interface SettingsFormValues {
  netText: string
  budgetText: string
  factorText: string
  decimalsValue: string
  /** '' = nicht gespeichert (wirkt als everySave, wird nicht materialisiert). */
  backupModeValue: string
  retentionText: string
}

function formValuesFromData(data: FinanceData): SettingsFormValues {
  const settings = data.settings
  return {
    netText: amountToInputText(settings.emergencyFund.netIncomeMonthly),
    budgetText:
      typeof settings.monthlySavingsBudget === 'number'
        ? amountToInputText(settings.monthlySavingsBudget)
        : '',
    factorText: amountToInputText(settings.emergencyFund.factor),
    decimalsValue: String(
      typeof settings.display?.percentDecimals === 'number'
        ? settings.display.percentDecimals
        : 2,
    ),
    backupModeValue: settings.backup?.mode ?? '',
    retentionText:
      typeof settings.backup?.retentionCount === 'number'
        ? String(settings.backup.retentionCount)
        : '',
  }
}

function SettingsForm({
  initial,
  fund,
  savedOverride,
  savedComputed,
  isSaving,
  onSubmit,
  onSetOverride,
  onResetOverride,
}: {
  initial: SettingsFormValues
  fund: EmergencyFund
  /** Gespeicherte manuelle Übersteuerung oder null (= automatische Berechnung). */
  savedOverride: number | null
  /** Gespeicherter berechneter Notgroschen (Faktor × Netto, M12-Funktion). */
  savedComputed: number
  isSaving: boolean
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (input: SettingsInput) => string | null
  onSetOverride: (amount: number) => string | null
  onResetOverride: () => string | null
}) {
  const [values, setValues] = useState<SettingsFormValues>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [discardStatus, setDiscardStatus] = useState<string | null>(null)
  const [overrideText, setOverrideText] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null)
  // B4: Sammelmeldung fokussierbar machen (GoalsPage-Muster).
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null)

  // B3-Fehlerfokus: Reihenfolge entspricht der Feldreihenfolge im Formular.
  const FIELD_ID_BY_ERROR_KEY: Record<string, string> = {
    net: 'settings-net',
    budget: 'settings-budget',
    factor: 'settings-factor',
    decimals: 'settings-decimals',
    mode: 'settings-backup-mode',
    retention: 'settings-retention',
  }
  const FIELD_ERROR_ORDER = ['net', 'budget', 'factor', 'decimals', 'mode', 'retention']

  function focusFirstErrorField(errors: Record<string, string>): void {
    const key = FIELD_ERROR_ORDER.find((candidate) => errors[candidate] !== undefined)
    if (key === undefined) return
    document.getElementById(FIELD_ID_BY_ERROR_KEY[key])?.focus()
  }

  function setField<K extends keyof SettingsFormValues>(
    key: K,
    value: SettingsFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  /**
   * B3: „Eingaben verwerfen“ ist die EINZIGE Rücksetz-Geste (kein globaler
   * Escape-Handler – das immer offene Formular ist kein Dialog/Editor, und
   * Escape kann aus Select/IME heraus bubbeln). Unveränderte Werte sind ein
   * No-Op (keine Meldung); sonst role=status-Feedback.
   */
  function resetToSaved(): void {
    setFieldErrors({})
    setSubmitError(null)
    if (JSON.stringify(values) === JSON.stringify(initial)) {
      setDiscardStatus(null)
      return
    }
    setValues(initial)
    setDiscardStatus('Eingaben auf den gespeicherten Stand zurückgesetzt.')
  }

  const parsedFactor = parseGermanAmount(values.factorText)
  const parsedNet = parseGermanAmount(values.netText)
  // Live-Vorschau über die M12-Funktion (keine doppelte Formel): nur bei
  // gültigen Eingaben berechenbar – sonst ehrlich „nicht berechenbar“.
  const previewComputed =
    parsedFactor !== null && parsedNet !== null && parsedNet > 0 && Number.isFinite(parsedFactor)
      ? effectiveEmergencyFundTarget({
          factor: parsedFactor,
          netIncomeMonthly: parsedNet,
          manualOverrideAmount: null,
        })
      : null

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitError(null)
    setDiscardStatus(null)
    const errors: Record<string, string> = {}
    if (parsedNet === null) {
      errors['net'] = 'Bitte einen gültigen Betrag eingeben (z. B. 1.170 oder 1.170,50).'
    }
    let budget: number | null = null
    if (values.budgetText.trim() !== '') {
      const parsedBudget = parseGermanAmount(values.budgetText)
      if (parsedBudget === null) {
        errors['budget'] =
          'Bitte einen gültigen Betrag eingeben (z. B. 250,00) – oder leer lassen („offen“).'
      } else {
        budget = parsedBudget
      }
    }
    if (parsedFactor === null) {
      errors['factor'] = 'Bitte einen Faktor zwischen 3 und 5 eingeben (z. B. 4 oder 3,5).'
    }
    let retention: number | undefined
    if (values.retentionText.trim() !== '') {
      if (!/^\d+$/.test(values.retentionText.trim())) {
        errors['retention'] =
          'Bitte eine ganze Zahl größer oder gleich 1 eingeben – oder leer lassen (keine Änderung).'
      } else {
        retention = Number(values.retentionText.trim())
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusFirstErrorField(errors)
      return
    }
    setFieldErrors({})
    const input: SettingsInput = {
      netIncomeMonthly: parsedNet ?? undefined,
      factor: parsedFactor ?? undefined,
      monthlySavingsBudget: budget,
    }
    // K2-Linie (finance-analyst-Grauzone M14): percentDecimals nur in den
    // Patch aufnehmen, wenn der Wert vom gespeicherten Stand abweicht – ein
    // unverändertes Übernehmen materialisiert bei Minimaldateien ohne
    // display-Block sonst den Schlüssel und erzeugte einen falschen Dirty-State.
    if (values.decimalsValue !== initial.decimalsValue) {
      input.percentDecimals = Number(values.decimalsValue)
    }
    if (values.backupModeValue !== '') input.backupMode = values.backupModeValue as BackupMode
    if (retention !== undefined) input.retentionCount = retention
    const error = onSubmit(input)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah zuordnen (Feld-Präfixe, B3).
    const prefixes: [string, string][] = [
      ['Netto:', 'net'],
      ['Sparbudget:', 'budget'],
      ['Faktor:', 'factor'],
      ['Prozent-Dezimalstellen:', 'decimals'],
      ['Sicherungsmodus:', 'mode'],
      ['Aufbewahrungsanzahl:', 'retention'],
    ]
    const match = prefixes.find(([prefix]) => error.startsWith(prefix))
    if (match) {
      const mapped = { [match[1]]: error.slice(match[0].length).trim() }
      setFieldErrors(mapped)
      focusFirstErrorField(mapped)
    } else {
      setSubmitError(error)
      // B4: Sammelmeldung erhält den Fokus (GoalsPage-Muster).
      requestAnimationFrame(() => submitErrorRef.current?.focus())
    }
  }

  function handleSetOverride(): void {
    setOverrideError(null)
    setOverrideStatus(null)
    const parsed = parseGermanAmount(overrideText)
    if (parsed === null || parsed <= 0) {
      setOverrideError('Bitte einen Betrag größer als 0 eingeben (z. B. 5.000).')
      document.getElementById('settings-override')?.focus()
      return
    }
    // G12: Bestätigung mit BEIDEN Werten (manueller Wert und berechneter Wert).
    const proceed = window.confirm(
      `Notgroschen-Ziel manuell auf ${formatEuro(parsed)} setzen? Das überschreibt die automatische Berechnung – berechnet wäre ${formatEuro(savedComputed)} (Faktor ${amountToInputText(fund.factor)} × Netto ${formatEuro(fund.netIncomeMonthly)}). Ein manueller Wert wird durch Neuberechnungen nie ungefragt ersetzt.`,
    )
    if (!proceed) return
    const error = onSetOverride(parsed)
    if (error !== null) {
      setOverrideError(error.replace(/^Manueller Zielbetrag:\s*/, ''))
      document.getElementById('settings-override')?.focus()
      return
    }
    setOverrideText('')
    setOverrideStatus(
      `Manuelle Übersteuerung ${formatEuro(parsed)} übernommen – Datei speichern nicht vergessen.`,
    )
  }

  function handleResetOverride(): void {
    if (savedOverride === null) return
    setOverrideError(null)
    setOverrideStatus(null)
    // G12: Bestätigung mit BEIDEN Werten (bisheriger manueller + künftiger berechneter Wert).
    const proceed = window.confirm(
      `Manuelle Übersteuerung ${formatEuro(savedOverride)} entfernen und wieder automatisch berechnen? Danach gilt: ${formatEuro(savedComputed)} (Faktor ${amountToInputText(fund.factor)} × Netto ${formatEuro(fund.netIncomeMonthly)}).`,
    )
    if (!proceed) return
    const error = onResetOverride()
    if (error !== null) {
      setOverrideError(error.replace(/^Manueller Zielbetrag:\s*/, ''))
      return
    }
    setOverrideStatus(
      `Übersteuerung entfernt – es gilt wieder die automatische Berechnung ${formatEuro(savedComputed)}.`,
    )
    // B2 (M13-Muster): der Zurücksetzen-Button verschwindet mit dem Erfolg –
    // der Fokus wandert auf den bestehen bleibenden Anker (Override-Feld).
    requestAnimationFrame(() => document.getElementById('settings-override')?.focus())
  }

  function fieldError(key: string, id: string) {
    const message = fieldErrors[key]
    if (message === undefined) return null
    return (
      <p id={id} className="field-error" role="alert">
        {message}
      </p>
    )
  }

  const decimals = Number(values.decimalsValue)

  return (
    <form
      className="account-form settings-form"
      aria-label="Einstellungen der Finanzdatei"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* A11y B7: sichtbare Legende der Pflichtfeld-Markierung. */}
      <p className="app-hint">* = Pflichtfeld</p>

      <fieldset className="settings-fieldset">
        <legend>Allgemein &amp; Finanzen</legend>
        <div className="form-field">
          <label htmlFor="settings-net">Monatliches Netto in Euro *</label>
          <input
            id="settings-net"
            type="text"
            inputMode="decimal"
            value={values.netText}
            onChange={(event) => setField('netText', event.target.value)}
            aria-invalid={fieldErrors['net'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['net'] !== undefined ? 'settings-net-error' : 'settings-net-hint'
            }
          />
          {fieldError('net', 'settings-net-error')}
          <p id="settings-net-hint" className="app-hint">
            Dient ausschließlich als Bezugsgröße (Notgroschen = Faktor × Netto) – es werden keine
            Budgets oder Auswertungen daraus gespeichert.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="settings-budget">Monatliches Sparbudget in Euro (leer = offen)</label>
          <input
            id="settings-budget"
            type="text"
            inputMode="decimal"
            value={values.budgetText}
            onChange={(event) => setField('budgetText', event.target.value)}
            aria-invalid={fieldErrors['budget'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['budget'] !== undefined ? 'settings-budget-error' : 'settings-budget-hint'
            }
          />
          {fieldError('budget', 'settings-budget-error')}
          <p id="settings-budget-hint" className="app-hint">
            Grenzwert für die Budget-Warnung auf der Seite „Sparpläne“ (überschreiten die festen
            eigenen Monatsraten das Budget, erscheint dort ein Hinweis – nie blockierend). Ohne
            Wert bleibt das Budget „offen“ und es wird nichts geprüft.
          </p>
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Notgroschen</legend>
        <div className="form-field">
          <label htmlFor="settings-factor">Notgroschen-Faktor (3–5) *</label>
          <input
            id="settings-factor"
            type="text"
            inputMode="decimal"
            value={values.factorText}
            onChange={(event) => setField('factorText', event.target.value)}
            aria-invalid={fieldErrors['factor'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['factor'] !== undefined
                ? 'settings-factor-error'
                : 'settings-factor-hint'
            }
          />
          {fieldError('factor', 'settings-factor-error')}
          <p id="settings-factor-hint" className="app-hint">
            Anzahl der Nettogehälter als Notgroschen-Ziel (Standard 4).
          </p>
          {parsedFactor === 3 || parsedFactor === 5 ? (
            <p className="field-warning" role="status">
              ⚠ Faktor {amountToInputText(parsedFactor)} liegt am Rand des empfohlenen Bereichs
              (3–5).
            </p>
          ) : null}
        </div>
        <p>
          Berechnet (Vorschau mit den Eingaben oben):{' '}
          <strong className="computed-value">
            {previewComputed === null
              ? 'nicht berechenbar (ungültige Eingaben)'
              : `${values.factorText.trim()} × ${parsedNet === null ? '?' : formatEuro(parsedNet)} = ${formatEuro(previewComputed)}`}
          </strong>
          {/* finance-analyst-Grauzone M14: die Vorschau rechnet auch außerhalb
              des zulässigen Bereichs weiter, weist das aber ehrlich aus. */}
          {previewComputed !== null && parsedFactor !== null && (parsedFactor < 3 || parsedFactor > 5)
            ? ' (Faktor außerhalb des zulässigen Bereichs 3–5 – wird beim Übernehmen abgelehnt)'
            : ''}
        </p>
        <p>
          Wirksames Notgroschen-Ziel (gespeicherter Stand):{' '}
          <strong className="computed-value">
            {savedOverride !== null
              ? `${formatEuro(effectiveEmergencyFundTarget(fund))} (manuell)`
              : `${formatEuro(effectiveEmergencyFundTarget(fund))} (automatisch berechnet)`}
          </strong>
          {savedOverride !== null ? ` – berechnet wäre ${formatEuro(savedComputed)}` : ''}
        </p>
        {savedOverride !== null && savedOverride < savedComputed ? (
          <p className="warning-note" role="status">
            ⚠ Die manuelle Übersteuerung {formatEuro(savedOverride)} liegt unter der Empfehlung
            Faktor × Netto ({formatEuro(savedComputed)}).
          </p>
        ) : null}
        <div className="form-field">
          <label htmlFor="settings-override">
            Manuelle Übersteuerung des Zielbetrags in Euro (optional)
          </label>
          <input
            id="settings-override"
            type="text"
            inputMode="decimal"
            value={overrideText}
            onChange={(event) => setOverrideText(event.target.value)}
            aria-invalid={overrideError !== null || undefined}
            aria-describedby={
              overrideError !== null ? 'settings-override-error' : 'settings-override-hint'
            }
          />
          {overrideError !== null ? (
            <p id="settings-override-error" className="field-error" role="alert">
              {overrideError}
            </p>
          ) : null}
          <p id="settings-override-hint" className="app-hint">
            Überschreibt die automatische Berechnung sofort nach Bestätigung (unabhängig von
            „Einstellungen übernehmen“ unten). Das Ziel „Notgroschen“ auf der Seite „Ziele“ nutzt
            den wirksamen Wert automatisch; ein manueller Wert wird durch Neuberechnungen nie
            ungefragt ersetzt (M12-Regel).
          </p>
          <div className="form-actions">
            <button type="button" onClick={handleSetOverride} disabled={isSaving}>
              Übersteuerung setzen …
            </button>
            {savedOverride !== null ? (
              <button
                type="button"
                className="btn-danger"
                onClick={handleResetOverride}
                disabled={isSaving}
              >
                Auf automatische Berechnung zurücksetzen …
              </button>
            ) : null}
          </div>
          {overrideStatus !== null ? (
            <p className="success-note" role="status">
              ✓ {overrideStatus}
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Darstellung</legend>
        <div className="form-field">
          <label htmlFor="settings-decimals">Dezimalstellen der Prozentanzeige (0–4)</label>
          <select
            id="settings-decimals"
            value={values.decimalsValue}
            onChange={(event) => setField('decimalsValue', event.target.value)}
            aria-invalid={fieldErrors['decimals'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['decimals'] !== undefined
                ? 'settings-decimals-error'
                : 'settings-decimals-hint'
            }
          >
            {['0', '1', '2', '3', '4'].map((option) => (
              <option key={option} value={option}>
                {option === '2' ? '2 (Standard)' : option}
              </option>
            ))}
          </select>
          {fieldError('decimals', 'settings-decimals-error')}
          <p id="settings-decimals-hint" className="app-hint">
            Vorschau:{' '}
            <span className="computed-value">
              {formatShare(PERCENT_PREVIEW_DECIMAL, decimals)}
            </span>{' '}
            (Beispielwert 0,8008 – gilt für alle Anteils- und Abweichungsanzeigen der App; die
            Renditeeingabe des Simulators ist eine Parameter-Anzeige mit eigener Genauigkeit).
          </p>
        </div>
        <dl className="facts-list">
          <div>
            <dt>Zahlenformat</dt>
            <dd>de-DE – fest in V1 (nur Anzeige, kein Schreibpfad)</dd>
          </div>
          <div>
            <dt>Währung</dt>
            <dd>EUR – fest in V1</dd>
          </div>
          <div>
            <dt>Datumsformat</dt>
            <dd>TT.MM.JJJJ – fest in V1</dd>
          </div>
        </dl>
        <p className="app-hint">
          Vorbereitung für spätere Versionen: V1 ist durchgehend deutsch (de-DE/EUR/TT.MM.JJJJ).
          Ein abweichend in der Datei gespeicherter numberLocale hätte in V1 KEINE Wirkung – die
          Anzeige bleibt deutsch.
        </p>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Automatische Sicherungen</legend>
        <div className="form-field">
          <label htmlFor="settings-backup-mode">Sicherungsmodus</label>
          <select
            id="settings-backup-mode"
            value={values.backupModeValue}
            onChange={(event) => setField('backupModeValue', event.target.value)}
            aria-invalid={fieldErrors['mode'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['mode'] !== undefined
                ? 'settings-backup-mode-error'
                : 'settings-backup-mode-hint'
            }
          >
            {initial.backupModeValue === '' ? (
              <option value="">
                nicht festgelegt – wirkt wie „bei jedem Speichern“ (Standard)
              </option>
            ) : null}
            {(Object.keys(BACKUP_MODE_LABELS) as BackupMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {BACKUP_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
          {fieldError('mode', 'settings-backup-mode-error')}
          <p id="settings-backup-mode-hint" className="app-hint">
            Nach jedem erfolgreichen Speichern lädt die App automatisch eine datierte
            Sicherungskopie herunter – „bei jedem Speichern“ immer, „täglich beim ersten
            Speichern“ nur einmal pro Kalendertag. Eine „aus“-Option gibt es in V1 bewusst nicht.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="settings-retention">
            Empfohlene Aufbewahrungsanzahl (ohne gespeicherten Wert gilt{' '}
            {RETENTION_DISPLAY_DEFAULT})
          </label>
          <input
            id="settings-retention"
            type="text"
            inputMode="numeric"
            value={values.retentionText}
            onChange={(event) => setField('retentionText', event.target.value)}
            aria-invalid={fieldErrors['retention'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['retention'] !== undefined
                ? 'settings-retention-error'
                : 'settings-retention-hint'
            }
          />
          {fieldError('retention', 'settings-retention-error')}
          <p id="settings-retention-hint" className="app-hint">
            Reine Empfehlung: „Bewahre die letzten N Sicherungen auf.“ Bei Browser-Downloads ist
            das Limit technisch nicht durchsetzbar – es wird NIE automatisch gelöscht. Ein leeres
            Feld lässt einen bereits gespeicherten Wert unverändert.
          </p>
        </div>
      </fieldset>

      {submitError !== null ? (
        <p className="field-error" role="alert" tabIndex={-1} ref={submitErrorRef}>
          {submitError}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" disabled={isSaving}>
          Einstellungen übernehmen
        </button>
        <button type="button" className="btn-danger" onClick={resetToSaved} disabled={isSaving}>
          Eingaben verwerfen
        </button>
      </div>
      {discardStatus !== null ? (
        <p className="success-note" role="status">
          ✓ {discardStatus}
        </p>
      ) : null}
    </form>
  )
}

// --- Erklärblock ---

function SettingsRules() {
  return (
    <details className="model-hint">
      <summary>So wirken die Einstellungen</summary>
      <ul>
        <li>
          Alle fachlichen Einstellungen liegen in der JSON-Datei und überleben damit jede
          Cache-Löschung (die Datei ist die einzige dauerhafte Datenquelle).
        </li>
        <li>
          Notgroschen-Ziel = Faktor × Netto; eine manuelle Übersteuerung hat Vorrang und wird nie
          ungefragt ersetzt. Das Ziel „Notgroschen“ nutzt immer den wirksamen Wert.
        </li>
        <li>
          Das Sparbudget ist nur ein Warn-Grenzwert (Seite „Sparpläne“) – es blockiert nichts und
          ändert keine Sparpläne.
        </li>
        <li>
          „Einstellungen übernehmen“, die Übersteuerung und die Zielprofil-Aktivierung ändern
          zunächst nur den Arbeitsspeicher (Kopfzeile zeigt „Ungespeicherte Änderungen“) – dauerhaft
          in deiner Datei landen sie erst über die Speichern-Schaltfläche oben rechts.
        </li>
      </ul>
    </details>
  )
}

// --- Seite ---

export function SettingsPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions, todayIso } = useFinanceData()
  const [formStatus, setFormStatus] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileStatus, setProfileStatus] = useState<string | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  // B1: Nach „Einstellungen übernehmen“ remountet das Formular (key) – der
  // Fokus landet gezielt auf der Erfolgs-Statusmeldung, nie auf document.body.
  const formStatusRef = useRef<HTMLParagraphElement | null>(null)

  const data = state.data
  if (data === null) {
    return (
      <section className="page" aria-labelledby="page-title">
        <h2 id="page-title">Einstellungen</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  const loadedData: FinanceData = data
  const fund = data.settings.emergencyFund
  const savedOverride =
    typeof fund.manualOverrideAmount === 'number' ? fund.manualOverrideAmount : null
  const savedComputed = computedEmergencyTarget(fund)

  const activeProfileId = data.settings.activeTargetProfileId ?? null
  const activeProfile: TargetProfile | null =
    data.targetProfiles.find((profile) => profile.id === activeProfileId) ?? null
  const displayedProfileId = selectedProfileId ?? activeProfileId ?? ''
  const displayedProfile =
    data.targetProfiles.find((profile) => profile.id === displayedProfileId) ?? null
  const jobWarningActive =
    displayedProfile !== null &&
    displayedProfile.kind === 'job' &&
    todayIso < JOB_PROFILE_EARLIEST_ISO

  const lastAutoBackupDay = readLastAutoBackupDay()
  const retentionDisplay =
    typeof data.settings.backup?.retentionCount === 'number'
      ? data.settings.backup.retentionCount
      : RETENTION_DISPLAY_DEFAULT

  /**
   * Übernimmt einen Patch über die reine Datenfunktion. Dirty entsteht NUR,
   * wenn sich das Serialisat tatsächlich ändert (K2-Vergleich vor Übernahme).
   */
  function applySettingsPatch(patch: SettingsInput): { error: string | null; changed: boolean } {
    const result = updateSettings(loadedData, patch)
    if (!result.ok) return { error: result.error, changed: false }
    const changed = JSON.stringify(result.data) !== JSON.stringify(loadedData)
    if (changed) actions.applyDataChange(result.data)
    return { error: null, changed }
  }

  function handleFormSubmit(input: SettingsInput): string | null {
    setFormStatus(null)
    const { error, changed } = applySettingsPatch(input)
    if (error !== null) return error
    setFormStatus(
      changed
        ? 'Einstellungen übernommen. Noch nicht in der Datei gespeichert – das geschieht erst ' +
            'über die Speichern-Schaltfläche oben rechts (die Kopfzeile zeigt „Ungespeicherte ' +
            'Änderungen“).'
        : 'Keine Änderungen – der Bestand bleibt unverändert.',
    )
    // B1: Fokus auf die Statusmeldung – der key-Remount des Formulars (bei
    // echter Änderung) würde den Fokus sonst auf document.body werfen.
    requestAnimationFrame(() => formStatusRef.current?.focus())
    return null
  }

  function handleSetOverride(amount: number): string | null {
    setFormStatus(null)
    return applySettingsPatch({ manualOverrideAmount: amount }).error
  }

  function handleResetOverride(): string | null {
    setFormStatus(null)
    return applySettingsPatch({ manualOverrideAmount: null }).error
  }

  function handleActivateProfile(): void {
    setProfileError(null)
    setProfileStatus(null)
    if (displayedProfile === null) {
      // B6: Fehler feldnah am Select (aria-Verdrahtung) + Fokus aufs Select.
      setProfileError('Bitte zuerst ein Zielprofil wählen.')
      document.getElementById('settings-profile')?.focus()
      return
    }
    if (displayedProfile.id === activeProfileId) {
      setProfileStatus(`„${displayedProfile.name}“ ist bereits das aktive Zielprofil.`)
      return
    }
    // G12: Bestätigung mit beiden Werten (bisheriges und neues Profil, Namen).
    const jobWarningText = jobWarningActive
      ? ` WARNUNG: Das Job-Profil ist laut Plan erst ab dem ${formatIsoDateGerman(JOB_PROFILE_EARLIEST_ISO)} vorgesehen (heute: ${formatIsoDateGerman(todayIso)}) – die Aktivierung ist vermutlich verfrüht.`
      : ''
    const proceed = window.confirm(
      `Zielprofil wechseln? Bisher aktiv: „${activeProfile?.name ?? 'keins'}“ – neu: „${displayedProfile.name}“. Die Auswahl gilt global (z. B. Übersicht und Depot-Zielvergleich); es wird nichts automatisch umgeschichtet.${jobWarningText}`,
    )
    if (!proceed) return
    const { error, changed } = applySettingsPatch({ activeTargetProfileId: displayedProfile.id })
    if (error !== null) {
      setProfileError(error.replace(/^Zielprofil:\s*/, ''))
      document.getElementById('settings-profile')?.focus()
      return
    }
    setSelectedProfileId(null)
    setProfileStatus(
      changed
        ? `Zielprofil „${displayedProfile.name}“ aktiviert – Datei speichern nicht vergessen.`
        : `„${displayedProfile.name}“ war bereits aktiv – keine Änderung.`,
    )
  }

  function handleManualBackup(): void {
    setBackupStatus(null)
    actions.backupDownload()
    setBackupStatus(
      'Sicherungskopie wurde als Download erstellt (aktueller Stand des Arbeitsspeichers, inklusive ungespeicherter Änderungen).',
    )
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <h2 id="page-title">Einstellungen</h2>
      <p className="app-hint">
        Nutzerkonfiguration ohne sensible Daten (Stichtag: {formatIsoDateGerman(todayIso)}). Alle
        fachlichen Einstellungen werden in der JSON-Datei gespeichert; es gibt keine Konten,
        Logins oder Zugangsdaten.
      </p>
      <SettingsRules />

      <section aria-labelledby="settings-file-title">
        <h3 id="settings-file-title">Einstellungen in der Finanzdatei</h3>
        <SettingsForm
          // key erzwingt eine frische Formularinstanz, sobald sich der
          // GESPEICHERTE Stand der Formularfelder ändert (z. B. nach dem
          // Übernehmen oder einem Import) – Eingaben „kleben“ nie an einem
          // veralteten Bestand (M8-Lehre).
          key={JSON.stringify(formValuesFromData(loadedData))}
          initial={formValuesFromData(loadedData)}
          fund={fund}
          savedOverride={savedOverride}
          savedComputed={savedComputed}
          isSaving={state.isSaving}
          onSubmit={handleFormSubmit}
          onSetOverride={handleSetOverride}
          onResetOverride={handleResetOverride}
        />
        {formStatus !== null ? (
          <p className="success-note" role="status" tabIndex={-1} ref={formStatusRef}>
            ✓ {formStatus}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="settings-profile-title">
        <h3 id="settings-profile-title">Zielprofil (global)</h3>
        <p className="app-hint">
          Das aktive Zielprofil steuert Übersicht und Depot-Zielvergleich. Die Seite
          „Rebalancing“ behält ihre eigene lokale Analyse-Auswahl – ein Wechsel hier ändert dort
          nichts automatisch. Profile werden in V1 nicht bearbeitet (bewusste Grenze); die
          Aktivierung ist eine reine Auswahl mit Bestätigung.
        </p>
        <div className="form-field">
          <label htmlFor="settings-profile">Zielprofil wählen</label>
          <select
            id="settings-profile"
            value={displayedProfileId}
            onChange={(event) => setSelectedProfileId(event.target.value)}
            aria-invalid={profileError !== null || undefined}
            aria-describedby={
              profileError !== null
                ? 'settings-profile-error'
                : jobWarningActive
                  ? 'settings-profile-job-warning'
                  : undefined
            }
          >
            {activeProfileId === null ? <option value="">kein aktives Profil</option> : null}
            {data.targetProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.id === activeProfileId ? `${profile.name} (aktiv)` : profile.name}
              </option>
            ))}
          </select>
          {profileError !== null ? (
            <p id="settings-profile-error" className="field-error" role="alert">
              {profileError}
            </p>
          ) : null}
        </div>
        {jobWarningActive ? (
          <p id="settings-profile-job-warning" className="warning-note" role="status">
            ⚠ Das Job-Profil ist laut Plan erst ab dem{' '}
            {formatIsoDateGerman(JOB_PROFILE_EARLIEST_ISO)} vorgesehen (heute:{' '}
            {formatIsoDateGerman(todayIso)}). Die Aktivierung vorher ist möglich, aber vermutlich
            verfrüht.
          </p>
        ) : null}
        <div className="toolbar">
          <button type="button" onClick={handleActivateProfile} disabled={state.isSaving}>
            Zielprofil aktivieren …
          </button>
        </div>
        {profileStatus !== null ? (
          <p className="success-note" role="status">
            ✓ {profileStatus}
          </p>
        ) : null}
        <p>
          Aktives Profil: <strong>{activeProfile?.name ?? 'keins'}</strong>
        </p>
      </section>

      <section aria-labelledby="settings-backup-title">
        <h3 id="settings-backup-title">Sicherung &amp; Wiederherstellung</h3>
        <dl className="facts-list">
          <div>
            <dt>Letzte automatische Sicherung dieses Geräts</dt>
            <dd>
              {lastAutoBackupDay === null
                ? 'unbekannt (noch keine automatische Sicherung auf diesem Gerät vermerkt)'
                : `${formatIsoDateGerman(lastAutoBackupDay)} (Tagesgranularität – vermerkt wird nur der Kalendertag)`}
            </dd>
          </div>
          <div>
            <dt>Aufbewahrungsempfehlung</dt>
            <dd>
              Bewahre die letzten {retentionDisplay} Sicherungen auf – Downloads werden nie
              automatisch gelöscht (nicht durchsetzbar, reine Empfehlung).
            </dd>
          </div>
        </dl>
        <div className="toolbar">
          <button type="button" onClick={handleManualBackup} disabled={state.isSaving}>
            Sicherung jetzt erstellen
          </button>
          {/* B7: direkter Weg zur Wiederherstellung (Import) auch aus dieser Sektion. */}
          <button type="button" className="btn-quiet" onClick={onOpenDataBackups}>
            Zur Wiederherstellung (Daten &amp; Backups)
          </button>
        </div>
        {backupStatus !== null ? (
          <p className="success-note" role="status">
            ✓ {backupStatus}
          </p>
        ) : null}
        <p className="app-hint">
          Wiederherstellung = Import einer Sicherungsdatei: Jede Sicherung ist eine vollständige
          Finanzdatei. Unter „Daten &amp; Backups“ wird sie mit Validierung, Vorschau und
          ausdrücklicher Bestätigung importiert – ein Abbruch oder Fehler lässt den aktuellen
          Bestand unverändert.
        </p>
      </section>

      <section aria-labelledby="settings-io-title">
        <h3 id="settings-io-title">Import &amp; Export</h3>
        <p>
          Öffnen, Export (Download) und Import mit Vorschau laufen zentral über die Seite „Daten
          &amp; Backups“, gespeichert wird über die Schaltfläche oben rechts – hier gibt es bewusst
          keine doppelten Datei-Aktionen.
        </p>
        <p>Jede geladene oder importierte Datei durchläuft die vollständige Datenprüfung:</p>
        <ul>
          <li>Schema und Version (schemaVersion, verständliche Ablehnung neuerer Dateien)</li>
          <li>Pflichtfelder und Typen (keine Beträge als Text)</li>
          <li>endliche Zahlen – niemals NaN oder Infinity</li>
          <li>Datumsformate (JJJJ-MM-TT, gültige Kalenderdaten)</li>
          <li>dateiweit eindeutige IDs (keine doppelten IDs)</li>
          <li>auflösbare Referenzen (Konten, Positionen, Profile, Ziele)</li>
          <li>gültige Aufzählungswerte und Wertebereiche (z. B. Faktor 3–5)</li>
          <li>Fachregeln und Warnungen (z. B. Snapshot-Schutz, leere Historien)</li>
        </ul>
        <div className="toolbar">
          <button type="button" className="btn-quiet" onClick={onOpenDataBackups}>
            Zu Daten &amp; Backups
          </button>
        </div>
        <p className="app-hint">
          Bewusste V1-Grenzen: kein CSV-Export, kein PDF, keine Cloud – die JSON-Datei ist der
          einzige Kanal.
        </p>
      </section>

      <section aria-labelledby="settings-storage-title">
        <h3 id="settings-storage-title">Speicherorte (Transparenz)</h3>
        <ul>
          <li>
            <strong>JSON-Datei:</strong> alle fachlichen Einstellungen und Finanzdaten
            (Notgroschen, Sparbudget, Darstellung, Sicherungsmodus, Zielprofil) – nach einer
            Cache-Löschung durch erneutes Öffnen der Datei vollständig wiederhergestellt.
          </li>
          <li>
            {/* B9: kein technischer Schlüsselname im Endnutzertext – die
                Klartext-Beschreibung genügt (Schlüssel dokumentiert in
                localStoragePolicy.ts und storage-concept §1). */}
            <strong>Browser-Speicher (nur unkritische Gerätemarken):</strong> ausschließlich ein
            einzelner Tagesmerker dieses Geräts (Kalendertag der letzten automatischen
            Sicherung). Geht er verloren, entsteht höchstens eine zusätzliche Sicherung – nie
            ein Datenverlust. Finanzdaten liegen NIE im Browser-Speicher.
          </li>
          <li>
            {/* Speicherort-/Berechtigungsstatus der Dateizugriffe (M14-Eingabe). */}
            <strong>Dateiverbindung dieser Sitzung:</strong>{' '}
            {state.fileName ?? 'neue, noch nicht gespeicherte Datei'} –{' '}
            {state.fileHandle !== null
              ? 'direktes Speichern in die geöffnete Datei möglich (die Freigabe kann der Browser jederzeit widerrufen; dann greift der Download-Weg).'
              : 'kein direktes Datei-Handle – Speichern läuft über den Dialog bzw. den Download-Weg („Daten & Backups“).'}
          </li>
        </ul>
      </section>
    </section>
  )
}
