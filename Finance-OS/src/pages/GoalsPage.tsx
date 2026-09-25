/**
 * Modul „Finanzziele und Zielerreichung“ (M12): Zusammenfassung, Zielliste als
 * Karten (goal-list-Muster, mobile-tauglich), aufklappbares Zieldetail mit
 * Prognose (OHNE Rendite-/Kursannahme) sowie Verwaltung (Anlegen/Bearbeiten/
 * Pausieren/Reaktivieren/Abschließen/Archivieren – KEIN Löschen).
 *
 * Keine Finanzlogik in Komponenten: alle Kennzahlen kommen aus
 * src/finance/goals.ts (effectiveGoalTarget, goalActualValue,
 * normalizedActualForStatus, goalProgress, goalSurplus, remainingFullMonths,
 * requiredMonthlyRate, forecastMonthsToTarget, rateGap, deriveGoalStatus,
 * assignedOwnPlans/-Savings, countGoalsByStatus, compareGoalEntries) – die
 * metric-Verzweigung existiert NUR dort. Alle Datenänderungen laufen über die
 * reinen Funktionen in src/data/goals.ts (+ applyDataChange → DATA_CHANGED).
 * Abbrechen/unverändertes Speichern übernimmt NIE einen Bestand (Vergleich
 * vor Übernahme, auch bei Statusaktionen – K3). Der Stichtag kommt IMMER aus
 * dem injizierten todayIso des Provider-Kontexts.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { FinanceData, Goal, GoalMetric, SavingsPlan } from '../types/finance'
import type { DerivedGoalStatus, GoalActualValue, GoalProgress } from '../finance'
import {
  assignedOwnPlans,
  compareGoalEntries,
  countGoalsByStatus,
  deriveGoalStatus,
  effectiveGoalTarget,
  forecastMonthsToTarget,
  goalActualValue,
  goalProgress,
  goalSurplus,
  isEmergencyFundGoal,
  isPlanActiveOn,
  assignedOwnSavings,
  normalizedActualForStatus,
  ownMonthlySavings,
  rateGap,
  remainingFullMonths,
  requiredMonthlyRate,
} from '../finance'
import { formatEuro, parseGermanAmount } from '../format/money'
import { formatIsoDateGerman } from '../format/date'
import {
  addGoal,
  archiveGoal,
  completeGoal,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from '../data/goals'
import type { GoalActionResult, GoalInput } from '../data/goals'
import { useFinanceData } from '../state/useFinanceData'

// --- Deutsche Labels (UI) ---

const METRIC_LABELS: Record<GoalMetric, string> = {
  tagesgeld: 'Tagesgeld gesamt',
  depotValue: 'Depotwert',
  totalWealth: 'Gesamtvermögen',
  monthlySavingsRate: 'Monatliche Sparrate',
  accountBalance: 'Kontostand eines Kontos',
  positionValue: 'Wert einer Depotposition',
  manual: 'Freies Geldziel (Ist-Wert manuell gepflegt)',
}

const NO_METRIC_LABEL = 'ohne Kennzahl (Merkziel)'

/**
 * Label-Kontinuität (Auflage G): der GESPEICHERTE Status deferred heißt
 * weiterhin „zurückgestellt“ (Dashboard); hier erscheint der ABGELEITETE
 * Status – „Pausiert“ als Zustandslabel, „Pausieren/Reaktivieren“ nur als
 * Aktionsverben.
 */
const DERIVED_STATUS_LABELS: Record<DerivedGoalStatus, string> = {
  overdue: 'Überfällig',
  active: 'Aktiv',
  reachedNow: 'Rechnerisch erreicht',
  notComputable: 'Nicht berechenbar',
  planned: 'Geplant',
  paused: 'Pausiert (zurückgestellt)',
  completed: 'Manuell abgeschlossen',
  archived: 'Archiviert',
}

const DERIVED_STATUS_SYMBOLS: Record<DerivedGoalStatus, string> = {
  overdue: '⚠',
  active: '●',
  reachedNow: '✓',
  notComputable: '∅',
  planned: '◷',
  paused: '⏸',
  completed: '✔',
  archived: '■',
}

const STATUS_REASONS: Record<DerivedGoalStatus, string> = {
  archived: 'Archiviert (gespeichert) – endgültig beendet, keine weitere Bearbeitung.',
  completed:
    'Manuell abgeschlossen (gespeicherte Entscheidung) – gilt unabhängig vom rechnerischen Fortschritt, auch bei sinkendem Ist-Wert.',
  paused:
    'Pausiert (gespeichert „zurückgestellt“) – der gespeicherte Nutzerwille geht vor dem Zeitfenster; es wird kein Fortschritt bewertet.',
  planned: 'Geplant – das Startdatum liegt nach dem Stichtag.',
  notComputable:
    'Nicht berechenbar – es fehlt ein wirksamer Zielbetrag oder ein bekannter Ist-Wert (unbekannt zählt nie als 0).',
  reachedNow:
    'Rechnerisch erreicht (Ist ≥ Ziel) – wird nie gespeichert und fällt bei sinkendem Ist-Wert wieder zurück.',
  overdue: 'Überfällig – das Zieldatum ist überschritten und das Ziel noch nicht erreicht.',
  active: 'Aktiv – das Ziel wird verfolgt.',
}

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Betrag als de-DE-Eingabetext (parseGermanAmount-kompatibel). */
function amountToInputText(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

interface RefInfo {
  name: string
  kindLabel: 'Konto' | 'Depotposition'
  exists: boolean
  inactive: boolean
}

/** Referenz-Info eines Konto-/Positionsziels (Namen, nie IDs im Endnutzertext). */
function refInfoOf(data: FinanceData, goal: Goal): RefInfo | null {
  if (goal.metric === 'accountBalance') {
    const account = data.accounts.find((entry) => entry.id === goal.refId)
    return {
      name: account?.name ?? 'unbekanntes Konto',
      kindLabel: 'Konto',
      exists: account !== undefined,
      inactive: account !== undefined && account.isActive === false,
    }
  }
  if (goal.metric === 'positionValue') {
    const position = data.portfolioPositions.find((entry) => entry.id === goal.refId)
    return {
      name: position?.name ?? 'unbekannte Depotposition',
      kindLabel: 'Depotposition',
      exists: position !== undefined,
      inactive: position !== undefined && position.isActive === false,
    }
  }
  return null
}

/** Zielart-Label inkl. Referenzname (z. B. „Kontostand eines Kontos: VW Tagesgeld“). */
function metricDisplay(goal: Goal, refInfo: RefInfo | null): string {
  if (isEmergencyFundGoal(goal)) return 'Notgroschen (Tagesgeld, Ziel wird berechnet)'
  if (goal.metric == null) return NO_METRIC_LABEL
  const base = METRIC_LABELS[goal.metric]
  return refInfo === null ? base : `${base}: ${refInfo.name}`
}

/** G11-Anzeige des Ist-Werts: „unbekannt“/„offen“/„nicht berechenbar“, nie eine erfundene 0. */
function actualDisplay(goal: Goal, value: GoalActualValue | null, normalized: number | null): string {
  if (value === null) {
    if (goal.metric === 'manual') return 'offen (kein Ist-Wert erfasst)'
    if (goal.metric == null && !isEmergencyFundGoal(goal)) {
      return 'nicht berechenbar (keine Kennzahl zugeordnet)'
    }
    return 'nicht berechenbar (Referenz nicht gefunden)'
  }
  if (normalized === null) return 'unbekannt (noch kein Wert erfasst)'
  if (value.missingIds.length > 0) {
    return `${formatEuro(value.amount)} (enthält unbekannte Werte)`
  }
  return formatEuro(value.amount)
}

// --- Formular (Anlegen + Bearbeiten, gleiche Komponente; key={goal.id} beim Bearbeiten) ---

interface GoalFormValues {
  name: string
  /** '' = ohne Kennzahl; sonst GoalMetric. */
  metric: string
  /** Referenz-ID (nur bei accountBalance/positionValue relevant). */
  refId: string
  targetAmountText: string
  manualCurrentText: string
  startDate: string
  targetDate: string
  note: string
}

const REF_METRICS: readonly string[] = ['accountBalance', 'positionValue']

function GoalForm({
  heading,
  initial,
  data,
  isAutoGoal,
  autoTargetText,
  onCancel,
  onSubmit,
}: {
  heading: string
  initial: GoalFormValues
  data: FinanceData
  /** true beim Notgroschen: Kennzahl/Zielbetrag sind nicht editierbar. */
  isAutoGoal: boolean
  /** Anzeigetext des berechneten Notgroschen-Ziels (nur bei isAutoGoal). */
  autoTargetText: string | null
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (input: GoalInput) => string | null
}) {
  const [values, setValues] = useState<GoalFormValues>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Fokus aufs ERSTE Fehlerfeld nach fehlgeschlagenem Absenden (B3-Muster) –
  // Reihenfolge entspricht der Feldreihenfolge im Formular.
  const FIELD_ID_BY_ERROR_KEY: Record<string, string> = {
    name: 'goal-name',
    ref: 'goal-ref',
    target: 'goal-target',
    manual: 'goal-manual',
    startDate: 'goal-startdate',
    targetDate: 'goal-targetdate',
  }
  const FIELD_ERROR_ORDER = ['name', 'ref', 'target', 'manual', 'startDate', 'targetDate']

  function focusFirstErrorField(errors: Record<string, string>): void {
    const key = FIELD_ERROR_ORDER.find((candidate) => errors[candidate] !== undefined)
    if (key === undefined) return
    document.getElementById(FIELD_ID_BY_ERROR_KEY[key])?.focus()
  }

  function setField<K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const needsRef = REF_METRICS.includes(values.metric)
  const isManual = values.metric === 'manual'
  const refOptions =
    values.metric === 'accountBalance'
      ? data.accounts.map((account) => ({
          id: account.id,
          label: account.isActive === false ? `${account.name} (inaktiv)` : account.name,
          inactive: account.isActive === false,
        }))
      : data.portfolioPositions.map((position) => ({
          id: position.id,
          label: position.isActive === false ? `${position.name} (inaktiv)` : position.name,
          inactive: position.isActive === false,
        }))
  const selectedRef = refOptions.find((option) => option.id === values.refId)

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitError(null)
    const errors: Record<string, string> = {}
    if (values.name.trim() === '') {
      errors['name'] = 'Der Name darf nicht leer sein.'
    }
    let targetAmount: number | null = null
    if (!isAutoGoal && values.targetAmountText.trim() !== '') {
      const parsed = parseGermanAmount(values.targetAmountText)
      if (parsed === null) {
        errors['target'] =
          'Bitte einen gültigen Betrag eingeben (z. B. 5.000 oder 4.680,50) – oder leer lassen („offen“).'
      } else {
        targetAmount = parsed
      }
    }
    let manualCurrentAmount: number | null = null
    if (isManual && values.manualCurrentText.trim() !== '') {
      const parsed = parseGermanAmount(values.manualCurrentText)
      if (parsed === null) {
        errors['manual'] =
          'Bitte einen gültigen Betrag eingeben (z. B. 250,00) – oder leer lassen („offen“).'
      } else {
        manualCurrentAmount = parsed
      }
    }
    if (needsRef && values.refId === '') {
      errors['ref'] = 'Bitte eine Referenz wählen.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusFirstErrorField(errors)
      return
    }
    setFieldErrors({})
    const input: GoalInput = {
      name: values.name,
      targetAmount: isAutoGoal ? undefined : targetAmount,
      targetDate: textOrNull(values.targetDate),
      metric: isAutoGoal
        ? undefined
        : values.metric === ''
          ? null
          : (values.metric as GoalMetric),
      refId: needsRef ? values.refId : null,
      manualCurrentAmount: isManual ? manualCurrentAmount : null,
      startDate: textOrNull(values.startDate),
      note: textOrNull(values.note),
    }
    const error = onSubmit(input)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah zuordnen (Feld-Präfixe).
    const prefixes: [string, string][] = [
      ['Name:', 'name'],
      ['Zielbetrag:', 'target'],
      ['Referenz:', 'ref'],
      ['Ist-Wert:', 'manual'],
      ['Startdatum:', 'startDate'],
      ['Zieldatum:', 'targetDate'],
    ]
    const match = prefixes.find(([prefix]) => error.startsWith(prefix))
    if (match) {
      const mapped = { [match[1]]: error.slice(match[0].length).trim() }
      setFieldErrors(mapped)
      focusFirstErrorField(mapped)
    } else {
      setSubmitError(error)
      requestAnimationFrame(() => submitErrorRef.current?.focus())
    }
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

  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      {/* h4: die Formulare liegen INNERHALB der Sektion „Zielliste“ (h3). */}
      <h4>{heading}</h4>
      <div className="form-field">
        <label htmlFor="goal-name">Name *</label>
        <input
          id="goal-name"
          ref={firstFieldRef}
          type="text"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={fieldErrors['name'] !== undefined || undefined}
          aria-describedby={fieldErrors['name'] !== undefined ? 'goal-name-error' : undefined}
        />
        {fieldError('name', 'goal-name-error')}
      </div>
      <div className="form-field">
        <label htmlFor="goal-metric">Zielart (Kennzahl)</label>
        <select
          id="goal-metric"
          value={values.metric}
          disabled={isAutoGoal}
          onChange={(event) => {
            const nextMetric = event.target.value
            setValues((current) => ({
              ...current,
              metric: nextMetric,
              // Zielart steuert die Zusatzfelder: Referenz nur bei Konto-/
              // Positionszielen, manueller Ist-Wert nur beim freien Geldziel.
              // Die Referenz wird bei JEDEM Zielartwechsel geleert – sonst
              // „klebte“ eine Konto-ID unsichtbar am Positionsziel (A11y B3).
              refId: '',
              manualCurrentText: nextMetric === 'manual' ? current.manualCurrentText : '',
            }))
          }}
        >
          <option value="">{NO_METRIC_LABEL}</option>
          {(Object.keys(METRIC_LABELS) as GoalMetric[]).map((metric) => (
            <option key={metric} value={metric}>
              {METRIC_LABELS[metric]}
            </option>
          ))}
        </select>
        {isAutoGoal ? (
          <p className="app-hint">
            Der Notgroschen behält seine berechnete Kennzahl – die Zielart ist hier nicht änderbar.
          </p>
        ) : null}
      </div>
      {needsRef ? (
        <div className="form-field">
          <label htmlFor="goal-ref">
            {values.metric === 'accountBalance' ? 'Referenziertes Konto *' : 'Referenzierte Depotposition *'}
          </label>
          <select
            id="goal-ref"
            value={values.refId}
            onChange={(event) => setField('refId', event.target.value)}
            aria-invalid={fieldErrors['ref'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['ref'] !== undefined
                ? 'goal-ref-error'
                : selectedRef?.inactive
                  ? 'goal-ref-warning'
                  : undefined
            }
          >
            <option value="">bitte wählen …</option>
            {refOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldError('ref', 'goal-ref-error')}
          {selectedRef?.inactive ? (
            <p id="goal-ref-warning" className="field-warning" role="status">
              ⚠ Die gewählte Referenz ist deaktiviert. Das Ziel kann gespeichert werden – der
              Ist-Wert wird weiter berechnet, die Referenz zählt aber in keine aktive Summe.
            </p>
          ) : null}
        </div>
      ) : null}
      {isAutoGoal ? (
        <div className="form-field">
          <p className="app-hint">
            Zielbetrag (berechnet): <strong>{autoTargetText}</strong> – aus Faktor × Netto
            (Einstellungen). Eine manuelle Übersteuerung ist über die Einstellungen möglich; der
            berechnete Wert wird nie ungefragt ersetzt.
          </p>
        </div>
      ) : (
        <div className="form-field">
          <label htmlFor="goal-target">Zielbetrag in Euro (leer = offen)</label>
          <input
            id="goal-target"
            type="text"
            inputMode="decimal"
            value={values.targetAmountText}
            onChange={(event) => setField('targetAmountText', event.target.value)}
            aria-invalid={fieldErrors['target'] !== undefined || undefined}
            aria-describedby={fieldErrors['target'] !== undefined ? 'goal-target-error' : undefined}
          />
          {fieldError('target', 'goal-target-error')}
        </div>
      )}
      {isManual ? (
        <div className="form-field">
          <label htmlFor="goal-manual">Aktueller Ist-Wert in Euro (leer = offen)</label>
          <input
            id="goal-manual"
            type="text"
            inputMode="decimal"
            value={values.manualCurrentText}
            onChange={(event) => setField('manualCurrentText', event.target.value)}
            aria-invalid={fieldErrors['manual'] !== undefined || undefined}
            aria-describedby={fieldErrors['manual'] !== undefined ? 'goal-manual-error' : undefined}
          />
          {fieldError('manual', 'goal-manual-error')}
          <p className="app-hint">
            Freies Geldziel: Der Ist-Wert wird hier manuell gepflegt – es gibt keinen
            automatischen Bezug zu Konten oder Positionen.
          </p>
        </div>
      ) : null}
      <div className="form-field">
        <label htmlFor="goal-startdate">Startdatum (optional)</label>
        <input
          id="goal-startdate"
          type="date"
          value={values.startDate}
          onChange={(event) => setField('startDate', event.target.value)}
          aria-invalid={fieldErrors['startDate'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['startDate'] !== undefined ? 'goal-startdate-error' : 'goal-startdate-hint'
          }
        />
        {fieldError('startDate', 'goal-startdate-error')}
        <p id="goal-startdate-hint" className="app-hint">
          Liegt das Startdatum in der Zukunft, gilt das Ziel als „geplant“.
        </p>
      </div>
      <div className="form-field">
        <label htmlFor="goal-targetdate">Zieldatum (optional)</label>
        <input
          id="goal-targetdate"
          type="date"
          value={values.targetDate}
          onChange={(event) => setField('targetDate', event.target.value)}
          aria-invalid={fieldErrors['targetDate'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['targetDate'] !== undefined ? 'goal-targetdate-error' : undefined
          }
        />
        {fieldError('targetDate', 'goal-targetdate-error')}
      </div>
      <div className="form-field">
        <label htmlFor="goal-note">Notiz</label>
        <input
          id="goal-note"
          type="text"
          value={values.note}
          onChange={(event) => setField('note', event.target.value)}
        />
      </div>
      {submitError !== null ? (
        <p className="field-error" role="alert" tabIndex={-1} ref={submitErrorRef}>
          {submitError}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit">Speichern</button>
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// --- Erklärblock (Details-Muster, kein title-only) ---

function GoalRules() {
  return (
    <details className="model-hint">
      <summary>So rechnen die Ziel-Kennzahlen</summary>
      <ul>
        <li>
          Fortschritt = Ist-Wert / Zielbetrag. Offene Zielbeträge und unbekannte Ist-Werte werden
          nie als 0 erfunden – solche Ziele sind „offen“ bzw. „nicht berechenbar“.
        </li>
        <li>
          Verbleibende Zeit zählt VOLLE Kalendermonatswechsel bis zum Zieldatum – der angebrochene
          aktuelle Monat zählt nicht als Sparmonat (konservativ: die benötigte Monatsrate fällt
          eher höher aus).
        </li>
        <li>
          Die Prognose ist eine reine Division (Rest ÷ eigene reale Monatsrate) OHNE
          Rendite-/Kursannahme – keine Prognosegarantie.
        </li>
        <li>
          Eigene Sparleistung: nur eigenes Geld (U3/U4) – eigene feste UND eigene variable Raten
          mit festem positivem Betrag; externe Zuflüsse (Arbeitgeber/Anbieter), Umbuchungen und
          variable Raten ohne Betrag zählen nie. Geglättete Werte sind IMMER als „geglättet
          (Analysewert)“ gekennzeichnet.
        </li>
        <li>
          Zielbezogene Sparleistungen werden NIE über Ziele summiert – dieselbe Rate kann mehreren
          Zielen zuordenbar sein (z. B. Positionsziel und Depotziel).
        </li>
        <li>
          „Manuell abgeschlossen“ ist eine gespeicherte Entscheidung; „rechnerisch erreicht“ wird
          nie gespeichert und fällt bei sinkendem Ist-Wert wieder zurück. Zielerreichung löst nur
          eine Anzeige aus – die App ändert nie automatisch Sparraten.
        </li>
      </ul>
    </details>
  )
}

function StartHint({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  return (
    <div className="start-hint">
      <p>
        Es sind noch keine Finanzdaten geladen. Öffne unter „Daten &amp; Backups“ eine vorhandene
        JSON-Datei, lege eine neue leere Datei an oder importiere einen Bestand.
      </p>
      <button type="button" onClick={onOpenDataBackups}>
        Zu „Daten &amp; Backups“
      </button>
    </div>
  )
}

// --- Seite ---

interface GoalRow {
  goal: Goal
  target: number | null
  actualValue: GoalActualValue | null
  actual: number | null
  status: DerivedGoalStatus
  progress: GoalProgress | null
  refInfo: RefInfo | null
  assignedPlans: SavingsPlan[] | null
  /** Zielbezogene eigene Sparleistung (assignedOwnSavings, reine Schicht – Reviewer K1). */
  assignedReal: number | null
  assignedSmoothed: number | null
  /** Namen der Einträge ohne erfassten Wert (G11) – Namen, nie IDs. */
  missingNames: string[]
}

type EditorState = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; goalId: string }

export function GoalsPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions, todayIso } = useFinanceData()
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  const [actionError, setActionError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [returnFocusPending, setReturnFocusPending] = useState(false)

  // Fokus-Rückgabe erst NACH dem Re-Render (Buttons sind bei offenem Formular disabled).
  useEffect(() => {
    if (returnFocusPending && editor.kind === 'closed') {
      triggerRef.current?.focus()
      setReturnFocusPending(false)
    }
  }, [returnFocusPending, editor])

  const data = state.data
  if (data === null) {
    return (
      <section className="page" aria-labelledby="page-title">
        <h2 id="page-title">Ziele</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  const loadedData: FinanceData = data
  const fund = data.settings.emergencyFund
  const percentDecimals =
    typeof data.settings.display?.percentDecimals === 'number'
      ? data.settings.display.percentDecimals
      : 2

  // Stichtag kommt injiziert aus dem Provider (nie die eigene Systemuhr).
  const activePlans = data.savingsPlans.filter((plan) => isPlanActiveOn(plan, todayIso))
  const ownReal = ownMonthlySavings(activePlans, 'realMonthly')
  const ownSmoothed = ownMonthlySavings(activePlans, 'smoothed')

  // G11-Hinweise: fehlende Werte als NAMEN (nie IDs) über die Lookups auflösen.
  const accountNameById = new Map(data.accounts.map((account) => [account.id, account.name]))
  const positionNameById = new Map(
    data.portfolioPositions.map((position) => [position.id, position.name]),
  )

  const rows: GoalRow[] = data.goals.map((goal) => {
    const target = effectiveGoalTarget(goal, fund)
    const actualValue = goalActualValue(goal, loadedData, todayIso)
    // G11 (Auflage E): vollständig unbekannter Ist-Wert → null, nie 0.
    const actual = normalizedActualForStatus(actualValue)
    const status = deriveGoalStatus(goal, { target, actual, todayIso })
    return {
      goal,
      target,
      actualValue,
      actual,
      status,
      progress: target !== null && actual !== null ? goalProgress(actual, target) : null,
      refInfo: refInfoOf(loadedData, goal),
      assignedPlans: assignedOwnPlans(
        goal,
        activePlans,
        loadedData.accounts,
        loadedData.portfolioPositions,
      ),
      assignedReal: assignedOwnSavings(
        goal,
        activePlans,
        loadedData.accounts,
        loadedData.portfolioPositions,
        'realMonthly',
      ),
      assignedSmoothed: assignedOwnSavings(
        goal,
        activePlans,
        loadedData.accounts,
        loadedData.portfolioPositions,
        'smoothed',
      ),
      missingNames: (actualValue?.missingIds ?? []).map(
        (id) => accountNameById.get(id) ?? positionNameById.get(id) ?? 'unbekannter Eintrag',
      ),
    }
  })
  const sortedRows = rows
    .slice()
    .sort((a, b) => compareGoalEntries({ goal: a.goal, status: a.status }, { goal: b.goal, status: b.status }))

  // --- Zusammenfassung ---

  const counts = countGoalsByStatus(rows.map((row) => row.status))
  const nonArchivedRows = rows.filter((row) => row.status !== 'archived')
  // Sparraten-Ziele (€/Monat) fließen NICHT in die Summen ein – ein Monatswert
  // ist keine Vermögensgröße (Auflage F, dimensionsrein).
  const sumRows = nonArchivedRows.filter(
    (row) => row.goal.metric !== 'monthlySavingsRate' && row.target !== null,
  )
  const targetSum = sumRows.reduce((sum, row) => sum + (row.target ?? 0), 0)
  const computableSumRows = sumRows.filter((row) => row.progress !== null)
  const remainingSum = computableSumRows.reduce((sum, row) => sum + row.progress!.remaining, 0)
  const attentionRows = nonArchivedRows.filter(
    (row) =>
      row.status === 'overdue' ||
      row.status === 'notComputable' ||
      row.refInfo?.inactive === true ||
      row.refInfo?.exists === false,
  )

  // --- Editor-Handling (Fokusführung wie SavingsPlansPage) ---

  function openEditor(next: EditorState, trigger: HTMLButtonElement | null): void {
    triggerRef.current = trigger
    setActionError(null)
    setEditor(next)
  }

  function closeEditor(): void {
    setEditor({ kind: 'closed' })
    setReturnFocusPending(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape' || editor.kind === 'closed') return
    // Escape aus einem Select- oder Datumsfeld schließt im echten Browser
    // zuerst dessen natives Auswahl-Popup – das keydown bubbelt trotzdem bis
    // hierher (Chromium). Das Formular darf dann nicht mitschließen, sonst
    // gehen die Eingaben verloren (M14-B3-Lehre; Fehlerbericht „Dropdown
    // Konto/Depotposition“). Escape schließt daher nur außerhalb dieser
    // Popup-Felder.
    const target = event.target
    if (target instanceof HTMLSelectElement) return
    if (target instanceof HTMLInputElement && target.type === 'date') return
    closeEditor()
  }

  /**
   * Übernimmt ein Ergebnis der reinen Datenfunktionen. Unverändertes Speichern
   * löst KEIN applyDataChange aus (kein falscher Dirty-State) – Vergleich vor
   * Übernahme, auch bei Statusaktionen (K3).
   */
  function applyResult(result: GoalActionResult, closeAfter: boolean): string | null {
    if (!result.ok) return result.error
    if (JSON.stringify(result.data) !== JSON.stringify(loadedData)) {
      actions.applyDataChange(result.data)
    }
    if (closeAfter) closeEditor()
    return null
  }

  function handleAddSubmit(input: GoalInput): string | null {
    return applyResult(addGoal(loadedData, input), true)
  }

  function handleEditSubmit(goalId: string, input: GoalInput): string | null {
    return applyResult(updateGoal(loadedData, goalId, input), true)
  }

  function runStatusAction(
    confirmText: string,
    action: () => GoalActionResult,
    /** Karten-Überschrift dieses Ziels nach Erfolg fokussieren (wenn der
     * auslösende Button durch die Aktion verschwindet, A11y B2). */
    focusGoalId?: string,
  ): void {
    setActionError(null)
    if (!window.confirm(confirmText)) return
    const error = applyResult(action(), false)
    if (error !== null) {
      setActionError(error)
      return
    }
    if (focusGoalId !== undefined) {
      requestAnimationFrame(() =>
        document.getElementById(`goal-card-heading-${focusGoalId}`)?.focus(),
      )
    }
  }

  function handlePause(goal: Goal): void {
    runStatusAction(
      `Ziel „${goal.name}“ pausieren? Es wird kein Fortschritt mehr bewertet; das Ziel bleibt gelistet und kann jederzeit reaktiviert werden.`,
      () => pauseGoal(loadedData, goal.id),
    )
  }

  function handleResume(goal: Goal): void {
    runStatusAction(
      `Ziel „${goal.name}“ reaktivieren? Der Fortschritt wird wieder bewertet.`,
      () => resumeGoal(loadedData, goal.id),
      // Beim Reaktivieren aus „abgeschlossen“ verschwindet der Button →
      // Fokus auf die Kartenüberschrift; beim Umschalt-Button (pausiert)
      // bleibt der Fokus auf dem Button.
      goal.status === 'reached' ? goal.id : undefined,
    )
  }

  function handleComplete(goal: Goal, row: GoalRow): void {
    const istText = actualDisplay(goal, row.actualValue, row.actual)
    runStatusAction(
      `Ziel „${goal.name}“ als manuell abgeschlossen speichern? Diese Entscheidung wird in der Datei gespeichert und gilt unabhängig vom rechnerischen Fortschritt (Ist aktuell: ${istText}). Reaktivieren bleibt möglich.`,
      () => completeGoal(loadedData, goal.id),
      goal.id,
    )
  }

  function handleArchive(goal: Goal): void {
    setActionError(null)
    if (
      !window.confirm(
        `Ziel „${goal.name}“ endgültig archivieren? Archivierte Ziele erscheinen nicht mehr in Übersicht und Dashboard und können nicht weiter bearbeitet werden. Das Ziel bleibt in der Datei erhalten – es wird nie gelöscht.`,
      )
    ) {
      return
    }
    const error = applyResult(archiveGoal(loadedData, goal.id), false)
    if (error !== null) {
      setActionError(error)
      return
    }
    // Ein gerade bearbeitetes Ziel wird mit dem Archivieren geschlossen –
    // archivierte Ziele sind nicht mehr bearbeitbar (A11y B5).
    if (editor.kind === 'edit' && editor.goalId === goal.id) {
      closeEditor()
    }
    requestAnimationFrame(() =>
      document.getElementById(`goal-card-heading-${goal.id}`)?.focus(),
    )
  }

  const editingRow =
    editor.kind === 'edit' ? (rows.find((row) => row.goal.id === editor.goalId) ?? null) : null

  const emptyForm: GoalFormValues = {
    name: '',
    metric: '',
    refId: '',
    targetAmountText: '',
    manualCurrentText: '',
    startDate: '',
    targetDate: '',
    note: '',
  }

  function formValuesFromGoal(goal: Goal): GoalFormValues {
    return {
      name: goal.name,
      metric: goal.metric ?? '',
      refId: goal.refId ?? '',
      targetAmountText:
        typeof goal.targetAmount === 'number' ? amountToInputText(goal.targetAmount) : '',
      manualCurrentText:
        typeof goal.manualCurrentAmount === 'number'
          ? amountToInputText(goal.manualCurrentAmount)
          : '',
      startDate: goal.startDate ?? '',
      targetDate: goal.targetDate ?? '',
      note: goal.note ?? '',
    }
  }

  return (
    <section className="page" aria-labelledby="page-title" onKeyDown={handleKeyDown}>
      <h2 id="page-title">Ziele</h2>
      <p className="app-hint">
        Alle finanziellen Ziele des geladenen Bestands (Stichtag: {formatIsoDateGerman(todayIso)}).
        Ziele werden nie gelöscht – nur pausiert, abgeschlossen oder archiviert. Zielerreichung
        löst nur eine Anzeige aus, nie eine automatische Aktion.
      </p>
      <GoalRules />

      <section aria-labelledby="goals-summary-title">
        <h3 id="goals-summary-title">Zusammenfassung</h3>
        <dl className="kpi-grid">
          <div className="kpi-tile">
            <dt>Aktive Ziele</dt>
            <dd>
              <span>{counts.active + counts.overdue}</span>
              {counts.overdue > 0 ? (
                <span className="kpi-note">davon {counts.overdue} überfällig</span>
              ) : null}
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Rechnerisch erreicht</dt>
            <dd>
              <span>{counts.reachedNow}</span>
              <span className="kpi-note">abgeleitet – wird nie gespeichert</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Summe Zielbeträge</dt>
            <dd>
              <span>{formatEuro(targetSum)}</span>
              <span className="kpi-note">
                ⚠ Bezugswerte können sich überschneiden (z. B. Depot ⊂ Gesamtvermögen) – keine
                addierbare Vermögensgröße; ohne Sparraten-Ziele (€/Monat)
              </span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Summe verbleibend</dt>
            <dd>
              <span>{formatEuro(remainingSum)}</span>
              <span className="kpi-note">
                nur berechenbare Ziele; gleiche Überschneidungs-Kennzeichnung wie die Zielbeträge
              </span>
            </dd>
          </div>
        </dl>
        <p className="app-hint">
          Bewusst keine Summe der Ist-Werte: Die Bezugswerte überschneiden sich (z. B. zählt der
          Depotwert auch im Gesamtvermögen) – eine Addition wäre irreführend.
        </p>
        {attentionRows.length > 0 ? (
          <div className="issue-box">
            <ul className="quality-list">
              {attentionRows.map((row) => (
                <li key={row.goal.id}>
                  ⚠ „{row.goal.name}“:{' '}
                  {row.refInfo?.exists === false
                    ? 'Die Referenz des Ziels existiert nicht mehr im Bestand.'
                    : row.refInfo?.inactive === true
                      ? `Die Referenz „${row.refInfo.name}“ ist deaktiviert – sie zählt in keine aktive Summe.`
                      : STATUS_REASONS[row.status]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="goals-list-title">
        <h3 id="goals-list-title">Zielliste</h3>

        <div className="toolbar">
          <button
            type="button"
            onClick={(event) => openEditor({ kind: 'add' }, event.currentTarget)}
            disabled={state.isSaving || editor.kind === 'add'}
          >
            Ziel hinzufügen
          </button>
        </div>

        {actionError !== null ? (
          <p className="operation-error" role="alert">
            ⚠ {actionError}
          </p>
        ) : null}

        {editor.kind === 'add' ? (
          <GoalForm
            heading="Ziel hinzufügen"
            initial={emptyForm}
            data={loadedData}
            isAutoGoal={false}
            autoTargetText={null}
            onCancel={closeEditor}
            onSubmit={handleAddSubmit}
          />
        ) : null}
        {editor.kind === 'edit' && editingRow !== null ? (
          <GoalForm
            // key erzwingt eine frische Formularinstanz je Ziel (M8-Lehre): sonst
            // „klebt“ der Zustand beim Wechsel A→B und schreibt aufs falsche Ziel.
            key={editingRow.goal.id}
            heading={`Ziel bearbeiten: ${editingRow.goal.name}`}
            initial={formValuesFromGoal(editingRow.goal)}
            data={loadedData}
            isAutoGoal={isEmergencyFundGoal(editingRow.goal)}
            autoTargetText={editingRow.target !== null ? formatEuro(editingRow.target) : null}
            onCancel={closeEditor}
            onSubmit={(input) => handleEditSubmit(editingRow.goal.id, input)}
          />
        ) : null}

        {data.goals.length === 0 ? (
          <p className="app-hint">
            Der geladene Bestand enthält noch keine Ziele. Lege mit „Ziel hinzufügen“ das erste
            Ziel an.
          </p>
        ) : (
          <ul className="goal-list">
            {sortedRows.map((row) => (
              <GoalCard
                key={row.goal.id}
                row={row}
                ownReal={ownReal}
                ownSmoothed={ownSmoothed}
                todayIso={todayIso}
                percentDecimals={percentDecimals}
                isSaving={state.isSaving}
                onEdit={(trigger) => openEditor({ kind: 'edit', goalId: row.goal.id }, trigger)}
                onPause={() => handlePause(row.goal)}
                onResume={() => handleResume(row.goal)}
                onComplete={() => handleComplete(row.goal, row)}
                onArchive={() => handleArchive(row.goal)}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

// --- Ziel-Karte (goal-list-Muster aus M7 – KEINE breite Tabelle, mobile-tauglich) ---

function GoalCard({
  row,
  ownReal,
  ownSmoothed,
  todayIso,
  percentDecimals,
  isSaving,
  onEdit,
  onPause,
  onResume,
  onComplete,
  onArchive,
}: {
  row: GoalRow
  ownReal: number
  ownSmoothed: number
  todayIso: string
  percentDecimals: number
  isSaving: boolean
  onEdit: (trigger: HTMLButtonElement) => void
  onPause: () => void
  onResume: () => void
  onComplete: () => void
  onArchive: () => void
}) {
  const { goal, target, actualValue, actual, status, progress, refInfo, assignedPlans } = row
  const isSavingsRateGoal = goal.metric === 'monthlySavingsRate' && !isEmergencyFundGoal(goal)
  const months = remainingFullMonths(todayIso, goal.targetDate)
  const shareTextId = `goal-share-${goal.id}`
  const surplus = progress !== null && actual !== null && target !== null ? goalSurplus(actual, target) : 0
  // Zielbezogene Sparleistung kommt aus der reinen Schicht (assignedOwnSavings,
  // in der Zeilen-Aufbereitung berechnet) – keine Summenformel in der Komponente
  // (Reviewer-Befund M12-K1).
  const { assignedReal, assignedSmoothed } = row
  // Prognosebasis: zugeordnete eigene reale Rate, sonst (klar gekennzeichnet)
  // die allgemeine eigene reale Sparleistung.
  const forecastBasis = assignedReal ?? ownReal
  const forecastBasisLabel =
    assignedReal !== null
      ? 'zugeordnete eigene reale Monatsrate'
      : 'allgemeine eigene reale Sparleistung (keine eindeutige Zuordnung)'
  const requiredRate =
    !isSavingsRateGoal && progress !== null ? requiredMonthlyRate(progress.remaining, months) : null
  const forecastMonths =
    !isSavingsRateGoal && progress !== null
      ? forecastMonthsToTarget(progress.remaining, forecastBasis)
      : null
  const storedStatus = goal.status
  const canEdit = storedStatus !== 'archived'
  const missingNames = row.missingNames

  return (
    <li>
      {/* Fokus-Anker: nach Statusaktionen, deren Button verschwindet, landet
          der Tastaturfokus hier statt auf document.body (A11y B2). */}
      <p className="goal-heading" id={`goal-card-heading-${goal.id}`} tabIndex={-1}>
        <strong>{goal.name}</strong> – Status: {DERIVED_STATUS_SYMBOLS[status]}{' '}
        {DERIVED_STATUS_LABELS[status]}
      </p>
      <p>Zielart: {metricDisplay(goal, refInfo)}</p>
      <p>
        Ist: {actualDisplay(goal, actualValue, actual)}
        {isSavingsRateGoal ? ' pro Monat (eigene reale Sparleistung)' : ''} · Ziel:{' '}
        {target === null ? 'offen / nutzerdefinierbar' : formatEuro(target)}
        {isSavingsRateGoal && target !== null ? ' pro Monat' : ''}
      </p>
      {status !== 'paused' && status !== 'archived' && progress !== null ? (
        <>
          <p className="goal-progress">
            {/* Anzeige-Cap: value nie über max; der ECHTE Prozentwert steht als
                Text daneben und ist über aria-describedby verknüpft (M10-Muster). */}
            <progress
              max={progress.target}
              value={Math.min(Math.max(progress.actual, 0), progress.target)}
              aria-label={`Fortschritt „${goal.name}“`}
              aria-describedby={shareTextId}
            />{' '}
            <span id={shareTextId}>
              {progress.share === null
                ? 'nicht berechenbar'
                : formatShare(progress.share, percentDecimals)}
            </span>
          </p>
          <p>
            Rest: {formatEuro(progress.remaining)}
            {surplus > 0 ? ` · Überschuss (informativ): ${formatEuro(surplus)}` : ''}
          </p>
        </>
      ) : null}
      {status === 'reachedNow' ? (
        <p className="success-note" role="status">
          ✓ Rechnerisch erreicht – die App schlägt nur vor, ändert aber nie automatisch Sparraten.
        </p>
      ) : null}
      {goal.targetDate != null ? (
        <p>
          Zieldatum: {formatIsoDateGerman(goal.targetDate)}
          {!isSavingsRateGoal && months !== null
            ? months === 0
              ? ' – diesen Monat fällig oder überfällig'
              : ` – noch ${months} volle ${months === 1 ? 'Kalendermonat' : 'Kalendermonate'}`
            : ''}
        </p>
      ) : null}
      {goal.startDate != null && status === 'planned' ? (
        <p>Start: {formatIsoDateGerman(goal.startDate)} (geplant)</p>
      ) : null}
      {!isSavingsRateGoal && goal.targetDate != null && progress !== null && progress.remaining > 0 ? (
        <p>
          Benötigte Monatsrate:{' '}
          {requiredRate === null
            ? 'nicht berechenbar – das Ziel ist diesen Monat fällig oder überfällig'
            : `${formatEuro(requiredRate)} pro Monat`}{' '}
          (Basis: {months ?? 0} volle Kalendermonate bis {formatIsoDateGerman(goal.targetDate)};
          der angebrochene Monat zählt nicht)
        </p>
      ) : null}
      {assignedReal !== null ? (
        <p>
          Zugeordnete eigene Sparleistung (real): {formatEuro(assignedReal)} pro Monat
          {assignedPlans !== null && assignedPlans.length > 0
            ? ` – Sparpläne: ${assignedPlans.map((plan) => plan.name).join(', ')}`
            : ' – keine zuordenbaren Sparpläne'}
        </p>
      ) : !isSavingsRateGoal && status !== 'archived' ? (
        <p className="app-hint">
          Keine eindeutige Plan-Zuordnung möglich – zur Einordnung: allgemeine eigene Sparleistung
          (real) {formatEuro(ownReal)} pro Monat; sie fließt nicht zwingend vollständig in dieses
          Ziel.
        </p>
      ) : null}
      {refInfo !== null && !refInfo.exists ? (
        <p className="warning-note">⚠ Die Referenz des Ziels existiert nicht mehr im Bestand.</p>
      ) : null}
      {refInfo !== null && refInfo.inactive ? (
        <p className="warning-note">
          ⚠ Die Referenz „{refInfo.name}“ ({refInfo.kindLabel}) ist deaktiviert – sie zählt in
          keine aktive Summe; der Ist-Wert dieses Ziels wird weiterhin berechnet.
        </p>
      ) : null}
      <details className="model-hint">
        <summary>Details und Prognose</summary>
        <p>Berechnungsgrundlage: {calculationBasisText(goal, refInfo)}</p>
        <p>
          Eigene Sparleistung real: {formatEuro(assignedReal ?? ownReal)} pro Monat · geglättet
          (Analysewert): {formatEuro(assignedSmoothed ?? ownSmoothed)} pro Monat
          {assignedReal === null ? ' – allgemeine Werte, keine eindeutige Ziel-Zuordnung' : ''}
        </p>
        {!isSavingsRateGoal && progress !== null ? (
          progress.remaining <= 0 ? (
            <p>Prognose: Ziel bereits erreicht – kein Restbetrag offen.</p>
          ) : (
            <>
              <p>
                Prognose: {forecastMonths === null
                  ? `keine Prognose möglich – keine laufende eigene reale Monatsrate (Basis: ${forecastBasisLabel})`
                  : `voraussichtlich noch ${forecastMonths} ${forecastMonths === 1 ? 'Monat' : 'Monate'} (Basis: ${forecastBasisLabel} ${formatEuro(forecastBasis)})`}
                {forecastMonths !== null && months !== null && goal.targetDate != null
                  ? forecastMonths <= months
                    ? ' – rechtzeitig zum Zieldatum erreichbar'
                    : ' – voraussichtlich verspätet'
                  : ''}
              </p>
              {requiredRate !== null ? (
                <p>
                  Benötigt: {formatEuro(requiredRate)} pro Monat · vorhanden (real):{' '}
                  {formatEuro(forecastBasis)} pro Monat · Differenz:{' '}
                  {formatEuro(rateGap(requiredRate, forecastBasis))} pro Monat
                </p>
              ) : null}
              <p className="app-hint">Ohne Rendite-/Kursannahme – keine Prognosegarantie.</p>
            </>
          )
        ) : null}
        {isSavingsRateGoal ? (
          <p className="app-hint">
            Sparraten-Ziel (€/Monat): benötigte Monatsrate und Prognose entfallen – ein
            Monatsraten-Ziel hat keinen ansparbaren Restbetrag.
          </p>
        ) : null}
        <p>Statusbegründung: {STATUS_REASONS[status]}</p>
        {actualValue !== null && actualValue.missingIds.length > 0 ? (
          <p className="warning-note">
            ⚠ Fehlende Daten: {missingNames.join(', ')} – ohne erfassten Wert; unbekannt zählt nie
            als 0.
          </p>
        ) : null}
        {goal.note != null && goal.note !== '' ? <p>Notiz: {goal.note}</p> : null}
      </details>
      <div className="row-actions">
        {canEdit ? (
          <button
            type="button"
            aria-label={`Ziel „${goal.name}“ bearbeiten`}
            onClick={(event) => onEdit(event.currentTarget)}
            disabled={isSaving}
          >
            Bearbeiten
          </button>
        ) : null}
        {storedStatus === 'active' || storedStatus === 'deferred' ? (
          // EIN stabiler Umschalt-Button (M8-Muster): der DOM-Knoten bleibt beim
          // Umschalten erhalten, der Tastaturfokus geht nicht verloren (A11y B2).
          <button
            type="button"
            aria-label={
              storedStatus === 'deferred'
                ? `Ziel „${goal.name}“ reaktivieren`
                : `Ziel „${goal.name}“ pausieren`
            }
            onClick={storedStatus === 'deferred' ? onResume : onPause}
            disabled={isSaving}
          >
            {storedStatus === 'deferred' ? 'Reaktivieren' : 'Pausieren'}
          </button>
        ) : null}
        {storedStatus === 'reached' ? (
          <button
            type="button"
            aria-label={`Ziel „${goal.name}“ reaktivieren`}
            onClick={onResume}
            disabled={isSaving}
          >
            Reaktivieren
          </button>
        ) : null}
        {storedStatus === 'active' || storedStatus === 'deferred' ? (
          <button
            type="button"
            aria-label={`Ziel „${goal.name}“ abschließen`}
            onClick={onComplete}
            disabled={isSaving}
          >
            Abschließen
          </button>
        ) : null}
        {storedStatus !== 'archived' ? (
          <button
            type="button"
            aria-label={`Ziel „${goal.name}“ archivieren`}
            onClick={onArchive}
            disabled={isSaving}
          >
            Archivieren
          </button>
        ) : (
          <span className="app-hint">Archiviert – endgültig, keine weitere Bearbeitung.</span>
        )}
      </div>
    </li>
  )
}

/** Berechnungsgrundlage in Worten (Zieldetail). */
function calculationBasisText(goal: Goal, refInfo: RefInfo | null): string {
  if (isEmergencyFundGoal(goal)) {
    return 'Ziel = Notgroschen-Faktor × Netto (bzw. manuelle Übersteuerung in den Einstellungen); Ist = Summe der aktuellen Salden aller aktiven Tagesgeld-Konten.'
  }
  switch (goal.metric) {
    case 'tagesgeld':
      return 'Ist = Summe der aktuellen Salden aller aktiven Tagesgeld-Konten; Fortschritt = Ist ÷ Zielbetrag.'
    case 'depotValue':
      return 'Ist = Summe der aktuellen Werte aller aktiven Depotpositionen; Fortschritt = Ist ÷ Zielbetrag.'
    case 'totalWealth':
      return 'Ist = Gesamtvermögen (Tagesgeld + Depotwert); Fortschritt = Ist ÷ Zielbetrag.'
    case 'monthlySavingsRate':
      return 'Ist = eigene REALE monatliche Sparleistung (nur eigenes, regelmäßig monatlich gespartes Geld, U3/U4); Fortschritt = Ist ÷ Ziel-Monatsrate.'
    case 'accountBalance':
      return `Ist = jüngster erfasster Saldo des Kontos „${refInfo?.name ?? 'unbekannt'}“; Fortschritt = Ist ÷ Zielbetrag.`
    case 'positionValue':
      return `Ist = jüngster erfasster Wert der Depotposition „${refInfo?.name ?? 'unbekannt'}“; Fortschritt = Ist ÷ Zielbetrag.`
    case 'manual':
      return 'Ist = manuell gepflegter Wert (im Formular dieses Ziels); kein automatischer Bezug zu Konten oder Positionen.'
    default:
      return 'Keine Kennzahl zugeordnet – es wird kein Fortschritt berechnet.'
  }
}
