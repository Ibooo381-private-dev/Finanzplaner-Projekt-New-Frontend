/**
 * Modul „Rebalancing und Handlungsempfehlungen“ (M11): Übersicht mit lokaler
 * Profilauswahl (ändert NIE das aktive Zielprofil, G5), Abweichungstabelle,
 * Empfehlungen in Konjunktiv-Formulierung, sparratenbasierter Vorschlag
 * (F17/F18 mit abgeleitetem A1-Budget), hypothetische Voll-Simulation (reine
 * Anzeige, A7) und gespeicherte Planungen (G5, „geplant, nicht ausgeführt“).
 *
 * REIN lesend bis auf addPlannedChange/discardPlannedChange (G5: nur nach
 * window.confirm inkl. Beträgen; Vergleich vor applyDataChange; Abbruch lässt
 * den Bestand Byte-identisch). Keine Finanzlogik in der Komponente: alle
 * Kennzahlen kommen aus src/finance (calculateRebalancingAnalysis,
 * deriveFlexibleMonthlyBudget, calculateSavingsOnlyRebalancing,
 * estimateSavingsDuration, calculateFullRebalancing, sortRebalancingEntries,
 * groupRecommendations, validateWeights); der Stichtag kommt IMMER aus dem
 * injizierten todayIso des Provider-Kontexts.
 *
 * Statuslabel-Mapping (A4, dokumentiert in calculation-rules „Rebalancing-
 * Bausteine (M11)“): Die vier Statusbegriffe des Auftrags werden auf die DREI
 * bestehenden actionLevel-Stufen abgebildet – „beobachten“ erhält KEINE eigene
 * Stufe (eine vierte Schwelle wäre quellenlos).
 */

import { useState } from 'react'
import type { FinanceData, PositionGroup, SavingsPlan, TargetProfile } from '../types/finance'
import {
  calculateFullRebalancing,
  calculateRebalancingAnalysis,
  calculateSavingsOnlyRebalancing,
  deriveFlexibleMonthlyBudget,
  estimateSavingsDuration,
  groupRecommendations,
  isContractBoundPosition,
  isPlanActiveOn,
  sortRebalancingEntries,
  validateWeights,
} from '../finance'
import type {
  ActionLevel,
  ProposalReason,
  RebalancingAnalysis,
  RebalancingAnalysisEntry,
} from '../finance'
import { formatEuro } from '../format/money'
import { formatIsoDateGerman, formatIsoTimestampGerman } from '../format/date'
import { isPositionActive } from '../data/positions'
import { addPlannedChange, discardPlannedChange } from '../data/plannedChanges'
import type { PlannedChangeActionResult, PlannedChangeItemInput } from '../data/plannedChanges'
import { useFinanceData } from '../state/useFinanceData'

// --- Deutsche Labels (UI) ---

const GROUP_LABELS: Record<PositionGroup, string> = {
  world: 'World',
  em: 'Emerging Markets',
  gold: 'Gold',
  telekom: 'Telekom',
}

/**
 * A4 – Statuslabel-Mapping auf die drei bestehenden actionLevel-Stufen
 * (KEINE vierte Schwelle; „beobachten“ ist keine eigene Stufe).
 */
const ACTION_LEVEL_LABELS: Record<ActionLevel, string> = {
  none: 'OK (nur Anzeige)',
  recommendation: 'Empfehlung – prüfen',
  'recommendation-with-sale-option':
    'Empfehlung – Rebalancing sinnvoll (inkl. Verkaufsoption als letzte Möglichkeit)',
}

const ACTION_LEVEL_SYMBOLS: Record<ActionLevel, string> = {
  none: '✓',
  recommendation: '⚠',
  'recommendation-with-sale-option': '‼',
}

const REASON_LABELS: Record<ProposalReason, string> = {
  fixed: 'fest – bleibt unverändert (nicht flexibel bzw. externer Zufluss, F18)',
  paused: 'pausiert – erhält 0',
  'no-gap': 'kein Kaufbedarf – erhält 0 (übergewichtete flexible Positionen dürfen leer ausgehen)',
  proportional: 'proportional zur Kaufbedarfslücke (F17)',
}

const PLANNED_STATUS_LABELS: Record<'planned' | 'discarded', string> = {
  planned: 'geplant, nicht ausgeführt',
  discarded: 'verworfen',
}

const PLANNED_STATUS_SYMBOLS: Record<'planned' | 'discarded', string> = {
  planned: '◷',
  discarded: '■',
}

/** Prozent-Anzeige aus Dezimalanteil (F19: percentDecimals, Standard 2). */
function formatShare(decimal: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${format.format(decimal * 100)} %`
}

/** Prozentpunkte mit Vorzeichen (F14: Text, nie nur Farbe). */
function formatPp(pp: number, decimals: number): string {
  const format = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  const text = format.format(pp)
  return pp > 0 ? `+${text} Pp` : `${text} Pp`
}

/** Anzeigename eines Analyse-Eintrags (Positionsname bzw. Gruppen-Label – nie IDs). */
function entryLabel(entry: { refKind: 'position' | 'group'; ref: string; name: string | null }): string {
  if (entry.refKind === 'group') {
    return `${GROUP_LABELS[entry.ref as PositionGroup]} (Gruppe)`
  }
  return entry.name ?? 'unbekannte Depotposition'
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

function RebalancingRules() {
  return (
    <details className="model-hint">
      <summary>So rechnet die Rebalancing-Seite (Formeln, Schwellen und Maßnahmen)</summary>
      <ul>
        <li>
          Ist-Anteil = Positionswert ÷ Depotwert (F5, Tagesgeld nie im Nenner); Sollwert =
          Zielgewicht × Depotwert (F11/F12); Abweichung in Prozentpunkten = (Ist-Anteil −
          Zielanteil) × 100 (F14, absolut, nie relativ).
        </li>
        <li>
          Schwellen: unter 5 Prozentpunkten nur Anzeige; ab 5 Prozentpunkten (absolut) eine
          Handlungsempfehlung; ab +10 Prozentpunkten (nur Übergewichtung) wird zusätzlich die
          Verkaufsoption als LETZTE Möglichkeit erwähnt (T9). Die vier Statusbegriffe des
          Auftrags werden auf diese drei Stufen abgebildet – „beobachten“ ist keine eigene Stufe.
        </li>
        <li>
          Kaufbedarf = MAX(0, Soll − Ist) (F15); Verkaufsbedarf = MAX(0, Ist − Soll) (F16, reine
          Information). Pflichtprüfung: Σ Kaufbedarf = Σ Verkaufsbedarf bei vollständiger
          Abdeckung – Differenzen werden sichtbar ausgewiesen (F19).
        </li>
        <li>
          Gesamtabweichung (M11-Definition) = Σ Kaufbedarf (= Σ Verkaufsbedarf); daneben steht die
          größte Abweichung in Prozentpunkten.
        </li>
        <li>
          Das flexible Monatsbudget wird abgeleitet als Summe der am Stichtag aktiven, flexiblen
          EIGENEN monatlichen Sparpläne auf Depotpositionen mit festem Betrag (Seed: 23 + 22 + 10 +
          5 = 60,00 €). Budget 0 bedeutet: keine Sparraten-Empfehlung.
        </li>
        <li>
          Die Dauer-Schätzung ist eine reine Division (Σ Kaufbedarf ÷ Budget, aufgerundet) OHNE
          Renditeannahme – immer „ungefähr, ohne Kursentwicklung“.
        </li>
        <li>
          Fehlende Werte bedeuten „unbekannt“, nie 0 (G11): unbewertete Positionen fallen
          namentlich aus der Rechnung. Bei Depotwert 0 heißt es „nicht berechenbar“ (F20) – es
          erscheint nie ein technischer Zahlenrest.
        </li>
        <li>
          Alle Ergebnisse sind unverbindliche Empfehlungen (G1/G2): Finance OS führt nie Käufe,
          Verkäufe oder Sparplanänderungen aus und ändert nie das aktive Zielprofil.
        </li>
      </ul>
    </details>
  )
}

/** Konjunktiv-Empfehlungssatz je Eintrag (NIE „solltest“, nie Imperative). */
function recommendationSentence(
  entry: RebalancingAnalysisEntry,
  percentDecimals: number,
  contractBound = false,
): string {
  const label = entryLabel(entry)
  const pp = formatPp(entry.deviationPp, percentDecimals)
  if (entry.level === 'recommendation-with-sale-option') {
    // Verkaufsoption NUR hier (≥ +10 Pp) und als LETZTE Möglichkeit der S2-Reihenfolge.
    // F16-Randfall: vertraglich gebundene Positionen (z. B. VL) erhalten den
    // dokumentierten Einschränkungs-Hinweis (finance-analyst M11).
    const saleClause = contractBound
      ? `erst als letzte Möglichkeit könntest du einen Verkauf von ungefähr ${formatEuro(entry.sellRequirement)} prüfen – beachte: Diese Position wird über einen vertraglich gebundenen Plan bespart (z. B. VL), ein Verkauf ist real zusätzlich eingeschränkt (nur Hinweis).`
      : `erst als letzte Möglichkeit könntest du einen Verkauf von ungefähr ${formatEuro(entry.sellRequirement)} prüfen.`
    return (
      `Wenn du deine Zielallokation annähern möchtest, könntest du bei „${label}“ (${pp} übergewichtet) ` +
      'zunächst laufende Sparraten auf untergewichtete Positionen lenken, zusätzliches Geld oder ' +
      'Ausschüttungen dort einsetzen und flexible Sparpläne dieser Position reduzieren oder ' +
      `vorübergehend pausieren; ${saleClause}`
    )
  }
  if (entry.deviationPp > 0) {
    return (
      `Wenn du deine Zielallokation annähern möchtest, könntest du bei „${label}“ (${pp} übergewichtet) ` +
      'künftige Sparzuflüsse eher in untergewichtete Positionen lenken und flexible Sparpläne ' +
      'dieser Position reduzieren oder vorübergehend pausieren.'
    )
  }
  return (
    `Wenn du deine Zielallokation annähern möchtest, könntest du künftige Sparraten stärker in „${label}“ ` +
    `lenken (Kaufbedarf ungefähr ${formatEuro(entry.buyRequirement)}, Abweichung ${pp}).`
  )
}

export function RebalancingPage({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions, todayIso } = useFinanceData()
  // Lokale Profilauswahl (G5): '' = noch keine Auswahl → aktives Profil.
  const [selectedProfileId, setSelectedProfileId] = useState('')
  // Aktions-Feedback erscheint BEIM Auslöser (A11y-Befund M11-B2):
  // Speichern-Feedback in Sektion D, Verwerfen-Feedback in Sektion F.
  const [actionError, setActionError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [discardFeedback, setDiscardFeedback] = useState<
    { kind: 'error' | 'success'; text: string } | null
  >(null)

  const data = state.data
  if (data === null) {
    return (
      <section className="page" aria-labelledby="page-title">
        <h2 id="page-title">Rebalancing</h2>
        <StartHint onOpenDataBackups={onOpenDataBackups} />
      </section>
    )
  }

  const loadedData: FinanceData = data
  const percentDecimals =
    typeof data.settings.display?.percentDecimals === 'number'
      ? data.settings.display.percentDecimals
      : 2

  const profiles = data.targetProfiles
  const activeProfileId = data.settings.activeTargetProfileId ?? null
  const defaultProfileId = activeProfileId ?? profiles[0]?.id ?? ''
  const effectiveProfileId = profiles.some((profile) => profile.id === selectedProfileId)
    ? selectedProfileId
    : defaultProfileId
  const selectedProfile: TargetProfile | null =
    profiles.find((profile) => profile.id === effectiveProfileId) ?? null

  // Inaktive Positionen fließen NIE in die Analyse ein (Aufruferfilter).
  const activePositions = data.portfolioPositions.filter(isPositionActive)
  const positionNameById = new Map(
    data.portfolioPositions.map((position) => [position.id, position.name]),
  )

  const weightsValidation =
    selectedProfile === null ? null : validateWeights(selectedProfile.weights)
  const isSavingsRateReference =
    selectedProfile !== null &&
    selectedProfile.basis === 'savingsRate' &&
    weightsValidation !== null &&
    weightsValidation.status === 'empty'
  const analysis: RebalancingAnalysis | null =
    selectedProfile === null || weightsValidation === null || weightsValidation.status !== 'valid'
      ? null
      : calculateRebalancingAnalysis(activePositions, selectedProfile.weights)

  // --- Sparratenbasierter Vorschlag (F17/F18, A1-Budget) ---
  const budget = deriveFlexibleMonthlyBudget(data.savingsPlans, todayIso)
  /** Anzeige-Pläne des Vorschlags: monatliche Positions-Pläne mit festem Betrag (aktiv oder pausiert). */
  const proposalPlans: SavingsPlan[] = data.savingsPlans.filter(
    (plan) =>
      plan.targetKind === 'position' &&
      plan.interval === 'monthly' &&
      typeof plan.amount === 'number' &&
      Number.isFinite(plan.amount) &&
      plan.amount > 0 &&
      (isPlanActiveOn(plan, todayIso) || plan.isPaused === true),
  )
  const planById = new Map(data.savingsPlans.map((plan) => [plan.id, plan]))
  const savings =
    analysis === null
      ? null
      : calculateSavingsOnlyRebalancing(analysis, budget.budget, proposalPlans, activePositions)
  const duration =
    analysis === null ? null : estimateSavingsDuration(analysis.totalBuy, budget.budget)
  const receiverProposals =
    savings === null
      ? []
      : savings.proposal.proposals.filter(
          (proposal) => proposal.reason === 'proportional' || proposal.reason === 'no-gap',
        )
  const hasProportional =
    savings !== null &&
    savings.proposal.proposals.some((proposal) => proposal.reason === 'proportional')

  const simulation = analysis === null ? null : calculateFullRebalancing(analysis)
  const sortedEntries = analysis === null ? [] : sortRebalancingEntries(analysis.entries)
  const recommendations = analysis === null ? null : groupRecommendations(sortedEntries)
  const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.name]))

  function applyResult(result: PlannedChangeActionResult): string | null {
    if (!result.ok) return result.error
    // Vergleich vor Übernahme: unveränderte Bestände lösen NIE einen Dirty-State aus.
    if (JSON.stringify(result.data) !== JSON.stringify(loadedData)) {
      actions.applyDataChange(result.data)
    }
    return null
  }

  function handleSavePlannedChange(): void {
    setActionError(null)
    setSaveSuccess(null)
    if (selectedProfile === null || savings === null) return
    const items: PlannedChangeItemInput[] = []
    const lines: string[] = []
    for (const proposal of receiverProposals) {
      const plan = planById.get(proposal.id)
      if (plan === undefined) continue
      items.push({
        refKind: 'position',
        ref: plan.targetId,
        plannedMonthlyAmount: proposal.proposedMonthlyAmount,
      })
      lines.push(`• ${plan.name}: ${formatEuro(proposal.proposedMonthlyAmount)} pro Monat`)
    }
    const total = items.reduce((sum, item) => sum + item.plannedMonthlyAmount, 0)
    // G5: ausdrückliche Bestätigung INKLUSIVE der Beträge; Abbruch ändert nichts.
    const proceed = window.confirm(
      `Sparraten-Vorschlag als geplante Einstellung speichern?\n\nGeplante Monatsraten (Profil „${selectedProfile.name}“):\n${lines.join('\n')}\nSumme: ${formatEuro(total)} pro Monat.\n\nDie Planung wird nur innerhalb von Finance OS gespeichert („geplant, nicht ausgeführt“) und ändert nie Ist-Daten, Sparpläne oder Broker-Einstellungen.`,
    )
    if (!proceed) return
    const error = applyResult(
      addPlannedChange(
        loadedData,
        {
          basedOnProfileId: selectedProfile.id,
          items,
          note: `Sparraten-Vorschlag (flexibles Budget ${formatEuro(budget.budget)} pro Monat)`,
        },
        todayIso,
      ),
    )
    if (error !== null) {
      setActionError(error)
      return
    }
    setSaveSuccess(
      'Die Planung wurde gespeichert und ist als „geplant, nicht ausgeführt“ gekennzeichnet. Sie ändert keine Ist-Daten und keine Sparpläne.',
    )
  }

  function handleDiscard(changeId: string): void {
    setDiscardFeedback(null)
    const change = loadedData.plannedChanges.find((entry) => entry.id === changeId)
    if (change === undefined) return
    const profileName = profileNameById.get(change.basedOnProfileId) ?? 'unbekanntes Profil'
    const total = change.items.reduce(
      (sum, item) =>
        sum + (Number.isFinite(item.plannedMonthlyAmount) ? item.plannedMonthlyAmount : 0),
      0,
    )
    const proceed = window.confirm(
      `Planung vom ${formatPlannedDate(change.createdAt)} (Profil „${profileName}“, Summe ${formatEuro(total)} pro Monat) verwerfen?\n\nDie Planung bleibt als „verworfen“ in der Datei erhalten – sie wird nicht gelöscht und hat nie Ist-Daten geändert.`,
    )
    if (!proceed) return
    const error = applyResult(discardPlannedChange(loadedData, changeId))
    if (error !== null) {
      setDiscardFeedback({ kind: 'error', text: error })
      return
    }
    // Erfolgs-Feedback + Fokus-Anker: der auslösende Button verschwindet mit
    // der Aktion – der Fokus landet auf dem ersetzenden Status-Text (B1).
    setDiscardFeedback({
      kind: 'success',
      text: `Die Planung vom ${formatPlannedDate(change.createdAt)} wurde als „verworfen“ markiert – sie bleibt zur Historie erhalten und hat nie Ist-Daten geändert.`,
    })
    requestAnimationFrame(() =>
      document.getElementById(`planned-change-status-${changeId}`)?.focus(),
    )
  }

  /** createdAt tolerant anzeigen: Kalenderdatum (A2) oder Alt-Zeitstempel. */
  function formatPlannedDate(createdAt: string): string {
    return createdAt.includes('T')
      ? formatIsoTimestampGerman(createdAt)
      : formatIsoDateGerman(createdAt)
  }

  const jobProfileSelected = selectedProfile !== null && selectedProfile.kind === 'job'

  return (
    <section className="page" aria-labelledby="page-title">
      <h2 id="page-title">Rebalancing</h2>
      <p className="app-hint">
        Analyse der Abweichungen zwischen Ist-Verteilung und gewähltem Zielprofil (Stichtag:{' '}
        {formatIsoDateGerman(todayIso)}). Alle Ergebnisse sind unverbindliche Empfehlungen (G2) –
        es wird nie automatisch etwas ausgeführt.
      </p>
      <RebalancingRules />

      {/* --- A: Übersicht --- */}
      <section aria-labelledby="rebalancing-overview-title">
        <h3 id="rebalancing-overview-title">Übersicht</h3>
        <div className="form-field">
          <label htmlFor="rebalancing-profile-select">Zielprofil für die Analyse</label>
          <select
            id="rebalancing-profile-select"
            value={effectiveProfileId}
            onChange={(event) => {
              setSelectedProfileId(event.target.value)
              setActionError(null)
              setSaveSuccess(null)
              setDiscardFeedback(null)
            }}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.id === activeProfileId ? `${profile.name} (aktives Profil)` : profile.name}
              </option>
            ))}
          </select>
          <p className="app-hint">
            Die Auswahl gilt nur für diese Analyse und ändert das aktive Zielprofil nicht (G5).
          </p>
        </div>
        {jobProfileSelected ? (
          <p className="app-hint" role="note">
            ℹ Hinweis zum Job-Profil: Eine Aktivierung ist nur manuell und frühestens nach dem
            30.09.2027 sinnvoll – Finance OS schaltet nie automatisch um.
          </p>
        ) : null}
        {selectedProfile === null ? (
          <p className="app-hint">Der geladene Bestand enthält keine Zielprofile.</p>
        ) : isSavingsRateReference ? (
          <p className="app-hint">
            Das Profil „{selectedProfile.name}“ ist eine Sparraten-Referenz (Ebene A): Die Referenz
            IST die aktuelle Verteilung – es gibt kein Bestands-Soll und damit keinen berechenbaren
            Rebalancing-Bedarf. Für eine Bestands-Analyse bitte ein Profil mit gespeicherten
            Zielgewichten wählen (z. B. das Job-Profil).
          </p>
        ) : weightsValidation !== null && weightsValidation.status === 'empty' ? (
          <p className="app-hint">
            Profil nicht befüllt – es wird nicht gerechnet. Die Zielgewichte können später gepflegt
            werden (Eigene Aufteilung / Ebene B).
          </p>
        ) : weightsValidation !== null && weightsValidation.status === 'invalid' ? (
          <p className="operation-error" role="alert">
            ⚠ Das Profil „{selectedProfile.name}“ ist ungültig und wird nicht gerechnet:{' '}
            {weightsValidation.issues.join(' ')}
          </p>
        ) : analysis === null ? (
          <p className="app-hint">
            Der Depotwert ist 0 oder es gibt keine bewerteten aktiven Positionen – Anteile und
            Sollwerte sind nicht berechenbar (F20). Es erscheint bewusst kein Zahlwert.
          </p>
        ) : (
          <>
            <dl className="kpi-grid">
              <div className="kpi-tile">
                <dt>Depotwert-Basis</dt>
                <dd>
                  <span>{formatEuro(analysis.depotValue)}</span>
                  <span className="kpi-note">
                    {analysis.entries.length} bewertete Zielpositionen/-gruppen in der Analyse
                  </span>
                </dd>
              </div>
              <div className="kpi-tile">
                <dt>Gesamtabweichung</dt>
                <dd>
                  <span>{formatEuro(analysis.totalDeviation)}</span>
                  <span className="kpi-note">
                    Σ Kaufbedarf (= Σ Verkaufsbedarf bei vollständiger Abdeckung)
                  </span>
                </dd>
              </div>
              <div className="kpi-tile">
                <dt>Größte Abweichung</dt>
                <dd>
                  <span>
                    {analysis.largestDeviation === null
                      ? 'nicht berechenbar'
                      : `${entryLabel(analysis.largestDeviation)}: ${formatPp(analysis.largestDeviation.deviationPp, percentDecimals)}`}
                  </span>
                </dd>
              </div>
              <div className="kpi-tile">
                <dt>Handlungsebene gesamt</dt>
                <dd>
                  <span>
                    {ACTION_LEVEL_SYMBOLS[analysis.overallLevel]}{' '}
                    {ACTION_LEVEL_LABELS[analysis.overallLevel]}
                  </span>
                  <span className="kpi-note">höchste Stufe über alle Zielpositionen</span>
                </dd>
              </div>
            </dl>
            {analysis.unvaluedPositionNames.length > 0 ? (
              <p className="warning-note">
                ⚠ Ohne erfassten Wert (zählen als „unbekannt“, nie als 0, und fehlen in der
                Rechnung): {analysis.unvaluedPositionNames.join(', ')}.
              </p>
            ) : null}
            {analysis.uncoveredPositionNames.length > 0 ? (
              <p className="warning-note">
                ⚠ Nicht im Zielprofil enthalten (kein Sollwert – es wird kein Soll von 0
                erfunden): {analysis.uncoveredPositionNames.join(', ')}. Die Prüfung „Σ Kauf = Σ
                Verkauf“ gilt deshalb nicht; die Differenz ist in der Tabelle ausgewiesen.
              </p>
            ) : null}
            {analysis.unresolvedRefs.length > 0 ? (
              <p className="operation-error" role="alert">
                ⚠ Das Profil „{selectedProfile.name}“ verweist auf Depotpositionen, die im
                Bestand nicht (mehr) aktiv vorhanden sind –{' '}
                {analysis.unresolvedRefs.length === 1
                  ? 'ein Eintrag fehlt'
                  : `${analysis.unresolvedRefs.length} Einträge fehlen`}{' '}
                in der Rechnung.
              </p>
            ) : null}
          </>
        )}
      </section>

      {analysis !== null && selectedProfile !== null ? (
        <>
          {/* --- B: Abweichungstabelle --- */}
          <section aria-labelledby="rebalancing-table-title">
            <h3 id="rebalancing-table-title">Abweichungen je Position</h3>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Abweichungstabelle (horizontal scrollbar)"
            >
              <table className="accounts-table">
                <caption className="visually-hidden">
                  Abweichungen je Position gegenüber dem Profil {selectedProfile.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Position/Gruppe</th>
                    <th scope="col">Ist (€)</th>
                    <th scope="col">Ist (%)</th>
                    <th scope="col">Soll (%)</th>
                    <th scope="col">Soll (€)</th>
                    <th scope="col">Abweichung (Pp)</th>
                    <th scope="col">Abweichung (€)</th>
                    <th scope="col">Kaufbedarf</th>
                    <th scope="col">Verkaufsbedarf</th>
                    <th scope="col">Handlungsebene</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => (
                    <tr key={`${entry.refKind}-${entry.ref}`}>
                      <th scope="row">{entryLabel(entry)}</th>
                      <td>{formatEuro(entry.actualValue)}</td>
                      <td>{formatShare(entry.actualShare, percentDecimals)}</td>
                      <td>{formatShare(entry.targetShare, percentDecimals)}</td>
                      <td>{formatEuro(entry.targetValue)}</td>
                      <td>{formatPp(entry.deviationPp, percentDecimals)}</td>
                      <td>
                        {entry.deviationEur > 0
                          ? `+${formatEuro(entry.deviationEur)}`
                          : formatEuro(entry.deviationEur)}
                      </td>
                      <td>{formatEuro(entry.buyRequirement)}</td>
                      <td>{formatEuro(entry.sellRequirement)}</td>
                      <td>
                        {ACTION_LEVEL_SYMBOLS[entry.level]} {ACTION_LEVEL_LABELS[entry.level]}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Summe</th>
                    <td>
                      {formatEuro(
                        sortedEntries.reduce((sum, entry) => sum + entry.actualValue, 0),
                      )}
                    </td>
                    <td>
                      {formatShare(
                        sortedEntries.reduce((sum, entry) => sum + entry.actualShare, 0),
                        percentDecimals,
                      )}
                    </td>
                    <td>
                      {formatShare(
                        sortedEntries.reduce((sum, entry) => sum + entry.targetShare, 0),
                        percentDecimals,
                      )}
                    </td>
                    <td>
                      {formatEuro(
                        sortedEntries.reduce((sum, entry) => sum + entry.targetValue, 0),
                      )}
                    </td>
                    <td>–</td>
                    <td>–</td>
                    <td>{formatEuro(analysis.totalBuy)}</td>
                    <td>{formatEuro(analysis.totalSell)}</td>
                    <td>–</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Statischer Rechen-Text: KEINE Live-Region (A11y B5). */}
            {analysis.fullCoverage ? (
              <p className="app-hint">
                ✓ Konsistenzprüfung: Σ Kaufbedarf {formatEuro(analysis.totalBuy)} = Σ
                Verkaufsbedarf {formatEuro(analysis.totalSell)}; Differenz{' '}
                {formatEuro(analysis.buySellDifference)} (Anzeige kaufmännisch gerundet, F19 –
                intern wird ungerundet gerechnet).
              </p>
            ) : (
              <p className="warning-note">
                ⚠ Σ Kaufbedarf {formatEuro(analysis.totalBuy)} und Σ Verkaufsbedarf{' '}
                {formatEuro(analysis.totalSell)} weichen um{' '}
                {formatEuro(analysis.buySellDifference)} ab, weil nicht alle bewerteten Positionen
                vom Profil abgedeckt sind (Abdeckungslücke – sichtbar, nicht stillschweigend
                ausgeglichen).
              </p>
            )}
          </section>

          {/* --- C: Empfehlungen --- */}
          <section aria-labelledby="rebalancing-recommendations-title">
            <h3 id="rebalancing-recommendations-title">Handlungsempfehlungen</h3>
            <p className="app-hint">
              Empfehlungen sind rein informativ – die App führt nie Käufe, Verkäufe oder
              Sparplanänderungen aus.
            </p>
            <h4>Maßnahmen-Reihenfolge (S2)</h4>
            <ol>
              <li>Laufende Sparraten auf untergewichtete Positionen lenken.</li>
              <li>Zusätzliches Geld und Ausschüttungen verwenden.</li>
              <li>Flexible Sparpläne übergewichteter Positionen reduzieren.</li>
              <li>Flexible Sparpläne vorübergehend pausieren.</li>
              <li>
                Verkäufe erst als letzte Möglichkeit prüfen – sie werden überhaupt erst ab einer
                Übergewichtung von 10 Prozentpunkten erwähnt.
              </li>
            </ol>
            {recommendations !== null &&
            recommendations.saleOption.length === 0 &&
            recommendations.recommendation.length === 0 ? (
              <p className="success-note">
                ✓ Alle Abweichungen liegen unter 5 Prozentpunkten – keine Empfehlung nötig.
              </p>
            ) : (
              <>
                {recommendations !== null && recommendations.saleOption.length > 0 ? (
                  <>
                    <h4>
                      {ACTION_LEVEL_SYMBOLS['recommendation-with-sale-option']}{' '}
                      {ACTION_LEVEL_LABELS['recommendation-with-sale-option']}
                    </h4>
                    <ul>
                      {recommendations.saleOption.map((entry) => (
                        <li key={`sale-${entry.refKind}-${entry.ref}`}>
                          {recommendationSentence(
                            entry,
                            percentDecimals,
                            entry.refKind === 'position' &&
                              isContractBoundPosition(entry.ref, loadedData.savingsPlans),
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {recommendations !== null && recommendations.recommendation.length > 0 ? (
                  <>
                    <h4>
                      {ACTION_LEVEL_SYMBOLS.recommendation} {ACTION_LEVEL_LABELS.recommendation}
                    </h4>
                    <ul>
                      {recommendations.recommendation.map((entry) => (
                        <li key={`rec-${entry.refKind}-${entry.ref}`}>
                          {recommendationSentence(entry, percentDecimals)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            )}
            {recommendations !== null && recommendations.none.length > 0 ? (
              <p className="app-hint">
                {ACTION_LEVEL_SYMBOLS.none} Nur Anzeige (unter 5 Prozentpunkten):{' '}
                {recommendations.none
                  .map(
                    (entry) =>
                      `${entryLabel(entry)} (${formatPp(entry.deviationPp, percentDecimals)})`,
                  )
                  .join(', ')}
                .
              </p>
            ) : null}
          </section>

          {/* --- D: Sparratenbasierter Vorschlag --- */}
          <section aria-labelledby="rebalancing-savings-title">
            <h3 id="rebalancing-savings-title">Sparratenbasierter Vorschlag (ohne Verkäufe)</h3>
            <p>
              Flexibles Monatsbudget (abgeleitet): <strong>{formatEuro(budget.budget)}</strong>
            </p>
            <p className="app-hint">
              Herleitung: Summe der am Stichtag aktiven, flexiblen eigenen monatlichen Sparpläne
              auf Depotpositionen mit festem Betrag
              {budget.plans.length > 0
                ? ` – ${budget.plans
                    .map((plan) => `${plan.name} ${formatEuro(plan.amount ?? 0)}`)
                    .join(' + ')} = ${formatEuro(budget.budget)}.`
                : ' – derzeit trägt kein Sparplan zum Budget bei.'}
            </p>
            {budget.budget <= 0 || savings === null ? (
              <p className="app-hint">
                Kein flexibles Budget vorhanden – es gibt keine Sparraten-Empfehlung (definierter
                Zustand, keine Rechnung mit 0).
              </p>
            ) : (
              <>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Sparraten-Vorschlag (Tabelle, horizontal scrollbar)"
                >
                  <table className="accounts-table">
                    <caption className="visually-hidden">Sparraten-Vorschlag</caption>
                    <thead>
                      <tr>
                        <th scope="col">Sparplan</th>
                        <th scope="col">Aktuelle Rate</th>
                        <th scope="col">Vorgeschlagene Rate</th>
                        <th scope="col">Begründung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savings.proposal.proposals.map((proposal) => {
                        const plan = planById.get(proposal.id)
                        return (
                          <tr key={proposal.id}>
                            <th scope="row">{plan?.name ?? 'unbekannter Sparplan'}</th>
                            <td>
                              {plan && typeof plan.amount === 'number'
                                ? formatEuro(plan.amount)
                                : 'unbekannt'}
                            </td>
                            <td>{formatEuro(proposal.proposedMonthlyAmount)}</td>
                            <td>{REASON_LABELS[proposal.reason]}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p>
                  Verteiltes Budget: {formatEuro(savings.proposal.distributedBudget)}
                  {savings.proposal.roundingDifference !== 0 ? (
                    <>
                      {' '}
                      – Rundungsdifferenz {formatEuro(savings.proposal.roundingDifference)}{' '}
                      sichtbar ausgeglichen am Plan „
                      {planById.get(savings.proposal.adjustedId ?? '')?.name ?? 'unbekannt'}“
                      (F19).
                    </>
                  ) : (
                    ' – keine Rundungsdifferenz.'
                  )}
                </p>
                <p>
                  Geschätzte Dauer, bis der gesamte Kaufbedarf über die Zuflüsse gedeckt wäre:{' '}
                  <strong>
                    {duration === null
                      ? 'nicht berechenbar'
                      : `ungefähr ${duration} ${duration === 1 ? 'Monat' : 'Monate'}`}
                  </strong>
                  , ohne Kursentwicklung (reine Division, keine Renditeannahme). Parallele feste
                  Zuflüsse in übergewichtete Positionen (z. B. VL, Telekom-Jahresbeitrag) können
                  die tatsächliche Dauer verlängern.
                </p>
                <details className="model-hint">
                  <summary>Geschätzte Dauer je Zielposition (ungefähr, ohne Kursentwicklung)</summary>
                  <ul>
                    {savings.proposal.proposals
                      .filter((proposal) => proposal.reason === 'proportional')
                      .map((proposal) => {
                        const plan = planById.get(proposal.id)
                        const mapped = savings.mappedPlans.find(
                          (candidate) => candidate.id === proposal.id,
                        )
                        const months =
                          mapped === undefined
                            ? null
                            : estimateSavingsDuration(
                                mapped.buyRequirement,
                                proposal.proposedMonthlyAmount,
                              )
                        return (
                          <li key={`duration-${proposal.id}`}>
                            {plan?.name ?? 'unbekannter Sparplan'}:{' '}
                            {months === null
                              ? 'nicht berechenbar (keine Rate)'
                              : `ungefähr ${months} ${months === 1 ? 'Monat' : 'Monate'}`}
                          </li>
                        )
                      })}
                  </ul>
                </details>
                {savings.remainingAfterSavings.length > 0 ? (
                  <div className="warning-note">
                    <p>
                      ⚠ Übergewichtungen sind ohne Verkäufe nicht abbaubar – sie bleiben auch bei
                      umgelenkten Sparraten bestehen (Summe{' '}
                      {formatEuro(savings.totalRemainingSell)}):
                    </p>
                    <ul>
                      {savings.remainingAfterSavings.map((entry) => (
                        <li key={`remaining-${entry.refKind}-${entry.ref}`}>
                          {entryLabel(entry)}: verbleibende Übergewichtung{' '}
                          {formatEuro(entry.remainingSellRequirement)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {hasProportional ? (
                  <div className="toolbar">
                    <button
                      type="button"
                      onClick={handleSavePlannedChange}
                      disabled={state.isSaving}
                    >
                      Als geplante Einstellung speichern
                    </button>
                  </div>
                ) : (
                  <p className="app-hint">
                    Keine untergewichtete Zielposition mit Kaufbedarf – es gibt nichts zu planen.
                  </p>
                )}
                {/* Feedback direkt beim Auslöser (A11y B2). */}
                {actionError !== null ? (
                  <p className="operation-error" role="alert">
                    ⚠ {actionError}
                  </p>
                ) : null}
                {saveSuccess !== null ? (
                  <p className="success-note" role="status">
                    ✓ {saveSuccess}
                  </p>
                ) : null}
              </>
            )}
          </section>

          {/* --- E: Voll-Simulation (reine Anzeige, A7) --- */}
          <section aria-labelledby="rebalancing-simulation-title">
            <h3 id="rebalancing-simulation-title">Voll-Rebalancing (hypothetisch)</h3>
            <p className="simulation-banner" role="note">
              <strong>Simulation – wird nie automatisch übernommen.</strong> Diese Ansicht zeigt
              nur, wie das Depot nach einem vollständigen Rebalancing aussähe. Sie erzeugt KEINEN
              Eintrag unter „Simulationen“ (das ist das Simulations-Modul) und löst keine Käufe
              oder Verkäufe aus.
            </p>
            {simulation !== null ? (
              <>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Voll-Rebalancing-Simulation (Tabelle, horizontal scrollbar)"
                >
                  <table className="accounts-table">
                    <caption className="visually-hidden">Voll-Rebalancing-Simulation</caption>
                    <thead>
                      <tr>
                        <th scope="col">Position/Gruppe</th>
                        <th scope="col">Hypothetischer Kauf</th>
                        <th scope="col">Hypothetischer Verkauf</th>
                        <th scope="col">Neuer Wert</th>
                        <th scope="col">Neue Verteilung (= Ziel)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.entries.map((entry) => (
                        <tr key={`sim-${entry.refKind}-${entry.ref}`}>
                          <th scope="row">{entryLabel(entry)}</th>
                          <td>{formatEuro(entry.buyAmount)}</td>
                          <td>{formatEuro(entry.sellAmount)}</td>
                          <td>{formatEuro(entry.newValue)}</td>
                          <td>{formatShare(entry.newShare, percentDecimals)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Summe</th>
                        <td>{formatEuro(simulation.totalBuy)}</td>
                        <td>{formatEuro(simulation.totalSell)}</td>
                        <td>{formatEuro(analysis.depotValue)}</td>
                        <td>
                          {formatShare(
                            simulation.entries.reduce((sum, entry) => sum + entry.newShare, 0),
                            percentDecimals,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {simulation.unvaluedPositionNames.length > 0 ||
                simulation.uncoveredPositionNames.length > 0 ? (
                  <p className="app-hint">
                    ℹ Nicht Teil der Simulation (Rest):{' '}
                    {[...simulation.unvaluedPositionNames, ...simulation.uncoveredPositionNames].join(
                      ', ',
                    )}
                    .
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {/* --- F: Gespeicherte Planungen --- */}
      <section aria-labelledby="rebalancing-planned-title">
        <h3 id="rebalancing-planned-title">Gespeicherte Planungen</h3>
        <p className="app-hint">
          Gespeicherte Planungen sind reine Absichten innerhalb von Finance OS („geplant, nicht
          ausgeführt“) – sie ändern nie Ist-Daten, Sparpläne oder Broker-Einstellungen. Verworfene
          Planungen bleiben zur Historie erhalten (kein Löschen).
        </p>
        {discardFeedback !== null ? (
          discardFeedback.kind === 'error' ? (
            <p className="operation-error" role="alert">
              ⚠ {discardFeedback.text}
            </p>
          ) : (
            <p className="success-note" role="status">
              ✓ {discardFeedback.text}
            </p>
          )
        ) : null}
        {data.plannedChanges.length === 0 ? (
          <p className="app-hint">
            Noch keine gespeicherten Planungen. Ein Vorschlag kann oben nach ausdrücklicher
            Bestätigung gespeichert werden.
          </p>
        ) : (
          <ul className="goal-list">
            {data.plannedChanges.map((change) => {
              const status = change.status === 'discarded' ? 'discarded' : 'planned'
              return (
                <li key={change.id}>
                  <p className="goal-heading">
                    <strong>Planung vom {formatPlannedDate(change.createdAt)}</strong> – Profil „
                    {profileNameById.get(change.basedOnProfileId) ?? 'unbekanntes Profil'}“ –
                    Status: {PLANNED_STATUS_SYMBOLS[status]} {PLANNED_STATUS_LABELS[status]}
                  </p>
                  <ul>
                    {change.items.map((item, index) => (
                      <li key={`${change.id}-item-${index}`}>
                        {item.refKind === 'group'
                          ? `${GROUP_LABELS[item.ref as PositionGroup] ?? 'unbekannte Gruppe'} (Gruppe)`
                          : (positionNameById.get(item.ref) ?? 'unbekannte Depotposition')}
                        : {formatEuro(item.plannedMonthlyAmount)} pro Monat
                      </li>
                    ))}
                  </ul>
                  {change.note != null && change.note !== '' ? <p>Notiz: {change.note}</p> : null}
                  <div className="row-actions">
                    {status === 'planned' ? (
                      <button
                        type="button"
                        aria-label={`Planung vom ${formatPlannedDate(change.createdAt)} verwerfen`}
                        onClick={() => handleDiscard(change.id)}
                        disabled={state.isSaving}
                      >
                        Verwerfen
                      </button>
                    ) : (
                      // Fokus-Anker nach dem Verwerfen (B1): ersetzt den Button.
                      <span
                        className="app-hint"
                        id={`planned-change-status-${change.id}`}
                        tabIndex={-1}
                      >
                        Verworfen – bleibt zur Historie erhalten und wird nicht gelöscht.
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </section>
  )
}
