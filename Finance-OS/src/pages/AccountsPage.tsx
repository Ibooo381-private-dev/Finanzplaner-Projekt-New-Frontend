/**
 * Modul „Konten“ (M8): sortierbare Liste, Anlegen/Bearbeiten,
 * Aktivieren/Deaktivieren und Saldo-Erfassung.
 *
 * Keine Finanzlogik in Komponenten: alle Datenänderungen laufen über die
 * reinen Funktionen in src/data/accounts.ts (+ applyDataChange → DATA_CHANGED,
 * setzt isDirty), alle Kennzahlen kommen aus src/finance (latestEntry,
 * cashValue, depotValue). Doppelzählungs-Modell: siehe Kommentar in
 * src/data/accounts.ts und den aufklappbaren Hinweis auf dieser Seite.
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Account, AccountType, FinanceData, PortfolioPosition } from '../types/finance'
import { cashValue, depotValue, latestEntry } from '../finance'
import { formatEuro, parseGermanAmount } from '../format/money'
import {
  ADDABLE_ACCOUNT_TYPES,
  addAccount,
  defaultCountsAsFreeLiquidity,
  setAccountActive,
  setAccountBalance,
  updateAccount,
} from '../data/accounts'
import type { AccountActionResult } from '../data/accounts'
import { useFinanceData } from '../state/useFinanceData'

// --- Deutsches Typ-Mapping (UI) ---

const TYPE_LABELS: Record<AccountType, string> = {
  giro: 'Girokonto',
  tagesgeld: 'Tagesgeld',
  depot: 'Depot',
  cash: 'Verrechnungskonto',
  bargeld: 'Bargeld',
  sonstiges: 'Sonstiges',
  ruecklage: 'Rücklagenkonto',
  krypto: 'Kryptokonto',
  pension: 'Pensionskonto',
}

function typeLabel(type: AccountType): string {
  return TYPE_LABELS[type]
}

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

/** Lokales Kalenderdatum (JJJJ-MM-TT) als Vorbelegung des Datumsfelds. */
function localTodayIso(): string {
  const now = new Date()
  const pad2 = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

// --- Konto-Formular (Hinzufügen + Bearbeiten, gleiche Komponente) ---

interface AccountFormValues {
  name: string
  type: AccountType
  institution: string
  purpose: string
  note: string
  countsAsFreeLiquidity: boolean
  allowNegativeBalance: boolean
}

function AccountForm({
  heading,
  initial,
  typeEditable,
  onCancel,
  onSubmit,
}: {
  heading: string
  initial: AccountFormValues
  /** Nur beim Hinzufügen wählbar; beim Bearbeiten wird der Typ als Text angezeigt. */
  typeEditable: boolean
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (values: AccountFormValues) => string | null
}) {
  const [values, setValues] = useState<AccountFormValues>(initial)
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function setField<K extends keyof AccountFormValues>(key: K, value: AccountFormValues[K]): void {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function onTypeChange(nextType: AccountType): void {
    // Beim Typwechsel die sinnvolle Vorbelegung übernehmen (Default nach Typ);
    // die Checkbox bleibt danach frei änderbar.
    setValues((current) => ({
      ...current,
      type: nextType,
      countsAsFreeLiquidity: defaultCountsAsFreeLiquidity(nextType),
    }))
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

  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      <h3>{heading}</h3>
      <div className="form-field">
        <label htmlFor="account-name">Name *</label>
        <input
          id="account-name"
          type="text"
          value={values.name}
          onChange={(event) => setField('name', event.target.value)}
          aria-invalid={nameError !== null || undefined}
          aria-describedby={nameError !== null ? 'account-name-error' : undefined}
        />
        {nameError !== null ? (
          <p id="account-name-error" className="field-error" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      {typeEditable ? (
        <div className="form-field">
          <label htmlFor="account-type">Typ *</label>
          <select
            id="account-type"
            value={values.type}
            onChange={(event) => onTypeChange(event.target.value as AccountType)}
          >
            {ADDABLE_ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="form-field">
          Typ: <strong>{typeLabel(values.type)}</strong> (bei bestehenden Konten nicht änderbar)
        </p>
      )}
      <div className="form-field">
        <label htmlFor="account-institution">Institut</label>
        <input
          id="account-institution"
          type="text"
          value={values.institution}
          onChange={(event) => setField('institution', event.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="account-purpose">Zweck</label>
        <input
          id="account-purpose"
          type="text"
          value={values.purpose}
          onChange={(event) => setField('purpose', event.target.value)}
        />
      </div>
      <div className="form-field">
        <label htmlFor="account-note">Notiz</label>
        <input
          id="account-note"
          type="text"
          value={values.note}
          onChange={(event) => setField('note', event.target.value)}
        />
      </div>
      <div className="form-field form-field-checkbox">
        <label>
          <input
            type="checkbox"
            checked={values.countsAsFreeLiquidity}
            onChange={(event) => setField('countsAsFreeLiquidity', event.target.checked)}
          />{' '}
          zählt zur frei verfügbaren Liquidität
        </label>
        <p className="app-hint">
          Kennzeichnung auf Datenebene: zweckgebundene Konten (z. B. die ING-Rücklage) bleiben
          hier abgewählt. Eine eigene Kennzahl „frei verfügbare Liquidität“ zeigt die App in V1
          noch nicht an.
        </p>
      </div>
      <div className="form-field form-field-checkbox">
        <label>
          <input
            type="checkbox"
            checked={values.allowNegativeBalance}
            onChange={(event) => setField('allowNegativeBalance', event.target.checked)}
          />{' '}
          negativer Saldo erlaubt
        </label>
        <p className="app-hint">
          Nur mit diesem Haken sind negative Salden gültig (z. B. Girokonto mit Dispo).
        </p>
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

// --- Saldo-Erfassung („Wert aktualisieren“) ---

function BalanceForm({
  account,
  onCancel,
  onSubmit,
}: {
  account: Account
  onCancel: () => void
  /** Liefert bei Erfolg null, sonst die deutsche Fehlermeldung der Datenfunktion. */
  onSubmit: (amount: number, dateIso: string) => string | null
}) {
  const [amountText, setAmountText] = useState('')
  const [dateIso, setDateIso] = useState(localTodayIso())
  const [amountError, setAmountError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setAmountError(null)
    setDateError(null)
    setGeneralError(null)
    // Review-Befund 3.2: strenges de-DE-Muster – "1.234" ist 1234 €, nie 1,234 €.
    const amount = parseGermanAmount(amountText)
    if (amount === null) {
      setAmountError('Bitte einen gültigen Betrag eingeben (z. B. 250,00 oder 1.234,56).')
      return
    }
    if (dateIso.trim() === '') {
      setDateError('Bitte ein Datum wählen.')
      return
    }
    const error = onSubmit(amount, dateIso)
    if (error === null) return
    // Fehlermeldungen der Datenfunktion feldnah anzeigen (Präfix „Betrag:“ / „Datum:“).
    if (error.startsWith('Betrag:')) setAmountError(error.slice('Betrag:'.length).trim())
    else if (error.startsWith('Datum:')) setDateError(error.slice('Datum:'.length).trim())
    else setGeneralError(error)
  }

  const heading = `Wert aktualisieren: ${account.name}`
  return (
    <form className="account-form" aria-label={heading} onSubmit={handleSubmit} noValidate>
      <h3>{heading}</h3>
      <p className="app-hint">
        Der neue Saldo wird als datierter Eintrag erfasst; die bisherige Historie bleibt erhalten.
        Gibt es am selben Datum bereits einen Eintrag, wird er ersetzt.
      </p>
      <div className="form-field">
        <label htmlFor="balance-amount">Betrag in Euro *</label>
        <input
          id="balance-amount"
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          aria-invalid={amountError !== null || undefined}
          aria-describedby={amountError !== null ? 'balance-amount-error' : undefined}
        />
        {amountError !== null ? (
          <p id="balance-amount-error" className="field-error" role="alert">
            {amountError}
          </p>
        ) : null}
      </div>
      <div className="form-field">
        <label htmlFor="balance-date">Datum *</label>
        <input
          id="balance-date"
          type="date"
          value={dateIso}
          onChange={(event) => setDateIso(event.target.value)}
          aria-invalid={dateError !== null || undefined}
          aria-describedby={dateError !== null ? 'balance-date-error' : undefined}
        />
        {dateError !== null ? (
          <p id="balance-date-error" className="field-error" role="alert">
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

// --- Wertdarstellung je Konto (Doppelzählungs-Modell, siehe src/data/accounts.ts) ---

function ValueCell({
  account,
  positions,
}: {
  account: Account
  positions: readonly PortfolioPosition[]
}) {
  if (account.type === 'depot') {
    const accountPositions = positions.filter((position) => position.accountId === account.id)
    if (accountPositions.length === 0) {
      return <span>Wert ergibt sich aus den Depotpositionen</span>
    }
    const { amount, missingIds } = depotValue(accountPositions)
    return (
      <span>
        Wert ergibt sich aus den Depotpositionen: {formatEuro(amount)}
        {missingIds.length > 0 ? ' (enthält Positionen ohne erfassten Wert)' : ''}
      </span>
    )
  }
  if (account.type === 'pension') {
    return <span>Merkposten ohne Wert</span>
  }
  const entry = latestEntry(account.balanceHistory)
  // Leere Historie = „unbekannt“, nie 0 (G11).
  return entry === null ? <span>unbekannt</span> : <span>{formatEuro(entry.amount)}</span>
}

function lastUpdateDate(account: Account): string {
  if (account.type === 'depot' || account.type === 'pension') return '–'
  const entry = latestEntry(account.balanceHistory)
  return entry === null ? '–' : entry.date
}

// --- Seite ---

type SortKey = 'name' | 'type'

interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

type EditorState =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; accountId: string }
  | { kind: 'balance'; accountId: string }

const EMPTY_FORM: AccountFormValues = {
  name: '',
  type: 'giro',
  institution: '',
  purpose: '',
  note: '',
  countsAsFreeLiquidity: defaultCountsAsFreeLiquidity('giro'),
  allowNegativeBalance: false,
}

function formValuesFromAccount(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    institution: account.institution ?? '',
    purpose: account.purpose ?? '',
    note: account.note ?? '',
    countsAsFreeLiquidity:
      account.countsAsFreeLiquidity ?? defaultCountsAsFreeLiquidity(account.type),
    allowNegativeBalance: account.allowNegativeBalance === true,
  }
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

function CountingRules() {
  return (
    <details className="model-hint">
      <summary>So werden Konten gezählt (keine Doppelzählung)</summary>
      <ul>
        <li>
          Depot-Konten haben keinen eigenen Wert: Der Depotwert entsteht ausschließlich aus den
          Depotpositionen. Pensionskonten sind Merkposten ohne Wert.
        </li>
        <li>
          Jedes Konto zählt genau einmal nach seinem Typ, z. B. Tagesgeld gesamt = Summe der
          aktiven Tagesgeld-Konten.
        </li>
        <li>
          Deaktivierte Konten fließen in keine Summen ein, bleiben aber sichtbar gelistet (Status
          „Inaktiv“).
        </li>
      </ul>
    </details>
  )
}

export function AccountsPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions } = useFinanceData()
  const [editor, setEditor] = useState<EditorState>({ kind: 'closed' })
  const [sort, setSort] = useState<SortState | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const data = state.data
  if (data === null) {
    return (
      <section className="page" aria-labelledby="page-title">
        <h2 id="page-title">Konten</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  // Nach dem Guard fest als FinanceData gebunden (Funktionsdeklarationen unten
  // erhalten sonst keine Narrowing-Information).
  const loadedData: FinanceData = data
  const accounts = data.accounts
  const positions = data.portfolioPositions
  // Deaktivierte Konten fließen in KEINE Summen ein (Doppelzählungs-Modell, Regel 3).
  const activeAccounts = accounts.filter(isAccountActive)
  const tagesgeld = cashValue(activeAccounts)

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

  const sortedAccounts = accounts.slice()
  if (sort !== null) {
    const factor = sort.direction === 'asc' ? 1 : -1
    sortedAccounts.sort((a, b) => {
      const left = sort.key === 'name' ? a.name : typeLabel(a.type)
      const right = sort.key === 'name' ? b.name : typeLabel(b.type)
      return factor * left.localeCompare(right, 'de')
    })
  }

  function applyResult(result: AccountActionResult): string | null {
    if (!result.ok) return result.error
    actions.applyDataChange(result.data)
    setEditor({ kind: 'closed' })
    return null
  }

  function handleAddSubmit(values: AccountFormValues): string | null {
    return applyResult(
      addAccount(loadedData, {
        name: values.name,
        type: values.type,
        institution: textOrNull(values.institution),
        purpose: textOrNull(values.purpose),
        note: textOrNull(values.note),
        countsAsFreeLiquidity: values.countsAsFreeLiquidity,
        allowNegativeBalance: values.allowNegativeBalance,
      }),
    )
  }

  function handleEditSubmit(accountId: string, values: AccountFormValues): string | null {
    return applyResult(
      updateAccount(loadedData, accountId, {
        name: values.name,
        institution: textOrNull(values.institution),
        purpose: textOrNull(values.purpose),
        note: textOrNull(values.note),
        countsAsFreeLiquidity: values.countsAsFreeLiquidity,
        allowNegativeBalance: values.allowNegativeBalance,
      }),
    )
  }

  function handleBalanceSubmit(accountId: string, amount: number, dateIso: string): string | null {
    return applyResult(setAccountBalance(loadedData, accountId, amount, dateIso))
  }

  function handleToggleActive(account: Account): void {
    setActionError(null)
    const currentlyActive = isAccountActive(account)
    if (currentlyActive) {
      // Kritische Aktion: Bestätigung mit klarem Text (G12).
      const proceed = window.confirm(
        `Konto „${account.name}“ deaktivieren? Es fließt danach nicht mehr in Summen ein, bleibt aber sichtbar gelistet.`,
      )
      if (!proceed) return
    }
    const result = setAccountActive(loadedData, account.id, !currentlyActive)
    if (result.ok) actions.applyDataChange(result.data)
    else setActionError(result.error)
  }

  const editingAccount =
    editor.kind === 'edit' || editor.kind === 'balance'
      ? (accounts.find((account) => account.id === editor.accountId) ?? null)
      : null

  return (
    <section className="page" aria-labelledby="page-title">
      <h2 id="page-title">Konten</h2>
      <p className="app-hint">
        Alle Konten des geladenen Bestands. Salden werden als datierte Einträge erfasst; der
        aktuelle Wert ist immer der jüngste Eintrag.
      </p>
      <CountingRules />

      <div className="toolbar">
        <button
          type="button"
          onClick={() => setEditor({ kind: 'add' })}
          disabled={state.isSaving || editor.kind === 'add'}
        >
          Konto hinzufügen
        </button>
      </div>

      {actionError !== null ? (
        <p className="operation-error" role="alert">
          ⚠ {actionError}
        </p>
      ) : null}

      {editor.kind === 'add' ? (
        <AccountForm
          heading="Konto hinzufügen"
          initial={EMPTY_FORM}
          typeEditable={true}
          onCancel={() => setEditor({ kind: 'closed' })}
          onSubmit={handleAddSubmit}
        />
      ) : null}
      {editor.kind === 'edit' && editingAccount !== null ? (
        <AccountForm
          // Review-Befund 3.1: key erzwingt eine frische Formularinstanz je Konto –
          // sonst "klebt" der Zustand beim Zielwechsel und schreibt aufs falsche Konto.
          key={editingAccount.id}
          heading={`Konto bearbeiten: ${editingAccount.name}`}
          initial={formValuesFromAccount(editingAccount)}
          typeEditable={false}
          onCancel={() => setEditor({ kind: 'closed' })}
          onSubmit={(values) => handleEditSubmit(editingAccount.id, values)}
        />
      ) : null}
      {editor.kind === 'balance' && editingAccount !== null ? (
        <BalanceForm
          key={editingAccount.id}
          account={editingAccount}
          onCancel={() => setEditor({ kind: 'closed' })}
          onSubmit={(amount, dateIso) => handleBalanceSubmit(editingAccount.id, amount, dateIso)}
        />
      ) : null}

      {accounts.length === 0 ? (
        <p className="app-hint">
          Der geladene Bestand enthält noch keine Konten. Lege mit „Konto hinzufügen“ das erste
          Konto an.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="accounts-table">
              <caption className="visually-hidden">Kontenliste</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort('name')}>
                    <button type="button" className="sort-button" onClick={() => toggleSort('name')}>
                      Name{sortIndicator('name')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={ariaSort('type')}>
                    <button type="button" className="sort-button" onClick={() => toggleSort('type')}>
                      Typ{sortIndicator('type')}
                    </button>
                  </th>
                  <th scope="col">Institut</th>
                  <th scope="col">Zweck</th>
                  <th scope="col">Aktueller Wert</th>
                  <th scope="col">Letzte Aktualisierung</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {sortedAccounts.map((account) => {
                  const active = isAccountActive(account)
                  const hasOwnValue = account.type !== 'depot' && account.type !== 'pension'
                  return (
                    <tr key={account.id}>
                      <th scope="row">{account.name}</th>
                      <td>{typeLabel(account.type)}</td>
                      <td>{account.institution ?? '–'}</td>
                      <td>{account.purpose ?? '–'}</td>
                      <td>
                        <ValueCell account={account} positions={positions} />
                      </td>
                      <td>{lastUpdateDate(account)}</td>
                      <td>{active ? 'Aktiv' : <strong>Inaktiv</strong>}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            aria-label={`Konto „${account.name}“ bearbeiten`}
                            onClick={() => {
                              setActionError(null)
                              setEditor({ kind: 'edit', accountId: account.id })
                            }}
                            disabled={state.isSaving}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            aria-label={
                              active
                                ? `Konto „${account.name}“ deaktivieren`
                                : `Konto „${account.name}“ aktivieren`
                            }
                            onClick={() => handleToggleActive(account)}
                            disabled={state.isSaving}
                          >
                            {active ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                          {hasOwnValue ? (
                            <button
                              type="button"
                              aria-label={`Wert von „${account.name}“ aktualisieren`}
                              onClick={() => {
                                setActionError(null)
                                setEditor({ kind: 'balance', accountId: account.id })
                              }}
                              disabled={state.isSaving}
                            >
                              Wert aktualisieren
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
          <p className="sum-line">
            Tagesgeld gesamt (aktive Konten): <strong>{formatEuro(tagesgeld.amount)}</strong>
          </p>
          {tagesgeld.missingIds.length > 0 ? (
            <p className="app-hint">enthält Konten ohne erfassten Saldo</p>
          ) : null}
        </>
      )}
    </section>
  )
}
