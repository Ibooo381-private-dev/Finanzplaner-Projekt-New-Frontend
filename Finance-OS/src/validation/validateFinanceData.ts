/**
 * Vollständige Validierung eines unbekannten Werts gegen schemaVersion 1
 * (Blueprint §3, docs/data-model.md Abschnitt 5, Stufen A → B → C/D).
 *
 * Verbindliche Technik (Regel 16): Die Validierung ist ein Type-Guard.
 * Das geparste Objekt wird NIE umkopiert, neu aufgebaut oder gefiltert –
 * unbekannte Felder erzeugen nie Fehler oder Warnungen. Einzige Mutation:
 * Fehlende optionale Arrays werden bei Erfolg als [] gesetzt
 * (Loader-Normalisierung, docs/data-model.md Abschnitt 1).
 *
 * Zeit wird injiziert (Blueprint §7.7): Die Zukunftsprüfung (W_FUTURE_DATE)
 * läuft nur, wenn ein Referenzdatum übergeben wird – kein interner new-Date-Aufruf.
 */

import type { FinanceData } from '../types/finance'
import { SUPPORTED_SCHEMA_VERSION } from '../types/finance'
import type { ValidationIssue, ValidationResult } from './issues'
import { formatValue, msgEnum, msgMissing, msgWrongType } from './issues'
import { formatIsoDateGerman } from '../format/date'

export interface ValidateOptions {
  /** Referenzdatum (JJJJ-MM-TT) für W_FUTURE_DATE; ohne Angabe entfällt die Zukunftsprüfung. */
  todayIso?: string
}

// +bargeld +sonstiges: additive Enum-Erweiterung vor Erstveröffentlichung
// (Modul Konten, protokolliert in docs/data-model.md §6).
const ACCOUNT_TYPES = [
  'giro',
  'tagesgeld',
  'depot',
  'cash',
  'bargeld',
  'sonstiges',
  'ruecklage',
  'krypto',
  'pension',
] as const
const POSITION_GROUPS = ['world', 'em', 'gold', 'telekom'] as const
const ASSET_CLASSES = ['etf', 'etc', 'stock'] as const
const TARGET_KINDS = ['position', 'account'] as const
// +quarterly +halfyearly +once: additive Enum-Erweiterung (Modul Sparpläne M10,
// 2026-07-19, protokolliert in docs/data-model.md §6). Atomar gekoppelt mit der
// monthlyAmount-Erweiterung in src/finance/savings.ts (Auflage 2g) – sonst würde
// quarterly fälschlich mit /12 geglättet.
const INTERVALS = ['monthly', 'yearly', 'quarterly', 'halfyearly', 'once'] as const
const FLOW_TYPES = [
  'own_fixed',
  'own_variable',
  'employer',
  'provider',
  'reserve_transfer',
  'liquidity_transfer',
] as const
const PROFILE_KINDS = ['student-sparplan', 'student-bestand', 'job', 'custom'] as const
const PROFILE_BASES = ['savingsRate', 'holdings'] as const
// +archived: additive Enum-Erweiterung (Modul Ziele M12, 2026-07-20,
// protokolliert in docs/data-model.md §6). Atomar gekoppelt mit
// deriveGoalStatus/GOAL_STATUS_LABELS (Auflage H) – 'reached' ist ab M12
// verbindlich „manuell abgeschlossen“; rechnerisch erreicht wird nie gespeichert.
const GOAL_STATUS = ['active', 'deferred', 'reached', 'archived'] as const
// +accountBalance +positionValue +manual: additive Enum-Erweiterung (M12, §6).
// Atomar gekoppelt mit goalActualValue in src/finance/goals.ts (Auflage H).
const GOAL_METRICS = [
  'tagesgeld',
  'depotValue',
  'totalWealth',
  'monthlySavingsRate',
  'accountBalance',
  'positionValue',
  'manual',
] as const
/** Ziel-Kennzahlen, die eine Referenz (refId) verlangen (M12, Auflage B). */
const GOAL_REF_METRICS = ['accountBalance', 'positionValue'] as const
const SNAPSHOT_SOURCES = ['seed', 'user', 'import'] as const
const IMPORT_ACTIONS = ['import', 'migration'] as const
const IMPORT_OUTCOMES = ['applied', 'rejected', 'cancelled'] as const
const BACKUP_MODES = ['everySave', 'dailyFirstSave'] as const
const WEIGHT_REF_KINDS = ['position', 'group'] as const
// +discarded: additive Enum-Erweiterung (Modul Rebalancing M11, 2026-07-20,
// protokolliert in docs/data-model.md §6). 'planned' = „geplant, nicht
// ausgeführt" (G5); 'discarded' = verworfen (kein Löschen, Historie bleibt).
const PLANNED_CHANGE_STATUS = ['planned', 'discarded'] as const
const TELEKOM_MODES = ['real', 'smoothed'] as const
// +target ('depot' Default | 'cash'): additive Erweiterung (Modul Simulator
// M13, 2026-07-20, protokolliert in docs/data-model.md §6). Die ECHTEN
// Verschärfungen des simulations-Blocks (annualReturnRate ∈ [0; 0,15],
// months Ganzzahl 1–1200, Transfer-flowType-Verbot, Beträge/Startwerte ≥ 0)
// sind dort als §6-Ausweis dokumentiert – es gab nie einen Schreibpfad für
// simulations (Beispieldatei [], keine App-Version schrieb sie).
const SIMULATION_TARGETS = ['depot', 'cash'] as const
/** Umbuchungen sind in Simulationen unzulässig (G7): kein realer Vermögenszufluss. */
const SIMULATION_FORBIDDEN_FLOW_TYPES = ['reserve_transfer', 'liquidity_transfer'] as const
/** Harte Obergrenze des Simulationshorizonts (100 Jahre, M13 – gegen UI-Sprengung). */
const SIMULATION_MAX_MONTHS = 1200
/** Obergrenze der jährlichen Renditeannahme (15 %, M13). */
const SIMULATION_MAX_RETURN_RATE = 0.15
/** Ab dieser Annahme (> 8 %) wird gewarnt – Warnung, nie Fehler (M13). */
const SIMULATION_RETURN_WARN_THRESHOLD = 0.08

/** Fehlende optionale Arrays werden beim Laden als [] gesetzt; der Writer schreibt sie immer. */
const OPTIONAL_ARRAYS = [
  'transactions',
  'plannedChanges',
  'simulations',
  'fixedCosts',
  'monthlyClosings',
  'journalEntries',
] as const

const AMOUNT_NULL_FLOW_TYPES = ['own_variable', 'provider']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Format JJJJ-MM-TT UND gültiges Kalenderdatum (A5, DM14). */
export function isValidBusinessDate(value: string): boolean {
  if (!BUSINESS_DATE_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12) return false
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function joinPath(base: string, key: string): string {
  return base === '' ? key : `${base}.${key}`
}

export function validateFinanceData(raw: unknown, options: ValidateOptions = {}): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const error = (code: string, path: string, message: string): void => {
    errors.push({ code, path, message })
  }
  const warn = (code: string, path: string, message: string): void => {
    warnings.push({ code, path, message })
  }
  const fail = (): ValidationResult => ({ ok: false, data: null, errors, warnings })

  // --- Feld-Helfer (überspringen bei Strukturfehlern tiefere Prüfungen desselben Pfads) ---

  const reqString = (obj: Record<string, unknown>, base: string, key: string): string | null => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      error('E_MISSING_KEY', path, msgMissing(key))
      return null
    }
    if (typeof value !== 'string') {
      error('E_WRONG_TYPE', path, msgWrongType(key, 'Text (String)', value))
      return null
    }
    return value
  }

  const optString = (obj: Record<string, unknown>, base: string, key: string): void => {
    const value = obj[key]
    if (value === undefined || value === null) return
    if (typeof value !== 'string') {
      error(
        'E_WRONG_TYPE',
        joinPath(base, key),
        msgWrongType(key, 'Text (String) oder null', value),
      )
    }
  }

  const optBoolean = (obj: Record<string, unknown>, base: string, key: string): void => {
    const value = obj[key]
    if (value === undefined) return
    if (typeof value !== 'boolean') {
      error(
        'E_WRONG_TYPE',
        joinPath(base, key),
        msgWrongType(key, 'Wahrheitswert (true/false)', value),
      )
    }
  }

  const reqBoolean = (obj: Record<string, unknown>, base: string, key: string): boolean | null => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      error('E_MISSING_KEY', path, msgMissing(key))
      return null
    }
    if (typeof value !== 'boolean') {
      error('E_WRONG_TYPE', path, msgWrongType(key, 'Wahrheitswert (true/false)', value))
      return null
    }
    return value
  }

  /**
   * Geld-/Zahlfelder (A4): typeof number und Number.isFinite.
   * Rückgabe: number = gültig, null = zulässiges null, undefined = fehlend/ungültig (Fehler gemeldet).
   */
  const numberField = (
    obj: Record<string, unknown>,
    base: string,
    key: string,
    opts: { required: boolean; allowNull: boolean },
  ): number | null | undefined => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      if (opts.required) error('E_MISSING_KEY', path, msgMissing(key))
      return undefined
    }
    if (value === null) {
      if (opts.allowNull) return null
      error(
        'E_MONEY_TYPE',
        path,
        `»${key}« muss eine Zahl sein und darf nicht null sein. Ist-Wert: null.`,
      )
      return undefined
    }
    if (typeof value !== 'number') {
      error(
        'E_MONEY_TYPE',
        path,
        `»${key}« muss eine JSON-Zahl sein (kein Text). Ist-Wert: ${formatValue(value)}.`,
      )
      return undefined
    }
    if (!Number.isFinite(value)) {
      error(
        'E_NOT_FINITE',
        path,
        `»${key}« muss eine endliche Zahl sein. Ist-Wert: ${String(value)}.`,
      )
      return undefined
    }
    return value
  }

  const enumField = <T extends string>(
    obj: Record<string, unknown>,
    base: string,
    key: string,
    allowed: readonly T[],
    opts: { required: boolean; allowNull: boolean; code?: string },
  ): T | null | undefined => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      if (opts.required) error('E_MISSING_KEY', path, msgMissing(key))
      return undefined
    }
    if (value === null && opts.allowNull) return null
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      error(opts.code ?? 'E_WRONG_TYPE', path, msgEnum(key, allowed, value))
      return undefined
    }
    return value as T
  }

  const businessDateField = (
    obj: Record<string, unknown>,
    base: string,
    key: string,
    opts: { required: boolean; allowNull: boolean },
  ): string | null | undefined => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      if (opts.required) error('E_MISSING_KEY', path, msgMissing(key))
      return undefined
    }
    if (value === null && opts.allowNull) return null
    if (typeof value !== 'string' || !isValidBusinessDate(value)) {
      error(
        'E_DATE_FORMAT',
        path,
        `»${key}« muss ein gültiges Kalenderdatum im Format JJJJ-MM-TT sein (z. B. "2026-07-17"). Ist-Wert: ${formatValue(value)}.`,
      )
      return undefined
    }
    return value
  }

  const timestampField = (
    obj: Record<string, unknown>,
    base: string,
    key: string,
    opts: { required: boolean },
  ): string | undefined => {
    const path = joinPath(base, key)
    const value = obj[key]
    if (value === undefined) {
      if (opts.required) error('E_MISSING_KEY', path, msgMissing(key))
      return undefined
    }
    if (typeof value !== 'string' || !isValidTimestamp(value)) {
      error(
        'E_DATE_FORMAT',
        path,
        `»${key}« muss ein gültiger ISO-8601-Zeitstempel sein (z. B. "2026-07-19T10:30:00.000Z"). Ist-Wert: ${formatValue(value)}.`,
      )
      return undefined
    }
    return value
  }

  // IDs: dateiweit eindeutig, nicht leer (A6).
  const seenIds = new Map<string, string>()
  const registerId = (value: string | null, path: string): void => {
    if (value === null) return
    if (value.trim() === '') {
      error('E_EMPTY_ID', path, 'Die ID darf nicht leer sein.')
      return
    }
    const firstPath = seenIds.get(value)
    if (firstPath !== undefined) {
      error(
        'E_DUPLICATE_ID',
        path,
        `Die ID "${value}" ist mehrfach vergeben (zuerst unter ${firstPath}). IDs müssen dateiweit eindeutig sein.`,
      )
      return
    }
    seenIds.set(value, path)
  }

  /**
   * Historien-Einträge { date, amount|value }: A4/A5, B3 (Datums-Eindeutigkeit, DM23)
   * und C1 (keine negativen Werte, DM20).
   */
  const validateHistory = (
    owner: Record<string, unknown>,
    base: string,
    key: 'balanceHistory' | 'valueHistory',
    opts: { allowNegative: boolean },
  ): void => {
    const valueKey = key === 'balanceHistory' ? 'amount' : 'value'
    const path = joinPath(base, key)
    const arr = owner[key]
    if (arr === undefined) {
      error('E_MISSING_KEY', path, msgMissing(key))
      return
    }
    if (!Array.isArray(arr)) {
      error('E_WRONG_TYPE', path, msgWrongType(key, 'Array', arr))
      return
    }
    const seenDates = new Set<string>()
    arr.forEach((entry, index) => {
      const entryPath = `${path}[${index}]`
      if (!isRecord(entry)) {
        error(
          'E_WRONG_TYPE',
          entryPath,
          msgWrongType(`${key}[${index}]`, `Objekt { date, ${valueKey} }`, entry),
        )
        return
      }
      const date = businessDateField(entry, entryPath, 'date', { required: true, allowNull: false })
      if (typeof date === 'string') {
        if (seenDates.has(date)) {
          error(
            'E_DUPLICATE_DATE',
            `${entryPath}.date`,
            `Das Datum "${date}" kommt in dieser Historie mehrfach vor. Je Historie ist jedes Datum nur einmal zulässig (DM23).`,
          )
        }
        seenDates.add(date)
      }
      const amount = numberField(entry, entryPath, valueKey, { required: true, allowNull: false })
      if (typeof amount === 'number' && amount < 0 && !opts.allowNegative) {
        error(
          'E_NEGATIVE_AMOUNT',
          `${entryPath}.${valueKey}`,
          key === 'balanceHistory'
            ? `Der Saldo darf nicht negativ sein (Ist-Wert: ${amount}). Negative Salden sind nur bei Konten mit allowNegativeBalance: true zulässig (DM20).`
            : `Der Positionswert darf nicht negativ sein (Ist-Wert: ${amount}).`,
        )
      }
    })
  }

  // ============================ Stufe A ============================

  if (!isRecord(raw)) {
    error(
      'E_WRONG_TYPE',
      '',
      `Die Datei enthält kein JSON-Objekt auf oberster Ebene. Ist-Wert: ${formatValue(raw)}.`,
    )
    return fail()
  }

  // A2: schemaVersion (bei Versionsfehlern keine weiteren Prüfungen – das Schema ist nicht vertrauenswürdig).
  const schemaVersion = raw['schemaVersion']
  if (schemaVersion === undefined) {
    error(
      'E_SCHEMA_VERSION',
      'schemaVersion',
      'Das Pflichtfeld »schemaVersion« fehlt. Die Datei kann keiner Finance-OS-Version zugeordnet werden und wird nicht geladen.',
    )
    return fail()
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    error(
      'E_SCHEMA_VERSION',
      'schemaVersion',
      `»schemaVersion« muss eine Ganzzahl sein. Ist-Wert: ${formatValue(schemaVersion)}.`,
    )
    return fail()
  }
  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    error(
      'E_SCHEMA_VERSION',
      'schemaVersion',
      `Diese Datei stammt aus einer neueren Version von Finance OS (schemaVersion ${schemaVersion}, unterstützt wird ${SUPPORTED_SCHEMA_VERSION}). Bitte aktualisiere die Anwendung, um die Datei zu öffnen. Deine Datei wurde nicht verändert.`,
    )
    return fail()
  }
  if (schemaVersion < 1) {
    error(
      'E_SCHEMA_VERSION',
      'schemaVersion',
      `»schemaVersion« ${schemaVersion} wird nicht unterstützt (kleinste gültige Version: 1). Deine Datei wurde nicht verändert.`,
    )
    return fail()
  }

  // A3: Pflicht-Top-Level-Schlüssel und Typen.
  const requireTopLevel = (key: string, kind: 'record' | 'array'): boolean => {
    const value = raw[key]
    if (value === undefined) {
      error('E_MISSING_KEY', key, msgMissing(key))
      return false
    }
    if (kind === 'record' ? !isRecord(value) : !Array.isArray(value)) {
      error('E_WRONG_TYPE', key, msgWrongType(key, kind === 'record' ? 'Objekt' : 'Array', value))
      return false
    }
    return true
  }

  const metadataOk = requireTopLevel('metadata', 'record')
  const settingsOk = requireTopLevel('settings', 'record')
  const accountsOk = requireTopLevel('accounts', 'array')
  const positionsOk = requireTopLevel('portfolioPositions', 'array')
  const snapshotsOk = requireTopLevel('snapshots', 'array')
  const plansOk = requireTopLevel('savingsPlans', 'array')
  const profilesOk = requireTopLevel('targetProfiles', 'array')
  const goalsOk = requireTopLevel('goals', 'array')
  const importHistoryOk = requireTopLevel('importHistory', 'array')

  const optionalArraysOk: Record<string, boolean> = {}
  for (const key of OPTIONAL_ARRAYS) {
    const value = raw[key]
    if (value === undefined) {
      optionalArraysOk[key] = true
      continue
    }
    if (!Array.isArray(value)) {
      error('E_WRONG_TYPE', key, msgWrongType(key, 'Array', value))
      optionalArraysOk[key] = false
      continue
    }
    optionalArraysOk[key] = true
  }

  // --- metadata (3.1) ---
  if (metadataOk) {
    const metadata = raw['metadata'] as Record<string, unknown>
    reqString(metadata, 'metadata', 'appName')
    timestampField(metadata, 'metadata', 'createdAt', { required: true })
    timestampField(metadata, 'metadata', 'updatedAt', { required: true })
    reqString(metadata, 'metadata', 'currency')
    optBoolean(metadata, 'metadata', 'isExampleData')
    optString(metadata, 'metadata', 'description')
  }

  // --- settings (3.2, C6) ---
  if (settingsOk) {
    const settings = raw['settings'] as Record<string, unknown>
    const emergencyFund = settings['emergencyFund']
    if (emergencyFund === undefined) {
      error('E_MISSING_KEY', 'settings.emergencyFund', msgMissing('emergencyFund'))
    } else if (!isRecord(emergencyFund)) {
      error(
        'E_WRONG_TYPE',
        'settings.emergencyFund',
        msgWrongType('emergencyFund', 'Objekt', emergencyFund),
      )
    } else {
      const efBase = 'settings.emergencyFund'
      const factor = numberField(emergencyFund, efBase, 'factor', {
        required: true,
        allowNull: false,
      })
      if (typeof factor === 'number' && (factor < 3 || factor > 5)) {
        error(
          'E_SETTINGS_RANGE',
          `${efBase}.factor`,
          `»factor« muss zwischen 3 und 5 liegen. Ist-Wert: ${factor}.`,
        )
      }
      const netIncome = numberField(emergencyFund, efBase, 'netIncomeMonthly', {
        required: true,
        allowNull: false,
      })
      if (typeof netIncome === 'number' && netIncome <= 0) {
        error(
          'E_SETTINGS_RANGE',
          `${efBase}.netIncomeMonthly`,
          `»netIncomeMonthly« muss größer als 0 sein. Ist-Wert: ${netIncome}.`,
        )
      }
      const override = numberField(emergencyFund, efBase, 'manualOverrideAmount', {
        required: false,
        allowNull: true,
      })
      if (typeof override === 'number' && override <= 0) {
        error(
          'E_SETTINGS_RANGE',
          `${efBase}.manualOverrideAmount`,
          `»manualOverrideAmount« muss größer als 0 oder null sein. Ist-Wert: ${override}.`,
        )
      }
    }
    const budget = numberField(settings, 'settings', 'monthlySavingsBudget', {
      required: false,
      allowNull: true,
    })
    if (typeof budget === 'number' && budget < 0) {
      error(
        'E_SETTINGS_RANGE',
        'settings.monthlySavingsBudget',
        `»monthlySavingsBudget« muss größer oder gleich 0 oder null sein. Ist-Wert: ${budget}.`,
      )
    }
    const backup = settings['backup']
    if (backup !== undefined) {
      if (!isRecord(backup)) {
        error('E_WRONG_TYPE', 'settings.backup', msgWrongType('backup', 'Objekt', backup))
      } else {
        enumField(backup, 'settings.backup', 'mode', BACKUP_MODES, {
          required: false,
          allowNull: false,
          code: 'E_SETTINGS_RANGE',
        })
        const retention = backup['retentionCount']
        if (
          retention !== undefined &&
          (typeof retention !== 'number' || !Number.isInteger(retention) || retention <= 0)
        ) {
          error(
            'E_SETTINGS_RANGE',
            'settings.backup.retentionCount',
            `»retentionCount« muss eine positive Ganzzahl sein. Ist-Wert: ${formatValue(retention)}.`,
          )
        }
      }
    }
    const display = settings['display']
    if (display !== undefined) {
      if (!isRecord(display)) {
        error('E_WRONG_TYPE', 'settings.display', msgWrongType('display', 'Objekt', display))
      } else {
        optString(display, 'settings.display', 'numberLocale')
        const decimals = numberField(display, 'settings.display', 'percentDecimals', {
          required: false,
          allowNull: false,
        })
        // Verschärfung (Modul Einstellungen M14, 2026-07-20, dokumentierter
        // §6-Ausweis, Auflage A6): percentDecimals muss eine Ganzzahl 0–4 sein
        // (zuvor nur „endliche Zahl“). Schreibseite (src/data/settings.ts)
        // prüft identisch; die Beispieldatei (2) und der Seed (2) laden
        // unverändert – die Prüfung verhindert einen Format-Crash der
        // Prozentanzeige (Intl mit ungültigen fractionDigits).
        if (
          typeof decimals === 'number' &&
          (!Number.isInteger(decimals) || decimals < 0 || decimals > 4)
        ) {
          error(
            'E_SETTINGS_RANGE',
            'settings.display.percentDecimals',
            `»percentDecimals« muss eine Ganzzahl zwischen 0 und 4 sein. Ist-Wert: ${decimals}.`,
          )
        }
      }
    }
    optString(settings, 'settings', 'activeTargetProfileId')
  }

  // --- accounts (3.3) ---
  if (accountsOk) {
    ;(raw['accounts'] as unknown[]).forEach((item, index) => {
      const base = `accounts[${index}]`
      if (!isRecord(item)) {
        error('E_WRONG_TYPE', base, msgWrongType(`accounts[${index}]`, 'Objekt (Konto)', item))
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      optString(item, base, 'institution')
      const type = enumField(item, base, 'type', ACCOUNT_TYPES, {
        required: true,
        allowNull: false,
      })
      const earmark = item['earmark']
      if (earmark !== undefined && earmark !== null && earmark !== 'shares2you') {
        error('E_WRONG_TYPE', `${base}.earmark`, msgEnum('earmark', ['shares2you'], earmark))
      }
      optBoolean(item, base, 'countsAsFreeLiquidity')
      optBoolean(item, base, 'includeInInvestedWealth')
      optBoolean(item, base, 'allowNegativeBalance')
      // Additive optionale Felder (Modul Konten): isActive (Default true), purpose (Default null).
      optBoolean(item, base, 'isActive')
      optString(item, base, 'purpose')
      optBoolean(item, base, 'needsReview')
      optString(item, base, 'note')
      const allowNegative = item['allowNegativeBalance'] === true
      validateHistory(item, base, 'balanceHistory', { allowNegative })
      // C2 (DM19): Depot- und Pension-Konten führen keine eigene Saldo-Historie.
      const history = item['balanceHistory']
      if (
        (type === 'depot' || type === 'pension') &&
        Array.isArray(history) &&
        history.length > 0
      ) {
        error(
          'E_DEPOT_BALANCE',
          `${base}.balanceHistory`,
          `Konten vom Typ "${type}" dürfen keine eigene Saldo-Historie führen (Ist: ${history.length} Eintrag/Einträge). Der Depotwert wird immer aus den Positionswerten berechnet (DM19).`,
        )
      }
    })
  }

  // --- portfolioPositions (3.4) ---
  if (positionsOk) {
    ;(raw['portfolioPositions'] as unknown[]).forEach((item, index) => {
      const base = `portfolioPositions[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`portfolioPositions[${index}]`, 'Objekt (Depotposition)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      optString(item, base, 'isin')
      reqString(item, base, 'accountId')
      enumField(item, base, 'assetClass', ASSET_CLASSES, { required: false, allowNull: false })
      enumField(item, base, 'group', POSITION_GROUPS, { required: true, allowNull: false })
      optBoolean(item, base, 'isVL')
      // Additives optionales Feld (Modul Depot): isActive (Default true).
      optBoolean(item, base, 'isActive')
      optBoolean(item, base, 'needsReview')
      optString(item, base, 'note')
      validateHistory(item, base, 'valueHistory', { allowNegative: false })
    })
  }

  // --- snapshots (3.5) ---
  if (snapshotsOk) {
    ;(raw['snapshots'] as unknown[]).forEach((item, index) => {
      const base = `snapshots[${index}]`
      if (!isRecord(item)) {
        error('E_WRONG_TYPE', base, msgWrongType(`snapshots[${index}]`, 'Objekt (Snapshot)', item))
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      businessDateField(item, base, 'date', { required: true, allowNull: false })
      reqBoolean(item, base, 'locked')
      optString(item, base, 'label')
      enumField(item, base, 'source', SNAPSHOT_SOURCES, { required: false, allowNull: false })
    })
  }

  // --- savingsPlans (3.6, C1/C3/C4) ---
  if (plansOk) {
    ;(raw['savingsPlans'] as unknown[]).forEach((item, index) => {
      const base = `savingsPlans[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`savingsPlans[${index}]`, 'Objekt (Sparplan)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      const targetKind = enumField(item, base, 'targetKind', TARGET_KINDS, {
        required: true,
        allowNull: false,
      })
      reqString(item, base, 'targetId')
      const amount = numberField(item, base, 'amount', { required: true, allowNull: true })
      const interval = enumField(item, base, 'interval', INTERVALS, {
        required: true,
        allowNull: false,
      })
      const dueMonth = numberField(item, base, 'dueMonth', { required: false, allowNull: true })
      const flowType = enumField(item, base, 'flowType', FLOW_TYPES, {
        required: true,
        allowNull: false,
        code: 'E_FLOWTYPE',
      })
      optBoolean(item, base, 'isFlexible')
      // Additives optionales Feld (Modul Sparpläne M10): isPaused (Default false).
      optBoolean(item, base, 'isPaused')
      const minAmount = numberField(item, base, 'minAmount', { required: false, allowNull: true })
      // C7 (Review-Befund 3.4): minAmount >= 0, falls gesetzt.
      if (typeof minAmount === 'number' && minAmount < 0) {
        error(
          'E_NEGATIVE_AMOUNT',
          `${base}.minAmount`,
          `»minAmount« darf nicht negativ sein. Ist-Wert: ${minAmount}.`,
        )
      }
      const validFrom = businessDateField(item, base, 'validFrom', {
        required: true,
        allowNull: false,
      })
      const validUntil = businessDateField(item, base, 'validUntil', {
        required: false,
        allowNull: true,
      })
      optBoolean(item, base, 'needsReview')
      optString(item, base, 'note')
      // C1 (DM20): amount >= 0, falls nicht null.
      if (typeof amount === 'number' && amount < 0) {
        error(
          'E_NEGATIVE_AMOUNT',
          `${base}.amount`,
          `»amount« darf nicht negativ sein. Ist-Wert: ${amount}.`,
        )
      }
      // C4 (DM18): amount null nur bei own_variable/provider.
      if (
        amount === null &&
        typeof flowType === 'string' &&
        !AMOUNT_NULL_FLOW_TYPES.includes(flowType)
      ) {
        error(
          'E_AMOUNT_NULL',
          `${base}.amount`,
          `»amount« darf nur bei den variablen Zuflussarten "own_variable" oder "provider" null sein. Ist-Zuflussart: "${flowType}" (DM18).`,
        )
      }
      // C3 (DM17/G7): Umbuchungen nur auf Konten.
      if (
        (flowType === 'reserve_transfer' || flowType === 'liquidity_transfer') &&
        typeof targetKind === 'string' &&
        targetKind !== 'account'
      ) {
        error(
          'E_FLOWTYPE',
          `${base}.flowType`,
          `Die Zuflussart "${flowType}" ist eine Umbuchung und nur mit targetKind "account" zulässig. Ist-targetKind: "${targetKind}" (DM17/G7).`,
        )
      }
      // C4: validUntil >= validFrom.
      if (
        typeof validFrom === 'string' &&
        typeof validUntil === 'string' &&
        validUntil < validFrom
      ) {
        error(
          'E_AMOUNT_NULL',
          `${base}.validUntil`,
          `»validUntil« ("${validUntil}") darf nicht vor »validFrom« ("${validFrom}") liegen.`,
        )
      }
      // C4: dueMonth ∈ [1;12] oder null.
      if (
        typeof dueMonth === 'number' &&
        (!Number.isInteger(dueMonth) || dueMonth < 1 || dueMonth > 12)
      ) {
        error(
          'E_AMOUNT_NULL',
          `${base}.dueMonth`,
          `»dueMonth« muss eine Ganzzahl von 1 bis 12 oder null sein. Ist-Wert: ${dueMonth}.`,
        )
      }
      // M10 (Auflage 2f, additiv): dueMonth nur bei interval "yearly" – Fehler NUR
      // bei NUMERISCHEM dueMonth mit anderem Intervall; null/fehlend ist überall gültig.
      if (
        typeof dueMonth === 'number' &&
        typeof interval === 'string' &&
        interval !== 'yearly'
      ) {
        error(
          'E_AMOUNT_NULL',
          `${base}.dueMonth`,
          `»dueMonth« ist nur bei jährlichen Sparplänen (interval "yearly") zulässig. Ist-Intervall: "${interval}".`,
        )
      }
      // M10: einmalige Zuflüsse (interval "once") brauchen einen Betrag –
      // amount null ist bei once nie zulässig (auch nicht bei variablen Zuflussarten).
      if (interval === 'once' && amount === null) {
        error(
          'E_AMOUNT_NULL',
          `${base}.amount`,
          '»amount« darf bei einmaligen Zuflüssen (interval "once") nicht null sein – ein einmaliger Zufluss ohne Betrag ist nicht erfassbar.',
        )
      }
      // M10 (Auflage 2a, tolerante Ladeprüfung): once → validUntil null ODER = validFrom
      // (das Ausführungsdatum IST validFrom; der Datenlayer normalisiert auf validFrom).
      if (
        interval === 'once' &&
        typeof validFrom === 'string' &&
        typeof validUntil === 'string' &&
        validUntil !== validFrom
      ) {
        error(
          'E_AMOUNT_NULL',
          `${base}.validUntil`,
          `»validUntil« muss bei einmaligen Zuflüssen (interval "once") null oder gleich »validFrom« sein (Ausführungsdatum). Ist-Wert: "${validUntil}", validFrom: "${validFrom}".`,
        )
      }
    })
  }

  // --- targetProfiles (3.8, A4/C5) ---
  if (profilesOk) {
    ;(raw['targetProfiles'] as unknown[]).forEach((item, index) => {
      const base = `targetProfiles[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`targetProfiles[${index}]`, 'Objekt (Zielprofil)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      enumField(item, base, 'kind', PROFILE_KINDS, { required: true, allowNull: false })
      enumField(item, base, 'basis', PROFILE_BASES, { required: true, allowNull: false })
      optString(item, base, 'note')
      const level1 = item['level1']
      if (level1 !== undefined && level1 !== null) {
        if (!isRecord(level1)) {
          error(
            'E_WRONG_TYPE',
            `${base}.level1`,
            msgWrongType('level1', 'Objekt { depotShare, cashShare } oder null', level1),
          )
        } else {
          const l1Base = `${base}.level1`
          const depotShare = numberField(level1, l1Base, 'depotShare', {
            required: true,
            allowNull: false,
          })
          const cashShare = numberField(level1, l1Base, 'cashShare', {
            required: true,
            allowNull: false,
          })
          // A2 (Review-Befund 3.4): Anteile einzeln als Dezimalzahlen in [0;1].
          ;(
            [
              ['depotShare', depotShare],
              ['cashShare', cashShare],
            ] as const
          ).forEach(([fieldName, value]) => {
            if (typeof value === 'number' && (value < 0 || value > 1)) {
              error(
                'E_NOT_FINITE',
                `${l1Base}.${fieldName}`,
                `»${fieldName}« muss eine Dezimalzahl zwischen 0 und 1 sein (z. B. 0,85 für 85 %). Ist-Wert: ${value}.`,
              )
            }
          })
          // C5: |depotShare + cashShare − 1| <= 0,001.
          if (typeof depotShare === 'number' && typeof cashShare === 'number') {
            const sum = depotShare + cashShare
            if (Math.abs(sum - 1) > 0.001) {
              const shown = Math.round(sum * 1e6) / 1e6
              error(
                'E_WEIGHT_SUM',
                l1Base,
                `»depotShare« und »cashShare« müssen zusammen 1,0 ergeben (±0,001). Ist-Summe: ${shown}.`,
              )
            }
          }
        }
      }
      const weights = item['weights']
      if (weights !== undefined && weights !== null) {
        if (!Array.isArray(weights)) {
          error(
            'E_WRONG_TYPE',
            `${base}.weights`,
            msgWrongType('weights', 'Array oder null', weights),
          )
        } else if (weights.length > 0) {
          let allNumbers = true
          let sum = 0
          weights.forEach((weightEntry, weightIndex) => {
            const wBase = `${base}.weights[${weightIndex}]`
            if (!isRecord(weightEntry)) {
              error(
                'E_WRONG_TYPE',
                wBase,
                msgWrongType(
                  `weights[${weightIndex}]`,
                  'Objekt { refKind, ref, weight }',
                  weightEntry,
                ),
              )
              allNumbers = false
              return
            }
            enumField(weightEntry, wBase, 'refKind', WEIGHT_REF_KINDS, {
              required: true,
              allowNull: false,
            })
            reqString(weightEntry, wBase, 'ref')
            const weight = numberField(weightEntry, wBase, 'weight', {
              required: true,
              allowNull: false,
            })
            if (typeof weight !== 'number') {
              allNumbers = false
              return
            }
            // A4: Gewichte ∈ [0;1].
            if (weight < 0 || weight > 1) {
              error(
                'E_NOT_FINITE',
                `${wBase}.weight`,
                `»weight« muss zwischen 0 und 1 liegen (Dezimalzahl, 0,15 = 15 %). Ist-Wert: ${weight}.`,
              )
              allNumbers = false
              return
            }
            sum += weight
          })
          // C5 (DM10): befüllte Gewichte müssen in Summe 1,0 (±0,001) ergeben; Meldung nennt Ist-Summe.
          if (allNumbers && Math.abs(sum - 1) > 0.001) {
            const shown = Math.round(sum * 1e6) / 1e6
            error(
              'E_WEIGHT_SUM',
              `${base}.weights`,
              `Die Summe der Gewichte muss 1,0 ergeben (±0,001). Ist-Summe: ${shown} (DM10).`,
            )
          }
        }
      }
    })
  }

  // --- goals (3.9, C6) ---
  if (goalsOk) {
    ;(raw['goals'] as unknown[]).forEach((item, index) => {
      const base = `goals[${index}]`
      if (!isRecord(item)) {
        error('E_WRONG_TYPE', base, msgWrongType(`goals[${index}]`, 'Objekt (Ziel)', item))
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      enumField(item, base, 'status', GOAL_STATUS, { required: true, allowNull: false })
      const targetAmount = numberField(item, base, 'targetAmount', {
        required: false,
        allowNull: true,
      })
      if (typeof targetAmount === 'number' && targetAmount <= 0) {
        error(
          'E_SETTINGS_RANGE',
          `${base}.targetAmount`,
          `»targetAmount« muss größer als 0 oder null sein. Ist-Wert: ${targetAmount}.`,
        )
      }
      const targetDate = businessDateField(item, base, 'targetDate', {
        required: false,
        allowNull: true,
      })
      const metric = enumField(item, base, 'metric', GOAL_METRICS, {
        required: false,
        allowNull: true,
      })
      optBoolean(item, base, 'isAutoCalculated')
      // --- Additive M12-Felder (strikte Kopplung, Auflage B) ---
      const refId = item['refId']
      if (refId !== undefined && refId !== null && typeof refId !== 'string') {
        error('E_WRONG_TYPE', `${base}.refId`, msgWrongType('refId', 'Text (String) oder null', refId))
      }
      const hasRefId = typeof refId === 'string'
      const metricNeedsRef =
        typeof metric === 'string' && (GOAL_REF_METRICS as readonly string[]).includes(metric)
      // Ungültige metric-Werte haben bereits einen eigenen Fehler – die
      // Kopplungsprüfung meldet dann nicht doppelt.
      const metricFailed = item['metric'] !== undefined && metric === undefined
      if (hasRefId && !metricNeedsRef && !metricFailed) {
        error(
          'E_GOAL_COUPLING',
          `${base}.refId`,
          `»refId« ist nur bei den Ziel-Kennzahlen "accountBalance" und "positionValue" zulässig. Ist-Kennzahl: ${formatValue(item['metric'])}.`,
        )
      }
      if (!hasRefId && metricNeedsRef) {
        error(
          'E_GOAL_COUPLING',
          `${base}.refId`,
          `Ziele mit der Kennzahl "${metric}" benötigen eine gesetzte Referenz (»refId« auf ein ${metric === 'accountBalance' ? 'Konto' : 'eine Depotposition'}).`,
        )
      }
      const manualCurrentAmount = numberField(item, base, 'manualCurrentAmount', {
        required: false,
        allowNull: true,
      })
      if (typeof manualCurrentAmount === 'number' && manualCurrentAmount < 0) {
        error(
          'E_NEGATIVE_AMOUNT',
          `${base}.manualCurrentAmount`,
          `»manualCurrentAmount« darf nicht negativ sein. Ist-Wert: ${manualCurrentAmount}.`,
        )
      }
      if (typeof manualCurrentAmount === 'number' && metric !== 'manual' && !metricFailed) {
        error(
          'E_GOAL_COUPLING',
          `${base}.manualCurrentAmount`,
          `»manualCurrentAmount« ist nur bei der Ziel-Kennzahl "manual" zulässig. Ist-Kennzahl: ${formatValue(item['metric'])}.`,
        )
      }
      const startDate = businessDateField(item, base, 'startDate', {
        required: false,
        allowNull: true,
      })
      if (typeof startDate === 'string' && typeof targetDate === 'string' && targetDate < startDate) {
        error(
          'E_GOAL_COUPLING',
          `${base}.targetDate`,
          `»targetDate« ("${targetDate}") darf nicht vor »startDate« ("${startDate}") liegen.`,
        )
      }
      optString(item, base, 'note')
    })
  }

  // --- transactions (3.7, C1/C3) ---
  if (optionalArraysOk['transactions'] && Array.isArray(raw['transactions'])) {
    ;(raw['transactions'] as unknown[]).forEach((item, index) => {
      const base = `transactions[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`transactions[${index}]`, 'Objekt (Buchung)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      businessDateField(item, base, 'date', { required: true, allowNull: false })
      const amount = numberField(item, base, 'amount', { required: true, allowNull: false })
      // C1 (DM20): Buchungsbeträge strikt größer 0.
      if (typeof amount === 'number' && amount <= 0) {
        error(
          'E_NEGATIVE_AMOUNT',
          `${base}.amount`,
          `»amount« muss bei Buchungen größer als 0 sein. Ist-Wert: ${amount} (DM20).`,
        )
      }
      const flowType = enumField(item, base, 'flowType', FLOW_TYPES, {
        required: true,
        allowNull: false,
        code: 'E_FLOWTYPE',
      })
      const targetKind = enumField(item, base, 'targetKind', TARGET_KINDS, {
        required: true,
        allowNull: false,
      })
      reqString(item, base, 'targetId')
      optString(item, base, 'savingsPlanId')
      optString(item, base, 'note')
      if (
        (flowType === 'reserve_transfer' || flowType === 'liquidity_transfer') &&
        typeof targetKind === 'string' &&
        targetKind !== 'account'
      ) {
        error(
          'E_FLOWTYPE',
          `${base}.flowType`,
          `Die Zuflussart "${flowType}" ist eine Umbuchung und nur mit targetKind "account" zulässig. Ist-targetKind: "${targetKind}" (DM17/G7).`,
        )
      }
    })
  }

  // --- plannedChanges (3.10) ---
  if (optionalArraysOk['plannedChanges'] && Array.isArray(raw['plannedChanges'])) {
    ;(raw['plannedChanges'] as unknown[]).forEach((item, index) => {
      const base = `plannedChanges[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`plannedChanges[${index}]`, 'Objekt (geplante Änderung)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      timestampField(item, base, 'createdAt', { required: true })
      reqString(item, base, 'basedOnProfileId')
      enumField(item, base, 'status', PLANNED_CHANGE_STATUS, { required: true, allowNull: false })
      const items = item['items']
      if (items === undefined) {
        error('E_MISSING_KEY', `${base}.items`, msgMissing('items'))
      } else if (!Array.isArray(items)) {
        error('E_WRONG_TYPE', `${base}.items`, msgWrongType('items', 'Array', items))
      } else {
        items.forEach((planItem, itemIndex) => {
          const itemBase = `${base}.items[${itemIndex}]`
          if (!isRecord(planItem)) {
            error(
              'E_WRONG_TYPE',
              itemBase,
              msgWrongType(
                `items[${itemIndex}]`,
                'Objekt { refKind, ref, plannedMonthlyAmount }',
                planItem,
              ),
            )
            return
          }
          enumField(planItem, itemBase, 'refKind', WEIGHT_REF_KINDS, {
            required: true,
            allowNull: false,
          })
          reqString(planItem, itemBase, 'ref')
          const plannedMonthlyAmount = numberField(planItem, itemBase, 'plannedMonthlyAmount', {
            required: true,
            allowNull: false,
          })
          // C7/M11 (Review-Befund 3.4): keine geplante Rate < 0.
          if (typeof plannedMonthlyAmount === 'number' && plannedMonthlyAmount < 0) {
            error(
              'E_NEGATIVE_AMOUNT',
              `${itemBase}.plannedMonthlyAmount`,
              `»plannedMonthlyAmount« darf nicht negativ sein. Ist-Wert: ${plannedMonthlyAmount}.`,
            )
          }
        })
      }
      optString(item, base, 'note')
    })
  }

  // --- simulations (3.11) ---
  if (optionalArraysOk['simulations'] && Array.isArray(raw['simulations'])) {
    ;(raw['simulations'] as unknown[]).forEach((item, index) => {
      const base = `simulations[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`simulations[${index}]`, 'Objekt (Simulation)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      reqString(item, base, 'name')
      timestampField(item, base, 'createdAt', { required: true })
      optString(item, base, 'note')
      const params = item['params']
      if (params === undefined) {
        error('E_MISSING_KEY', `${base}.params`, msgMissing('params'))
      } else if (!isRecord(params)) {
        error('E_WRONG_TYPE', `${base}.params`, msgWrongType('params', 'Objekt', params))
      } else {
        const pBase = `${base}.params`
        // M13-Tiefenprüfung (additiv + dokumentierte Verschärfungen, §6-Ausweis):
        // Startwerte ≥ 0, months Ganzzahl 1–1200, annualReturnRate ∈ [0; 0,15],
        // Beiträge ≥ 0, Transfer-flowTypes verboten (G7), target-Enum.
        const startDepot = numberField(params, pBase, 'startDepotValue', {
          required: true,
          allowNull: false,
        })
        if (typeof startDepot === 'number' && startDepot < 0) {
          error(
            'E_NEGATIVE_AMOUNT',
            `${pBase}.startDepotValue`,
            `»startDepotValue« darf nicht negativ sein. Ist-Wert: ${startDepot}.`,
          )
        }
        const startCash = numberField(params, pBase, 'startTagesgeldValue', {
          required: true,
          allowNull: false,
        })
        if (typeof startCash === 'number' && startCash < 0) {
          error(
            'E_NEGATIVE_AMOUNT',
            `${pBase}.startTagesgeldValue`,
            `»startTagesgeldValue« darf nicht negativ sein. Ist-Wert: ${startCash}.`,
          )
        }
        const months = numberField(params, pBase, 'months', { required: true, allowNull: false })
        if (
          typeof months === 'number' &&
          (!Number.isInteger(months) || months < 1 || months > SIMULATION_MAX_MONTHS)
        ) {
          error(
            'E_SETTINGS_RANGE',
            `${pBase}.months`,
            `»months« muss eine Ganzzahl zwischen 1 und ${SIMULATION_MAX_MONTHS} (100 Jahre) sein. Ist-Wert: ${months}.`,
          )
        }
        const returnRate = numberField(params, pBase, 'annualReturnRate', {
          required: true,
          allowNull: false,
        })
        if (typeof returnRate === 'number') {
          if (returnRate < 0 || returnRate > SIMULATION_MAX_RETURN_RATE) {
            error(
              'E_SETTINGS_RANGE',
              `${pBase}.annualReturnRate`,
              `»annualReturnRate« muss eine Dezimalzahl zwischen 0 und 0.15 sein (0–15 % pro Jahr; negative Renditeannahmen sind in Version 1 nicht vorgesehen). Ist-Wert: ${returnRate}.`,
            )
          } else if (returnRate > SIMULATION_RETURN_WARN_THRESHOLD) {
            // Ausdrücklich WARNUNG, nie Fehler (M13, „Warnung bei Extremwerten“).
            warn(
              'W_RETURN_ASSUMPTION',
              `${pBase}.annualReturnRate`,
              `Die Renditeannahme von ${returnRate} (> 0.08 = 8 % pro Jahr) ist eine sehr optimistische Annahme.`,
            )
          }
        }
        enumField(params, pBase, 'telekomMode', TELEKOM_MODES, { required: true, allowNull: false })
        const contributions = params['monthlyContributions']
        if (contributions === undefined) {
          error(
            'E_MISSING_KEY',
            `${pBase}.monthlyContributions`,
            msgMissing('monthlyContributions'),
          )
        } else if (!Array.isArray(contributions)) {
          error(
            'E_WRONG_TYPE',
            `${pBase}.monthlyContributions`,
            msgWrongType('monthlyContributions', 'Array', contributions),
          )
        } else {
          contributions.forEach((contribution, contributionIndex) => {
            const cBase = `${pBase}.monthlyContributions[${contributionIndex}]`
            if (!isRecord(contribution)) {
              error(
                'E_WRONG_TYPE',
                cBase,
                msgWrongType(
                  `monthlyContributions[${contributionIndex}]`,
                  'Objekt { label, amount, flowType }',
                  contribution,
                ),
              )
              return
            }
            reqString(contribution, cBase, 'label')
            const amount = numberField(contribution, cBase, 'amount', {
              required: true,
              allowNull: false,
            })
            if (typeof amount === 'number' && amount < 0) {
              error(
                'E_NEGATIVE_AMOUNT',
                `${cBase}.amount`,
                `»amount« darf nicht negativ sein. Ist-Wert: ${amount}.`,
              )
            }
            const flowType = enumField(contribution, cBase, 'flowType', FLOW_TYPES, {
              required: true,
              allowNull: false,
              code: 'E_FLOWTYPE',
            })
            if (
              typeof flowType === 'string' &&
              (SIMULATION_FORBIDDEN_FLOW_TYPES as readonly string[]).includes(flowType)
            ) {
              error(
                'E_FLOWTYPE',
                `${cBase}.flowType`,
                `Die Zuflussart "${flowType}" ist eine Umbuchung und in Simulations-Beiträgen unzulässig (G7 – Umbuchungen sind kein Vermögenszufluss).`,
              )
            }
            enumField(contribution, cBase, 'target', SIMULATION_TARGETS, {
              required: false,
              allowNull: false,
            })
          })
        }
      }
    })
  }

  // --- importHistory (3.12, C7/DM22) ---
  if (importHistoryOk) {
    const history = raw['importHistory'] as unknown[]
    if (history.length > 50) {
      error(
        'E_IMPORT_HISTORY',
        'importHistory',
        `»importHistory« darf höchstens 50 Einträge enthalten. Ist-Anzahl: ${history.length} (DM22).`,
      )
    }
    history.forEach((item, index) => {
      const base = `importHistory[${index}]`
      if (!isRecord(item)) {
        error(
          'E_WRONG_TYPE',
          base,
          msgWrongType(`importHistory[${index}]`, 'Objekt (Protokolleintrag)', item),
        )
        return
      }
      registerId(reqString(item, base, 'id'), `${base}.id`)
      timestampField(item, base, 'timestamp', { required: true })
      enumField(item, base, 'action', IMPORT_ACTIONS, {
        required: true,
        allowNull: false,
        code: 'E_IMPORT_HISTORY',
      })
      enumField(item, base, 'outcome', IMPORT_OUTCOMES, {
        required: true,
        allowNull: false,
        code: 'E_IMPORT_HISTORY',
      })
      optString(item, base, 'fileName')
      numberField(item, base, 'fileSchemaVersion', { required: false, allowNull: true })
      optString(item, base, 'note')
    })
  }

  if (errors.length > 0) return fail()

  // Loader-Normalisierung direkt nach fehlerfreier Stufe A: fehlende optionale
  // Arrays als [] setzen (einzige Mutation, Regel 16-konform). Muss vor den
  // Stufen B/C liegen, da diese über transactions/plannedChanges/… iterieren.
  // Schlägt B/C später fehl, wird das Objekt verworfen (data: null) – die
  // Normalisierung ist dann nicht beobachtbar.
  for (const key of OPTIONAL_ARRAYS) {
    if (raw[key] === undefined) {
      raw[key] = []
    }
  }

  // ============================ Stufe B (nur bei fehlerfreier Stufe A) ============================

  const data = raw as unknown as FinanceData
  const accountById = new Map(data.accounts.map((account) => [account.id, account]))
  const positionIds = new Set(data.portfolioPositions.map((position) => position.id))
  const planIds = new Set(data.savingsPlans.map((plan) => plan.id))
  const profileIds = new Set(data.targetProfiles.map((profile) => profile.id))

  // B1: Position → existierendes Depot-Konto.
  data.portfolioPositions.forEach((position, index) => {
    const account = accountById.get(position.accountId)
    if (!account) {
      error(
        'E_REF_ACCOUNT',
        `portfolioPositions[${index}].accountId`,
        `Das referenzierte Konto "${position.accountId}" existiert nicht.`,
      )
    } else if (account.type !== 'depot') {
      error(
        'E_REF_ACCOUNT',
        `portfolioPositions[${index}].accountId`,
        `Das referenzierte Konto "${position.accountId}" ist kein Depot-Konto. Ist-Typ: "${account.type}".`,
      )
    }
  })

  // B2: Ziel-Referenzen passend zu targetKind; optionale Referenzen existieren falls gesetzt.
  const checkTargetRef = (targetKind: string, targetId: string, path: string): void => {
    const exists = targetKind === 'position' ? positionIds.has(targetId) : accountById.has(targetId)
    if (!exists) {
      error(
        'E_REF_TARGET',
        path,
        `Das Ziel "${targetId}" (targetKind "${targetKind}") existiert nicht.`,
      )
    }
  }
  data.savingsPlans.forEach((plan, index) => {
    checkTargetRef(plan.targetKind, plan.targetId, `savingsPlans[${index}].targetId`)
  })
  data.transactions.forEach((transaction, index) => {
    checkTargetRef(transaction.targetKind, transaction.targetId, `transactions[${index}].targetId`)
    if (typeof transaction.savingsPlanId === 'string' && !planIds.has(transaction.savingsPlanId)) {
      error(
        'E_REF_TARGET',
        `transactions[${index}].savingsPlanId`,
        `Der referenzierte Sparplan "${transaction.savingsPlanId}" existiert nicht.`,
      )
    }
  })
  // B (M12, Auflage B): Ziel-Referenzen passend zur Kennzahl – accountBalance
  // → existierendes Konto, positionValue → existierende Position. Tote oder
  // art-fremde Referenzen sind harte Fehler (E_REF_TARGET-Analogie);
  // DEAKTIVIERTE Referenzen sind KEIN Ladefehler (nur UI-Warnung).
  data.goals.forEach((goal, index) => {
    if (typeof goal.refId !== 'string') return
    if (goal.metric === 'accountBalance' && !accountById.has(goal.refId)) {
      error(
        'E_REF_TARGET',
        `goals[${index}].refId`,
        `Das referenzierte Konto "${goal.refId}" des Ziels "${goal.name}" existiert nicht.`,
      )
    }
    if (goal.metric === 'positionValue' && !positionIds.has(goal.refId)) {
      error(
        'E_REF_TARGET',
        `goals[${index}].refId`,
        `Die referenzierte Depotposition "${goal.refId}" des Ziels "${goal.name}" existiert nicht.`,
      )
    }
  })

  const activeProfileId = data.settings.activeTargetProfileId
  if (typeof activeProfileId === 'string' && !profileIds.has(activeProfileId)) {
    error(
      'E_REF_TARGET',
      'settings.activeTargetProfileId',
      `Das referenzierte Zielprofil "${activeProfileId}" existiert nicht.`,
    )
  }
  data.plannedChanges.forEach((change, index) => {
    if (typeof change.basedOnProfileId === 'string' && !profileIds.has(change.basedOnProfileId)) {
      error(
        'E_REF_TARGET',
        `plannedChanges[${index}].basedOnProfileId`,
        `Das referenzierte Zielprofil "${change.basedOnProfileId}" existiert nicht.`,
      )
    }
    // A5 (M11, additive Verschärfung – §6-Ausweis): items[].ref analog zu den
    // targetProfiles-Gewichten prüfen (position → existiert, group → bekannte
    // Gruppe). Tote Referenzen in gespeicherten Planungen sind harte Fehler.
    if (!Array.isArray(change.items)) return
    change.items.forEach((item, itemIndex) => {
      const path = `plannedChanges[${index}].items[${itemIndex}].ref`
      if (item.refKind === 'position') {
        if (!positionIds.has(item.ref)) {
          error(
            'E_REF_TARGET',
            path,
            `Die referenzierte Depotposition "${item.ref}" existiert nicht.`,
          )
        }
      } else if (!(POSITION_GROUPS as readonly string[]).includes(item.ref)) {
        error('E_REF_TARGET', path, msgEnum('ref', POSITION_GROUPS, item.ref))
      }
    })
  })
  data.targetProfiles.forEach((profile, profileIndex) => {
    if (!Array.isArray(profile.weights)) return
    profile.weights.forEach((weightEntry, weightIndex) => {
      const path = `targetProfiles[${profileIndex}].weights[${weightIndex}].ref`
      if (weightEntry.refKind === 'position') {
        if (!positionIds.has(weightEntry.ref)) {
          error(
            'E_REF_TARGET',
            path,
            `Die referenzierte Depotposition "${weightEntry.ref}" existiert nicht.`,
          )
        }
      } else if (!(POSITION_GROUPS as readonly string[]).includes(weightEntry.ref)) {
        error('E_REF_TARGET', path, msgEnum('ref', POSITION_GROUPS, weightEntry.ref))
      }
    })
  })

  // B3: Snapshot-Daten dateiweit eindeutig (Historien-Daten wurden je Historie bereits geprüft).
  const seenSnapshotDates = new Map<string, number>()
  data.snapshots.forEach((snapshot, index) => {
    const firstIndex = seenSnapshotDates.get(snapshot.date)
    if (firstIndex !== undefined) {
      error(
        'E_DUPLICATE_DATE',
        `snapshots[${index}].date`,
        `Das Snapshot-Datum "${snapshot.date}" ist mehrfach vergeben (zuerst unter snapshots[${firstIndex}]). Snapshot-Daten müssen eindeutig sein.`,
      )
    } else {
      seenSnapshotDates.set(snapshot.date, index)
    }
  })

  if (errors.length > 0) return fail()

  // ============================ Warnungen (blockieren nie) ============================

  // W1 (G11): leere Historien.
  data.accounts.forEach((account, index) => {
    if (
      account.type !== 'depot' &&
      account.type !== 'pension' &&
      account.balanceHistory.length === 0
    ) {
      warn(
        'W_EMPTY_HISTORY',
        `accounts[${index}].balanceHistory`,
        `Für das Konto "${account.name}" ist noch kein Saldo erfasst (leere Historie). Das Konto zählt nicht als 0, sondern als "unbekannt" (G11).`,
      )
    }
    if (account.needsReview === true) {
      warn(
        'W_NEEDS_REVIEW',
        `accounts[${index}]`,
        `Das Konto "${account.name}" ist als "zu prüfen" markiert.`,
      )
    }
  })
  data.portfolioPositions.forEach((position, index) => {
    if (position.valueHistory.length === 0) {
      warn(
        'W_EMPTY_HISTORY',
        `portfolioPositions[${index}].valueHistory`,
        `Für die Depotposition "${position.name}" ist noch kein Wert erfasst (leere Historie, G11).`,
      )
    }
    if (position.needsReview === true) {
      warn(
        'W_NEEDS_REVIEW',
        `portfolioPositions[${index}]`,
        `Die Depotposition "${position.name}" ist als "zu prüfen" markiert.`,
      )
    }
  })
  data.savingsPlans.forEach((plan, index) => {
    if (plan.needsReview === true) {
      warn(
        'W_NEEDS_REVIEW',
        `savingsPlans[${index}]`,
        `Der Sparplan "${plan.name}" ist als "zu prüfen" markiert.`,
      )
    }
  })

  // W3: Zukunftsdaten – beim Laden nur Warnung (DM14); Referenzdatum wird injiziert.
  const todayIso = options.todayIso
  if (typeof todayIso === 'string') {
    const warnFuture = (date: string, path: string): void => {
      if (date > todayIso) {
        // Endnutzertext: deutsche Datumsformate, keine ISO-Rohwerte (M7-A11y-Befund B3).
        warn(
          'W_FUTURE_DATE',
          path,
          `Das Datum "${formatIsoDateGerman(date)}" liegt in der Zukunft (heute: ${formatIsoDateGerman(todayIso)}). Beim Laden ist das nur ein Hinweis.`,
        )
      }
    }
    data.accounts.forEach((account, index) => {
      account.balanceHistory.forEach((entry, entryIndex) =>
        warnFuture(entry.date, `accounts[${index}].balanceHistory[${entryIndex}].date`),
      )
    })
    data.portfolioPositions.forEach((position, index) => {
      position.valueHistory.forEach((entry, entryIndex) =>
        warnFuture(entry.date, `portfolioPositions[${index}].valueHistory[${entryIndex}].date`),
      )
    })
    data.snapshots.forEach((snapshot, index) =>
      warnFuture(snapshot.date, `snapshots[${index}].date`),
    )
    data.transactions.forEach((transaction, index) =>
      warnFuture(transaction.date, `transactions[${index}].date`),
    )
  }

  // W4 (Neufassung Modul Depot): W4 erwartet zum Snapshot-Datum Einträge für alle
  // AKTIVEN Positionen und alle AKTIVEN Tagesgeldkonten; Einträge inaktiver
  // Positionen/Konten am Snapshot-Datum sind legitime Historie und erzeugen
  // weder Fehler noch Warnung.
  data.snapshots.forEach((snapshot, index) => {
    const missing: string[] = []
    data.portfolioPositions.forEach((position) => {
      if (position.isActive === false) return
      if (!position.valueHistory.some((entry) => entry.date === snapshot.date)) {
        missing.push(`Position "${position.name}"`)
      }
    })
    data.accounts.forEach((account) => {
      if (account.isActive === false) return
      if (
        account.type === 'tagesgeld' &&
        !account.balanceHistory.some((entry) => entry.date === snapshot.date)
      ) {
        missing.push(`Tagesgeld-Konto "${account.name}"`)
      }
    })
    if (missing.length > 0) {
      warn(
        'W_SNAPSHOT_INCOMPLETE',
        `snapshots[${index}]`,
        `Der Snapshot vom ${formatIsoDateGerman(snapshot.date)} ist unvollständig. Es fehlen Einträge für: ${missing.join(', ')}.`,
      )
    }
  })

  return { ok: true, data, errors, warnings }
}
