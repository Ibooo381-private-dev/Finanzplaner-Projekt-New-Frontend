/**
 * Modul „Simulator & Projektionen“ (M13): Übersicht mit Pflicht-Banner, Liste
 * gespeicherter Simulationen (Kartenmuster), Formular (Anlegen/Bearbeiten mit
 * Vorbelegungen aus den M10-Sparplänen, G9-gekennzeichnet), Detailansicht
 * (Zusammenfassung, Verlaufstabelle als PRIMÄRquelle, ergänzendes inline-SVG-
 * Diagramm mit aria-hidden, Zielanalyse) und Vergleich (≥ 2 Simulationen).
 *
 * Keine Finanzlogik in Komponenten: alle Kennzahlen kommen aus
 * src/finance/projection.ts (simulateScenario, summarizeSimulation,
 * analyzeGoalsInSimulation, compareSimulations, firstProjectionStartMonth,
 * projectionMonthIso) – der Rechenkern existiert NUR dort. Alle
 * Datenänderungen laufen über die reinen Funktionen in src/data/simulations.ts
 * (+ applyDataChange → DATA_CHANGED). Simulationen ändern NIE Ist-Daten
 * (einzige berührte Collection: simulations[]). Löschen NUR mit
 * G12-Bestätigung inkl. Name; Abbruch lässt den Bestand Byte-identisch.
 * Der Stichtag kommt IMMER aus dem injizierten todayIso des Provider-Kontexts;
 * startMonth ist der FOLGEMONAT des Stichtags (KORREKTUR 2.1, F22).
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type {
  EmergencyFund,
  FinanceData,
  SavingsPlan,
  Simulation,
  SimulationContributionTarget,
} from '../types/finance'
import type { SimulationGoalOutcome, SimulationMonthPoint } from '../finance'
import {
  analyzeGoalsInSimulation,
  cashValue,
  compareSimulations,
  depotValue,
  firstProjectionStartMonth,
  formatIsoMonthGerman,
  isPlanActiveOn,
  monthlyAmount,
  projectionMonthIso,
  roundToUnit,
  simulateScenario,
  summarizeSimulation,
  TELEKOM_ANNUAL_EVENT,
} from '../finance'
import { isPositionActive } from '../data/positions'
import { formatEuro, parseGermanAmount } from '../format/money'
import { formatIsoDateGerman } from '../format/date'
import {
  addSimulation,
  deleteSimulation,
  duplicateSimulation,
  updateSimulation,
} from '../data/simulations'
import type {
  SimulationActionResult,
  SimulationContributionInput,
  SimulationInput,
} from '../data/simulations'
import { useFinanceData } from '../state/useFinanceData'
import { StartHint } from '../components/StartHint'
import { Icon } from '../components/Icon'

// --- Deutsche Labels (UI) ---

/** In Simulationen wählbare Zuflussarten (Umbuchungen sind unzulässig, G7). */
const CONTRIBUTION_FLOW_TYPES = ['own_fixed', 'own_variable', 'employer', 'provider'] as const

const FLOW_TYPE_LABELS: Record<(typeof CONTRIBUTION_FLOW_TYPES)[number], string> = {
  own_fixed: 'Eigene feste Sparleistung',
  own_variable: 'Eigene variable Sparleistung',
  employer: 'Arbeitgeberleistung',
  provider: 'Anbieterleistung',
}

const TARGET_LABELS: Record<SimulationContributionTarget, string> = {
  depot: 'Depot',
  cash: 'Tagesgeld',
}

const TELEKOM_MODE_LABELS: Record<'real' | 'smoothed', string> = {
  real: 'real (Jahresereignis im Juli: 1.500 € = 1.000 € eigen + 500 € Arbeitgeber)',
  smoothed: 'geglättet (Analysewert – 125 €/Monat gehören in die Beiträge, KEIN Jahresereignis)',
}

const TELEKOM_MODE_SHORT: Record<'real' | 'smoothed', string> = {
  real: 'reale Sicht',
  smoothed: 'geglättete Sicht (Analysewert)',
}

const OUTCOME_LABELS: Record<SimulationGoalOutcome, string> = {
  reachable: 'Erreichbar',
  late: 'Voraussichtlich verspätet',
  'not-in-horizon': 'Im Horizont nicht erreicht',
  'no-statement': 'Keine Aussage möglich',
}

const OUTCOME_SYMBOLS: Record<SimulationGoalOutcome, string> = {
  reachable: '✓',
  late: '◷',
  'not-in-horizon': '⚠',
  'no-statement': '∅',
}

/** Plaketten-Variante je Ergebnis (Symbol + Text bleiben das Signal, Farbe nur Zusatz). */
const OUTCOME_BADGES: Record<SimulationGoalOutcome, string> = {
  reachable: 'badge badge--ok',
  late: 'badge badge--warn',
  'not-in-horizon': 'badge badge--warn',
  'no-statement': 'badge',
}

const PERCENT_TEXT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

/** Pflicht-Kennzeichnung (2.6, exakt nach requirements): je nach Renditeannahme. */
function projectionDisclaimer(annualReturnRate: number): string {
  if (annualReturnRate === 0) return 'Projektion ohne Kursentwicklung'
  return `Projektion mit Annahme ${PERCENT_TEXT.format(annualReturnRate * 100)} % p. a. – keine Prognose, keine Anlageberatung`
}

/** Betrag als de-DE-Eingabetext (parseGermanAmount-kompatibel). */
function amountToInputText(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

// --- Vorbelegungen aus den M10-Sparplänen (Auflage 2.4: flowType-getrennt, G8/G9) ---

interface ContributionRow {
  label: string
  amountText: string
  flowType: (typeof CONTRIBUTION_FLOW_TYPES)[number]
  target: SimulationContributionTarget
}

function isCashAccountPlan(plan: SavingsPlan, data: FinanceData): boolean {
  if (plan.targetKind !== 'account') return false
  const account = data.accounts.find((entry) => entry.id === plan.targetId)
  return account !== undefined && account.type === 'tagesgeld'
}

function hasPositiveAmount(plan: SavingsPlan): boolean {
  return typeof plan.amount === 'number' && Number.isFinite(plan.amount) && plan.amount > 0
}

function sumAmounts(plans: readonly SavingsPlan[]): number {
  return plans.reduce((sum, plan) => sum + (plan.amount ?? 0), 0)
}

function pushRow(
  rows: ContributionRow[],
  label: string,
  amount: number,
  flowType: (typeof CONTRIBUTION_FLOW_TYPES)[number],
  target: SimulationContributionTarget,
): void {
  if (amount > 0) {
    rows.push({ label, amountText: amountToInputText(roundToUnit(amount)), flowType, target })
  }
}

/**
 * Reale Vorbelegung (2.4): monatliche Raten flowType-getrennt (Seed: 93,50
 * eigen + 6,50 Arbeitgeber ins Depot, 25 eigen ins Tagesgeld); der
 * Telekom-Jahreszufluss kommt als Ereignis über telekomMode 'real'.
 * Nur Formular-Befüllung – editierbar, nie automatisch gespeichert.
 */
function realPrefillRows(data: FinanceData, todayIso: string): ContributionRow[] {
  const monthly = data.savingsPlans.filter(
    (plan) =>
      isPlanActiveOn(plan, todayIso) && plan.interval === 'monthly' && hasPositiveAmount(plan),
  )
  const depotPlans = monthly.filter((plan) => plan.targetKind === 'position')
  const cashPlans = monthly.filter((plan) => isCashAccountPlan(plan, data))
  const rows: ContributionRow[] = []
  pushRow(
    rows,
    'Eigene Depot-Sparraten (monatlich)',
    sumAmounts(depotPlans.filter((plan) => plan.flowType === 'own_fixed' || plan.flowType === 'own_variable')),
    'own_fixed',
    'depot',
  )
  pushRow(
    rows,
    'Arbeitgeber-Depotzuflüsse (monatlich)',
    sumAmounts(depotPlans.filter((plan) => plan.flowType === 'employer')),
    'employer',
    'depot',
  )
  pushRow(
    rows,
    'Anbieter-Depotzuflüsse (monatlich)',
    sumAmounts(depotPlans.filter((plan) => plan.flowType === 'provider')),
    'provider',
    'depot',
  )
  pushRow(
    rows,
    'Eigene Tagesgeld-Raten (monatlich)',
    sumAmounts(cashPlans.filter((plan) => plan.flowType === 'own_fixed' || plan.flowType === 'own_variable')),
    'own_fixed',
    'cash',
  )
  return rows
}

/**
 * Geglättete Vorbelegung (2.4, zeilenweise – KEINE Sammelzeile „225 eigen“,
 * G8): VL eigen 33,50 + Arbeitgeber 6,50 + übrige eigene Depot-Raten 60 +
 * Telekom eigen 83,33 + Telekom Bonus 41,67 (beide „geglättet (Analysewert)“,
 * G9) + Tagesgeld 25. telekomMode 'smoothed' → KEIN Jahresereignis.
 */
function smoothedPrefillRows(data: FinanceData, todayIso: string): ContributionRow[] {
  const active = data.savingsPlans.filter((plan) => isPlanActiveOn(plan, todayIso))
  const monthly = active.filter((plan) => plan.interval === 'monthly' && hasPositiveAmount(plan))
  const depotMonthly = monthly.filter((plan) => plan.targetKind === 'position')
  const cashMonthly = monthly.filter((plan) => isCashAccountPlan(plan, data))
  const vlPositionIds = new Set(
    data.portfolioPositions.filter((position) => position.isVL === true).map((position) => position.id),
  )
  const isOwn = (plan: SavingsPlan): boolean =>
    plan.flowType === 'own_fixed' || plan.flowType === 'own_variable'
  // Nicht-monatliche Pläne (z. B. Telekom jährlich) als geglättete Analysewerte.
  const smoothedNonMonthly = active.filter(
    (plan) =>
      plan.targetKind === 'position' && plan.interval !== 'monthly' && hasPositiveAmount(plan),
  )
  const smoothedSum = (plans: readonly SavingsPlan[]): number =>
    plans.reduce((sum, plan) => sum + monthlyAmount(plan, 'smoothed'), 0)
  const rows: ContributionRow[] = []
  pushRow(
    rows,
    'Eigene VL-Sparrate (monatlich)',
    sumAmounts(depotMonthly.filter((plan) => isOwn(plan) && vlPositionIds.has(plan.targetId))),
    'own_fixed',
    'depot',
  )
  pushRow(
    rows,
    'Arbeitgeber-Depotzuflüsse (monatlich)',
    sumAmounts(depotMonthly.filter((plan) => plan.flowType === 'employer')),
    'employer',
    'depot',
  )
  pushRow(
    rows,
    'Eigene Depot-Sparraten ohne VL (monatlich)',
    sumAmounts(depotMonthly.filter((plan) => isOwn(plan) && !vlPositionIds.has(plan.targetId))),
    'own_fixed',
    'depot',
  )
  pushRow(
    rows,
    'Anbieter-Depotzuflüsse (monatlich)',
    sumAmounts(depotMonthly.filter((plan) => plan.flowType === 'provider')),
    'provider',
    'depot',
  )
  pushRow(
    rows,
    'Eigene Jahresbeiträge – geglättet (Analysewert)',
    smoothedSum(smoothedNonMonthly.filter(isOwn)),
    'own_fixed',
    'depot',
  )
  pushRow(
    rows,
    'Arbeitgeber-Jahresbeiträge – geglättet (Analysewert)',
    smoothedSum(smoothedNonMonthly.filter((plan) => plan.flowType === 'employer')),
    'employer',
    'depot',
  )
  pushRow(
    rows,
    'Eigene Tagesgeld-Raten (monatlich)',
    sumAmounts(cashMonthly.filter(isOwn)),
    'own_fixed',
    'cash',
  )
  return rows
}

// --- Formular (Anlegen + Bearbeiten; key={id} beim Bearbeiten) ---

interface SimFormValues {
  name: string
  startDepotText: string
  startCashText: string
  monthsText: string
  /** Renditeannahme als Prozent-EINGABE (0–15, de-DE). */
  ratePercentText: string
  telekomMode: 'real' | 'smoothed'
  note: string
  contributions: ContributionRow[]
}

const EMPTY_FORM: SimFormValues = {
  name: '',
  startDepotText: '0',
  startCashText: '0',
  monthsText: '12',
  ratePercentText: '0',
  telekomMode: 'real',
  note: '',
  contributions: [],
}

function formValuesFromSimulation(simulation: Simulation): SimFormValues {
  return {
    name: simulation.name,
    startDepotText: amountToInputText(simulation.params.startDepotValue),
    startCashText: amountToInputText(simulation.params.startTagesgeldValue),
    monthsText: String(simulation.params.months),
    ratePercentText: PERCENT_TEXT.format(simulation.params.annualReturnRate * 100),
    telekomMode: simulation.params.telekomMode,
    note: simulation.note ?? '',
    contributions: simulation.params.monthlyContributions.map((contribution) => ({
      label: contribution.label,
      amountText: amountToInputText(contribution.amount),
      flowType: (CONTRIBUTION_FLOW_TYPES as readonly string[]).includes(contribution.flowType)
        ? (contribution.flowType as (typeof CONTRIBUTION_FLOW_TYPES)[number])
        : 'own_fixed',
      target: contribution.target === 'cash' ? 'cash' : 'depot',
    })),
  }
}

function SimulationForm({
  heading,
  submitLabel,
  initial,
  data,
  todayIso,
  onCancel,
  onSubmit,
}: {
  heading: string
  /** Beschriftung des Absende-Buttons („Simulation anlegen“ bzw. „Änderungen übernehmen“). */
  submitLabel: string
  initial: SimFormValues
  data: FinanceData
  todayIso: string
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (input: SimulationInput) => string | null
}) {
  const [values, setValues] = useState<SimFormValues>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Sichtbares Aktions-Feedback beim Auslöser (A11y B2/B5): Startwerte-
  // Übernahme bzw. Vorbelegung/Zeilen-Entfernen als role="status"-Meldung.
  const [startStatus, setStartStatus] = useState<string | null>(null)
  const [contributionStatus, setContributionStatus] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function setField<K extends keyof SimFormValues>(key: K, value: SimFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function setContribution(index: number, changes: Partial<ContributionRow>): void {
    setValues((current) => ({
      ...current,
      contributions: current.contributions.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row,
      ),
    }))
  }

  function addContributionRow(): void {
    setValues((current) => ({
      ...current,
      contributions: [
        ...current.contributions,
        { label: '', amountText: '', flowType: 'own_fixed', target: 'depot' },
      ],
    }))
  }

  function removeContributionRow(index: number): void {
    setValues((current) => ({
      ...current,
      contributions: current.contributions.filter((_, rowIndex) => rowIndex !== index),
    }))
    // A11y B2: der auslösende Button verschwindet mit der Zeile – Feedback als
    // Status plus Fokus auf den bestehen bleibenden „Beitrag hinzufügen“-Button.
    setContributionStatus(`Beitrag ${index + 1} entfernt.`)
    requestAnimationFrame(() => document.getElementById('sim-add-contribution')?.focus())
  }

  // Aktuelle Werte (Seed: Depot 2.522,47 / Tagesgeld 627,59) NUR als
  // Formular-Vorbelegung – nie automatisch (M13).
  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const activeAccounts = data.accounts.filter((account) => account.isActive !== false)
  const currentDepot = depotValue(activePositions)
  const currentCash = cashValue(activeAccounts)
  // G11: ganz ohne bewertete Einträge ist die Summe „unbekannt“, nie 0.
  const depotUnknown =
    activePositions.length > 0 && currentDepot.missingIds.length >= activePositions.length
  const cashAccountCount = activeAccounts.filter((account) => account.type === 'tagesgeld').length
  const cashUnknown = cashAccountCount > 0 && currentCash.missingIds.length >= cashAccountCount

  function applyCurrentValues(): void {
    setValues((current) => ({
      ...current,
      startDepotText: amountToInputText(currentDepot.amount),
      startCashText: amountToInputText(currentCash.amount),
    }))
    setStartStatus(
      `Startwerte ins Formular übernommen: Depot ${depotUnknown ? 'unbekannt' : formatEuro(currentDepot.amount)}, Tagesgeld ${cashUnknown ? 'unbekannt' : formatEuro(currentCash.amount)}.`,
    )
  }

  function applyRealPrefill(): void {
    const rows = realPrefillRows(data, todayIso)
    setValues((current) => ({
      ...current,
      telekomMode: 'real',
      contributions: rows,
    }))
    setContributionStatus(
      `${rows.length} Beitragszeilen befüllt – Telekom-Sicht: real.`,
    )
  }

  function applySmoothedPrefill(): void {
    const rows = smoothedPrefillRows(data, todayIso)
    setValues((current) => ({
      ...current,
      telekomMode: 'smoothed',
      contributions: rows,
    }))
    setContributionStatus(
      `${rows.length} Beitragszeilen befüllt – Telekom-Sicht: geglättet (Analysewert).`,
    )
  }

  const parsedRatePercent = parseGermanAmount(values.ratePercentText)
  const showOptimisticWarning = parsedRatePercent !== null && parsedRatePercent > 8

  // Fokus aufs ERSTE Fehlerfeld nach fehlgeschlagenem Absenden (B3-Muster).
  function focusFirstErrorField(errors: Record<string, string>): void {
    const order = [
      'name',
      'startDepot',
      'startCash',
      ...values.contributions.flatMap((_, index) => [
        `contrib-${index}-label`,
        `contrib-${index}-amount`,
      ]),
      'months',
      'rate',
    ]
    const key = order.find((candidate) => errors[candidate] !== undefined)
    if (key === undefined) return
    const idByKey: Record<string, string> = {
      name: 'sim-name',
      startDepot: 'sim-start-depot',
      startCash: 'sim-start-cash',
      months: 'sim-months',
      rate: 'sim-rate',
    }
    const id =
      idByKey[key] ??
      (key.startsWith('contrib-') ? `sim-${key}` : undefined)
    if (id !== undefined) document.getElementById(id)?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitError(null)
    const errors: Record<string, string> = {}
    if (values.name.trim() === '') {
      errors['name'] = 'Der Name darf nicht leer sein.'
    }
    const startDepot = parseGermanAmount(values.startDepotText)
    if (startDepot === null || startDepot < 0) {
      errors['startDepot'] = 'Bitte einen Betrag ≥ 0 eingeben (z. B. 2.522,47).'
    }
    const startCash = parseGermanAmount(values.startCashText)
    if (startCash === null || startCash < 0) {
      errors['startCash'] = 'Bitte einen Betrag ≥ 0 eingeben (z. B. 627,59).'
    }
    const monthsTrimmed = values.monthsText.trim()
    const months = /^\d+$/.test(monthsTrimmed) ? Number(monthsTrimmed) : Number.NaN
    if (!Number.isInteger(months) || months < 1 || months > 1200) {
      errors['months'] = 'Bitte eine ganze Zahl zwischen 1 und 1200 Monaten eingeben.'
    }
    if (parsedRatePercent === null || parsedRatePercent < 0 || parsedRatePercent > 15) {
      errors['rate'] =
        'Bitte eine Renditeannahme zwischen 0 und 15 Prozent eingeben (z. B. 5 oder 7,5).'
    }
    const contributions: SimulationContributionInput[] = []
    values.contributions.forEach((row, index) => {
      if (row.label.trim() === '') {
        errors[`contrib-${index}-label`] = 'Bitte eine Bezeichnung eingeben.'
      }
      const amount = parseGermanAmount(row.amountText)
      if (amount === null || amount < 0) {
        errors[`contrib-${index}-amount`] = 'Bitte einen Betrag ≥ 0 eingeben (z. B. 93,50).'
      }
      if (amount !== null && amount >= 0) {
        contributions.push({
          label: row.label,
          amount,
          flowType: row.flowType,
          target: row.target,
        })
      }
    })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      focusFirstErrorField(errors)
      return
    }
    setFieldErrors({})
    const input: SimulationInput = {
      name: values.name,
      params: {
        startDepotValue: startDepot!,
        startTagesgeldValue: startCash!,
        months,
        annualReturnRate: parsedRatePercent! / 100,
        monthlyContributions: contributions,
        telekomMode: values.telekomMode,
      },
      note: textOrNull(values.note),
    }
    const error = onSubmit(input)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah zuordnen (Feld-Präfixe).
    const prefixes: [string, string][] = [
      ['Name:', 'name'],
      ['Depot-Startwert:', 'startDepot'],
      ['Tagesgeld-Startwert:', 'startCash'],
      ['Zeitraum:', 'months'],
      ['Rendite:', 'rate'],
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

  const sliderValue = Math.min(15, Math.max(0, parsedRatePercent ?? 0))

  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      {/* h4: die Formulare liegen INNERHALB der Sektion „Gespeicherte Simulationen“ (h3). */}
      <h4>{heading}</h4>
      {/* A11y B7: sichtbare Legende der Pflichtfeld-Markierung. */}
      <p className="app-hint">* = Pflichtfeld</p>
      <div className="form-field">
        <label htmlFor="sim-name">Name *</label>
        <input
          id="sim-name"
          ref={firstFieldRef}
          type="text"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={fieldErrors['name'] !== undefined || undefined}
          aria-describedby={fieldErrors['name'] !== undefined ? 'sim-name-error' : undefined}
        />
        {fieldError('name', 'sim-name-error')}
      </div>
      <div className="form-field">
        <label htmlFor="sim-start-depot">Depot-Startwert in Euro</label>
        <input
          id="sim-start-depot"
          type="text"
          inputMode="decimal"
          value={values.startDepotText}
          onChange={(event) => setField('startDepotText', event.target.value)}
          aria-invalid={fieldErrors['startDepot'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['startDepot'] !== undefined ? 'sim-start-depot-error' : undefined
          }
        />
        {fieldError('startDepot', 'sim-start-depot-error')}
      </div>
      <div className="form-field">
        <label htmlFor="sim-start-cash">Tagesgeld-Startwert in Euro</label>
        <input
          id="sim-start-cash"
          type="text"
          inputMode="decimal"
          value={values.startCashText}
          onChange={(event) => setField('startCashText', event.target.value)}
          aria-invalid={fieldErrors['startCash'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['startCash'] !== undefined ? 'sim-start-cash-error' : undefined
          }
        />
        {fieldError('startCash', 'sim-start-cash-error')}
        <button type="button" onClick={applyCurrentValues}>
          Aktuelle Werte übernehmen
        </button>
        <p className="app-hint">
          Übernimmt die aktuellen Bestandswerte nur ins Formular (Depot{' '}
          {depotUnknown ? 'unbekannt' : formatEuro(currentDepot.amount)}, Tagesgeld{' '}
          {cashUnknown ? 'unbekannt' : formatEuro(currentCash.amount)}) – in die Simulation
          gelangen sie erst mit „{submitLabel}“.
        </p>
        {startStatus !== null ? (
          <p className="app-hint" role="status">
            ✓ {startStatus}
          </p>
        ) : null}
      </div>

      <fieldset className="form-field">
        <legend>Monatliche Beiträge</legend>
        <p className="app-hint">
          Vorbelegungen befüllen nur das Formular (aus den aktiven Sparplänen, M10) – reale und
          geglättete Sicht nie mischen (G9). Variable Zuflüsse ohne festen Betrag (Saveback,
          Round-up) sind nicht enthalten (nicht garantiert).
        </p>
        <div className="toolbar">
          <button type="button" onClick={applyRealPrefill}>
            Vorbelegung: reale Sparraten
          </button>
          <button type="button" onClick={applySmoothedPrefill}>
            Vorbelegung: geglättete Sparraten (Analysewerte)
          </button>
        </div>
        {contributionStatus !== null ? (
          <p className="app-hint" role="status">
            ✓ {contributionStatus}
          </p>
        ) : null}
        {values.contributions.length === 0 ? (
          <p className="app-hint">Noch keine Beiträge – eine Simulation ohne Beiträge ist gültig.</p>
        ) : null}
        {values.contributions.map((row, index) => (
          <div className="sim-contribution-row" key={index}>
            <div className="form-field">
              <label htmlFor={`sim-contrib-${index}-label`}>Bezeichnung Beitrag {index + 1} *</label>
              <input
                id={`sim-contrib-${index}-label`}
                type="text"
                value={row.label}
                onChange={(event) => setContribution(index, { label: event.target.value })}
                aria-invalid={fieldErrors[`contrib-${index}-label`] !== undefined || undefined}
                aria-describedby={
                  fieldErrors[`contrib-${index}-label`] !== undefined
                    ? `sim-contrib-${index}-label-error`
                    : undefined
                }
              />
              {fieldError(`contrib-${index}-label`, `sim-contrib-${index}-label-error`)}
            </div>
            <div className="form-field">
              <label htmlFor={`sim-contrib-${index}-amount`}>
                Betrag Beitrag {index + 1} in Euro pro Monat *
              </label>
              <input
                id={`sim-contrib-${index}-amount`}
                type="text"
                inputMode="decimal"
                value={row.amountText}
                onChange={(event) => setContribution(index, { amountText: event.target.value })}
                aria-invalid={fieldErrors[`contrib-${index}-amount`] !== undefined || undefined}
                aria-describedby={
                  fieldErrors[`contrib-${index}-amount`] !== undefined
                    ? `sim-contrib-${index}-amount-error`
                    : undefined
                }
              />
              {fieldError(`contrib-${index}-amount`, `sim-contrib-${index}-amount-error`)}
            </div>
            <div className="form-field">
              <label htmlFor={`sim-contrib-${index}-flowtype`}>
                Zuflussart Beitrag {index + 1}
              </label>
              <select
                id={`sim-contrib-${index}-flowtype`}
                value={row.flowType}
                onChange={(event) =>
                  setContribution(index, {
                    flowType: event.target.value as (typeof CONTRIBUTION_FLOW_TYPES)[number],
                  })
                }
              >
                {CONTRIBUTION_FLOW_TYPES.map((flowType) => (
                  <option key={flowType} value={flowType}>
                    {FLOW_TYPE_LABELS[flowType]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`sim-contrib-${index}-target`}>Ziel Beitrag {index + 1}</label>
              <select
                id={`sim-contrib-${index}-target`}
                value={row.target}
                onChange={(event) =>
                  setContribution(index, {
                    target: event.target.value as SimulationContributionTarget,
                  })
                }
              >
                <option value="depot">{TARGET_LABELS.depot}</option>
                <option value="cash">{TARGET_LABELS.cash}</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={() => removeContributionRow(index)}
            >
              Beitrag {index + 1} entfernen
            </button>
          </div>
        ))}
        <button id="sim-add-contribution" type="button" onClick={addContributionRow}>
          Beitrag hinzufügen
        </button>
      </fieldset>

      <div className="form-field">
        <label htmlFor="sim-months">Zeitraum in Monaten (1–1200) *</label>
        <input
          id="sim-months"
          type="text"
          inputMode="numeric"
          value={values.monthsText}
          onChange={(event) => setField('monthsText', event.target.value)}
          aria-invalid={fieldErrors['months'] !== undefined || undefined}
          aria-describedby={fieldErrors['months'] !== undefined ? 'sim-months-error' : undefined}
        />
        {fieldError('months', 'sim-months-error')}
        <div className="toolbar">
          {[12, 60, 120].map((quick) => (
            <button
              key={quick}
              type="button"
              className="btn-sm"
              onClick={() => setField('monthsText', String(quick))}
            >
              {quick} Monate
            </button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="sim-rate">Jährliche Renditeannahme in Prozent (0–15)</label>
        <input
          id="sim-rate"
          type="text"
          inputMode="decimal"
          value={values.ratePercentText}
          onChange={(event) => setField('ratePercentText', event.target.value)}
          aria-invalid={fieldErrors['rate'] !== undefined || undefined}
          aria-describedby={
            fieldErrors['rate'] !== undefined
              ? 'sim-rate-error'
              : showOptimisticWarning
                ? 'sim-rate-warning'
                : 'sim-rate-hint'
          }
        />
        {fieldError('rate', 'sim-rate-error')}
        <label htmlFor="sim-rate-slider">Renditeannahme (Schnellwahl)</label>
        <input
          id="sim-rate-slider"
          type="range"
          min={0}
          max={15}
          step={0.25}
          value={sliderValue}
          // A11y B4: deutscher Wertetext statt roher Zahl; Warnung/Hinweis
          // sind auch am Slider verknüpft.
          aria-valuetext={`${PERCENT_TEXT.format(sliderValue)} % pro Jahr`}
          aria-describedby={
            fieldErrors['rate'] !== undefined
              ? 'sim-rate-error'
              : showOptimisticWarning
                ? 'sim-rate-warning'
                : 'sim-rate-hint'
          }
          onChange={(event) =>
            setField('ratePercentText', PERCENT_TEXT.format(Number(event.target.value)))
          }
        />
        {showOptimisticWarning ? (
          <p id="sim-rate-warning" className="field-warning" role="status">
            ⚠ Mehr als 8 % pro Jahr ist eine sehr optimistische Annahme.
          </p>
        ) : (
          <p id="sim-rate-hint" className="app-hint">
            0 % bedeutet „Projektion ohne Kursentwicklung“. Negative Annahmen sind in Version 1
            nicht vorgesehen.
          </p>
        )}
      </div>
      <div className="form-field">
        <label htmlFor="sim-telekom-mode">Telekom-Jahreszufluss</label>
        <select
          id="sim-telekom-mode"
          value={values.telekomMode}
          onChange={(event) =>
            setField('telekomMode', event.target.value as 'real' | 'smoothed')
          }
        >
          <option value="real">{TELEKOM_MODE_LABELS.real}</option>
          <option value="smoothed">{TELEKOM_MODE_LABELS.smoothed}</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="sim-note">Notiz (z. B. Annahmen des Szenarios)</label>
        <input
          id="sim-note"
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

// --- Erklärblock (Details-Muster) ---

function SimulatorRules() {
  return (
    <details className="model-hint">
      <summary>So rechnet der Simulator (Modell und Grenzen)</summary>
      <ul>
        <li>
          Aggregatmodell: nur Tagesgeld + Depot (Gesamtvermögen). Der erste projizierte Monat ist
          der FOLGEMONAT des Stichtags; Monat 0 der Tabelle zeigt die Startwerte.
        </li>
        <li>
          Rendite: konstante jährliche Annahme 0–15 %, umgerechnet mit dem geometrischen
          Monatsfaktor (1 + r)^(1/12). Verzinst wird NUR das Depot (keine
          Tagesgeld-Zinsannahme); je Monat wird erst der Bestand verzinst, dann kommen die
          Beiträge dazu (Beiträge des Monats werden im Zuführungsmonat nicht verzinst –
          konservative Regel).
        </li>
        <li>
          Telekom-Jahreszufluss: „real“ = Ereignis im Juli über 1.500 € (1.000 € eigene
          Sparleistung + 500 € Arbeitgeberbonus, G8-getrennt); „geglättet“ = 125 €/Monat als
          gekennzeichnete Analysewerte in den Beiträgen – nie beides zugleich (G9).
        </li>
        <li>
          Eigene Sparleistung und Gesamtzufluss werden getrennt summiert (G8); Umbuchungen sind in
          Simulationen unzulässig (G7).
        </li>
        <li>
          Bewusst NICHT enthalten (dokumentiert): keine Inflations- oder Steuermodellierung, keine
          Monte-Carlo-/Wahrscheinlichkeitsrechnung, keine negativen Renditen, kein
          Rebalancing-Schalter (Rebalancing verschiebt nur INNERHALB des Depots und ändert die
          projizierten Aggregate nicht – Annahmen dazu gehören ins Notiz-Feld).
        </li>
        <li>
          Simulationen speichern nur Parameter, nie Ergebnisse – und ändern nie Konten, Depot,
          Sparpläne oder Ziele.
        </li>
      </ul>
    </details>
  )
}

// --- Diagramm (handgerolltes inline-SVG, NUR Zusatz zur Tabelle) ---

const CHART_WIDTH = 640
const CHART_HEIGHT = 260
const CHART_PAD_LEFT = 8
const CHART_PAD_RIGHT = 8
const CHART_PAD_TOP = 12
const CHART_PAD_BOTTOM = 24

/** Validierte Serienfarben (hell + dunkel CVD-geprüft); Strichmuster als Zweitkodierung. */
const CHART_SERIES = [
  { key: 'total', label: 'Gesamtvermögen (durchgezogen)', color: '#059669', dash: undefined },
  { key: 'depot', label: 'Depot (gestrichelt)', color: '#2563eb', dash: '7 4' },
  { key: 'cash', label: 'Tagesgeld (gepunktet)', color: '#b45309', dash: '2 4' },
] as const

function seriesValue(point: SimulationMonthPoint, key: (typeof CHART_SERIES)[number]['key']): number {
  return key === 'total' ? point.total : key === 'depot' ? point.depot : point.cash
}

function SimulationChart({
  points,
  todayIso,
}: {
  points: readonly SimulationMonthPoint[]
  todayIso: string
}) {
  const maxIndex = points[points.length - 1].monthIndex
  const maxValueRaw = Math.max(...points.map((point) => point.total))
  // F20-Schutz: bei komplett leerer Reihe (alles 0) keine Division durch 0.
  const maxValue = maxValueRaw > 0 ? maxValueRaw : 1
  const innerWidth = CHART_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT
  const innerHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM
  const x = (monthIndex: number): number =>
    CHART_PAD_LEFT + (maxIndex === 0 ? 0 : (monthIndex / maxIndex) * innerWidth)
  const y = (value: number): number => CHART_PAD_TOP + innerHeight - (value / maxValue) * innerHeight
  const polyline = (key: (typeof CHART_SERIES)[number]['key']): string =>
    points.map((point) => `${x(point.monthIndex).toFixed(2)},${y(seriesValue(point, key)).toFixed(2)}`).join(' ')
  return (
    <div className="sim-chart" aria-hidden="true">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="presentation" focusable="false">
        {/* Recessive Gitterlinien bei 0 / 50 % / 100 % des Maximums. */}
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={CHART_PAD_LEFT}
              x2={CHART_WIDTH - CHART_PAD_RIGHT}
              y1={y(maxValue * fraction)}
              y2={y(maxValue * fraction)}
              stroke="currentColor"
              strokeOpacity={fraction === 0 ? 0.5 : 0.18}
              strokeWidth={1}
            />
            <text
              x={CHART_PAD_LEFT + 2}
              y={y(maxValue * fraction) - 3}
              fontSize="10"
              fill="currentColor"
              fillOpacity={0.75}
            >
              {formatEuro(roundToUnit(maxValue * fraction, 1))}
            </text>
          </g>
        ))}
        {CHART_SERIES.map((series) => (
          <polyline
            key={series.key}
            points={polyline(series.key)}
            fill="none"
            stroke={series.color}
            strokeWidth={series.key === 'total' ? 2.5 : 2}
            strokeDasharray={series.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <text
          x={CHART_PAD_LEFT}
          y={CHART_HEIGHT - 8}
          fontSize="10"
          fill="currentColor"
          fillOpacity={0.75}
        >
          {formatIsoMonthGerman(projectionMonthIso(todayIso, 0))} (Start)
        </text>
        <text
          x={CHART_WIDTH - CHART_PAD_RIGHT}
          y={CHART_HEIGHT - 8}
          fontSize="10"
          textAnchor="end"
          fill="currentColor"
          fillOpacity={0.75}
        >
          {formatIsoMonthGerman(projectionMonthIso(todayIso, maxIndex))}
        </text>
      </svg>
      <ul className="sim-chart-legend">
        {CHART_SERIES.map((series) => (
          <li key={series.key}>
            <svg width="28" height="10" role="presentation" focusable="false">
              <line
                x1="1"
                x2="27"
                y1="5"
                y2="5"
                stroke={series.color}
                strokeWidth={2.5}
                strokeDasharray={series.dash}
              />
            </svg>
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- Detailansicht ---

function VerlaufTable({
  points,
  todayIso,
  caption,
  regionLabel,
}: {
  points: readonly SimulationMonthPoint[]
  todayIso: string
  caption: string
  regionLabel: string
}) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={regionLabel}>
      <table className="accounts-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Monat</th>
            <th scope="col" className="num">Tagesgeld</th>
            <th scope="col" className="num">Depot</th>
            <th scope="col" className="num">Gesamtvermögen</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.monthIndex}>
              <th scope="row">
                {formatIsoMonthGerman(projectionMonthIso(todayIso, point.monthIndex))}
                {point.monthIndex === 0 ? ' (Start)' : ` (Monat ${point.monthIndex})`}
              </th>
              <td className="num">{formatEuro(point.cash)}</td>
              <td className="num">{formatEuro(point.depot)}</td>
              <td className="num">{formatEuro(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SimulationDetail({
  simulation,
  data,
  fund,
  todayIso,
  onClose,
}: {
  simulation: Simulation
  data: FinanceData
  fund: EmergencyFund
  todayIso: string
  onClose: () => void
}) {
  const startMonth = firstProjectionStartMonth(todayIso)
  const result = simulateScenario(simulation.params, startMonth)
  const summary = summarizeSimulation(result)
  const analyses = analyzeGoalsInSimulation(data.goals, fund, result.points, todayIso)
  const disclaimer = projectionDisclaimer(result.annualReturnRate)
  const months = result.months
  // Verlaufstabelle: bei > 24 Monaten Jahresschritte + letzte Zeile; die
  // vollständigen Monatsdaten bleiben über das Details-Element erreichbar –
  // die Tabelle ist die PRIMÄRquelle, das Diagramm nur Zusatz.
  const compact = months > 24
  const compactPoints = compact
    ? result.points.filter(
        (point) => point.monthIndex % 12 === 0 || point.monthIndex === months,
      )
    : result.points
  const firstIso = projectionMonthIso(todayIso, 1)
  const endIso = projectionMonthIso(todayIso, months)
  return (
    <section aria-labelledby="sim-detail-title">
      <h3 id="sim-detail-title" tabIndex={-1}>
        Detailansicht: {simulation.name}
      </h3>
      <p className="simulation-banner" role="note">
        <strong>{disclaimer}.</strong> Zeitraum: ab {formatIsoMonthGerman(firstIso)} (Folgemonat
        des Stichtags), {months} {months === 1 ? 'Monat' : 'Monate'} (bis{' '}
        {formatIsoMonthGerman(endIso)}) – Telekom-Sicht: {TELEKOM_MODE_SHORT[result.telekomMode]}.
      </p>
      <dl className="kpi-grid">
        <div className="kpi-tile">
          <dt>Endvermögen (projiziert)</dt>
          <dd>
            <span>{formatEuro(summary.endTotal)}</span>
            <span className="kpi-note">
              Depot {formatEuro(summary.endDepot)} · Tagesgeld {formatEuro(summary.endCash)}
            </span>
          </dd>
        </div>
        <div className="kpi-tile">
          <dt>Eingezahlt gesamt</dt>
          <dd>
            <span>{formatEuro(summary.contributedTotal)}</span>
            <span className="kpi-note">alle Zuflüsse inkl. Arbeitgeber/Anbieter</span>
          </dd>
        </div>
        <div className="kpi-tile">
          <dt>Davon eigene Sparleistung</dt>
          <dd>
            <span>{formatEuro(summary.contributedOwn)}</span>
            <span className="kpi-note">nur eigenes Geld – getrennte Kennzahl (G8)</span>
          </dd>
        </div>
        <div className="kpi-tile">
          <dt>Wertzuwachs aus der Annahme</dt>
          <dd>
            <span>
              {summary.growthFromAssumption === null
                ? 'entfällt (0 %)'
                : formatEuro(summary.growthFromAssumption)}
            </span>
            <span className="kpi-note">
              rechnerischer Wertzuwachs aus der Annahme – keine Prognose
            </span>
          </dd>
        </div>
      </dl>

      <h4>Verlaufstabelle</h4>
      {compact ? (
        // A11y B6: die kompakte Tabelle ist sichtbar als Jahresschritte gekennzeichnet.
        <p className="app-hint">
          Jahresschritte – die Zwischenmonate stehen unter „Alle {months} Monate anzeigen
          (vollständige Tabelle)“.
        </p>
      ) : null}
      <VerlaufTable
        points={compactPoints}
        todayIso={todayIso}
        caption={
          compact
            ? `Verlauf der Simulation ${simulation.name} in Jahresschritten (${disclaimer}); die vollständigen Monatswerte stehen im aufklappbaren Bereich darunter`
            : `Verlauf der Simulation ${simulation.name} (${disclaimer})`
        }
        regionLabel="Verlaufstabelle (horizontal scrollbar)"
      />
      {compact ? (
        <details className="model-hint">
          <summary>Alle {months} Monate anzeigen (vollständige Tabelle)</summary>
          <VerlaufTable
            points={result.points}
            todayIso={todayIso}
            caption={`Vollständiger monatlicher Verlauf der Simulation ${simulation.name}`}
            regionLabel="Vollständige Verlaufstabelle (horizontal scrollbar)"
          />
        </details>
      ) : null}

      <h4>Diagramm (Zusatz)</h4>
      <p className="app-hint">
        Das Diagramm ist nur eine ergänzende Darstellung – alle Werte stehen in der Tabelle
        {compact
          ? `; die vollständigen Monatswerte enthält „Alle ${months} Monate anzeigen (vollständige Tabelle)“.`
          : '.'}
      </p>
      <SimulationChart points={result.points} todayIso={todayIso} />

      <h4>Zielanalyse</h4>
      <p className="app-hint" role="note">
        {disclaimer}. Die Zielanalyse ist eine Projektion mit Annahme – keine Prognose.
        Archivierte und pausierte Ziele sind ausgenommen.
      </p>
      {analyses.length === 0 ? (
        <p className="app-hint">Der geladene Bestand enthält keine analysierbaren Ziele.</p>
      ) : (
        <ul className="goal-list">
          {analyses.map((analysis) => (
            <li key={analysis.goal.id}>
              <p className="goal-heading">
                <strong>{analysis.goal.name}</strong> –{' '}
                <span className={OUTCOME_BADGES[analysis.outcome]}>
                  {OUTCOME_SYMBOLS[analysis.outcome]} {OUTCOME_LABELS[analysis.outcome]}
                </span>
              </p>
              <p>{analysis.reason}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="row-actions">
        <button type="button" onClick={onClose}>
          Detailansicht schließen
        </button>
      </div>
    </section>
  )
}

// --- Seite ---

type EditorState = { kind: 'closed' } | { kind: 'add' } | { kind: 'edit'; simulationId: string }

export function SimulatorPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions, todayIso } = useFinanceData()
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  const [detailId, setDetailId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
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
        <h2 id="page-title">Simulation</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  const loadedData: FinanceData = data
  const fund = data.settings.emergencyFund
  const simulations = data.simulations
  const detailSimulation =
    detailId === null ? null : (simulations.find((entry) => entry.id === detailId) ?? null)
  const editingSimulation =
    editor.kind === 'edit'
      ? (simulations.find((entry) => entry.id === editor.simulationId) ?? null)
      : null
  const startMonth = firstProjectionStartMonth(todayIso)

  // --- Editor-Handling (Fokusführung wie GoalsPage) ---

  function openEditor(next: EditorState, trigger: HTMLButtonElement | null): void {
    triggerRef.current = trigger
    setActionError(null)
    setActionSuccess(null)
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
   * Übernahme (K3-Muster).
   */
  function applyResult(result: SimulationActionResult, closeAfter: boolean): string | null {
    if (!result.ok) return result.error
    if (JSON.stringify(result.data) !== JSON.stringify(loadedData)) {
      actions.applyDataChange(result.data)
    }
    if (closeAfter) closeEditor()
    return null
  }

  function handleAddSubmit(input: SimulationInput): string | null {
    return applyResult(addSimulation(loadedData, input, todayIso), true)
  }

  function handleEditSubmit(simulationId: string, input: SimulationInput): string | null {
    return applyResult(
      updateSimulation(loadedData, simulationId, {
        name: input.name,
        params: input.params,
        note: input.note,
      }),
      true,
    )
  }

  function handleDuplicate(simulation: Simulation): void {
    setActionError(null)
    setActionSuccess(null)
    const error = applyResult(duplicateSimulation(loadedData, simulation.id, todayIso), false)
    if (error !== null) {
      setActionError(error)
      return
    }
    setActionSuccess(
      `Die Simulation „${simulation.name}“ wurde kopiert – die Kopie ist ein eigenständiger Entwurf mit heutigem Datum.`,
    )
  }

  function handleDelete(simulation: Simulation): void {
    setActionError(null)
    setActionSuccess(null)
    // G12: Löschen NUR mit Bestätigung inkl. Name; Abbruch ändert nichts.
    const proceed = window.confirm(
      `Simulation „${simulation.name}“ endgültig löschen?\n\nGespeicherte Simulationen sind reine Szenario-Entwürfe – das Löschen ändert keine Konten, Depotwerte, Sparpläne oder Ziele. Dieser Schritt kann nicht rückgängig gemacht werden.`,
    )
    if (!proceed) return
    const error = applyResult(deleteSimulation(loadedData, simulation.id), false)
    if (error !== null) {
      setActionError(error)
      return
    }
    if (detailId === simulation.id) setDetailId(null)
    setCompareIds((current) => current.filter((id) => id !== simulation.id))
    if (editor.kind === 'edit' && editor.simulationId === simulation.id) {
      setEditor({ kind: 'closed' })
    }
    setActionSuccess(`Die Simulation „${simulation.name}“ wurde gelöscht.`)
    // Fokus-Anker (M11-B1-Muster): der auslösende Button verschwindet mit der
    // Karte – der Fokus landet auf der Listenüberschrift.
    requestAnimationFrame(() => document.getElementById('simulator-list-title')?.focus())
  }

  function handleShowDetail(simulationId: string): void {
    setDetailId(simulationId)
    requestAnimationFrame(() => document.getElementById('sim-detail-title')?.focus())
  }

  /**
   * Fokus-Rückgabe beim Schließen der Detailansicht (A11y B1): der Fokus
   * landet auf dem Karten-Anker der Simulation statt auf document.body.
   */
  function handleCloseDetail(simulationId: string): void {
    setDetailId(null)
    requestAnimationFrame(() =>
      document.getElementById(`sim-card-heading-${simulationId}`)?.focus(),
    )
  }

  function toggleCompare(simulationId: string): void {
    setCompareIds((current) =>
      current.includes(simulationId)
        ? current.filter((id) => id !== simulationId)
        : [...current, simulationId],
    )
  }

  // --- Vergleich (reine Ableitung, nichts wird gespeichert) ---

  const compareSelection = simulations.filter((simulation) => compareIds.includes(simulation.id))
  const comparison = compareSimulations(
    compareSelection.map((simulation) => ({
      name: simulation.name,
      result: simulateScenario(simulation.params, startMonth),
    })),
  )
  // React-Schlüssel und Status-Zuordnung über die ID (Prüfkette B3/N1) – die
  // Spalten von compareSimulations stehen in der Reihenfolge der Auswahl.
  const comparisonColumns =
    comparison === null
      ? []
      : comparison.columns.map((column, index) => ({
          ...column,
          id: compareSelection[index].id,
        }))
  const goalShortStatusById = new Map(
    compareSelection.map((simulation) => {
      const analyses = analyzeGoalsInSimulation(
        loadedData.goals,
        fund,
        simulateScenario(simulation.params, startMonth).points,
        todayIso,
      )
      const projectable = analyses.filter((analysis) => analysis.outcome !== 'no-statement')
      const reachable = projectable.filter((analysis) => analysis.outcome === 'reachable')
      return [
        simulation.id,
        projectable.length === 0
          ? 'keine projizierbaren Ziele'
          : `${reachable.length} von ${projectable.length} projizierbaren Zielen erreichbar`,
      ] as const
    }),
  )

  return (
    <section className="page" aria-labelledby="page-title" onKeyDown={handleKeyDown}>
      <h2 id="page-title">Simulation</h2>
      <p className="simulation-banner" role="note">
        <strong>Projektion – keine Prognose, keine Anlageberatung.</strong> Simulationen ändern
        nie Konten, Depot, Sparpläne oder Ziele.
      </p>
      <p className="app-hint page-lead">
        Szenarien der Vermögensentwicklung aus Sparraten und optionaler Renditeannahme (Stichtag:{' '}
        {formatIsoDateGerman(todayIso)}; projiziert wird ab dem Folgemonat). Gespeichert werden
        nur die Parameter – Ergebnisse werden bei jeder Anzeige neu berechnet.
      </p>
      <SimulatorRules />

      {/* --- A: Übersicht --- */}
      <section aria-labelledby="simulator-overview-title">
        <h3 id="simulator-overview-title">Übersicht</h3>
        <dl className="kpi-grid">
          <div className="kpi-tile">
            <dt>Gespeicherte Simulationen</dt>
            <dd>
              <span>{simulations.length}</span>
              <span className="kpi-note">
                Simulationen sind vollständig von den echten Finanzdaten getrennt
              </span>
            </dd>
          </div>
          <div className="kpi-tile">
            <dt>Projektionsstart</dt>
            <dd>
              <span>{formatIsoMonthGerman(projectionMonthIso(todayIso, 1))}</span>
              <span className="kpi-note">Folgemonat des Stichtags (F22)</span>
            </dd>
          </div>
        </dl>
        <p className="app-hint">
          Export: Gespeicherte Simulationen sind Teil der JSON-Datei und werden über „Daten &amp;
          Backups“ exportiert und gesichert – es gibt bewusst keinen eigenen Simulations-Export.
        </p>
      </section>

      {/* --- B: Liste gespeicherter Simulationen --- */}
      <section aria-labelledby="simulator-list-title">
        <h3 id="simulator-list-title" tabIndex={-1}>
          Gespeicherte Simulationen
        </h3>
        <div className="toolbar">
          <button
            type="button"
            className="btn-primary"
            onClick={(event) => openEditor({ kind: 'add' }, event.currentTarget)}
            disabled={state.isSaving || editor.kind === 'add'}
          >
            <Icon name="plus" />
            Neue Simulation
          </button>
        </div>
        {actionError !== null ? (
          <p className="operation-error" role="alert">
            ⚠ {actionError}
          </p>
        ) : null}
        {actionSuccess !== null ? (
          <p className="success-note" role="status">
            ✓ {actionSuccess}
          </p>
        ) : null}

        {editor.kind === 'add' ? (
          <SimulationForm
            heading="Neue Simulation"
            submitLabel="Simulation anlegen"
            initial={EMPTY_FORM}
            data={loadedData}
            todayIso={todayIso}
            onCancel={closeEditor}
            onSubmit={handleAddSubmit}
          />
        ) : null}
        {editor.kind === 'edit' && editingSimulation !== null ? (
          <SimulationForm
            // key erzwingt eine frische Formularinstanz je Simulation (M8-Lehre).
            key={editingSimulation.id}
            heading={`Simulation bearbeiten: ${editingSimulation.name}`}
            submitLabel="Änderungen übernehmen"
            initial={formValuesFromSimulation(editingSimulation)}
            data={loadedData}
            todayIso={todayIso}
            onCancel={closeEditor}
            onSubmit={(input) => handleEditSubmit(editingSimulation.id, input)}
          />
        ) : null}

        {simulations.length === 0 ? (
          <p className="app-hint">
            Noch keine gespeicherten Simulationen. Lege mit „Neue Simulation“ das erste Szenario
            an – die Vorbelegungen übernehmen deine aktuellen Sparraten ins Formular.
          </p>
        ) : (
          <ul className="goal-list">
            {simulations.map((simulation) => {
              const contributionSum = simulation.params.monthlyContributions.reduce(
                (sum, contribution) => sum + contribution.amount,
                0,
              )
              return (
                <li key={simulation.id}>
                  <p className="goal-heading" id={`sim-card-heading-${simulation.id}`} tabIndex={-1}>
                    <strong>{simulation.name}</strong> – angelegt am{' '}
                    {formatIsoDateGerman(simulation.createdAt.slice(0, 10))}
                  </p>
                  <p>
                    Startwerte: Depot {formatEuro(simulation.params.startDepotValue)} · Tagesgeld{' '}
                    {formatEuro(simulation.params.startTagesgeldValue)}
                  </p>
                  <p>
                    Zeitraum: {simulation.params.months}{' '}
                    {simulation.params.months === 1 ? 'Monat' : 'Monate'} · Rendite:{' '}
                    {PERCENT_TEXT.format(simulation.params.annualReturnRate * 100)} % p. a. ·
                    Telekom: {TELEKOM_MODE_SHORT[simulation.params.telekomMode]}
                  </p>
                  <p>
                    Beiträge: {formatEuro(contributionSum)} pro Monat (
                    {simulation.params.monthlyContributions.length}{' '}
                    {simulation.params.monthlyContributions.length === 1
                      ? 'Beitrag'
                      : 'Beiträge'}
                    )
                    {simulation.params.telekomMode === 'real'
                      ? ` zzgl. Jahresereignis ${formatEuro(TELEKOM_ANNUAL_EVENT.totalAmount)} im Juli`
                      : ''}
                  </p>
                  <p className="app-hint">{projectionDisclaimer(simulation.params.annualReturnRate)}</p>
                  {simulation.note != null && simulation.note !== '' ? (
                    <p>Notiz: {simulation.note}</p>
                  ) : null}
                  <div className="row-actions">
                    <button
                      type="button"
                      aria-label={`Simulation „${simulation.name}“ ansehen`}
                      onClick={() => handleShowDetail(simulation.id)}
                      disabled={state.isSaving}
                    >
                      Ansehen
                    </button>
                    <button
                      type="button"
                      aria-label={`Simulation „${simulation.name}“ bearbeiten`}
                      onClick={(event) =>
                        openEditor(
                          { kind: 'edit', simulationId: simulation.id },
                          event.currentTarget,
                        )
                      }
                      disabled={state.isSaving}
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      aria-label={`Simulation „${simulation.name}“ kopieren`}
                      onClick={() => handleDuplicate(simulation)}
                      disabled={state.isSaving}
                    >
                      Kopieren
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label={`Simulation „${simulation.name}“ löschen`}
                      onClick={() => handleDelete(simulation)}
                      disabled={state.isSaving}
                    >
                      Löschen
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* --- C: Detailansicht --- */}
      {detailSimulation !== null ? (
        <SimulationDetail
          key={detailSimulation.id}
          simulation={detailSimulation}
          data={loadedData}
          fund={fund}
          todayIso={todayIso}
          onClose={() => handleCloseDetail(detailSimulation.id)}
        />
      ) : null}

      {/* --- D: Vergleich --- */}
      <section aria-labelledby="simulator-compare-title">
        <h3 id="simulator-compare-title">Vergleich</h3>
        {simulations.length < 2 ? (
          <p className="app-hint">
            Für einen Vergleich braucht es mindestens zwei gespeicherte Simulationen.
          </p>
        ) : (
          <>
            <div className="filter-bar" role="group" aria-label="Simulationen für den Vergleich wählen">
              {simulations.map((simulation) => (
                <label key={simulation.id} className="sim-compare-choice">
                  <input
                    type="checkbox"
                    checked={compareIds.includes(simulation.id)}
                    onChange={() => toggleCompare(simulation.id)}
                  />{' '}
                  {/* Anlagedatum zur Unterscheidbarkeit gleich benannter Entwürfe (B3). */}
                  {simulation.name} (vom {formatIsoDateGerman(simulation.createdAt.slice(0, 10))})
                </label>
              ))}
            </div>
            {comparison === null ? (
              <p className="app-hint">
                Bitte mindestens zwei Simulationen auswählen, um sie zu vergleichen.
              </p>
            ) : (
              <>
                {comparison.viewsMixed ? (
                  <p className="warning-note">
                    ⚠ Der Vergleich mischt reale und geglättete Telekom-Sichten – die Zeilen sind
                    entsprechend gekennzeichnet; die Sichten bleiben getrennte Betrachtungen (G9).
                  </p>
                ) : null}
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Vergleichstabelle (horizontal scrollbar)"
                >
                  <table className="accounts-table">
                    <caption className="visually-hidden">Vergleich der gewählten Simulationen</caption>
                    <thead>
                      <tr>
                        <th scope="col">Kennzahl</th>
                        {comparisonColumns.map((column) => (
                          <th key={column.id} scope="col" className="num">
                            {column.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Annahme (Rendite p. a.)</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">
                            {PERCENT_TEXT.format(column.annualReturnRate * 100)} %
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Zeitraum</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">
                            {column.months} {column.months === 1 ? 'Monat' : 'Monate'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Telekom-Sicht</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id}>{TELEKOM_MODE_SHORT[column.telekomMode]}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Endvermögen (projiziert)</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">{formatEuro(column.endTotal)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Davon Depot</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">{formatEuro(column.endDepot)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Davon Tagesgeld (Liquidität)</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">{formatEuro(column.endCash)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Eingezahlt gesamt</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">
                            {formatEuro(column.contributedTotal)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Davon eigene Sparleistung (G8)</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">
                            {formatEuro(column.contributedOwn)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Wertzuwachs aus der Annahme</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id} className="num">
                            {column.growthFromAssumption === null
                              ? 'entfällt (0 %)'
                              : formatEuro(column.growthFromAssumption)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">Zielerreichung (kurz)</th>
                        {comparisonColumns.map((column) => (
                          <td key={column.id}>
                            {goalShortStatusById.get(column.id) ?? 'keine Angabe'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="app-hint" role="note">
                  Alle Werte sind Projektionen (keine Prognose, keine Anlageberatung); die
                  Kennzeichnung je Simulation steht in der Karte und der Detailansicht.
                </p>
              </>
            )}
          </>
        )}
      </section>
    </section>
  )
}
