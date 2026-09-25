/**
 * Modul „Depot“ (M9): Übersicht mit Kennzahlen-Kacheln und sortierbarer
 * Positionsliste, Verwaltung (Anlegen/Bearbeiten/Deaktivieren/Wert erfassen),
 * Snapshot-Vollerfassung und Zielvergleich (nur Anzeige).
 *
 * Keine Finanzlogik in Komponenten: alle Datenänderungen laufen über die
 * reinen Funktionen in src/data/positions.ts und src/data/snapshot.ts
 * (+ applyDataChange → DATA_CHANGED, setzt isDirty); alle Kennzahlen kommen
 * aus src/finance (latestEntry, cashValue, depotValue, groupTotal, share,
 * targetValues, deviationPp, buyRequirement, sellRequirement, actionLevel).
 * Inaktive Positionen fließen in keine aktive Summe ein – die Filterung
 * übernimmt diese Seite als Aufrufer (isPositionActive).
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type {
  Account,
  AssetClass,
  FinanceData,
  PortfolioPosition,
  PositionGroup,
  TargetProfile,
} from '../types/finance'
import {
  actionLevel,
  buyRequirement,
  cashValue,
  depotValue,
  deviationPp,
  groupTotal,
  latestEntry,
  sellRequirement,
  share,
  targetValues,
  totalWealth,
  validateWeights,
  worldTotal,
} from '../finance'
import type { ActionLevel } from '../finance/targets'
import { formatEuro, parseGermanAmount } from '../format/money'
import { formatIsoDateGerman } from '../format/date'
import {
  POSITION_GROUPS,
  addPosition,
  isPositionActive,
  setPositionActive,
  setPositionValue,
  updatePosition,
} from '../data/positions'
import type { PositionActionResult } from '../data/positions'
import { captureSnapshot, isBackdatedBeforeLatestSnapshot } from '../data/snapshot'
import { useFinanceData } from '../state/useFinanceData'

// --- Deutsche Labels (UI) ---

const GROUP_LABELS: Record<PositionGroup, string> = {
  world: 'World',
  em: 'Emerging Markets',
  gold: 'Gold',
  telekom: 'Telekom',
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  etf: 'ETF',
  etc: 'ETC',
  stock: 'Aktie',
}

const ACTION_LEVEL_LABELS: Record<ActionLevel, string> = {
  none: '–',
  recommendation: 'Empfehlung',
  'recommendation-with-sale-option': 'Empfehlung inkl. Verkaufsoption',
}

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

/** Lokales Kalenderdatum (JJJJ-MM-TT) als Vorbelegung der Datumsfelder. */
function localTodayIso(): string {
  const now = new Date()
  const pad2 = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

/** Prozentpunkte mit Vorzeichen (F14: vorzeichenbehaftet, Farbe nie einziges Signal). */
function formatPp(pp: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const text = format.format(pp)
  return pp > 0 ? `+${text} Pp` : `${text} Pp`
}

/** Betrag als de-DE-Eingabetext (parseGermanAmount-kompatibel, z. B. "1.234,56"). */
function amountToInputText(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Dubletten-Prüfung (nur Warnung, kein Blocker): gleiche nicht-null-ISIN
 * (getrimmt, case-insensitiv) im selben Depotkonto.
 */
function findIsinDuplicate(
  positions: readonly PortfolioPosition[],
  isin: string,
  accountId: string,
  excludeId: string | null,
): PortfolioPosition | null {
  const normalized = isin.trim().toLowerCase()
  if (normalized === '') return null
  return (
    positions.find(
      (position) =>
        position.id !== excludeId &&
        position.accountId === accountId &&
        typeof position.isin === 'string' &&
        position.isin.trim().toLowerCase() === normalized,
    ) ?? null
  )
}

// --- Positions-Formular (Hinzufügen + Bearbeiten, gleiche Komponente) ---

interface PositionFormValues {
  name: string
  group: PositionGroup
  accountId: string
  /** '' = kein Asset-Typ gewählt (Feld bleibt weg, §3.4). */
  assetClass: '' | AssetClass
  isin: string
  note: string
}

function PositionForm({
  heading,
  initial,
  groupEditable,
  depotAccounts,
  positions,
  excludeId,
  onCancel,
  onSubmit,
}: {
  heading: string
  initial: PositionFormValues
  /** Nur beim Hinzufügen wählbar; beim Bearbeiten ist die Gruppe read-only mit Begründung. */
  groupEditable: boolean
  depotAccounts: readonly Account[]
  positions: readonly PortfolioPosition[]
  /** Beim Bearbeiten die eigene Position aus der Dubletten-Prüfung ausnehmen. */
  excludeId: string | null
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (values: PositionFormValues) => string | null
}) {
  const [values, setValues] = useState<PositionFormValues>(initial)
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  // Fokus nach dem Öffnen auf das erste Feld (Phase E).
  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function setField<K extends keyof PositionFormValues>(
    key: K,
    value: PositionFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitError(null)
    if (values.name.trim() === '') {
      setNameError('Der Name darf nicht leer sein.')
      return
    }
    setNameError(null)
    const error = onSubmit(values)
    if (error !== null) setSubmitError(error)
  }

  const selectedAccount = depotAccounts.find((account) => account.id === values.accountId) ?? null
  const selectedAccountInactive = selectedAccount !== null && !isAccountActive(selectedAccount)
  const duplicate = findIsinDuplicate(positions, values.isin, values.accountId, excludeId)

  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      <h3>{heading}</h3>
      <div className="form-field">
        <label htmlFor="position-name">Name *</label>
        <input
          id="position-name"
          ref={firstFieldRef}
          type="text"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={nameError !== null || undefined}
          aria-describedby={nameError !== null ? 'position-name-error' : undefined}
        />
        {nameError !== null ? (
          <p id="position-name-error" className="field-error" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      {groupEditable ? (
        <div className="form-field">
          <label htmlFor="position-group">Gruppe *</label>
          <select
            id="position-group"
            value={values.group}
            onChange={(event) => setField('group', event.target.value as PositionGroup)}
          >
            {POSITION_GROUPS.map((group) => (
              <option key={group} value={group}>
                {GROUP_LABELS[group]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="form-field">
          Gruppe: <strong>{GROUP_LABELS[values.group]}</strong>{' '}
          {/* A11y (Review-Befund B2): Begründung als sichtbarer Text, nicht nur title. */}
          <span className="app-hint">
            (nicht änderbar – Zielprofile und Kennzahlen referenzieren die Gruppe; Begründung auch
            unter „So rechnet die Depot-Seite“)
          </span>
        </p>
      )}
      <div className="form-field">
        <label htmlFor="position-account">Depotkonto *</label>
        <select
          id="position-account"
          value={values.accountId}
          onChange={(event) => setField('accountId', event.target.value)}
          aria-describedby={selectedAccountInactive ? 'position-account-warning' : undefined}
        >
          {depotAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {isAccountActive(account) ? account.name : `${account.name} (inaktiv)`}
            </option>
          ))}
        </select>
        {selectedAccountInactive ? (
          <p id="position-account-warning" className="field-warning" role="status">
            ⚠ Das gewählte Depotkonto „{selectedAccount.name}“ ist deaktiviert.{' '}
            {groupEditable
              ? 'Die Position kann angelegt werden; solange die Position selbst aktiv ist, zählt ihr Wert weiterhin zu den Summen. Prüfe, ob das Konto zuerst aktiviert werden sollte.'
              : 'Ein Konto-Umzug ist nur auf ein aktives Depot-Konto möglich.'}
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="position-asset">Asset-Typ</label>
        <select
          id="position-asset"
          value={values.assetClass}
          onChange={(event) => setField('assetClass', event.target.value as '' | AssetClass)}
        >
          <option value="">– keine Angabe –</option>
          {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((assetClass) => (
            <option key={assetClass} value={assetClass}>
              {ASSET_CLASS_LABELS[assetClass]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="position-isin">ISIN</label>
        <input
          id="position-isin"
          type="text"
          value={values.isin}
          onChange={(event) => setField('isin', event.target.value)}
          aria-describedby={duplicate !== null ? 'position-isin-warning' : undefined}
        />
        {duplicate !== null ? (
          <p id="position-isin-warning" className="field-warning" role="status">
            {isPositionActive(duplicate)
              ? `⚠ Im gewählten Depotkonto existiert bereits eine Position mit dieser ISIN („${duplicate.name}“). Das Speichern bleibt möglich – prüfe, ob wirklich eine zweite Position gewünscht ist.`
              : `⚠ Eine inaktive Position mit gleicher ISIN existiert („${duplicate.name}“) – Reaktivieren statt Neuanlage prüfen.`}
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="position-note">Notiz</label>
        <input
          id="position-note"
          type="text"
          value={values.note}
          onChange={(event) => setField('note', event.target.value)}
        />
      </div>
      {submitError !== null ? (
        <p className="field-error" role="alert">
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

// --- Wert-Erfassung („Wert aktualisieren“, Muster BalanceForm der Konten-Seite) ---

function ValueForm({
  position,
  onCancel,
  onSubmit,
}: {
  position: PortfolioPosition
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (value: number, dateIso: string) => string | null
}) {
  const [amountText, setAmountText] = useState('')
  const [dateIso, setDateIso] = useState(localTodayIso())
  const [amountError, setAmountError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setAmountError(null)
    setDateError(null)
    setGeneralError(null)
    // Strenges de-DE-Muster: "1.234" ist 1234 €, nie 1,234 € (Review-Befund 3.2).
    const value = parseGermanAmount(amountText)
    if (value === null) {
      setAmountError('Bitte einen gültigen Betrag eingeben (z. B. 250,00 oder 1.234,56).')
      return
    }
    if (dateIso.trim() === '') {
      setDateError('Bitte ein Datum wählen.')
      return
    }
    const error = onSubmit(value, dateIso)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah anzeigen (Präfix „Betrag:“ / „Datum:“).
    if (error.startsWith('Betrag:')) setAmountError(error.slice('Betrag:'.length).trim())
    else if (error.startsWith('Datum:')) setDateError(error.slice('Datum:'.length).trim())
    else setGeneralError(error)
  }

  const heading = `Wert aktualisieren: ${position.name}`
  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      <h3>{heading}</h3>
      <p className="app-hint">
        Der neue Wert wird als datierter Eintrag erfasst; die bisherige Historie bleibt erhalten.
        Gibt es am selben Datum bereits einen Eintrag, wird er ersetzt.
      </p>
      <div className="form-field">
        <label htmlFor="position-value-amount">Wert in Euro *</label>
        <input
          id="position-value-amount"
          ref={firstFieldRef}
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          aria-invalid={amountError !== null || undefined}
          aria-describedby={amountError !== null ? 'position-value-amount-error' : undefined}
        />
        {amountError !== null ? (
          <p id="position-value-amount-error" className="field-error" role="alert">
            {amountError}
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="position-value-date">Datum *</label>
        <input
          id="position-value-date"
          type="date"
          value={dateIso}
          onChange={(event) => setDateIso(event.target.value)}
          aria-invalid={dateError !== null || undefined}
          aria-describedby={dateError !== null ? 'position-value-date-error' : undefined}
        />
        {dateError !== null ? (
          <p id="position-value-date-error" className="field-error" role="alert">
            {dateError}
          </p>
        ) : null}
      </div>
      {generalError !== null ? (
        <p className="field-error" role="alert">
          {generalError}
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

// --- Snapshot-Vollerfassung (Phase C) ---

interface SnapshotEntryRow {
  id: string
  label: string
  /** true = am gewählten Datum existiert bereits ein Eintrag („wird ersetzt“). */
  alreadyRecorded: boolean
}

function SnapshotForm({
  data,
  activePositions,
  activeCashAccounts,
  onCancel,
  onSubmit,
}: {
  data: FinanceData
  activePositions: readonly PortfolioPosition[]
  activeCashAccounts: readonly Account[]
  onCancel: () => void
  /** Liefert bei Erfolg/Abbruch null, sonst die deutsche Fehlermeldung. */
  onSubmit: (
    dateIso: string,
    label: string,
    positionValues: Map<string, number>,
    accountBalances: Map<string, number>,
  ) => string | null
}) {
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  function buildValues(forDate: string): Record<string, string> {
    const values: Record<string, string> = {}
    activePositions.forEach((position) => {
      const entry = position.valueHistory.find((valueEntry) => valueEntry.date === forDate)
      values[position.id] = entry === undefined ? '' : amountToInputText(entry.value)
    })
    activeCashAccounts.forEach((account) => {
      const entry = account.balanceHistory.find((balanceEntry) => balanceEntry.date === forDate)
      values[account.id] = entry === undefined ? '' : amountToInputText(entry.amount)
    })
    return values
  }

  const [dateIso, setDateIso] = useState(localTodayIso())
  const [label, setLabel] = useState('')
  const [values, setValues] = useState<Record<string, string>>(() => buildValues(localTodayIso()))
  const [error, setError] = useState<string | null>(null)
  // A11y (Review-Befund B3): feldnahe Fehlerzuordnung nach einem Speicherversuch.
  const [fieldIssues, setFieldIssues] = useState<Record<string, 'fehlt' | 'ungültig'>>({})

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  function onDateChange(nextDate: string): void {
    setDateIso(nextDate)
    // Vorbelegung gilt je Datum: beim Datumswechsel neu aus dem Bestand aufbauen.
    setValues(buildValues(nextDate))
    setError(null)
    setFieldIssues({})
  }

  const rows: { heading: string; entries: SnapshotEntryRow[] }[] = [
    {
      heading: 'Aktive Depotpositionen',
      entries: activePositions.map((position) => ({
        id: position.id,
        label: position.name,
        alreadyRecorded: position.valueHistory.some((entry) => entry.date === dateIso),
      })),
    },
    {
      heading: 'Aktive Tagesgeldkonten',
      entries: activeCashAccounts.map((account) => ({
        id: account.id,
        label: account.name,
        alreadyRecorded: account.balanceHistory.some((entry) => entry.date === dateIso),
      })),
    },
  ]

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setError(null)
    // Vollständigkeitsprüfung VOR dem Speichern: fehlende Namen im Fehlertext,
    // fehlende Werte werden NIE stillschweigend als 0 erfasst.
    const missing: { id: string; name: string }[] = []
    const invalid: { id: string; name: string }[] = []
    const positionValues = new Map<string, number>()
    const accountBalances = new Map<string, number>()
    const collect = (id: string, name: string, target: Map<string, number>): void => {
      const text = (values[id] ?? '').trim()
      if (text === '') {
        missing.push({ id, name })
        return
      }
      const parsed = parseGermanAmount(text)
      if (parsed === null) invalid.push({ id, name })
      else target.set(id, parsed)
    }
    activePositions.forEach((position) => collect(position.id, position.name, positionValues))
    activeCashAccounts.forEach((account) => collect(account.id, account.name, accountBalances))
    if (missing.length > 0 || invalid.length > 0) {
      // Sammel-Fehler als Übersicht + feldnahe Zuordnung über fieldIssues (B3).
      const issues: Record<string, 'fehlt' | 'ungültig'> = {}
      missing.forEach((entry) => {
        issues[entry.id] = 'fehlt'
      })
      invalid.forEach((entry) => {
        issues[entry.id] = 'ungültig'
      })
      setFieldIssues(issues)
      setError(
        missing.length > 0
          ? `Der Snapshot ist unvollständig. Es fehlen Werte für: ${missing.map((entry) => entry.name).join(', ')}. Fehlende Werte werden nicht als 0 gespeichert.`
          : `Bitte gültige Beträge eingeben (z. B. 250,00 oder 1.234,56) für: ${invalid.map((entry) => entry.name).join(', ')}.`,
      )
      return
    }
    setFieldIssues({})
    const submitError = onSubmit(dateIso, label, positionValues, accountBalances)
    if (submitError !== null) setError(submitError)
  }

  return (
    <form className="account-form snapshot-form" aria-label="Snapshot erfassen" onSubmit={handleSubmit} noValidate>
      <h3>Snapshot erfassen</h3>
      <p className="app-hint">
        Ein Snapshot erfasst alle aktiven Depotpositionen und alle aktiven Tagesgeldkonten zum
        gewählten Datum vollständig. Die Feldliste unten ist zugleich die Vorschau: gespeichert wird
        genau das, was hier steht. Nach dem Speichern ist das Datum dauerhaft gesperrt; Korrekturen
        nur als neuer Snapshot mit neuem Datum.
      </p>
      <div className="form-field">
        <label htmlFor="snapshot-date">Datum *</label>
        <input
          id="snapshot-date"
          ref={firstFieldRef}
          type="date"
          value={dateIso}
          onChange={(event) => onDateChange(event.target.value)}
          aria-describedby={
            isBackdatedBeforeLatestSnapshot(data, dateIso) ? 'snapshot-backdated-hint' : undefined
          }
        />
        {isBackdatedBeforeLatestSnapshot(data, dateIso) ? (
          // A11y (Review-Befund B7): Hinweis vor den Aktions-Buttons und am Datumsfeld verankert.
          <p id="snapshot-backdated-hint" className="app-hint" role="status">
            ℹ Das gewählte Datum liegt vor dem jüngsten Snapshot – beim Speichern wird eine
            Bestätigung abgefragt (rückdatierte Erfassung).
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="snapshot-label">Label (optional)</label>
        <input
          id="snapshot-label"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      {rows.map((group) =>
        group.entries.length === 0 ? null : (
          <fieldset key={group.heading} className="snapshot-group">
            <legend>{group.heading}</legend>
            {group.entries.map((entry) => {
              const currentText = values[entry.id] ?? ''
              const issue = fieldIssues[entry.id]
              const marker = entry.alreadyRecorded
                ? 'bereits erfasst – wird ersetzt'
                : currentText.trim() === ''
                  ? 'fehlt'
                  : null
              const stateId = `snapshot-entry-${entry.id}-state`
              return (
                <div key={entry.id} className="form-field snapshot-entry">
                  <label htmlFor={`snapshot-entry-${entry.id}`}>{entry.label} (Euro) *</label>
                  <input
                    id={`snapshot-entry-${entry.id}`}
                    type="text"
                    inputMode="decimal"
                    value={currentText}
                    onChange={(event) => {
                      setValues((current) => ({ ...current, [entry.id]: event.target.value }))
                      // Feldfehler beim Korrigieren zurücknehmen (B3).
                      setFieldIssues((current) => {
                        if (!(entry.id in current)) return current
                        const next = { ...current }
                        delete next[entry.id]
                        return next
                      })
                    }}
                    aria-invalid={issue !== undefined || undefined}
                    aria-describedby={issue !== undefined || marker !== null ? stateId : undefined}
                  />
                  {issue !== undefined ? (
                    <p id={stateId} className="field-error" role="alert">
                      {issue === 'fehlt'
                        ? '⚠ Wert fehlt – bitte Betrag eingeben (fehlende Werte werden nicht als 0 gespeichert).'
                        : '⚠ Ungültiger Betrag – bitte im Format 250,00 oder 1.234,56 eingeben.'}
                    </p>
                  ) : marker !== null ? (
                    <p id={stateId} className="snapshot-entry-state">
                      {marker === 'fehlt' ? `⚠ ${marker}` : `ℹ ${marker}`}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        ),
      )}
      {error !== null ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit">Snapshot speichern</button>
        <button type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// --- Zielvergleich (Phase D, nur Anzeige) ---

function TargetComparison({
  data,
  activePositions,
  percentDecimals,
}: {
  data: FinanceData
  activePositions: readonly PortfolioPosition[]
  percentDecimals: number
}) {
  const holdingsProfiles = data.targetProfiles.filter((profile) => profile.basis === 'holdings')
  const activeProfile = holdingsProfiles.find(
    (profile) => profile.id === data.settings.activeTargetProfileId,
  )
  const firstFilled = holdingsProfiles.find(
    (profile) => Array.isArray(profile.weights) && profile.weights.length > 0,
  )
  const defaultProfileId = activeProfile?.id ?? firstFilled?.id ?? holdingsProfiles[0]?.id ?? ''
  const [selectedProfileId, setSelectedProfileId] = useState(defaultProfileId)

  if (holdingsProfiles.length === 0) {
    return (
      <section aria-labelledby="target-comparison-title">
        <h3 id="target-comparison-title">Zielvergleich (nur Anzeige)</h3>
        <p className="app-hint">Es gibt keine Zielprofile auf Bestandsbasis (holdings).</p>
      </section>
    )
  }

  const selectedProfile: TargetProfile | null =
    holdingsProfiles.find((profile) => profile.id === selectedProfileId) ?? null
  const depot = depotValue(activePositions)
  const weightsValidation =
    selectedProfile === null ? null : validateWeights(selectedProfile.weights)
  const targets =
    selectedProfile === null ? null : targetValues(selectedProfile.weights, depot.amount)

  const positionById = new Map(data.portfolioPositions.map((position) => [position.id, position]))

  return (
    <section aria-labelledby="target-comparison-title">
      <h3 id="target-comparison-title">Zielvergleich (nur Anzeige)</h3>
      <p className="app-hint">
        Empfehlungen sind rein informativ – Finance OS führt niemals automatisch Käufe, Verkäufe
        oder Sparplanänderungen aus.
      </p>
      <div className="form-field">
        <label htmlFor="target-profile-select">Vergleichsprofil</label>
        <select
          id="target-profile-select"
          value={selectedProfileId}
          onChange={(event) => setSelectedProfileId(event.target.value)}
        >
          {holdingsProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <p className="app-hint">
          Die Auswahl dient nur dem Vergleich und ändert das aktive Zielprofil nicht.
        </p>
      </div>
      {selectedProfile === null || weightsValidation === null ? null : weightsValidation.status ===
        'empty' ? (
        <p className="app-hint">Profil nicht befüllt – es wird nicht gerechnet.</p>
      ) : weightsValidation.status === 'invalid' ? (
        <p className="operation-error" role="alert">
          ⚠ Das Profil ist ungültig und wird nicht gerechnet: {weightsValidation.issues.join(' ')}
        </p>
      ) : targets === null ? (
        <p className="app-hint">
          Der Depotwert ist 0 – Anteile und Zielwerte sind nicht berechenbar (F20).
        </p>
      ) : (
        <div className="table-wrap">
          <table className="accounts-table">
            <caption className="visually-hidden">Zielvergleich</caption>
            <thead>
              <tr>
                <th scope="col">Ziel</th>
                <th scope="col">Ziel-%</th>
                <th scope="col">Ist-Wert</th>
                <th scope="col">Ist-%</th>
                <th scope="col">Abweichung (Pp)</th>
                <th scope="col">Kaufbedarf</th>
                <th scope="col">Handlungsstufe</th>
                <th scope="col">Verkaufsbedarf</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => {
                let label: string
                let actual: number | null = null
                let actualText: string
                if (target.refKind === 'group') {
                  const group = groupTotal(activePositions, target.ref as PositionGroup)
                  label = `${GROUP_LABELS[target.ref as PositionGroup]} (Gruppe)`
                  actual = group.amount
                  actualText =
                    group.missingIds.length > 0
                      ? `${formatEuro(group.amount)} (enthält Positionen ohne erfassten Wert)`
                      : formatEuro(group.amount)
                } else {
                  const position = positionById.get(target.ref)
                  label = position ? position.name : target.ref
                  if (position === undefined) {
                    actualText = '– (Position unbekannt)'
                  } else if (!isPositionActive(position)) {
                    actualText = '– (Position inaktiv)'
                  } else {
                    const entry = latestEntry(position.valueHistory)
                    if (entry === null) {
                      actualText = 'unbekannt'
                    } else {
                      actual = entry.value
                      actualText = formatEuro(entry.value)
                    }
                  }
                }
                const actualShare = actual === null ? null : share(actual, depot.amount)
                const pp =
                  actualShare === null ? null : deviationPp(actualShare, target.weight)
                const level: ActionLevel | null = pp === null ? null : actionLevel(pp)
                const buy = actual === null ? null : buyRequirement(actual, target.target)
                const sell =
                  actual !== null && level === 'recommendation-with-sale-option'
                    ? sellRequirement(actual, target.target)
                    : null
                return (
                  <tr key={`${target.refKind}-${target.ref}`}>
                    <th scope="row">{label}</th>
                    <td>{formatShare(target.weight, percentDecimals)}</td>
                    <td>{actualText}</td>
                    <td>
                      {actualShare === null
                        ? '–'
                        : formatShare(actualShare, percentDecimals)}
                    </td>
                    <td>{pp === null ? '–' : formatPp(pp, percentDecimals)}</td>
                    <td>{buy === null ? '–' : formatEuro(buy)}</td>
                    <td>{level === null ? '–' : ACTION_LEVEL_LABELS[level]}</td>
                    <td>{sell === null ? '–' : formatEuro(sell)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// --- Seite ---

type SortKey = 'name' | 'value'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

type EditorState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; positionId: string }
  | { kind: 'value'; positionId: string }
  | { kind: 'snapshot' }

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

function DepotRules() {
  return (
    <details className="model-hint">
      <summary>So rechnet die Depot-Seite (Kennzahlen und Zählregeln)</summary>
      <ul>
        <li>
          Depotwert = Summe der aktuellen Werte aller aktiven Positionen (F2). Der aktuelle Wert
          ist immer der jüngste Eintrag der Wert-Historie.
        </li>
        <li>
          Anteil am Depot = Positionswert / Depotwert (F5); Anteil am Gesamtvermögen =
          Positionswert / (Tagesgeld + Depot) (F6). Bei Depotwert bzw. Gesamtvermögen 0 sind die
          Anteile „nicht berechenbar“ – es erscheint nie eine 0 und nie ein technischer
          Zahlenwert.
        </li>
        <li>
          Fehlende Werte (leere Historie) bedeuten „unbekannt“, nie 0 (G11); betroffene Positionen
          werden ausgewiesen.
        </li>
        <li>
          Inaktive Positionen fließen in keine Summe und keine Kennzahl ein, bleiben aber sichtbar
          gelistet und pflegbar. Positionen werden nie gelöscht, nur deaktiviert.
        </li>
        <li>
          „MSCI World gesamt“ = Summe der aktiven Positionen der Gruppe World (F7) – immer
          berechnet, nie gespeichert.
        </li>
        <li>
          Kachel „Aktive Positionen“: Anzahl der Positionen mit Status Aktiv; Kachel „Positionen
          ohne erfassten Wert“: aktive Positionen mit leerer Wert-Historie.
        </li>
        <li>
          Die Gruppe einer bestehenden Position ist nicht änderbar: Zielprofile und Kennzahlen
          (z. B. „MSCI World gesamt“) referenzieren Gruppen – ein Wechsel würde diese Referenzen
          stillschweigend verschieben.
        </li>
      </ul>
    </details>
  )
}

function formValuesFromPosition(
  position: PortfolioPosition,
): PositionFormValues {
  return {
    name: position.name,
    group: position.group,
    accountId: position.accountId,
    assetClass: position.assetClass ?? '',
    isin: position.isin ?? '',
    note: position.note ?? '',
  }
}

export function DepotPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions } = useFinanceData()
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  // Standardsortierung: Wert absteigend (aktiv vor inaktiv, unbekannte Werte ans Ende).
  const [sort, setSort] = useState<SortState>({ key: 'value', direction: 'desc' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [returnFocusPending, setReturnFocusPending] = useState(false)

  // Fokus-Rückgabe erst NACH dem Re-Render: die Toolbar-Buttons sind bei
  // offenem Formular disabled und erst nach dem Schließen wieder fokussierbar.
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
        <h2 id="page-title">Depot</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  // Nach dem Guard fest gebunden (Funktionsdeklarationen erhalten sonst kein Narrowing).
  const loadedData: FinanceData = data
  const positions = data.portfolioPositions
  const accountById = new Map(data.accounts.map((account) => [account.id, account]))
  const depotAccounts = data.accounts.filter((account) => account.type === 'depot')
  // Inaktive Positionen/Konten fließen in KEINE aktive Summe ein (Aufruferfilter).
  const activePositions = positions.filter(isPositionActive)
  const activeAccounts = data.accounts.filter(isAccountActive)
  const activeCashAccounts = activeAccounts.filter((account) => account.type === 'tagesgeld')
  const depot = depotValue(activePositions)
  const world = worldTotal(activePositions)
  const cash = cashValue(activeAccounts)
  const total = totalWealth(cash.amount, depot.amount)
  const percentDecimals =
    typeof data.settings.display?.percentDecimals === 'number'
      ? data.settings.display.percentDecimals
      : 2

  const missingValuePositions = activePositions.filter(
    (position) => position.valueHistory.length === 0,
  )
  const inactivePositions = positions.filter((position) => !isPositionActive(position))
  const inactiveAccountsWithPositions = depotAccounts.filter(
    (account) =>
      !isAccountActive(account) &&
      positions.some((position) => position.accountId === account.id),
  )
  const snapshotWarnings = state.warnings.filter(
    (warning) => warning.code === 'W_SNAPSHOT_INCOMPLETE',
  )

  function openEditor(next: EditorState, trigger: HTMLButtonElement | null): void {
    triggerRef.current = trigger
    setActionError(null)
    setSnapshotSuccess(null)
    setEditor(next)
  }

  function closeEditor(): void {
    setEditor({ kind: 'closed' })
    // Fokus zurück auf den auslösenden Button (Phase E, über den Effekt oben).
    setReturnFocusPending(true)
  }

  // Escape schließt offene Formulare der Depot-Seite (Phase E).
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

  function toggleSort(key: SortKey): void {
    setSort((current) =>
      current.key !== key
        ? { key, direction: 'asc' }
        : { key, direction: current.direction === 'asc' ? 'desc' : 'asc' },
    )
  }

  function ariaSort(key: SortKey): 'ascending' | 'descending' | undefined {
    if (sort.key !== key) return undefined
    return sort.direction === 'asc' ? 'ascending' : 'descending'
  }

  function sortIndicator(key: SortKey): string {
    if (sort.key !== key) return ''
    return sort.direction === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedPositions = positions.slice().sort((a, b) => {
    // Aktive Positionen immer vor inaktiven.
    const activeDiff = (isPositionActive(a) ? 0 : 1) - (isPositionActive(b) ? 0 : 1)
    if (activeDiff !== 0) return activeDiff
    if (sort.key === 'value') {
      const aEntry = latestEntry(a.valueHistory)
      const bEntry = latestEntry(b.valueHistory)
      // Unbekannte Werte ans Gruppenende (unabhängig von der Richtung).
      if (aEntry === null || bEntry === null) {
        if (aEntry === null && bEntry === null) return a.name.localeCompare(b.name, 'de')
        return aEntry === null ? 1 : -1
      }
      const factor = sort.direction === 'asc' ? 1 : -1
      if (aEntry.value !== bEntry.value) return factor * (aEntry.value - bEntry.value)
      return a.name.localeCompare(b.name, 'de')
    }
    const factor = sort.direction === 'asc' ? 1 : -1
    return factor * a.name.localeCompare(b.name, 'de')
  })

  function applyResult(result: PositionActionResult): string | null {
    if (!result.ok) return result.error
    actions.applyDataChange(result.data)
    closeEditor()
    return null
  }

  function handleAddSubmit(values: PositionFormValues): string | null {
    return applyResult(
      addPosition(loadedData, {
        name: values.name,
        group: values.group,
        accountId: values.accountId,
        assetClass: values.assetClass === '' ? null : values.assetClass,
        isin: textOrNull(values.isin),
        note: textOrNull(values.note),
      }),
    )
  }

  function handleEditSubmit(positionId: string, values: PositionFormValues): string | null {
    return applyResult(
      updatePosition(loadedData, positionId, {
        name: values.name,
        accountId: values.accountId,
        assetClass: values.assetClass === '' ? null : values.assetClass,
        isin: textOrNull(values.isin),
        note: textOrNull(values.note),
      }),
    )
  }

  function handleValueSubmit(positionId: string, value: number, dateIso: string): string | null {
    return applyResult(setPositionValue(loadedData, positionId, value, dateIso))
  }

  function handleSnapshotSubmit(
    dateIso: string,
    label: string,
    positionValues: Map<string, number>,
    accountBalances: Map<string, number>,
  ): string | null {
    // Rückdatierte Erfassung: Bestätigung VOR dem Speichern (Phase C).
    if (isBackdatedBeforeLatestSnapshot(loadedData, dateIso)) {
      const proceed = window.confirm(
        `Das Datum ${formatIsoDateGerman(dateIso)} liegt vor dem jüngsten vorhandenen Snapshot. Trotzdem rückdatiert erfassen? Der Snapshot wird nach dem Speichern dauerhaft gesperrt.`,
      )
      if (!proceed) return null
    }
    const result = captureSnapshot(loadedData, {
      dateIso,
      label: label.trim() === '' ? undefined : label.trim(),
      positionValues,
      accountBalances,
      todayIso: localTodayIso(),
    })
    if (!result.ok) return result.error
    actions.applyDataChange(result.data)
    closeEditor()
    setSnapshotSuccess(
      `Snapshot vom ${formatIsoDateGerman(dateIso)} gespeichert und gesperrt. Korrekturen sind nur als neuer Snapshot mit neuem Datum möglich.`,
    )
    return null
  }

  function handleToggleActive(position: PortfolioPosition): void {
    setActionError(null)
    const currentlyActive = isPositionActive(position)
    if (currentlyActive) {
      // Kritische Aktion: Bestätigung inkl. Betragsnennung (G12, Phase B).
      const entry = latestEntry(position.valueHistory)
      const valueText =
        entry === null
          ? 'ohne erfassten Wert'
          : `mit zuletzt erfasstem Wert ${formatEuro(entry.value)}`
      const proceed = window.confirm(
        `Position „${position.name}“ deaktivieren? Sie fällt ${valueText} aus allen Summen und Kennzahlen, bleibt aber sichtbar gelistet. Die Wert-Historie bleibt erhalten.`,
      )
      if (!proceed) return
    }
    const result = setPositionActive(loadedData, position.id, !currentlyActive)
    if (result.ok) actions.applyDataChange(result.data)
    else setActionError(result.error)
  }

  const editingPosition =
    editor.kind === 'edit' || editor.kind === 'value'
      ? (positions.find((position) => position.id === editor.positionId) ?? null)
      : null

  const emptyForm: PositionFormValues = {
    name: '',
    group: 'world',
    accountId:
      depotAccounts.find(isAccountActive)?.id ?? depotAccounts[0]?.id ?? '',
    assetClass: '',
    isin: '',
    note: '',
  }

  function shareOfDepotText(position: PortfolioPosition): string {
    if (!isPositionActive(position)) return '–'
    const entry = latestEntry(position.valueHistory)
    if (entry === null) return '–'
    const value = share(entry.value, depot.amount)
    return value === null ? 'nicht berechenbar' : formatShare(value, percentDecimals)
  }

  function shareOfTotalText(position: PortfolioPosition): string {
    if (!isPositionActive(position)) return '–'
    const entry = latestEntry(position.valueHistory)
    if (entry === null) return '–'
    if (total <= 0) return 'nicht berechenbar'
    const value = share(entry.value, total)
    return value === null ? 'nicht berechenbar' : formatShare(value, percentDecimals)
  }

  return (
    <section className="page" aria-labelledby="page-title" onKeyDown={handleKeyDown}>
      <h2 id="page-title">Depot</h2>
      <p className="app-hint">
        Der Depotwert wird ausschließlich aus den Positionen berechnet. Depotkonten besitzen keinen
        zusätzlichen Saldo.
      </p>
      <DepotRules />

      {missingValuePositions.length > 0 ? (
        <p className="warning-note">
          ⚠ Für folgende aktive Positionen ist noch kein Wert erfasst:{' '}
          {missingValuePositions.map((position) => position.name).join(', ')}. Sie zählen nicht als
          0, sondern als „unbekannt“.
        </p>
      ) : null}
      {snapshotWarnings.length > 0 ? (
        <div className="warning-note">
          <p>⚠ Unvollständig bewertete Snapshots im geladenen Bestand:</p>
          <ul>
            {snapshotWarnings.map((warning) => (
              <li key={warning.path}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {inactivePositions.length > 0 ? (
        <p className="app-hint">
          ℹ {inactivePositions.length === 1 ? 'Eine Position ist' : `${inactivePositions.length} Positionen sind`}{' '}
          deaktiviert und fließen in keine Summen ein.
        </p>
      ) : null}
      {inactiveAccountsWithPositions.length > 0 ? (
        <p className="app-hint">
          ℹ Inaktive Depotkonten mit zugeordneten Positionen:{' '}
          {inactiveAccountsWithPositions.map((account) => account.name).join(', ')}.
        </p>
      ) : null}

      <dl className="kpi-grid">
        <div className="kpi-tile" title="F2: Summe der aktuellen Werte aller aktiven Positionen.">
          <dt>Depotwert (aktive Positionen)</dt>
          <dd>{formatEuro(depot.amount)}</dd>
        </div>
        <div
          className="kpi-tile"
          title="F7: Summe der aktiven Positionen der Gruppe World – immer berechnet, nie gespeichert."
        >
          <dt>MSCI World gesamt</dt>
          <dd>{formatEuro(world.amount)}</dd>
        </div>
        <div className="kpi-tile" title="Anzahl der aktiven Depotpositionen.">
          <dt>Aktive Positionen</dt>
          <dd>{activePositions.length}</dd>
        </div>
        <div
          className="kpi-tile"
          title="Aktive Positionen mit leerer Wert-Historie – sie zählen als „unbekannt“, nie als 0 (G11)."
        >
          <dt>Positionen ohne erfassten Wert</dt>
          <dd>{missingValuePositions.length}</dd>
        </div>
      </dl>

      <div className="toolbar">
        <button
          type="button"
          onClick={(event) => openEditor({ kind: 'add' }, event.currentTarget)}
          disabled={state.isSaving || editor.kind === 'add'}
        >
          Position hinzufügen
        </button>
        <button
          type="button"
          onClick={(event) => openEditor({ kind: 'snapshot' }, event.currentTarget)}
          disabled={
            state.isSaving ||
            editor.kind === 'snapshot' ||
            (activePositions.length === 0 && activeCashAccounts.length === 0)
          }
        >
          Snapshot erfassen
        </button>
      </div>

      {actionError !== null ? (
        <p className="operation-error" role="alert">
          ⚠ {actionError}
        </p>
      ) : null}
      {snapshotSuccess !== null ? (
        <p className="success-note" role="status">
          ✓ {snapshotSuccess}
        </p>
      ) : null}

      {editor.kind === 'add' ? (
        <PositionForm
          heading="Position hinzufügen"
          initial={emptyForm}
          groupEditable={true}
          depotAccounts={depotAccounts}
          positions={positions}
          excludeId={null}
          onCancel={closeEditor}
          onSubmit={handleAddSubmit}
        />
      ) : null}
      {editor.kind === 'edit' && editingPosition !== null ? (
        <PositionForm
          // key erzwingt eine frische Formularinstanz je Position – sonst „klebt“
          // der Zustand beim Zielwechsel und schreibt auf die falsche Position.
          key={editingPosition.id}
          heading={`Position bearbeiten: ${editingPosition.name}`}
          initial={formValuesFromPosition(editingPosition)}
          groupEditable={false}
          depotAccounts={depotAccounts}
          positions={positions}
          excludeId={editingPosition.id}
          onCancel={closeEditor}
          onSubmit={(values) => handleEditSubmit(editingPosition.id, values)}
        />
      ) : null}
      {editor.kind === 'value' && editingPosition !== null ? (
        <ValueForm
          key={editingPosition.id}
          position={editingPosition}
          onCancel={closeEditor}
          onSubmit={(value, dateIso) => handleValueSubmit(editingPosition.id, value, dateIso)}
        />
      ) : null}
      {editor.kind === 'snapshot' ? (
        <SnapshotForm
          data={loadedData}
          activePositions={activePositions}
          activeCashAccounts={activeCashAccounts}
          onCancel={closeEditor}
          onSubmit={handleSnapshotSubmit}
        />
      ) : null}

      {positions.length === 0 ? (
        <p className="app-hint">
          Der geladene Bestand enthält noch keine Depotpositionen. Lege mit „Position hinzufügen“
          die erste Position an.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="accounts-table">
              <caption className="visually-hidden">Positionsliste</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort('name')}>
                    <button type="button" className="sort-button" onClick={() => toggleSort('name')}>
                      Bezeichnung{sortIndicator('name')}
                    </button>
                  </th>
                  <th scope="col">Gruppe</th>
                  <th scope="col">Asset-Typ</th>
                  <th scope="col">Depotkonto</th>
                  <th scope="col">ISIN</th>
                  <th scope="col" aria-sort={ariaSort('value')}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => toggleSort('value')}
                    >
                      Aktueller Wert{sortIndicator('value')}
                    </button>
                  </th>
                  <th scope="col">Letztes Bewertungsdatum</th>
                  <th scope="col">Anteil am Depot</th>
                  <th scope="col">Anteil am Gesamtvermögen</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((position) => {
                  const active = isPositionActive(position)
                  const account = accountById.get(position.accountId)
                  const entry = latestEntry(position.valueHistory)
                  return (
                    <tr key={position.id}>
                      <th scope="row">{position.name}</th>
                      <td>{GROUP_LABELS[position.group]}</td>
                      <td>
                        {position.assetClass !== undefined
                          ? ASSET_CLASS_LABELS[position.assetClass]
                          : '–'}
                      </td>
                      <td>
                        {account === undefined
                          ? position.accountId
                          : isAccountActive(account)
                            ? account.name
                            : `${account.name} (inaktives Konto)`}
                      </td>
                      <td>{position.isin ?? '–'}</td>
                      <td>{entry === null ? 'unbekannt' : formatEuro(entry.value)}</td>
                      <td>{entry === null ? '–' : formatIsoDateGerman(entry.date)}</td>
                      <td>{shareOfDepotText(position)}</td>
                      <td>{shareOfTotalText(position)}</td>
                      <td>{active ? 'Aktiv' : <strong>Inaktiv</strong>}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            aria-label={`Position „${position.name}“ bearbeiten`}
                            onClick={(event) =>
                              openEditor(
                                { kind: 'edit', positionId: position.id },
                                event.currentTarget,
                              )
                            }
                            disabled={state.isSaving}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            aria-label={
                              active
                                ? `Position „${position.name}“ deaktivieren`
                                : `Position „${position.name}“ aktivieren`
                            }
                            onClick={() => handleToggleActive(position)}
                            disabled={state.isSaving}
                          >
                            {active ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                          <button
                            type="button"
                            aria-label={`Wert von „${position.name}“ aktualisieren`}
                            onClick={(event) =>
                              openEditor(
                                { kind: 'value', positionId: position.id },
                                event.currentTarget,
                              )
                            }
                            disabled={state.isSaving}
                          >
                            Wert aktualisieren
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {depot.missingIds.length > 0 ? (
            <p className="app-hint">Der Depotwert enthält Positionen ohne erfassten Wert.</p>
          ) : null}
          {cash.missingIds.length > 0 ? (
            // G11 (Review-Befund finance-analyst): partielles Gesamtvermögen sichtbar machen.
            <p className="app-hint" role="status">
              ⚠ Das Gesamtvermögen enthält Tagesgeldkonten ohne erfassten Saldo – die Spalte
              „Anteil am Gesamtvermögen“ rechnet daher mit einem unvollständigen Gesamtvermögen.
            </p>
          ) : null}
        </>
      )}

      <TargetComparison
        data={loadedData}
        activePositions={activePositions}
        percentDecimals={percentDecimals}
      />
    </section>
  )
}
