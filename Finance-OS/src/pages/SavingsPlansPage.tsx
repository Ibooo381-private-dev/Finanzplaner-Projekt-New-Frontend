/**
 * Modul „Sparpläne und Zuflüsse“ (M10): Liste mit Statusgruppen, Filtern und
 * Sortierung; Summen (real/geglättet, Jahressicht, Monats-Realsicht);
 * 1.000-€-Sparziel (U3-Bezugsgröße); F10-Referenzverteilung (rein informativ);
 * Verwaltung (Anlegen/Bearbeiten/Pausieren/Reaktivieren/Beenden).
 *
 * Keine Finanzlogik in Komponenten: alle Kennzahlen kommen aus src/finance
 * (ownMonthlySavings, employerAndProviderInflow, totalMonthlyInflow,
 * monthlyAmount, annualAmount, aggregateMonthlyBy, realAmountInMonth,
 * nextDueDate, planStatus, goalProgress, referenceAllocation, roundToUnit),
 * alle Datenänderungen laufen über die reinen Funktionen in
 * src/data/savingsPlans.ts (+ applyDataChange → DATA_CHANGED, setzt isDirty).
 * Abbrechen/unverändertes Absenden übernimmt NIE einen Bestand (Vergleich vor
 * Übernahme). Der Stichtag kommt IMMER aus dem injizierten todayIso des
 * Provider-Kontexts – nie aus einer eigenen Systemuhr.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type {
  Account,
  FinanceData,
  FlowType,
  Goal,
  Interval,
  PortfolioPosition,
  PositionGroup,
  SavingsPlan,
  TargetKind,
  TargetProfile,
} from '../types/finance'
import {
  aggregateMonthlyBy,
  annualAmount,
  deviationEur,
  deviationPp,
  goalProgress,
  hasUnknownSchedule,
  isPlanActiveOn,
  isoMonthOf,
  monthlyAmount,
  nextDueDate,
  ownMonthlySavings,
  employerAndProviderInflow,
  planStatus,
  realAmountInMonth,
  referenceAllocation,
  roundToUnit,
  share,
  targetValues,
  totalMonthlyInflow,
} from '../finance'
import type { SavingsPlanStatus } from '../finance'
import { formatEuro, parseGermanAmount } from '../format/money'
import { formatIsoDateGerman } from '../format/date'
import {
  addSavingsPlan,
  endSavingsPlan,
  pauseSavingsPlan,
  resumeSavingsPlan,
  updateSavingsPlan,
} from '../data/savingsPlans'
import type { SavingsPlanActionResult, SavingsPlanInput } from '../data/savingsPlans'
import { useFinanceData } from '../state/useFinanceData'
import { StartHint } from '../components/StartHint'
import { Icon } from '../components/Icon'

// --- Deutsche Labels (UI) ---

/** Deutsche Gruppen-Namen (wie DepotPage) – nie rohe Gruppen-Schlüssel anzeigen. */
const GROUP_LABELS: Record<PositionGroup, string> = {
  world: 'World',
  em: 'Emerging Markets',
  gold: 'Gold',
  telekom: 'Telekom',
}

const FLOW_TYPE_LABELS: Record<FlowType, string> = {
  own_fixed: 'Eigene feste Sparleistung',
  own_variable: 'Eigene variable Sparleistung',
  employer: 'Arbeitgeberleistung',
  provider: 'Anbieterleistung',
  reserve_transfer: 'Rücklagenübertragung (Umbuchung)',
  liquidity_transfer: 'Liquiditätsübertragung (Umbuchung)',
}

const INTERVAL_LABELS: Record<Interval, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  halfyearly: 'halbjährlich',
  yearly: 'jährlich',
  once: 'einmalig',
}

const STATUS_LABELS: Record<SavingsPlanStatus, string> = {
  active: 'Aktiv',
  planned: 'Geplant',
  paused: 'Pausiert',
  ended: 'Beendet',
  completed: 'Abgeschlossen',
}

const STATUS_SYMBOLS: Record<SavingsPlanStatus, string> = {
  active: '●',
  planned: '◷',
  paused: '⏸',
  ended: '■',
  completed: '✓',
}

/**
 * Plaketten-Klasse je Status (nur Gestaltung – Text + Symbol bleiben das Signal):
 * aktiv → ok, geplant → info, pausiert → warn, beendet/abgeschlossen → neutral.
 */
const STATUS_BADGE_CLASSES: Record<SavingsPlanStatus, string> = {
  active: 'badge badge--ok',
  planned: 'badge badge--info',
  paused: 'badge badge--warn',
  ended: 'badge',
  completed: 'badge',
}

/** Herkunft (dokumentiertes flowType-Mapping, kein eigenes Feld). */
type Origin = 'own' | 'external' | 'transfer'

const ORIGIN_LABELS: Record<Origin, string> = {
  own: 'eigen',
  external: 'extern',
  transfer: 'Umbuchung',
}

function originOf(flowType: FlowType): Origin {
  if (flowType === 'own_fixed' || flowType === 'own_variable') return 'own'
  if (flowType === 'employer' || flowType === 'provider') return 'external'
  return 'transfer'
}

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** 'JJJJ-MM' → „Juli 2026“ (Monats-Realsicht klar beschriften). */
function formatIsoMonthGerman(isoMonth: string): string {
  const month = Number(isoMonth.slice(5, 7))
  return `${MONTH_NAMES[month - 1]} ${isoMonth.slice(0, 4)}`
}

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

/** Prozentpunkte mit Vorzeichen (Farbe nie einziges Signal). */
function formatPp(pp: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const text = format.format(pp)
  return pp > 0 ? `+${text} Pp` : `${text} Pp`
}

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

function isPositionActive(position: PortfolioPosition): boolean {
  return position.isActive !== false
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

interface TargetInfo {
  name: string
  kindLabel: 'Konto' | 'Position'
  exists: boolean
  inactive: boolean
}

function targetInfoOf(data: FinanceData, targetKind: TargetKind, targetId: string): TargetInfo {
  if (targetKind === 'position') {
    const position = data.portfolioPositions.find((entry) => entry.id === targetId)
    return {
      name: position?.name ?? 'unbekanntes Ziel',
      kindLabel: 'Position',
      exists: position !== undefined,
      inactive: position !== undefined && !isPositionActive(position),
    }
  }
  const account = data.accounts.find((entry) => entry.id === targetId)
  return {
    name: account?.name ?? 'unbekanntes Ziel',
    kindLabel: 'Konto',
    exists: account !== undefined,
    inactive: account !== undefined && !isAccountActive(account),
  }
}

/** Betragstext: variabel (amount null) ist nie 0 (G11). */
function amountText(plan: SavingsPlan): string {
  return plan.amount === null ? 'variabel (nicht garantiert)' : formatEuro(plan.amount)
}

// --- Formular (Anlegen + Bearbeiten, gleiche Komponente; key={plan.id} beim Bearbeiten) ---

interface PlanFormValues {
  name: string
  /** Zusammengesetzter Select-Wert `${targetKind}|${targetId}`. */
  targetKey: string
  amountText: string
  isVariable: boolean
  interval: Interval
  /** '' = kein Fälligkeitsmonat (unbekannt); sonst '1'–'12'. */
  dueMonth: string
  flowType: FlowType
  isFlexible: boolean
  validFrom: string
  validUntil: string
  note: string
}

const VARIABLE_FLOW_TYPES: readonly FlowType[] = ['own_variable', 'provider']

function splitTargetKey(key: string): { targetKind: TargetKind; targetId: string } {
  const [kind, ...rest] = key.split('|')
  return { targetKind: kind === 'account' ? 'account' : 'position', targetId: rest.join('|') }
}

function PlanForm({
  heading,
  submitLabel,
  initial,
  data,
  onCancel,
  onSubmit,
}: {
  heading: string
  /** Beschriftung des Absende-Buttons: „Sparplan anlegen“ bzw. „Änderungen übernehmen“. */
  submitLabel: string
  initial: PlanFormValues
  data: FinanceData
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (input: SavingsPlanInput) => string | null
}) {
  const [values, setValues] = useState<PlanFormValues>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Nach fehlgeschlagenem Absenden den Fokus auf das ERSTE Fehlerfeld setzen
  // (A11y-Befund M10-B3) – Reihenfolge entspricht der Feldreihenfolge im Formular.
  const FIELD_ID_BY_ERROR_KEY: Record<string, string> = {
    name: 'plan-name',
    target: 'plan-target',
    amount: 'plan-amount',
    dueMonth: 'plan-duemonth',
    validFrom: 'plan-validfrom',
    validUntil: 'plan-validuntil',
  }
  const FIELD_ERROR_ORDER = ['name', 'target', 'amount', 'dueMonth', 'validFrom', 'validUntil']

  function focusFirstErrorField(errors: Record<string, string>): void {
    const key = FIELD_ERROR_ORDER.find((candidate) => errors[candidate] !== undefined)
    if (key === undefined) return
    document.getElementById(FIELD_ID_BY_ERROR_KEY[key])?.focus()
  }

  function setField<K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const variableAllowed = VARIABLE_FLOW_TYPES.includes(values.flowType) && values.interval !== 'once'
  const { targetKind, targetId } = splitTargetKey(values.targetKey)
  const target = targetInfoOf(data, targetKind, targetId)
  const cycleHint =
    values.interval === 'quarterly' || values.interval === 'halfyearly'
      ? 'Das Startdatum ist der ERSTE Ausführungstermin – der Zyklus läuft ab diesem Termin (+3 bzw. +6 Monate), Zahltag ist der Tag des Startdatums (am Monatsende geklemmt).'
      : values.interval === 'once'
        ? 'Das Startdatum ist bei einmaligen Zuflüssen das Ausführungsdatum selbst.'
        : null

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitError(null)
    const errors: Record<string, string> = {}
    if (values.name.trim() === '') {
      errors['name'] = 'Der Name darf nicht leer sein.'
    }
    let amount: number | null = null
    if (values.isVariable && variableAllowed) {
      amount = null
    } else {
      // Strenges de-DE-Muster: "1.234" ist 1234 €, nie 1,234 € (M8-Lehre).
      const parsed = parseGermanAmount(values.amountText)
      if (parsed === null) {
        errors['amount'] = 'Bitte einen gültigen Betrag eingeben (z. B. 250,00 oder 1.234,56).'
      } else {
        amount = parsed
      }
    }
    if (values.validFrom.trim() === '') {
      errors['validFrom'] = 'Bitte ein Startdatum wählen.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusFirstErrorField(errors)
      return
    }
    setFieldErrors({})
    const input: SavingsPlanInput = {
      name: values.name,
      targetKind,
      targetId,
      amount,
      interval: values.interval,
      dueMonth:
        values.interval === 'yearly' && values.dueMonth !== '' ? Number(values.dueMonth) : null,
      flowType: values.flowType,
      isFlexible: values.isFlexible,
      validFrom: values.validFrom,
      validUntil: values.interval === 'once' ? null : textOrNull(values.validUntil),
      note: textOrNull(values.note),
    }
    const error = onSubmit(input)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah zuordnen (Feld-Präfixe).
    const prefixes: [string, string][] = [
      ['Name:', 'name'],
      ['Betrag:', 'amount'],
      ['Startdatum:', 'validFrom'],
      ['Enddatum:', 'validUntil'],
      ['Fälligkeitsmonat:', 'dueMonth'],
      ['Ziel:', 'target'],
    ]
    const match = prefixes.find(([prefix]) => error.startsWith(prefix))
    if (match) {
      const mapped = { [match[1]]: error.slice(match[0].length).trim() }
      setFieldErrors(mapped)
      focusFirstErrorField(mapped)
    } else {
      setSubmitError(error)
      // Nicht zuordenbare Fehler: Fokus auf die Sammelmeldung (B3).
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

  const activeAccounts = data.accounts
  const positions = data.portfolioPositions

  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      {/* h4: die Formulare liegen INNERHALB der Sektion „Sparplanliste“ (h3) – B4. */}
      <h4>{heading}</h4>
      <div className="form-field">
        <label htmlFor="plan-name">Name *</label>
        <input
          id="plan-name"
          ref={firstFieldRef}
          type="text"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={fieldErrors['name'] !== undefined || undefined}
          aria-describedby={fieldErrors['name'] !== undefined ? 'plan-name-error' : undefined}
        />
        {fieldError('name', 'plan-name-error')}
      </div>
      <div className="form-field">
        <label htmlFor="plan-target">Ziel (Konto oder Depotposition) *</label>
        <select
          id="plan-target"
          value={values.targetKey}
          onChange={(event) => setField('targetKey', event.target.value)}
          aria-invalid={fieldErrors['target'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['target'] !== undefined
              ? 'plan-target-error'
              : target.inactive
                ? 'plan-target-warning'
                : undefined
          }
        >
          <optgroup label="Depotpositionen">
            {positions.map((position) => (
              <option key={position.id} value={`position|${position.id}`}>
                {isPositionActive(position) ? position.name : `${position.name} (inaktiv)`}
              </option>
            ))}
          </optgroup>
          <optgroup label="Konten">
            {activeAccounts.map((account) => (
              <option key={account.id} value={`account|${account.id}`}>
                {isAccountActive(account) ? account.name : `${account.name} (inaktiv)`}
              </option>
            ))}
          </optgroup>
        </select>
        {fieldError('target', 'plan-target-error')}
        {target.inactive ? (
          <p id="plan-target-warning" className="field-warning" role="status">
            ⚠ Das gewählte Ziel „{target.name}“ ist deaktiviert. Der Sparplan kann trotzdem
            übernommen werden – Zuflüsse auf ein deaktiviertes Ziel zählen aber in keine aktive
            Summe. Prüfe, ob das Ziel zuerst aktiviert werden sollte (Deaktivieren ist umkehrbar).
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="plan-flowtype">Zuflussart *</label>
        <select
          id="plan-flowtype"
          value={values.flowType}
          onChange={(event) => {
            const nextFlowType = event.target.value as FlowType
            setValues((current) => ({
              ...current,
              flowType: nextFlowType,
              // „variabel“ ist nur bei own_variable/provider möglich.
              isVariable: VARIABLE_FLOW_TYPES.includes(nextFlowType) ? current.isVariable : false,
            }))
          }}
        >
          {(Object.keys(FLOW_TYPE_LABELS) as FlowType[]).map((flowType) => (
            <option key={flowType} value={flowType}>
              {FLOW_TYPE_LABELS[flowType]}
            </option>
          ))}
        </select>
        <p className="app-hint">
          Herkunft: eigenes Geld = eigene feste/variable Sparleistung; extern = Arbeitgeber-/
          Anbieterleistung; Umbuchungen zählen nie als Sparleistung.
        </p>
      </div>
      <div className="form-field">
        <label htmlFor="plan-amount">Betrag in Euro {values.isVariable ? '' : '*'}</label>
        <input
          id="plan-amount"
          type="text"
          inputMode="decimal"
          value={values.amountText}
          disabled={values.isVariable && variableAllowed}
          onChange={(event) => setField('amountText', event.target.value)}
          aria-invalid={fieldErrors['amount'] !== undefined || undefined}
          aria-describedby={fieldErrors['amount'] !== undefined ? 'plan-amount-error' : undefined}
        />
        {fieldError('amount', 'plan-amount-error')}
        {VARIABLE_FLOW_TYPES.includes(values.flowType) ? (
          <div className="form-field-checkbox">
            <label>
              <input
                type="checkbox"
                checked={values.isVariable}
                disabled={values.interval === 'once'}
                onChange={(event) => setField('isVariable', event.target.checked)}
              />{' '}
              variabel (kein garantierter Betrag)
            </label>
            <p className="app-hint">
              Variable Pläne zählen nie in Summen – Ist-Werte kommen nur aus tatsächlichen
              Buchungen. Bei einmaligen Zuflüssen ist immer ein Betrag nötig.
            </p>
          </div>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="plan-interval">Rhythmus *</label>
        <select
          id="plan-interval"
          value={values.interval}
          onChange={(event) => {
            const nextInterval = event.target.value as Interval
            setValues((current) => ({
              ...current,
              interval: nextInterval,
              dueMonth: nextInterval === 'yearly' ? current.dueMonth : '',
              isVariable: nextInterval === 'once' ? false : current.isVariable,
              // Wechsel WEG von „einmalig“: das normalisierte Enddatum
              // (= Ausführungsdatum) ist ein Artefakt und wird geleert –
              // sonst endete der Plan still nach einem Monat (Befund M10-3).
              validUntil:
                current.interval === 'once' && nextInterval !== 'once' ? '' : current.validUntil,
            }))
          }}
        >
          {(Object.keys(INTERVAL_LABELS) as Interval[]).map((interval) => (
            <option key={interval} value={interval}>
              {INTERVAL_LABELS[interval]}
            </option>
          ))}
        </select>
      </div>
      {values.interval === 'yearly' ? (
        <div className="form-field">
          <label htmlFor="plan-duemonth">Fälligkeitsmonat (real)</label>
          <select
            id="plan-duemonth"
            value={values.dueMonth}
            onChange={(event) => setField('dueMonth', event.target.value)}
            aria-invalid={fieldErrors['dueMonth'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['dueMonth'] !== undefined ? 'plan-duemonth-error' : undefined
            }
          >
            <option value="">unbekannt / nicht festgelegt</option>
            {MONTH_NAMES.map((monthName, index) => (
              <option key={monthName} value={String(index + 1)}>
                {monthName}
              </option>
            ))}
          </select>
          {fieldError('dueMonth', 'plan-duemonth-error')}
          <p className="app-hint">
            Ohne Fälligkeitsmonat ist der nächste Termin unbekannt und die reale Jahressicht kann
            den Betrag keinem Monat zuordnen.
          </p>
        </div>
      ) : null}
      <div className="form-field">
        <label htmlFor="plan-validfrom">Startdatum *</label>
        <input
          id="plan-validfrom"
          type="date"
          value={values.validFrom}
          onChange={(event) => setField('validFrom', event.target.value)}
          aria-invalid={fieldErrors['validFrom'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['validFrom'] !== undefined
              ? 'plan-validfrom-error'
              : cycleHint !== null
                ? 'plan-validfrom-hint'
                : undefined
          }
        />
        {fieldError('validFrom', 'plan-validfrom-error')}
        {cycleHint !== null ? (
          <p id="plan-validfrom-hint" className="app-hint">
            {cycleHint}
          </p>
        ) : null}
      </div>
      {values.interval !== 'once' ? (
        <div className="form-field">
          <label htmlFor="plan-validuntil">Enddatum (optional)</label>
          <input
            id="plan-validuntil"
            type="date"
            value={values.validUntil}
            onChange={(event) => setField('validUntil', event.target.value)}
            aria-invalid={fieldErrors['validUntil'] !== undefined || undefined}
            aria-describedby={
              fieldErrors['validUntil'] !== undefined ? 'plan-validuntil-error' : undefined
            }
          />
          {fieldError('validUntil', 'plan-validuntil-error')}
        </div>
      ) : (
        <p className="form-field app-hint">
          Enddatum: entfällt – ein einmaliger Zufluss ist mit dem Ausführungsdatum abgeschlossen.
        </p>
      )}
      <div className="form-field form-field-checkbox">
        <label>
          <input
            type="checkbox"
            checked={values.isFlexible}
            onChange={(event) => setField('isFlexible', event.target.checked)}
          />{' '}
          flexibel (darf in Empfehlungen angepasst werden)
        </label>
      </div>
      <div className="form-field">
        <label htmlFor="plan-note">Notiz</label>
        <input
          id="plan-note"
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
        <button type="submit">{submitLabel}</button>
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// --- Erklärtext der Summen und der U3-Bezugsgröße (Details-Muster, kein title-only) ---

function SavingsRules() {
  return (
    <details className="model-hint">
      <summary>So rechnen die Sparplan-Summen und das 1.000-€-Sparziel</summary>
      <ul>
        <li>
          Primärer Zielfortschritt (verbindliche Entscheidung U3): NUR die eigene REALE monatliche
          Sparleistung zählt – also regelmäßig monatlich gespartes eigenes Geld. Externe Zuflüsse
          (VL-Zuschuss, Boni, Saveback), Umbuchungen und variable Istwerte zählen nicht.
        </li>
        <li>
          Vierteljährliche und halbjährliche EIGENE Pläne zählen NICHT in den primären
          1.000-€-Fortschritt (nur monatliche Raten sind „regelmäßig monatlich“) – wohl aber in den
          geglätteten Analysewert (Betrag/3 bzw. Betrag/6).
        </li>
        <li>
          Einmalige Zuflüsse zählen weder real-monatlich noch geglättet; sie erscheinen nur in der
          Monats-Realsicht ihres Ausführungsmonats und getrennt in der Jahressicht.
        </li>
        <li>
          Geglättete Werte („geglättet (Analysewert)“) verteilen Jahres-, Halbjahres- und
          Quartalsbeträge rechnerisch auf Monate (/12, /6, /3). Sie sind reine Analysewerte, nie
          reale Buchungen, und werden nie mit realen Werten in einer Kennzahl gemischt.
        </li>
        <li>
          Verwechslungsschutz: Die „Monats-Realsicht“ enthält zusätzlich die Jahres- und
          Einmalfälligkeiten des jeweiligen Kalendermonats – sie ist NICHT die monatliche reale
          Sparrate (F8), die nur monatliche Raten enthält.
        </li>
        <li>
          Umbuchungen zwischen eigenen Konten (Rücklagen-/Liquiditätsübertragung) sind weder
          Einnahme noch Sparleistung und zählen in keine Summe.
        </li>
        <li>
          Variable Pläne (Saveback, Round-up) haben keinen garantierten Betrag: Sie zählen nie in
          Summen; ihre Ist-Werte kommen ausschließlich aus tatsächlichen Buchungen.
        </li>
        <li>
          Pausierte Pläne zählen ab sofort in keine Kennzahl; die Pause gilt nur für die Gegenwart
          und Zukunft – vergangene Monate werden nicht rückwirkend umgedeutet.
        </li>
      </ul>
    </details>
  )
}

// --- Seite ---

type SortKey = 'name' | 'amount' | 'annual' | 'target' | 'nextDue' | 'status'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

type EditorState = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; planId: string }

type StatusFilter = 'active' | 'paused' | 'ended'
type RegularityFilter = 'regular' | 'once'

interface Filters {
  status: StatusFilter[]
  origin: Origin[]
  regularity: RegularityFilter[]
  targetKind: TargetKind[]
}

const EMPTY_FILTERS: Filters = { status: [], origin: [], regularity: [], targetKind: [] }

const STATUS_GROUP_RANK: Record<SavingsPlanStatus, number> = {
  active: 0,
  planned: 0,
  paused: 1,
  ended: 2,
  completed: 2,
}

/** Filter-Zuordnung: „aktiv“ deckt aktiv+geplant, „beendet“ deckt beendet+abgeschlossen. */
function statusFilterOf(status: SavingsPlanStatus): StatusFilter {
  if (status === 'paused') return 'paused'
  if (status === 'ended' || status === 'completed') return 'ended'
  return 'active'
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]
}

export function SavingsPlansPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions, todayIso } = useFinanceData()
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  const [sort, setSort] = useState<SortState | null>(null)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
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
        <h2 id="page-title">Sparpläne</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  const loadedData: FinanceData = data
  const plans = data.savingsPlans
  const currentMonth = isoMonthOf(todayIso)
  const percentDecimals =
    typeof data.settings.display?.percentDecimals === 'number'
      ? data.settings.display.percentDecimals
      : 2

  // --- Kennzahlen (alle aus src/finance; Stichtag injiziert) ---

  const activePlans = plans.filter((plan) => isPlanActiveOn(plan, todayIso))
  const ownReal = ownMonthlySavings(activePlans, 'realMonthly')
  const ownSmoothed = ownMonthlySavings(activePlans, 'smoothed')
  const externalReal = employerAndProviderInflow(activePlans, 'realMonthly')
  const externalSmoothed = employerAndProviderInflow(activePlans, 'smoothed')
  const totalReal = totalMonthlyInflow(activePlans, 'realMonthly')
  const totalSmoothed = totalMonthlyInflow(activePlans, 'smoothed')

  const activeOwnPlans = activePlans.filter((plan) => originOf(plan.flowType) === 'own')
  const activeExternalPlans = activePlans.filter((plan) => originOf(plan.flowType) === 'external')
  const activeTransferPlans = activePlans.filter((plan) => originOf(plan.flowType) === 'transfer')
  const variableActivePlans = activePlans.filter(
    (plan) => plan.amount === null && originOf(plan.flowType) !== 'transfer',
  )

  /** G11: keine bewertbaren Einträge → „unbekannt“, nie eine leere 0-Summe. */
  function sumDisplay(amount: number, relevant: readonly SavingsPlan[]): string {
    const unknownCount = relevant.filter((plan) => plan.amount === null).length
    if (relevant.length > 0 && unknownCount >= relevant.length) return 'unbekannt'
    return formatEuro(amount)
  }

  // Jahreswerte: regelmäßige Pläne (ohne once, ohne Umbuchungen, 2h); Einmalbeträge getrennt.
  const regularAnnual = (list: readonly SavingsPlan[]): number =>
    list
      .filter((plan) => plan.interval !== 'once')
      .reduce((sum, plan) => sum + (annualAmount(plan) ?? 0), 0)
  const annualOwn = regularAnnual(activeOwnPlans)
  const annualExternal = regularAnnual(activeExternalPlans)
  const annualTotal = annualOwn + annualExternal
  // Einmalige Zuflüsse des LAUFENDEN KALENDERJAHRES (Jahressicht, 2h) – bewusst
  // unabhängig vom Aktivfenster: ein normalisierter once-Plan (validUntil =
  // validFrom) ist nur am Ausführungstag „aktiv“; für die Jahressicht zählen
  // aber auch geplante und bereits abgeschlossene Einmalzuflüsse des Jahres
  // (pausierte nicht; finance-analyst-Befund M10-F1).
  const currentYear = todayIso.slice(0, 4)
  const oncePlansThisYear = plans.filter(
    (plan) =>
      plan.interval === 'once' &&
      plan.isPaused !== true &&
      plan.validFrom.slice(0, 4) === currentYear &&
      originOf(plan.flowType) !== 'transfer',
  )
  const onceAnnualSum = oncePlansThisYear.reduce(
    (sum, plan) => sum + (annualAmount(plan) ?? 0),
    0,
  )
  // F19: sichtbare Anzeige-Rundungsdifferenz (12 × gerundeter Monatswert vs. Jahresbetrag).
  const ownRoundingDifference = roundToUnit(annualOwn - 12 * roundToUnit(ownSmoothed))
  const totalRoundingDifference = roundToUnit(annualTotal - 12 * roundToUnit(totalSmoothed))

  // Monats-Realsicht: tatsächlicher Planzufluss im aktuellen Kalendermonat
  // (inkl. Jahres-/Einmalfälligkeiten; NUR für Monate ab dem Stichtagsmonat, 2c).
  const monthRealTotal = plans
    .filter((plan) => originOf(plan.flowType) !== 'transfer')
    .reduce((sum, plan) => sum + realAmountInMonth(plan, currentMonth), 0)
  const transferMonthly = activeTransferPlans.reduce(
    (sum, plan) => sum + monthlyAmount(plan, 'realMonthly'),
    0,
  )

  // Gruppierungen (aggregateMonthlyBy, Sicht klar benannt: geglättet (Analysewert)).
  const nonTransferActive = activePlans.filter((plan) => originOf(plan.flowType) !== 'transfer')
  const byTarget = aggregateMonthlyBy(nonTransferActive, 'smoothed', (plan) => plan.targetId)
  const byOrigin = aggregateMonthlyBy(nonTransferActive, 'smoothed', (plan) =>
    originOf(plan.flowType),
  )

  // F10-Referenzverteilung: DOKUMENTIERTE Basis – geglättete feste Zuflüsse je
  // Depot-Ziel inkl. Arbeitgeberanteile, ohne variable, ohne Umbuchungen.
  const f10Basis = activePlans.filter(
    (plan) =>
      plan.targetKind === 'position' &&
      plan.amount !== null &&
      originOf(plan.flowType) !== 'transfer',
  )
  const f10Entries = aggregateMonthlyBy(f10Basis, 'smoothed', (plan) => plan.targetId)
  const f10Allocation = referenceAllocation(f10Entries)
  const f10Sum = f10Entries.reduce((sum, entry) => sum + entry.amount, 0)
  // World-gesamt-Aggregat (F10-Testergebnis 85/225 = 37,78 %): die drei
  // World-Positionen zusätzlich als Summe ausweisen (F7-Analogie, S1-Regel).
  const positionGroupById = new Map(
    loadedData.portfolioPositions.map((position) => [position.id, position.group]),
  )
  const f10WorldAmount = f10Entries
    .filter((entry) => positionGroupById.get(entry.id) === 'world')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const f10WorldShare = share(f10WorldAmount, f10Sum)
  const activeProfile =
    data.targetProfiles.find((profile) => profile.id === data.settings.activeTargetProfileId) ??
    null
  const savingsRateProfileWithWeights =
    activeProfile !== null &&
    activeProfile.basis === 'savingsRate' &&
    Array.isArray(activeProfile.weights) &&
    activeProfile.weights.length > 0
      ? activeProfile
      : null

  // 1.000-€-Sparziel (U3): Ziel aus data.goals, metric monthlySavingsRate.
  const savingsGoal: Goal | null =
    data.goals.find((goal) => goal.metric === 'monthlySavingsRate') ?? null
  const savingsGoalTarget =
    savingsGoal !== null && typeof savingsGoal.targetAmount === 'number'
      ? savingsGoal.targetAmount
      : null
  const primaryProgress =
    savingsGoalTarget !== null ? goalProgress(ownReal, savingsGoalTarget) : null
  const smoothedProgress =
    savingsGoalTarget !== null ? goalProgress(ownSmoothed, savingsGoalTarget) : null

  // --- Datenqualität/Warnungen (H): Namen, nie IDs ---

  const qualityIssues: string[] = []
  plans.forEach((plan) => {
    const target = targetInfoOf(loadedData, plan.targetKind, plan.targetId)
    if (!target.exists) {
      qualityIssues.push(
        `⚠ „${plan.name}“: Das Ziel des Sparplans existiert nicht mehr im Bestand.`,
      )
    } else if (target.inactive) {
      qualityIssues.push(
        `⚠ „${plan.name}“: Das Ziel „${target.name}“ ist deaktiviert – Zuflüsse zählen in keine aktive Summe.`,
      )
    }
    if (hasUnknownSchedule(plan)) {
      qualityIssues.push(
        `⚠ „${plan.name}“: jährlich ohne Fälligkeitsmonat – nächster Termin unbekannt; die reale Jahressicht kann den Betrag keinem Monat zuordnen.`,
      )
    }
  })
  const endedPlans = plans.filter((plan) => planStatus(plan, todayIso) === 'ended')
  const completedPlans = plans.filter((plan) => planStatus(plan, todayIso) === 'completed')

  // --- Liste: Status, Filter, Gruppierung, Sortierung ---

  interface PlanRow {
    plan: SavingsPlan
    status: SavingsPlanStatus
    target: TargetInfo
    nextDue: string | null
    annual: number | null
    smoothed: number
  }

  const rows: PlanRow[] = plans.map((plan) => ({
    plan,
    status: planStatus(plan, todayIso),
    target: targetInfoOf(loadedData, plan.targetKind, plan.targetId),
    nextDue: nextDueDate(plan, todayIso),
    annual: annualAmount(plan),
    smoothed: monthlyAmount(plan, 'smoothed'),
  }))

  const anyFilterActive =
    filters.status.length > 0 ||
    filters.origin.length > 0 ||
    filters.regularity.length > 0 ||
    filters.targetKind.length > 0

  const filteredRows = rows.filter((row) => {
    if (filters.status.length > 0 && !filters.status.includes(statusFilterOf(row.status))) {
      return false
    }
    if (filters.origin.length > 0 && !filters.origin.includes(originOf(row.plan.flowType))) {
      return false
    }
    if (filters.regularity.length > 0) {
      const isOnce = row.plan.interval === 'once'
      const isRegular = !isOnce && row.plan.amount !== null
      const matches =
        (filters.regularity.includes('once') && isOnce) ||
        (filters.regularity.includes('regular') && isRegular)
      if (!matches) return false
    }
    if (filters.targetKind.length > 0 && !filters.targetKind.includes(row.plan.targetKind)) {
      return false
    }
    return true
  })

  function compareDefault(a: PlanRow, b: PlanRow): number {
    // Standard: nächster Termin aufsteigend (unbekannt ans Ende), dann Betrag absteigend.
    if (a.nextDue !== b.nextDue) {
      if (a.nextDue === null) return 1
      if (b.nextDue === null) return -1
      if (a.nextDue !== b.nextDue) return a.nextDue < b.nextDue ? -1 : 1
    }
    const aAmount = a.plan.amount ?? -1
    const bAmount = b.plan.amount ?? -1
    if (aAmount !== bAmount) return bAmount - aAmount
    return a.plan.name.localeCompare(b.plan.name, 'de')
  }

  function compareBySort(a: PlanRow, b: PlanRow, sortState: SortState): number {
    const factor = sortState.direction === 'asc' ? 1 : -1
    switch (sortState.key) {
      case 'name':
        return factor * a.plan.name.localeCompare(b.plan.name, 'de')
      case 'target':
        return factor * a.target.name.localeCompare(b.target.name, 'de')
      case 'amount': {
        const aAmount = a.plan.amount
        const bAmount = b.plan.amount
        if (aAmount === null || bAmount === null) {
          if (aAmount === null && bAmount === null) return a.plan.name.localeCompare(b.plan.name, 'de')
          return aAmount === null ? 1 : -1
        }
        return factor * (aAmount - bAmount)
      }
      case 'annual': {
        if (a.annual === null || b.annual === null) {
          if (a.annual === null && b.annual === null) return a.plan.name.localeCompare(b.plan.name, 'de')
          return a.annual === null ? 1 : -1
        }
        return factor * (a.annual - b.annual)
      }
      case 'nextDue': {
        if (a.nextDue === null || b.nextDue === null) {
          if (a.nextDue === null && b.nextDue === null) return a.plan.name.localeCompare(b.plan.name, 'de')
          return a.nextDue === null ? 1 : -1
        }
        return factor * a.nextDue.localeCompare(b.nextDue)
      }
      case 'status':
        return factor * STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status], 'de')
    }
  }

  const sortedRows = filteredRows.slice().sort((a, b) => {
    // Statusgruppen immer zuerst: aktiv/geplant → pausiert → beendet/abgeschlossen.
    const groupDiff = STATUS_GROUP_RANK[a.status] - STATUS_GROUP_RANK[b.status]
    if (groupDiff !== 0) return groupDiff
    return sort === null ? compareDefault(a, b) : compareBySort(a, b, sort)
  })

  function toggleSort(key: SortKey): void {
    setSort((current) =>
      current === null || current.key !== key
        ? { key, direction: 'asc' }
        : { key, direction: current.direction === 'asc' ? 'desc' : 'asc' },
    )
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | undefined {
    if (sort === null || sort.key !== key) return undefined
    return sort.direction === 'asc' ? 'ascending' : 'descending'
  }

  function sortIndicator(key: SortKey): string {
    if (sort === null || sort.key !== key) return ''
    return sort.direction === 'asc' ? ' ▲' : ' ▼'
  }

  // --- Editor-Handling (Fokusführung wie DepotPage) ---

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
    // gehen die Eingaben verloren (M14-B3-Lehre; Fehlerbericht „Dropdown“).
    const target = event.target
    if (target instanceof HTMLSelectElement) return
    if (target instanceof HTMLInputElement && target.type === 'date') return
    closeEditor()
  }

  /**
   * Übernimmt ein Ergebnis der reinen Datenfunktionen. Unverändertes Absenden
   * löst KEIN applyDataChange aus (kein falscher Dirty-State) – Vergleich vor
   * Übernahme.
   */
  function applyResult(result: SavingsPlanActionResult): string | null {
    if (!result.ok) return result.error
    if (JSON.stringify(result.data) !== JSON.stringify(loadedData)) {
      actions.applyDataChange(result.data)
    }
    closeEditor()
    return null
  }

  function handleAddSubmit(input: SavingsPlanInput): string | null {
    return applyResult(addSavingsPlan(loadedData, input))
  }

  function handleEditSubmit(planId: string, input: SavingsPlanInput): string | null {
    return applyResult(updateSavingsPlan(loadedData, planId, input))
  }

  function handlePauseToggle(plan: SavingsPlan): void {
    setActionError(null)
    if (plan.isPaused === true) {
      const proceed = window.confirm(
        `Sparplan „${plan.name}“ (${amountText(plan)}) reaktivieren? Er zählt ab sofort wieder in die Kennzahlen.`,
      )
      if (!proceed) return
      const result = resumeSavingsPlan(loadedData, plan.id)
      if (result.ok) actions.applyDataChange(result.data)
      else setActionError(result.error)
      return
    }
    const proceed = window.confirm(
      `Sparplan „${plan.name}“ (${amountText(plan)}) pausieren? Er zählt ab sofort in keine Kennzahl, bleibt aber gelistet. Vergangene Monate werden nicht umgedeutet.`,
    )
    if (!proceed) return
    const result = pauseSavingsPlan(loadedData, plan.id)
    if (result.ok) actions.applyDataChange(result.data)
    else setActionError(result.error)
  }

  function handleEnd(plan: SavingsPlan): void {
    setActionError(null)
    const proceed = window.confirm(
      `Sparplan „${plan.name}“ (${amountText(plan)}) zum ${formatIsoDateGerman(todayIso)} beenden? Nach dem Enddatum zählt er in keine Summe mehr; er bleibt gelistet und wird nie gelöscht.`,
    )
    if (!proceed) return
    const result = endSavingsPlan(loadedData, plan.id, todayIso)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    // Kein falscher Dirty-State, wenn das Enddatum bereits gesetzt war (Reviewer K3).
    if (JSON.stringify(result.data) !== JSON.stringify(loadedData)) {
      actions.applyDataChange(result.data)
    }
  }

  const editingPlan =
    editor.kind === 'edit' ? (plans.find((plan) => plan.id === editor.planId) ?? null) : null

  const defaultTargetKey =
    data.portfolioPositions.length > 0
      ? `position|${data.portfolioPositions[0].id}`
      : data.accounts.length > 0
        ? `account|${data.accounts[0].id}`
        : 'position|'

  const emptyForm: PlanFormValues = {
    name: '',
    targetKey: defaultTargetKey,
    amountText: '',
    isVariable: false,
    interval: 'monthly',
    dueMonth: '',
    flowType: 'own_fixed',
    isFlexible: true,
    validFrom: todayIso,
    validUntil: '',
    note: '',
  }

  function formValuesFromPlan(plan: SavingsPlan): PlanFormValues {
    return {
      name: plan.name,
      targetKey: `${plan.targetKind}|${plan.targetId}`,
      amountText: plan.amount === null ? '' : amountToInputText(plan.amount),
      isVariable: plan.amount === null,
      interval: plan.interval,
      dueMonth: typeof plan.dueMonth === 'number' ? String(plan.dueMonth) : '',
      flowType: plan.flowType,
      isFlexible: plan.isFlexible !== false,
      validFrom: plan.validFrom,
      validUntil: plan.interval === 'once' ? '' : (plan.validUntil ?? ''),
      note: plan.note ?? '',
    }
  }

  function filterButton<T>(
    label: string,
    dimension: keyof Filters,
    value: T,
    list: T[],
  ) {
    const active = list.includes(value)
    return (
      <button
        type="button"
        className="filter-button"
        aria-pressed={active}
        onClick={() =>
          setFilters((current) => ({
            ...current,
            [dimension]: toggleValue(current[dimension] as T[], value),
          }))
        }
      >
        {active ? '✓ ' : ''}
        {label}
      </button>
    )
  }

  return (
    <section className="page" aria-labelledby="page-title" onKeyDown={handleKeyDown}>
      <h2 id="page-title">Sparpläne</h2>
      <p className="app-hint">
        Alle Sparpläne und Zuflüsse des geladenen Bestands (Stichtag: {formatIsoDateGerman(todayIso)}).
        Sparpläne werden nie gelöscht – nur beendet oder pausiert.
      </p>
      <SavingsRules />

      {qualityIssues.length > 0 ||
      variableActivePlans.length > 0 ||
      endedPlans.length > 0 ||
      completedPlans.length > 0 ? (
        <div className="issue-box">
          <ul className="quality-list">
            {qualityIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
            {variableActivePlans.length > 0 ? (
              <li>
                ℹ Variable Pläne ohne garantierten Betrag:{' '}
                {variableActivePlans.map((plan) => plan.name).join(', ')} – sie zählen nie in
                Summen (Ist-Werte nur aus Buchungen).
              </li>
            ) : null}
            {endedPlans.length > 0 ? (
              <li>
                ℹ Beendete Sparpläne (Enddatum überschritten):{' '}
                {endedPlans.map((plan) => plan.name).join(', ')}.
              </li>
            ) : null}
            {completedPlans.length > 0 ? (
              <li>
                ℹ Abgeschlossene Einmalzuflüsse (Ausführungsdatum vorbei):{' '}
                {completedPlans.map((plan) => plan.name).join(', ')}.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <section aria-labelledby="savings-sums-title">
        <h3 id="savings-sums-title">Summen</h3>
        <p className="app-hint">
          Berücksichtigt werden {activePlans.length} aktive Pläne. Reale und geglättete Sicht
          werden nie gemischt.
        </p>
        {/* M14/M10-Restpunkt (S2): Budget-Warnung gegen das in den Einstellungen
            hinterlegte monatliche Sparbudget – strikt > Budget, via F8 real
            (ownMonthlySavings), NIE blockierend; null = keine Prüfung („offen“). */}
        {typeof data.settings.monthlySavingsBudget === 'number' &&
        ownReal > data.settings.monthlySavingsBudget ? (
          <p className="warning-note" role="status">
            ⚠ Die eigene feste Sparleistung (real) {formatEuro(ownReal)} pro Monat überschreitet
            das in den Einstellungen hinterlegte monatliche Sparbudget{' '}
            {formatEuro(data.settings.monthlySavingsBudget)}. Nur ein Hinweis – es wird nichts
            blockiert und kein Sparplan geändert.
          </p>
        ) : null}
        <dl className="kpi-grid">
          <div className="kpi-tile">
            <dt>Eigene Sparleistung (real)</dt>
            <dd>
              <span>{sumDisplay(ownReal, activeOwnPlans)}</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Eigene Sparleistung – geglättet (Analysewert)</dt>
            <dd>
              <span>{sumDisplay(ownSmoothed, activeOwnPlans)}</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Externe Zuflüsse (real)</dt>
            <dd>
              <span>{sumDisplay(externalReal, activeExternalPlans)}</span>
              <span className="kpi-note">Arbeitgeber- und Anbieterleistungen</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Externe Zuflüsse – geglättet (Analysewert)</dt>
            <dd>
              <span>{sumDisplay(externalSmoothed, activeExternalPlans)}</span>
            </dd>
          </div>
        </dl>
        <dl className="kpi-grid">
          <div className="kpi-tile">
            <dt>Gesamtzufluss (real)</dt>
            <dd>
              <span>{sumDisplay(totalReal, nonTransferActive)}</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Gesamtzufluss – geglättet (Analysewert)</dt>
            <dd>
              <span>{sumDisplay(totalSmoothed, nonTransferActive)}</span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Monats-Realsicht {formatIsoMonthGerman(currentMonth)}</dt>
            <dd>
              <span>{formatEuro(monthRealTotal)}</span>
              <span className="kpi-note">
                tatsächlicher Planzufluss dieses Kalendermonats – inkl. Jahres- und
                Einmalfälligkeiten; nicht die monatliche Sparrate
              </span>
            </dd>
          </div>
        </dl>
        {variableActivePlans.length > 0 ? (
          <p className="app-hint">
            zzgl. variable Zuflüsse (nicht garantiert) – sie sind in keiner Summe enthalten.
          </p>
        ) : null}
        <h4>Jahreswerte (regelmäßige Pläne)</h4>
        <dl className="facts-list">
          <div>
            <dt>Jahresbetrag eigen</dt>
            <dd>{sumDisplay(annualOwn, activeOwnPlans)}</dd>
          </div>
          <div>
            <dt>Jahresbetrag extern</dt>
            <dd>{sumDisplay(annualExternal, activeExternalPlans)}</dd>
          </div>
          <div>
            <dt>Jahresbetrag gesamt</dt>
            <dd>{sumDisplay(annualTotal, nonTransferActive)}</dd>
          </div>
          {oncePlansThisYear.length > 0 ? (
            <div>
              <dt>Einmalige Zuflüsse {currentYear} (getrennt)</dt>
              <dd>{formatEuro(onceAnnualSum)} – inkl. geplanter und abgeschlossener Einmalzuflüsse dieses Jahres</dd>
            </div>
          ) : null}
          <div>
            <dt>Umbuchungen (keine Sparleistung)</dt>
            <dd>
              {activeTransferPlans.length === 0
                ? 'keine'
                : `${formatEuro(transferMonthly)} pro Monat – zählt in keine Summe`}
            </dd>
          </div>
        </dl>
        {ownRoundingDifference !== 0 ? (
          <p className="app-hint">
            ℹ Anzeige-Rundung (F19): 12 × {formatEuro(roundToUnit(ownSmoothed))} ={' '}
            {formatEuro(roundToUnit(12 * roundToUnit(ownSmoothed)))} weicht um{' '}
            {formatEuro(ownRoundingDifference)} vom Jahresbetrag eigen ab – intern wird ungerundet
            gerechnet (12 × geglättet = Jahresbetrag).
          </p>
        ) : null}
        {totalRoundingDifference !== 0 ? (
          <p className="app-hint">
            ℹ Anzeige-Rundung (F19): 12 × {formatEuro(roundToUnit(totalSmoothed))} weicht um{' '}
            {formatEuro(totalRoundingDifference)} vom Jahresbetrag gesamt ab.
          </p>
        ) : null}
        <h4>Nach Ziel – geglättet (Analysewert)</h4>
        <dl className="facts-list">
          {byTarget.map((entry) => {
            const first = nonTransferActive.find((plan) => plan.targetId === entry.id)!
            const target = targetInfoOf(loadedData, first.targetKind, first.targetId)
            return (
              <div key={entry.id}>
                <dt>
                  {target.name} ({target.kindLabel}
                  {target.inactive ? ', inaktiv' : ''})
                </dt>
                <dd>{formatEuro(entry.amount)}</dd>
              </div>
            )
          })}
        </dl>
        <h4>Nach Herkunft – geglättet (Analysewert)</h4>
        <dl className="facts-list">
          {byOrigin.map((entry) => (
            <div key={entry.id}>
              <dt>{ORIGIN_LABELS[entry.id as Origin]}</dt>
              <dd>{formatEuro(entry.amount)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="savings-goal-title">
        {/* Überschrift aus den DATEN (goal.name), nie hartkodiert (Reviewer K4). */}
        <h3 id="savings-goal-title">
          {savingsGoal === null ? 'Sparziel „monatliche Sparrate“' : `Sparziel „${savingsGoal.name}“`}
        </h3>
        {savingsGoal === null ? (
          <p className="app-hint">
            Der geladene Bestand enthält kein Ziel mit der Kennzahl „monatliche Sparrate“. Sobald
            ein solches Ziel existiert, erscheint hier der Fortschritt.
          </p>
        ) : primaryProgress === null || smoothedProgress === null ? (
          <p className="app-hint">
            „{savingsGoal.name}“: kein gültiger Zielbetrag – der Fortschritt ist nicht berechenbar.
          </p>
        ) : (
          <>
            <p>
              Ziel „{savingsGoal.name}“: {formatEuro(primaryProgress.target)} pro Monat.
            </p>
            <p>Fortschritt auf Basis deiner eigenen realen monatlichen Sparleistung:</p>
            <p className="goal-progress">
              {/* Balken gedeckelt; der ECHTE Prozentwert steht daneben (aria-describedby). */}
              <progress
                max={primaryProgress.target}
                value={Math.min(Math.max(primaryProgress.actual, 0), primaryProgress.target)}
                aria-label={`Fortschritt „${savingsGoal.name}“ (eigene reale Sparleistung)`}
                aria-describedby="savings-goal-primary-share"
              />{' '}
              <span id="savings-goal-primary-share">
                {primaryProgress.share === null
                  ? 'nicht berechenbar'
                  : formatShare(primaryProgress.share, percentDecimals)}{' '}
                ({formatEuro(primaryProgress.actual)} von {formatEuro(primaryProgress.target)})
              </span>
            </p>
            {primaryProgress.reached ? (
              <p className="success-note" role="status">
                ✓ Ziel erreicht – die App schlägt nur vor, ändert aber nie automatisch Sparraten.
              </p>
            ) : null}
            <p>Geglätteter Analysewert – nicht der primäre Zielfortschritt:</p>
            <p className="goal-progress">
              <progress
                max={smoothedProgress.target}
                value={Math.min(Math.max(smoothedProgress.actual, 0), smoothedProgress.target)}
                aria-label={`Analysewert „${savingsGoal.name}“ (eigene geglättete Sparleistung)`}
                aria-describedby="savings-goal-smoothed-share"
              />{' '}
              <span id="savings-goal-smoothed-share">
                {smoothedProgress.share === null
                  ? 'nicht berechenbar'
                  : formatShare(smoothedProgress.share, percentDecimals)}{' '}
                ({formatEuro(smoothedProgress.actual)} geglättet (Analysewert))
              </span>
            </p>
            <h4>Zur Einordnung: Gesamtzufluss (zählt NICHT als Zielfortschritt)</h4>
            <dl className="facts-list">
              <div>
                <dt>Gesamtzufluss (real)</dt>
                <dd>{formatEuro(totalReal)}</dd>
              </div>
              <div>
                <dt>Gesamtzufluss – geglättet (Analysewert)</dt>
                <dd>{formatEuro(totalSmoothed)}</dd>
              </div>
            </dl>
            <p className="app-hint">
              Externe Zuflüsse (VL-Zuschuss, Boni, Saveback) sind kein eigenes Sparen – das Ziel
              misst per Nutzerentscheidung U3 nur die eigene reale monatliche Sparleistung.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="savings-f10-title">
        <h3 id="savings-f10-title">Referenzverteilung der Sparraten (F10, nur Orientierung)</h3>
        <p className="app-hint">
          Datenbasis: geglättete feste Zuflüsse (inkl. Arbeitgeberanteile) je Depot-Ziel – ohne
          variable Zuflüsse, ohne Umbuchungen.
        </p>
        {f10Allocation === null ? (
          <p className="app-hint">nicht berechenbar – es gibt keine festen Depot-Zuflüsse.</p>
        ) : (
          <dl className="facts-list">
            {f10Entries.map((entry, index) => {
              const first = f10Basis.find((plan) => plan.targetId === entry.id)!
              const target = targetInfoOf(loadedData, first.targetKind, first.targetId)
              return (
                <div key={entry.id}>
                  <dt>
                    {target.name}
                    {target.inactive ? ' (inaktiv)' : ''}
                  </dt>
                  <dd>
                    {formatEuro(entry.amount)} ·{' '}
                    {formatShare(f10Allocation[index].share, percentDecimals)}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
        {f10Allocation !== null && f10WorldAmount > 0 ? (
          <p className="sum-line">
            Zusammen als „MSCI World gesamt“: {formatEuro(f10WorldAmount)}
            {f10WorldShare === null ? '' : ` · ${formatShare(f10WorldShare, percentDecimals)}`}
          </p>
        ) : null}
        {savingsRateProfileWithWeights !== null && f10Allocation !== null ? (
          <SavingsRateProfileComparison
            profile={savingsRateProfileWithWeights}
            data={loadedData}
            entries={f10Entries}
            basisSum={f10Sum}
            percentDecimals={percentDecimals}
          />
        ) : activeProfile !== null && activeProfile.basis === 'savingsRate' ? (
          <p className="app-hint">
            Die Referenz der Studienphase IST die aktuelle Verteilung (Ebene A) – ein gespeichertes
            Soll gibt es nicht.
          </p>
        ) : null}
        <p className="app-hint">
          Die Referenzverteilung dient nur zur Orientierung und ändert keine Sparpläne automatisch.
        </p>
      </section>

      <section aria-labelledby="savings-list-title">
        <h3 id="savings-list-title">Sparplanliste</h3>

        <div className="toolbar">
          <button
            type="button"
            className="btn-primary"
            onClick={(event) => openEditor({ kind: 'add' }, event.currentTarget)}
            disabled={state.isSaving || editor.kind === 'add'}
          >
            <Icon name="plus" />
            Sparplan hinzufügen
          </button>
        </div>

        {actionError !== null ? (
          <p className="operation-error" role="alert">
            ⚠ {actionError}
          </p>
        ) : null}

        {editor.kind === 'add' ? (
          <PlanForm
            heading="Sparplan hinzufügen"
            submitLabel="Sparplan anlegen"
            initial={emptyForm}
            data={loadedData}
            onCancel={closeEditor}
            onSubmit={handleAddSubmit}
          />
        ) : null}
        {editor.kind === 'edit' && editingPlan !== null ? (
          <PlanForm
            // key erzwingt eine frische Formularinstanz je Plan (M8-Lehre): sonst
            // „klebt“ der Zustand beim Wechsel A→B und schreibt auf den falschen Plan.
            key={editingPlan.id}
            heading={`Sparplan bearbeiten: ${editingPlan.name}`}
            submitLabel="Änderungen übernehmen"
            initial={formValuesFromPlan(editingPlan)}
            data={loadedData}
            onCancel={closeEditor}
            onSubmit={(input) => handleEditSubmit(editingPlan.id, input)}
          />
        ) : null}

        {plans.length === 0 ? (
          <p className="app-hint">
            Der geladene Bestand enthält noch keine Sparpläne. Lege mit „Sparplan hinzufügen“ den
            ersten Plan an.
          </p>
        ) : (
          <>
            <div className="filter-bar" role="group" aria-label="Filter der Sparplanliste">
              {/* Jede Filter-Dimension ist eine benannte Gruppe – Screenreader hören
                  den Kontext („Status: aktiv“), nicht nur den Buttontext (B2). */}
              <div className="filter-group" role="group" aria-labelledby="filter-label-status">
                <span id="filter-label-status" className="filter-label">Status:</span>
                {filterButton('aktiv', 'status', 'active', filters.status)}
                {filterButton('pausiert', 'status', 'paused', filters.status)}
                {filterButton('beendet', 'status', 'ended', filters.status)}
              </div>
              <div className="filter-group" role="group" aria-labelledby="filter-label-origin">
                <span id="filter-label-origin" className="filter-label">Herkunft:</span>
                {filterButton('eigen', 'origin', 'own', filters.origin)}
                {filterButton('extern', 'origin', 'external', filters.origin)}
                {filterButton('Umbuchung', 'origin', 'transfer', filters.origin)}
              </div>
              <div className="filter-group" role="group" aria-labelledby="filter-label-regularity">
                <span id="filter-label-regularity" className="filter-label">Regelmäßigkeit:</span>
                {filterButton('regelmäßig', 'regularity', 'regular', filters.regularity)}
                {filterButton('einmalig', 'regularity', 'once', filters.regularity)}
              </div>
              <div className="filter-group" role="group" aria-labelledby="filter-label-targetkind">
                <span id="filter-label-targetkind" className="filter-label">Zieltyp:</span>
                {filterButton('Konto', 'targetKind', 'account', filters.targetKind)}
                {filterButton('Position', 'targetKind', 'position', filters.targetKind)}
              </div>
              {anyFilterActive ? (
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                >
                  Filter zurücksetzen
                </button>
              ) : null}
            </div>

            {sortedRows.length === 0 ? (
              <p className="app-hint">
                Kein Sparplan entspricht den gewählten Filtern.{' '}
                <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Filter zurücksetzen
                </button>
              </p>
            ) : (
              // Fokussierbare benannte Region: Tastaturnutzer können die breite
              // Tabelle horizontal scrollen, ohne interaktive Zellen zu brauchen (B6).
              // Eigener Name (nicht die Sektions-ID) – sonst gäbe es zwei
              // gleichnamige Regionen „Sparplanliste".
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Sparplanliste (Tabelle, horizontal scrollbar)"
              >
                <table className="accounts-table">
                  <caption className="visually-hidden">Sparplanliste</caption>
                  <thead>
                    <tr>
                      <th scope="col" aria-sort={ariaSort('name')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('name')}
                        >
                          Name{sortIndicator('name')}
                        </button>
                      </th>
                      <th scope="col" aria-sort={ariaSort('target')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('target')}
                        >
                          Ziel{sortIndicator('target')}
                        </button>
                      </th>
                      <th scope="col">Zuflussart</th>
                      <th scope="col">Herkunft</th>
                      <th scope="col" className="num" aria-sort={ariaSort('amount')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('amount')}
                        >
                          Betrag{sortIndicator('amount')}
                        </button>
                      </th>
                      <th scope="col">Rhythmus</th>
                      <th scope="col">Start</th>
                      <th scope="col">Ende</th>
                      <th scope="col" aria-sort={ariaSort('status')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('status')}
                        >
                          Status{sortIndicator('status')}
                        </button>
                      </th>
                      <th scope="col" className="num" aria-sort={ariaSort('annual')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('annual')}
                        >
                          Jahresbetrag{sortIndicator('annual')}
                        </button>
                      </th>
                      <th scope="col" className="num">Monatsbetrag geglättet (Analysewert)</th>
                      <th scope="col" aria-sort={ariaSort('nextDue')}>
                        <button
                          type="button"
                          className="sort-button"
                          onClick={() => toggleSort('nextDue')}
                        >
                          Nächster Termin{sortIndicator('nextDue')}
                        </button>
                      </th>
                      <th scope="col">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => {
                      const { plan, status, target } = row
                      const canPauseToggle = status !== 'ended' && status !== 'completed'
                      const canEnd =
                        plan.interval !== 'once' && status !== 'ended' && status !== 'completed'
                      return (
                        <tr key={plan.id}>
                          <th scope="row">{plan.name}</th>
                          <td>
                            {target.name} ({target.kindLabel})
                            {target.inactive ? (
                              <>
                                {' '}
                                <strong className="badge badge--warn">⚠ Ziel inaktiv</strong>
                              </>
                            ) : null}
                            {!target.exists ? (
                              <>
                                {' '}
                                <strong className="badge badge--danger">⚠ Ziel unbekannt</strong>
                              </>
                            ) : null}
                          </td>
                          <td>{FLOW_TYPE_LABELS[plan.flowType]}</td>
                          <td>{ORIGIN_LABELS[originOf(plan.flowType)]}</td>
                          <td className="num">{amountText(plan)}</td>
                          <td>{INTERVAL_LABELS[plan.interval]}</td>
                          <td>{formatIsoDateGerman(plan.validFrom)}</td>
                          <td>
                            {plan.validUntil == null ? '–' : formatIsoDateGerman(plan.validUntil)}
                          </td>
                          <td>
                            <span className={STATUS_BADGE_CLASSES[status]}>
                              {STATUS_SYMBOLS[status]} {STATUS_LABELS[status]}
                            </span>
                          </td>
                          <td className="num">
                            {row.annual === null
                              ? 'variabel'
                              : plan.interval === 'once'
                                ? `${formatEuro(row.annual)} (einmalig)`
                                : formatEuro(row.annual)}
                          </td>
                          <td className="num">
                            {plan.interval === 'once'
                              ? '– (einmalig, nicht geglättet)'
                              : plan.amount === null
                                ? 'variabel'
                                : formatEuro(row.smoothed)}
                          </td>
                          <td>
                            {status === 'paused'
                              ? 'pausiert'
                              : status === 'completed'
                                ? 'abgeschlossen'
                                : row.nextDue === null
                                  ? 'unbekannt'
                                  : formatIsoDateGerman(row.nextDue)}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                aria-label={`Sparplan „${plan.name}“ bearbeiten`}
                                onClick={(event) =>
                                  openEditor(
                                    { kind: 'edit', planId: plan.id },
                                    event.currentTarget,
                                  )
                                }
                                disabled={state.isSaving}
                              >
                                Bearbeiten
                              </button>
                              {canPauseToggle ? (
                                <button
                                  type="button"
                                  aria-label={
                                    plan.isPaused === true
                                      ? `Sparplan „${plan.name}“ reaktivieren`
                                      : `Sparplan „${plan.name}“ pausieren`
                                  }
                                  onClick={() => handlePauseToggle(plan)}
                                  disabled={state.isSaving}
                                >
                                  {plan.isPaused === true ? 'Reaktivieren' : 'Pausieren'}
                                </button>
                              ) : null}
                              {canEnd ? (
                                <button
                                  type="button"
                                  className="btn-danger"
                                  aria-label={`Sparplan „${plan.name}“ beenden`}
                                  onClick={() => handleEnd(plan)}
                                  disabled={state.isSaving}
                                >
                                  Beenden
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  )
}

// --- F10-Abweichungsvergleich (NUR bei aktivem savingsRate-Profil MIT gespeicherten Gewichten) ---

function SavingsRateProfileComparison({
  profile,
  data,
  entries,
  basisSum,
  percentDecimals,
}: {
  profile: TargetProfile
  data: FinanceData
  entries: readonly { id: string; amount: number }[]
  basisSum: number
  percentDecimals: number
}) {
  // Nur Anzeige, KEINE Empfehlungen/Handlungsstufen: Ist-% vs. gespeichertes
  // Soll-% mit Pp- und EUR-Differenz – alle Formeln aus src/finance (F13/F14/F20).
  const targets = targetValues(profile.weights, basisSum)
  if (targets === null) {
    return (
      <p className="app-hint">
        Das gespeicherte Soll des Profils „{profile.name}“ ist nicht berechenbar (ungültige oder
        leere Gewichte) – es wird nicht verglichen.
      </p>
    )
  }
  const positionById = new Map(data.portfolioPositions.map((position) => [position.id, position]))
  const amountByTarget = new Map(entries.map((entry) => [entry.id, entry.amount]))
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label={`Vergleich Ist-Verteilung mit gespeichertem Soll des Profils ${profile.name}`}
    >
      <table className="accounts-table">
        <caption className="visually-hidden">
          Vergleich Ist-Verteilung mit gespeichertem Soll des Profils {profile.name}
        </caption>
        <thead>
          <tr>
            <th scope="col">Ziel</th>
            <th scope="col" className="num">Ist-%</th>
            <th scope="col" className="num">Soll-%</th>
            <th scope="col" className="num">Abweichung (Pp)</th>
            <th scope="col" className="num">Abweichung (EUR/Monat)</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => {
            let label: string
            let actualAmount = 0
            if (target.refKind === 'position') {
              label = positionById.get(target.ref)?.name ?? 'unbekanntes Ziel'
              actualAmount = amountByTarget.get(target.ref) ?? 0
            } else {
              // Deutscher Gruppen-Name statt rohem Schlüssel (A11y-Befund M10-B1).
              label = `${GROUP_LABELS[target.ref as PositionGroup]} (Gruppe)`
              for (const [targetId, amount] of amountByTarget) {
                if (positionById.get(targetId)?.group === target.ref) {
                  actualAmount += amount
                }
              }
            }
            const actualShare = share(actualAmount, basisSum)
            const pp = actualShare === null ? null : deviationPp(actualShare, target.weight)
            const eurDiff = deviationEur(actualAmount, target.target)
            return (
              <tr key={`${target.refKind}-${target.ref}`}>
                <th scope="row">{label}</th>
                <td className="num">
                  {actualShare === null
                    ? 'nicht berechenbar'
                    : formatShare(actualShare, percentDecimals)}
                </td>
                <td className="num">{formatShare(target.weight, percentDecimals)}</td>
                <td className="num">{pp === null ? '–' : formatPp(pp, percentDecimals)}</td>
                <td className="num">{formatEuro(eurDiff)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
