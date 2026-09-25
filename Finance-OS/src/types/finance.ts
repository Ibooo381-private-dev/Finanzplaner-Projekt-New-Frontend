/**
 * Finance OS – Entitätstypen für schemaVersion 1.
 *
 * Verbindliche Quelle: docs/data-model.md (Feldnamen, Pflichtfelder, Enums).
 * Regel 16 (unbekannte Felder überleben): Jede Entität erweitert WithUnknownFields.
 * Das geparste Original-Objekt ist die Quelle der Wahrheit – die Validierung ist
 * ein Type-Guard, der niemals umkopiert oder filtert. In dieser Phase mutieren
 * einzig withUpdatedTimestamp und appendImportHistory (flache Top-Level-Klone).
 */

export const SUPPORTED_SCHEMA_VERSION = 1

export interface WithUnknownFields {
  [key: string]: unknown
}

// --- Enums als String-Unions (docs/data-model.md 3.x) ---

// Additive Enum-Erweiterung vor Erstveröffentlichung (Modul Konten, 2026-07-19):
// +'bargeld' +'sonstiges' – protokolliert in docs/data-model.md §6.
export type AccountType =
  | 'giro'
  | 'tagesgeld'
  | 'depot'
  | 'cash'
  | 'bargeld'
  | 'sonstiges'
  | 'ruecklage'
  | 'krypto'
  | 'pension'

export type FlowType =
  'own_fixed' | 'own_variable' | 'employer' | 'provider' | 'reserve_transfer' | 'liquidity_transfer'

// Additive Enum-Erweiterung (Modul Sparpläne M10, 2026-07-19):
// +'quarterly' +'halfyearly' +'once' – protokolliert in docs/data-model.md §6.
// Bedeutung 'once': einmaliger Zufluss; das Ausführungsdatum ist validFrom.
export type Interval = 'monthly' | 'yearly' | 'quarterly' | 'halfyearly' | 'once'

export type TargetKind = 'position' | 'account'

export type PositionGroup = 'world' | 'em' | 'gold' | 'telekom'

export type AssetClass = 'etf' | 'etc' | 'stock'

export type ProfileKind = 'student-sparplan' | 'student-bestand' | 'job' | 'custom'

export type ProfileBasis = 'savingsRate' | 'holdings'

// Additive Enum-Erweiterung (Modul Ziele M12, 2026-07-20, protokolliert in
// docs/data-model.md §6): +'archived' (beendet/archiviert – kein Löschen).
// Semantik ab M12: 'reached' = MANUELL abgeschlossen (gespeicherter
// Nutzerwille); rechnerisch erreicht wird NIE gespeichert, nur abgeleitet.
export type GoalStatus = 'active' | 'deferred' | 'reached' | 'archived'

// Additive Enum-Erweiterung (Modul Ziele M12, 2026-07-20, §6):
// +'accountBalance' (Kontoziel) +'positionValue' (Positionsziel)
// +'manual' (freies Geldziel mit manuell gepflegtem Ist-Wert).
export type GoalMetric =
  | 'tagesgeld'
  | 'depotValue'
  | 'totalWealth'
  | 'monthlySavingsRate'
  | 'accountBalance'
  | 'positionValue'
  | 'manual'

export type SnapshotSource = 'seed' | 'user' | 'import'

export type ImportAction = 'import' | 'migration'

export type ImportOutcome = 'applied' | 'rejected' | 'cancelled'

export type BackupMode = 'everySave' | 'dailyFirstSave'

export type WeightRefKind = 'position' | 'group'

// --- Entitäten (docs/data-model.md 3.1–3.12) ---

export interface Metadata extends WithUnknownFields {
  appName: string
  createdAt: string
  updatedAt: string
  currency: string
  isExampleData?: boolean
  description?: string | null
}

export interface EmergencyFund extends WithUnknownFields {
  factor: number
  netIncomeMonthly: number
  manualOverrideAmount?: number | null
}

export interface BackupSettings extends WithUnknownFields {
  mode?: BackupMode
  retentionCount?: number
}

export interface DisplaySettings extends WithUnknownFields {
  numberLocale?: string
  percentDecimals?: number
}

export interface Settings extends WithUnknownFields {
  emergencyFund: EmergencyFund
  monthlySavingsBudget?: number | null
  backup?: BackupSettings
  display?: DisplaySettings
  activeTargetProfileId?: string | null
}

export interface BalanceEntry extends WithUnknownFields {
  date: string
  amount: number
}

export interface ValueEntry extends WithUnknownFields {
  date: string
  value: number
}

export interface Account extends WithUnknownFields {
  id: string
  name: string
  institution?: string | null
  type: AccountType
  earmark?: 'shares2you' | null
  countsAsFreeLiquidity?: boolean
  includeInInvestedWealth?: boolean
  allowNegativeBalance?: boolean
  /** Additiv (Modul Konten): false = deaktiviert – zählt in keine Summe, bleibt gelistet. Default true. */
  isActive?: boolean
  /** Additiv (Modul Konten): Freitext-Zweck des Kontos. Default null. */
  purpose?: string | null
  balanceHistory: BalanceEntry[]
  needsReview?: boolean
  note?: string | null
}

export interface PortfolioPosition extends WithUnknownFields {
  id: string
  name: string
  isin?: string | null
  accountId: string
  assetClass?: AssetClass
  group: PositionGroup
  isVL?: boolean
  /**
   * Additiv (Modul Depot, 2026-07-19): false = Position deaktiviert – fließt in
   * keine aktive Summe/Kennzahl ein (F2/F5/F6/F7, W4-Erwartung), bleibt aber
   * sichtbar gelistet. Default true. Kein Löschen von Positionen in V1
   * (stabile Referenzen savingsPlans.targetId / weights.ref / transactions.targetId).
   */
  isActive?: boolean
  valueHistory: ValueEntry[]
  needsReview?: boolean
  note?: string | null
}

export interface Snapshot extends WithUnknownFields {
  id: string
  date: string
  locked: boolean
  label?: string
  source?: SnapshotSource
}

export interface SavingsPlan extends WithUnknownFields {
  id: string
  name: string
  targetKind: TargetKind
  targetId: string
  amount: number | null
  interval: Interval
  dueMonth?: number | null
  flowType: FlowType
  isFlexible?: boolean
  minAmount?: number | null
  validFrom: string
  validUntil?: string | null
  /**
   * Additiv (Modul Sparpläne M10, 2026-07-19): true = Plan pausiert – zählt in
   * keine Kennzahl (isPlanActiveOn liefert false), bleibt aber gelistet.
   * Momentzustand OHNE Pausenhistorie (dokumentierte Grenze, data-model §3.6).
   * Default false (fehlt in Altdateien = nicht pausiert).
   */
  isPaused?: boolean
  needsReview?: boolean
  note?: string | null
}

export interface WeightEntry extends WithUnknownFields {
  refKind: WeightRefKind
  ref: string
  weight: number
}

export interface Level1 extends WithUnknownFields {
  depotShare: number
  cashShare: number
}

export interface TargetProfile extends WithUnknownFields {
  id: string
  name: string
  kind: ProfileKind
  basis: ProfileBasis
  level1?: Level1 | null
  weights?: WeightEntry[] | null
  note?: string | null
}

export interface Goal extends WithUnknownFields {
  id: string
  name: string
  targetAmount?: number | null
  targetDate?: string | null
  metric?: GoalMetric | null
  isAutoCalculated?: boolean
  status: GoalStatus
  /**
   * Additiv (Modul Ziele M12, 2026-07-20, §6): Referenz-ID NUR bei metric
   * "accountBalance" (Konto) bzw. "positionValue" (Position); Referenz muss
   * passend existieren (harter Ladefehler bei toter/falscher Referenz);
   * deaktivierte Referenz ist erlaubt (nur UI-Warnung). Default null.
   */
  refId?: string | null
  /**
   * Additiv (M12, §6): manuell gepflegter Ist-Wert – fachlich NUR bei metric
   * "manual" genutzt (non-null bei anderer Kennzahl → Ladefehler);
   * Zahl ≥ 0 oder null (= offen). Default null.
   */
  manualCurrentAmount?: number | null
  /**
   * Additiv (M12, §6): geplanter Beginn (ISO). Liegt er NACH dem Stichtag,
   * ist das Ziel „geplant“. targetDate ≥ startDate, falls beide gesetzt.
   * Default null.
   */
  startDate?: string | null
  note?: string | null
}

export interface Transaction extends WithUnknownFields {
  id: string
  date: string
  amount: number
  flowType: FlowType
  targetKind: TargetKind
  targetId: string
  savingsPlanId?: string | null
  note?: string | null
}

export interface PlannedChangeItem extends WithUnknownFields {
  refKind: WeightRefKind
  ref: string
  plannedMonthlyAmount: number
}

// Additive Enum-Erweiterung (Modul Rebalancing M11, 2026-07-20, protokolliert
// in docs/data-model.md §6): +'discarded' (verworfen – kein Löschen, Historie
// bleibt). 'planned' = „geplant, nicht ausgeführt" (G5). createdAt ist ein
// ISO-Kalenderdatum aus dem injizierten Stichtag (bewusst ohne Uhrzeitanteil;
// die Ladeprüfung akzeptiert tolerant auch volle Zeitstempel, §3.10).
export type PlannedChangeStatus = 'planned' | 'discarded'

export interface PlannedChange extends WithUnknownFields {
  id: string
  createdAt: string
  basedOnProfileId: string
  status: PlannedChangeStatus
  items: PlannedChangeItem[]
  note?: string | null
}

/**
 * Ziel eines Simulations-Beitrags (Modul Simulator M13, 2026-07-20, §6):
 * 'depot' (Default, F22-kompatibel – fehlendes Feld in Altdateien bedeutet
 * Depot) oder 'cash' (Tagesgeld). Additiv; die Tagesgeld-Rate der Vorbelegung
 * nutzt 'cash'.
 */
export type SimulationContributionTarget = 'depot' | 'cash'

export interface SimulationContribution extends WithUnknownFields {
  label: string
  amount: number
  flowType: FlowType
  /**
   * Additiv (Modul Simulator M13, 2026-07-20, §6): Zielseite des Beitrags im
   * Aggregatmodell. Default 'depot' (fehlend = Depot, F22-kompatibel);
   * Umbuchungs-flowTypes (reserve_/liquidity_transfer) sind in Simulationen
   * grundsätzlich unzulässig (G7 – Ladeprüfung lehnt sie ab).
   */
  target?: SimulationContributionTarget
}

export interface SimulationParams extends WithUnknownFields {
  startDepotValue: number
  startTagesgeldValue: number
  months: number
  annualReturnRate: number
  monthlyContributions: SimulationContribution[]
  telekomMode: 'real' | 'smoothed'
}

export interface Simulation extends WithUnknownFields {
  id: string
  name: string
  createdAt: string
  params: SimulationParams
  note?: string | null
}

export interface ImportHistoryEntry extends WithUnknownFields {
  id: string
  timestamp: string
  action: ImportAction
  fileName?: string | null
  fileSchemaVersion?: number | null
  outcome: ImportOutcome
  note?: string | null
}

// --- Top-Level-Struktur (docs/data-model.md 1) ---

export interface FinanceData extends WithUnknownFields {
  schemaVersion: number
  metadata: Metadata
  settings: Settings
  accounts: Account[]
  portfolioPositions: PortfolioPosition[]
  snapshots: Snapshot[]
  savingsPlans: SavingsPlan[]
  targetProfiles: TargetProfile[]
  goals: Goal[]
  transactions: Transaction[]
  plannedChanges: PlannedChange[]
  simulations: Simulation[]
  fixedCosts: unknown[]
  monthlyClosings: unknown[]
  journalEntries: unknown[]
  importHistory: ImportHistoryEntry[]
}
