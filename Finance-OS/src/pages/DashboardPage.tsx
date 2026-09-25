/**
 * Modul „Übersicht / Dashboard“ (M7): rein LESENDE Zusammenfassung des
 * geladenen Bestands – Dateistatus, Vermögen (F1–F4, F7), Sparen und Zuflüsse
 * (F8/F9), Zielfortschritt (§7/T7) sowie Datenqualität und Warnungen (G11/W4).
 *
 * Keine Finanzlogik in Komponenten: alle Kennzahlen kommen aus src/finance
 * (cashValue, depotValue, worldTotal, totalWealth, accountsValue,
 * cashShareOfTotal, depotShareOfTotal, ownMonthlySavings, totalMonthlyInflow,
 * isPlanActiveOn, effectiveEmergencyFundTarget, goalProgress) bzw.
 * src/data/snapshot (latestValuationDate, latestCompleteSnapshotDate,
 * hasEntriesAfter). Das Dashboard ändert NIE Daten (kein applyDataChange) –
 * alle Hinweise sind rein informativ (G1/G2). Fehlende Werte sind „unbekannt“,
 * nie 0 (G11); geglättete Werte tragen immer das Label
 * „geglättet (Analysewert)“ (G9).
 *
 * Redesign 2026-09: Das Gesamtvermögen steht als Blickfang oben (große Zahl
 * plus Aufteilungsband Depot/Tagesgeld). Das Band ist rein dekorativ
 * (aria-hidden) – die Anteile stehen als Text-Legende direkt darunter und
 * stammen unverändert aus depotShareOfTotal/cashShareOfTotal. Der Dateistatus
 * steht weiter unten (Datei und Speicherstatus zeigt ohnehin der Kopfbereich).
 */

import type {
  Account,
  AccountType,
  FinanceData,
  Goal,
  GoalStatus,
  PortfolioPosition,
} from '../types/finance'
import type { AggregatedAmount } from '../finance'
import {
  accountsValue,
  cashShareOfTotal,
  cashValue,
  depotShareOfTotal,
  depotValue,
  effectiveGoalTarget,
  goalActualValue,
  goalProgress,
  isPlanActiveOn,
  normalizedActualForStatus,
  ownMonthlySavings,
  totalMonthlyInflow,
  totalWealth,
  worldTotal,
} from '../finance'
import { hasEntriesAfter, latestCompleteSnapshotDate, latestValuationDate } from '../data/snapshot'
import { formatEuro } from '../format/money'
import { formatIsoDateGerman, formatIsoTimestampGerman } from '../format/date'
import { useFinanceData } from '../state/useFinanceData'
import { StartHint } from '../components/StartHint'
import { Icon } from '../components/Icon'
import type { PageId } from '../layout/pages'

/** Kontotypen des „sonstigen aktiven Kontovermögens“ – pension NIE (Merkposten ohne Wert). */
const OTHER_ACCOUNT_TYPES: readonly AccountType[] = [
  'giro',
  'cash',
  'ruecklage',
  'bargeld',
  'sonstiges',
  'krypto',
]

// Label-Kontinuität (M12, Auflage G): deferred bleibt „zurückgestellt“
// (gepinnte Dashboard-Texte); „Pausieren/Reaktivieren“ sind nur Aktionsverben
// der Ziele-Seite. reached = manuell abgeschlossen (gespeichert); archivierte
// Ziele erscheinen NICHT im Dashboard (beendet – Ausblendung dokumentiert).
const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'aktiv',
  deferred: 'zurückgestellt',
  reached: 'erreicht',
  archived: 'archiviert',
}

/** Status-Symbole (Text + Symbol, nie nur Farbe – konsistent zu den M12-Zielkarten). */
const GOAL_STATUS_SYMBOLS: Record<GoalStatus, string> = {
  active: '●',
  deferred: '⏸',
  reached: '✔',
  archived: '■',
}

/** Plaketten-Ton je Status (Farbe ergänzt nur – Symbol + Text bleiben das Signal). */
const GOAL_STATUS_BADGES: Record<GoalStatus, string> = {
  active: 'badge badge--ok',
  deferred: 'badge badge--warn',
  reached: 'badge badge--ok',
  archived: 'badge',
}

function isAccountActive(account: Account): boolean {
  return account.isActive !== false
}

function isPositionActive(position: PortfolioPosition): boolean {
  return position.isActive !== false
}

/**
 * G11-Anzeigeregel: Hat KEINER der relevanten Einträge einen erfassten Wert,
 * ist die Summe „unbekannt“ – nie eine leere 0. Teilsummen (mindestens ein
 * bekannter Wert) erscheinen als Betrag plus „enthält unbekannte Werte“.
 */
function aggregatedDisplay(value: AggregatedAmount, relevantCount: number): string {
  // >= statt ===: defensiv gegen Drift zwischen Zähler und missingIds-Quelle –
  // im Zweifel „unbekannt“ statt einer stillen 0-Summe.
  if (relevantCount > 0 && value.missingIds.length >= relevantCount) return 'unbekannt'
  return formatEuro(value.amount)
}

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

/**
 * Technische IDs in geladenen Warnmeldungen vor der Anzeige über den
 * Namens-Lookup ersetzen – im Endnutzertext erscheinen nie IDs (Lehre aus M9).
 */
function replaceIdsWithNames(message: string, data: FinanceData): string {
  let result = message
  for (const account of data.accounts) {
    if (result.includes(account.id)) result = result.split(account.id).join(account.name)
  }
  for (const position of data.portfolioPositions) {
    if (result.includes(position.id)) result = result.split(position.id).join(position.name)
  }
  return result
}

/** Kennzahlen-Kachel (kpi-grid-Muster); Zusatzhinweise als sichtbarer Text, nie nur Farbe. */
function KpiTile({
  label,
  value,
  note,
  containsUnknown,
  hero = false,
}: {
  label: string
  value: string
  /** Optionaler Kachel-Untertext (z. B. Einordnung der Kennzahl). */
  note?: string
  /** G11: true, wenn die Summe Einträge ohne erfassten Wert enthält. */
  containsUnknown: boolean
  /** Große Darstellung als Blickfang (nur Gesamtvermögen). */
  hero?: boolean
}) {
  return (
    <div className={hero ? 'kpi-tile kpi-tile--hero' : 'kpi-tile'}>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {note !== undefined ? <span className="kpi-note">{note}</span> : null}
        {containsUnknown ? <span className="kpi-note">⚠ enthält unbekannte Werte</span> : null}
      </dd>
    </div>
  )
}

/**
 * Aufteilung des Gesamtvermögens (F3/F4): dekoratives Band + Text-Legende.
 * Die Anteile kommen fertig aus der reinen Schicht; hier wird nur angezeigt.
 * Ohne berechenbare Anteile (z. B. Gesamtvermögen 0) bleibt das Band leer
 * und die Legende zeigt „nicht berechenbar“ – nie NaN.
 */
function AllocationBand({
  depotShare,
  cashShare,
  percentDecimals,
}: {
  depotShare: number | null
  cashShare: number | null
  percentDecimals: number
}) {
  const parts = [
    { key: 'depot', name: 'Depot', share: depotShare },
    { key: 'cash', name: 'Tagesgeld', share: cashShare },
  ]
  return (
    <>
      <div className="band" aria-hidden="true">
        {parts.map((part) =>
          part.share !== null && part.share > 0 ? (
            <div
              key={part.key}
              className={`band-part band-part--${part.key}`}
              style={{ flex: `0 0 ${Math.min(part.share, 1) * 100}%` }}
            >
              {part.name}
            </div>
          ) : null,
        )}
      </div>
      <dl className="band-legend">
        <div>
          <dt>
            <span className="band-swatch band-swatch--depot" aria-hidden="true" />
            Anteil Depot am Gesamtvermögen
          </dt>
          <dd>
            {depotShare === null ? 'nicht berechenbar' : formatShare(depotShare, percentDecimals)}
          </dd>
        </div>
        <div>
          <dt>
            <span className="band-swatch band-swatch--cash" aria-hidden="true" />
            Anteil Tagesgeld am Gesamtvermögen
          </dt>
          <dd>
            {cashShare === null ? 'nicht berechenbar' : formatShare(cashShare, percentDecimals)}
          </dd>
        </div>
      </dl>
    </>
  )
}

/** Erklärtext der Sparkennzahlen (Details-Muster, tastaturzugänglich – kein title-only). */
function SavingsExplanation() {
  return (
    <details className="model-hint">
      <summary>So unterscheiden sich die Sparkennzahlen</summary>
      <ul>
        <li>
          Eigene Sparleistung: nur eigenes Geld (eigene feste Raten; Round-up ist eigenes Geld und
          zählt nur aus tatsächlichen Buchungen). Umbuchungen zwischen eigenen Konten
          (Rücklagen-/Liquiditätsübertragungen) zählen nie als Sparleistung.
        </li>
        <li>
          Gesamtzufluss: eigene Sparleistung plus Arbeitgeber- und Anbieterleistungen
          (VL-Zuschuss, Shares2you-Bonus, Saveback).
        </li>
        <li>
          Real: tatsächliche Monatsbuchungen – Jahresbeträge wie der Telekom-Jahresbeitrag sind
          hier NICHT enthalten, sie buchen real einmal jährlich.
        </li>
        <li>
          Geglättet (Analysewert): Jahresbeträge werden rechnerisch auf die Monate verteilt
          (Jahresbetrag/12). Geglättete Werte sind reine Analysewerte, erscheinen nie als reale
          Buchung und werden nie mit realen Werten in einer Kennzahl gemischt.
        </li>
      </ul>
    </details>
  )
}

/**
 * Ein Ziel aus data.goals (Reihenfolge der Datei; archivierte Ziele werden
 * VOR dem Rendern ausgefiltert). Die metric-Verzweigung existiert NUR in der
 * reinen Schicht (goalActualValue/effectiveGoalTarget in src/finance/goals.ts)
 * – hier wird ausschließlich angezeigt. Für die Kennzahl „monatliche
 * Sparrate“ gilt die verbindliche Nutzerentscheidung U3 (M10): primärer
 * Fortschritt = eigene REALE monatliche Sparleistung / Zielbetrag (F8
 * realMonthly); zusätzlich der geglättete Analysewert (gekennzeichnet, nie
 * der primäre Zielfortschritt). Externe Zuflüsse zählen nie.
 */
function GoalEntry({
  goal,
  data,
  todayIso,
  ownReal,
  ownSmoothed,
  percentDecimals,
}: {
  goal: Goal
  data: FinanceData
  todayIso: string
  /** F8 – eigene reale monatliche Sparleistung (bereits auf der Seite berechnet). */
  ownReal: number
  /** F8 – eigene geglättete Sparleistung (Analysewert). */
  ownSmoothed: number
  percentDecimals: number
}) {
  const heading = (
    <p className="goal-heading">
      {/* Status als Text MIT Symbol – konsistent zu den M12-Zielkarten (B4). */}
      <strong>{goal.name}</strong> <span className="visually-hidden">Status:</span>{' '}
      <span className={GOAL_STATUS_BADGES[goal.status]}>
        {`${GOAL_STATUS_SYMBOLS[goal.status]} ${GOAL_STATUS_LABELS[goal.status]}`}
      </span>
    </p>
  )
  if (goal.status === 'deferred') {
    return (
      <li>
        {heading}
        <p className="app-hint">Zurückgestellt – es wird kein Fortschritt berechnet.</p>
      </li>
    )
  }
  if (goal.metric === 'monthlySavingsRate') {
    // U3 (M10): primärer Fortschritt = eigene reale monatliche Sparleistung.
    // (Der Notgroschen-Guard greift hier nie: er verlangt metric tagesgeld/null.)
    const savingsTarget = effectiveGoalTarget(goal, data.settings.emergencyFund)
    if (savingsTarget === null) {
      return (
        <li>
          {heading}
          <p className="app-hint">Zielbetrag offen – auf der Seite „Ziele“ festlegbar.</p>
        </li>
      )
    }
    const primary = goalProgress(ownReal, savingsTarget)
    const smoothed = goalProgress(ownSmoothed, savingsTarget)
    if (primary === null || smoothed === null) {
      return (
        <li>
          {heading}
          <p className="app-hint">Fortschritt nicht berechenbar (kein gültiger Zielbetrag).</p>
        </li>
      )
    }
    const primaryShareText =
      primary.share === null ? 'nicht berechenbar' : formatShare(primary.share, percentDecimals)
    const smoothedShareText =
      smoothed.share === null ? 'nicht berechenbar' : formatShare(smoothed.share, percentDecimals)
    const primaryShareId = `goal-share-${goal.id}`
    return (
      <li>
        {heading}
        <p>Ziel: {formatEuro(savingsTarget)} pro Monat</p>
        <p>Fortschritt auf Basis deiner eigenen realen monatlichen Sparleistung:</p>
        <p className="goal-progress">
          {/* Anzeige-Cap: value nie über max; der ECHTE Prozentwert steht als Text
              daneben und ist über aria-describedby mit dem Balken verknüpft. */}
          <progress
            max={primary.target}
            value={Math.min(Math.max(primary.actual, 0), primary.target)}
            aria-label={`Fortschritt „${goal.name}“`}
            aria-describedby={primaryShareId}
          />{' '}
          <span id={primaryShareId}>
            {primaryShareText} ({formatEuro(primary.actual)} von {formatEuro(primary.target)})
          </span>
        </p>
        {primary.reached ? (
          <p className="success-note" role="status">
            ✓ Ziel erreicht – die App schlägt nur vor, ändert aber nie automatisch Sparraten.
          </p>
        ) : null}
        <p className="app-hint">
          Geglätteter Analysewert – nicht der primäre Zielfortschritt: {smoothedShareText} (
          {formatEuro(smoothed.actual)} geglättet (Analysewert))
        </p>
      </li>
    )
  }
  // Alle übrigen Kennzahlen (inkl. Notgroschen-Guard, Konto-/Positionsziel,
  // freies Geldziel): Ist und Ziel kommen aus der reinen Schicht.
  const target = effectiveGoalTarget(goal, data.settings.emergencyFund)
  const actualValue = goalActualValue(goal, data, todayIso)
  // G11 (Auflage E): vollständig unbekannter Ist-Wert zählt nie als 0.
  const actual = normalizedActualForStatus(actualValue)
  if (actualValue === null || actual === null) {
    const reason =
      goal.metric == null
        ? 'keine Kennzahl zugeordnet'
        : goal.metric === 'manual'
          ? 'kein Ist-Wert erfasst – auf der Seite „Ziele“ pflegbar'
          : actualValue === null
            ? 'die Referenz des Ziels wurde nicht gefunden'
            : 'Ist-Wert unbekannt, es ist noch kein Wert erfasst'
    return (
      <li>
        {heading}
        <p className="app-hint">Fortschritt nicht berechenbar ({reason}).</p>
      </li>
    )
  }
  if (target === null) {
    return (
      <li>
        {heading}
        <p className="app-hint">Zielbetrag offen – auf der Seite „Ziele“ festlegbar.</p>
      </li>
    )
  }
  const progress = goalProgress(actual, target)
  if (progress === null) {
    return (
      <li>
        {heading}
        <p className="app-hint">Fortschritt nicht berechenbar (kein gültiger Zielbetrag).</p>
      </li>
    )
  }
  const shareText =
    progress.share === null ? 'nicht berechenbar' : formatShare(progress.share, percentDecimals)
  const shareTextId = `goal-share-${goal.id}`
  return (
    <li>
      {heading}
      <p>
        Ist: {formatEuro(progress.actual)} · Ziel: {formatEuro(progress.target)} · Restbetrag:{' '}
        {formatEuro(progress.remaining)}
      </p>
      <p className="goal-progress">
        {/* Anzeige-Cap: value nie über max; der ECHTE Prozentwert steht als Text
            daneben und ist über aria-describedby mit dem Balken verknüpft. */}
        <progress
          max={progress.target}
          value={Math.min(Math.max(progress.actual, 0), progress.target)}
          aria-label={`Fortschritt „${goal.name}“`}
          aria-describedby={shareTextId}
        />{' '}
        <span id={shareTextId}>{shareText}</span>
      </p>
      {progress.reached ? (
        <p className="success-note" role="status">
          ✓ Ziel erreicht – die App schlägt nur vor, ändert aber nie automatisch Sparraten.
        </p>
      ) : null}
    </li>
  )
}

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { state, todayIso } = useFinanceData()
  const data = state.data
  if (data === null) {
    // Ohne Datei: nur der Startzustand – keine weiteren Sektionen.
    return (
      <section className="page" aria-labelledby="page-title">
        <h2 id="page-title">Übersicht</h2>
        <StartHint onOpenDataBackups={() => onNavigate('daten-backups')} />
      </section>
    )
  }

  // Inaktive Konten/Positionen fließen in KEINE aktive Summe ein (Aufruferfilter).
  const activeAccounts = data.accounts.filter(isAccountActive)
  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const cash = cashValue(activeAccounts)
  const depot = depotValue(activePositions)
  const world = worldTotal(activePositions)
  const other = accountsValue(activeAccounts, OTHER_ACCOUNT_TYPES)
  const total = totalWealth(cash.amount, depot.amount)
  // Zähler der je Kachel relevanten Einträge – ist KEINER davon bewertet,
  // zeigt die Kachel „unbekannt“ statt einer leeren Summe (G11).
  const cashRelevantCount = activeAccounts.filter((account) => account.type === 'tagesgeld').length
  const otherRelevantCount = activeAccounts.filter((account) =>
    OTHER_ACCOUNT_TYPES.includes(account.type),
  ).length
  const worldRelevantCount = activePositions.filter((position) => position.group === 'world').length
  const totalAsAggregated: AggregatedAmount = {
    amount: total,
    missingIds: [...cash.missingIds, ...depot.missingIds],
  }
  const depotShare = depotShareOfTotal(depot.amount, total)
  const cashShare = cashShareOfTotal(cash.amount, total)
  const percentDecimals =
    typeof data.settings.display?.percentDecimals === 'number'
      ? data.settings.display.percentDecimals
      : 2

  // Stichtag kommt injiziert aus dem Provider (nie die eigene Systemuhr).
  const activePlans = data.savingsPlans.filter((plan) => isPlanActiveOn(plan, todayIso))
  const ownReal = ownMonthlySavings(activePlans, 'realMonthly')
  const ownSmoothed = ownMonthlySavings(activePlans, 'smoothed')
  const inflowReal = totalMonthlyInflow(activePlans, 'realMonthly')
  const inflowSmoothed = totalMonthlyInflow(activePlans, 'smoothed')

  const valuationDate = latestValuationDate(data)
  const completeSnapshotDate = latestCompleteSnapshotDate(data)
  const changedSinceSnapshot =
    completeSnapshotDate !== null && hasEntriesAfter(data, completeSnapshotDate)

  // G11-Hinweise: fehlende Werte als NAMEN (nie IDs) über die Lookups auflösen.
  const positionById = new Map(data.portfolioPositions.map((position) => [position.id, position]))
  const accountById = new Map(data.accounts.map((account) => [account.id, account]))
  const missingPositionNames = depot.missingIds.map(
    (id) => positionById.get(id)?.name ?? 'unbekannte Position',
  )
  const missingAccountNames = [...cash.missingIds, ...other.missingIds].map(
    (id) => accountById.get(id)?.name ?? 'unbekanntes Konto',
  )
  const hasMissing = missingPositionNames.length > 0 || missingAccountNames.length > 0
  const warningMessages = state.warnings.map((warning) =>
    replaceIdsWithNames(warning.message, data),
  )
  const nothingToReport = !hasMissing && warningMessages.length === 0

  // Archivierte Ziele sind beendet und erscheinen nicht im Dashboard (M12).
  const visibleGoals = data.goals.filter((goal) => goal.status !== 'archived')

  // Kleine Statusanzeige mit denselben State-Feldern wie der Kopfbereich
  // (Logik nicht dupliziert, bewusst leicht abweichende Formulierung).
  const savedText =
    state.lastSavedAt !== null
      ? formatIsoTimestampGerman(state.lastSavedAt)
      : `noch nicht in dieser Sitzung – Stand der Datei: ${formatIsoTimestampGerman(data.metadata.updatedAt)}`

  return (
    <section className="page" aria-labelledby="page-title">
      <h2 id="page-title">Übersicht</h2>
      <p className="app-hint">
        Dein Finanzstand auf einen Blick – rein lesend. Werte änderst du auf den Seiten Konten,
        Depot, Sparpläne und Ziele.
      </p>

      <section aria-labelledby="dashboard-wealth-title">
        <h3 id="dashboard-wealth-title">Vermögen</h3>
        <div className="hero">
          <div className="hero-head">
            <dl className="hero-kpi">
              <KpiTile
                hero
                label="Gesamtvermögen (Tagesgeld + Depot)"
                value={aggregatedDisplay(
                  totalAsAggregated,
                  cashRelevantCount + activePositions.length,
                )}
                containsUnknown={cash.missingIds.length > 0 || depot.missingIds.length > 0}
              />
            </dl>
            <p className="hero-note">
              {valuationDate === null
                ? 'Noch kein Bewertungsdatum erfasst.'
                : `Bewertungsstand ${formatIsoDateGerman(valuationDate)}.`}{' '}
              Sonstiges Kontovermögen (Girokonto, Rücklagen …) zählt nicht zum Gesamtvermögen.
            </p>
          </div>
          <AllocationBand
            depotShare={depotShare}
            cashShare={cashShare}
            percentDecimals={percentDecimals}
          />
        </div>
        <dl className="kpi-grid">
          <KpiTile
            label="Depotwert (aktive Positionen)"
            value={aggregatedDisplay(depot, activePositions.length)}
            containsUnknown={depot.missingIds.length > 0}
          />
          <KpiTile
            label="Tagesgeld gesamt (aktive Konten)"
            value={aggregatedDisplay(cash, cashRelevantCount)}
            containsUnknown={cash.missingIds.length > 0}
          />
          <KpiTile
            label="Sonstiges aktives Kontovermögen"
            value={aggregatedDisplay(other, otherRelevantCount)}
            note="zusätzlich zum Gesamtvermögen – zählt zum Finanzvermögen"
            containsUnknown={other.missingIds.length > 0}
          />
        </dl>
        <h4>Weitere Kennzahlen</h4>
        <dl className="facts-list">
          <div>
            <dt>MSCI World gesamt</dt>
            <dd>
              {aggregatedDisplay(world, worldRelevantCount)}
              {world.missingIds.length > 0 ? ' (⚠ enthält unbekannte Werte)' : null}
            </dd>
          </div>
          <div>
            <dt>Aktive Konten</dt>
            <dd>{activeAccounts.length}</dd>
          </div>
          <div>
            <dt>Aktive Positionen</dt>
            <dd>{activePositions.length}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="dashboard-savings-title">
        <h3 id="dashboard-savings-title">Sparen und Zuflüsse</h3>
        <p className="app-hint">
          Berücksichtigt werden {activePlans.length} aktive Sparpläne (Stichtag: heutiges Datum).
          Reale und geglättete Sicht werden nie gemischt.
        </p>
        <dl className="kpi-grid">
          <KpiTile
            label="Eigene Sparleistung (real)"
            value={formatEuro(ownReal)}
            containsUnknown={false}
          />
          <KpiTile
            label="Eigene Sparleistung – geglättet (Analysewert)"
            value={formatEuro(ownSmoothed)}
            containsUnknown={false}
          />
          <KpiTile
            label="Gesamtzufluss (real)"
            value={formatEuro(inflowReal)}
            containsUnknown={false}
          />
          <KpiTile
            label="Gesamtzufluss – geglättet (Analysewert)"
            value={formatEuro(inflowSmoothed)}
            containsUnknown={false}
          />
        </dl>
        <SavingsExplanation />
      </section>

      <section aria-labelledby="dashboard-goals-title">
        <h3 id="dashboard-goals-title">Ziele</h3>
        {/* Archivierte Ziele sind beendet und erscheinen NICHT im Dashboard
            (M12, dokumentierte Ausblendung – Verwaltung auf der Seite „Ziele“). */}
        {data.goals.length === 0 ? (
          <p className="app-hint">
            Der geladene Bestand enthält noch keine Ziele. Lege sie auf der Seite „Ziele“ an.
          </p>
        ) : visibleGoals.length === 0 ? (
          // Kein leerer Kartenrest, wenn ALLE Ziele archiviert sind (A11y B1).
          <p className="app-hint">
            Alle Ziele sind archiviert – die Verwaltung findest du auf der Seite „Ziele“.
          </p>
        ) : (
          <ul className="goal-list">
            {visibleGoals.map((goal) => (
              <GoalEntry
                key={goal.id}
                goal={goal}
                data={data}
                todayIso={todayIso}
                ownReal={ownReal}
                ownSmoothed={ownSmoothed}
                percentDecimals={percentDecimals}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dashboard-quality-title">
        <h3 id="dashboard-quality-title">Datenqualität und Warnungen</h3>
        <div className="issue-box">
          <ul className="quality-list">
            {missingPositionNames.length > 0 ? (
              <li>
                ⚠ Positionen ohne aktuellen Wert: {missingPositionNames.join(', ')}. Sie zählen
                nicht als 0, sondern als „unbekannt“.
              </li>
            ) : null}
            {missingAccountNames.length > 0 ? (
              <li>⚠ Aktive Konten ohne bekannten Saldo: {missingAccountNames.join(', ')}.</li>
            ) : null}
            {warningMessages.map((message, index) => (
              <li key={`${index}-${message}`}>⚠ {message}</li>
            ))}
            {hasMissing ? <li>⚠ Für eine vollständige Berechnung fehlen Daten.</li> : null}
            {nothingToReport ? (
              <li>
                ✓ Keine Auffälligkeiten – alle aktiven Konten und Positionen haben erfasste Werte.
              </li>
            ) : null}
            <li>
              {completeSnapshotDate === null
                ? 'ℹ Noch kein vollständiger Snapshot vorhanden.'
                : `ℹ Neuester vollständiger Snapshot: ${formatIsoDateGerman(completeSnapshotDate)}.`}
            </li>
            {changedSinceSnapshot ? (
              <li>
                ⚠ Seit dem letzten vollständigen Snapshot wurden Werte verändert – ein neuer
                Snapshot friert den aktuellen Stand ein.{' '}
                <button type="button" className="btn-sm" onClick={() => onNavigate('depot')}>
                  Neuen Snapshot im Depot erfassen
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section aria-labelledby="dashboard-file-title">
        <h3 id="dashboard-file-title">Dateistatus</h3>
        <dl className="facts-list">
          <div>
            <dt>Datei</dt>
            <dd>{state.fileName ?? 'Keine Datei geöffnet'}</dd>
          </div>
          <div>
            <dt>Zuletzt gespeichert</dt>
            <dd>{savedText}</dd>
          </div>
          <div>
            <dt>Änderungsstatus</dt>
            <dd>
              {state.isDirty
                ? '● Ungespeicherte Änderungen vorhanden'
                : '✓ Keine ungespeicherten Änderungen vorhanden'}
            </dd>
          </div>
          <div>
            <dt>Aktuelles Bewertungsdatum</dt>
            <dd>
              {valuationDate === null
                ? 'unbekannt – noch kein Bewertungsdatum erfasst'
                : formatIsoDateGerman(valuationDate)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="dashboard-nav-title">
        <h3 id="dashboard-nav-title">Schnellzugriff</h3>
        <div className="quick-links">
          <button type="button" onClick={() => onNavigate('konten')}>
            <Icon name="accounts" />
            Kontostände erfassen
          </button>
          <button type="button" onClick={() => onNavigate('depot')}>
            <Icon name="depot" />
            Depotwerte erfassen
          </button>
          <button type="button" onClick={() => onNavigate('daten-backups')}>
            <Icon name="data" />
            Datei speichern &amp; sichern
          </button>
        </div>
      </section>
    </section>
  )
}
