/**
 * Reine Datenfunktionen für das Modul „Simulator & Projektionen“ (M13,
 * simulations §3.11) – ohne React, unabhängig testbar (Muster
 * src/data/plannedChanges.ts). Alle Funktionen sind pur, mutieren nie die
 * Eingabe (Top-Level-Shallow-Klon) und geben entweder neues FinanceData oder
 * ein Fehlerobjekt mit deutscher, feldbezogener Meldung zurück. Fehlertexte
 * nennen NAMEN, nie technische IDs.
 *
 * Verbindliche Regeln (Spec M13, data-architect-ratifiziert):
 * - Simulationen ändern NIE Ist-Daten: die einzige berührte Collection ist
 *   simulations[] (AK-3-Stop-Bedingung – alle anderen Collections bleiben
 *   Byte-identisch).
 * - createdAt = injiziertes ISO-Kalenderdatum (todayIso, M11-Präzedenz A2,
 *   isValidBusinessDate-geprüft) – hier gibt es kein new Date().
 * - Hartes Löschen ist zulässig (ratifiziert): Simulationen sind reine
 *   Szenario-Entwürfe OHNE Referenzen von/auf andere Entitäten und keine
 *   historischen Finanzdaten; Löschen NUR über die G12-Bestätigung der Seite.
 * - Schreibseitige Prüfungen (2.2/2.6): Name nicht leer (trim), Startwerte
 *   ≥ 0 endlich, months Ganzzahl 1–1200, annualReturnRate ∈ [0; 0,15],
 *   Beiträge ≥ 0 endlich mit nicht-leerem Label, Transfer-flowTypes verboten
 *   (G7), target-Enum. Die 8-%-Warnung ist Sache der Anzeige (nie Fehler).
 * - K2-Regel: optionale Schlüssel (note; target je Beitrag) werden nie als
 *   Default-Schlüssel NEU materialisiert – unverändertes Speichern bleibt
 *   Byte-identisch; target wird nur bei 'cash' geschrieben ('depot' ist der
 *   dokumentierte Default).
 */

import type {
  FinanceData,
  FlowType,
  Simulation,
  SimulationContribution,
  SimulationContributionTarget,
  SimulationParams,
} from '../types/finance'
import { collectAllIds } from './accounts'
import { isValidBusinessDate } from '../validation/validateFinanceData'
import { SIMULATION_MAX_MONTHS, SIMULATION_MAX_RETURN_RATE } from '../finance/projection'

export interface SimulationContributionInput {
  label: string
  /** Monatsbetrag in EUR, endlich und ≥ 0. */
  amount: number
  /** Zuflussart (G8); Umbuchungen (reserve_/liquidity_transfer) sind unzulässig (G7). */
  flowType: FlowType
  /** Zielseite im Aggregatmodell; Default 'depot' (wird nur bei 'cash' gespeichert). */
  target?: SimulationContributionTarget
}

export interface SimulationParamsInput {
  startDepotValue: number
  startTagesgeldValue: number
  months: number
  annualReturnRate: number
  monthlyContributions: SimulationContributionInput[]
  telekomMode: 'real' | 'smoothed'
}

export interface SimulationInput {
  name: string
  params: SimulationParamsInput
  note?: string | null
}

export type SimulationActionResult = { ok: true; data: FinanceData } | { ok: false; error: string }

const TRANSFER_FLOW_TYPES: readonly FlowType[] = ['reserve_transfer', 'liquidity_transfer']

const FLOW_TYPES: readonly FlowType[] = [
  'own_fixed',
  'own_variable',
  'employer',
  'provider',
  'reserve_transfer',
  'liquidity_transfer',
]

/** Kebab-Case aus dem Namen (deutsche Umlaute transliteriert), nie leer (Muster goals.ts). */
function kebab(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'simulation' : slug
}

/** "sim-" + kebab(name); bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model §2). */
export function generateSimulationId(name: string, existingIds: ReadonlySet<string>): string {
  const base = `sim-${kebab(name)}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

function findSimulationIndex(data: FinanceData, simulationId: string): number {
  return data.simulations.findIndex((simulation) => simulation.id === simulationId)
}

/**
 * Fachliche Prüfung eines (zusammengeführten) Simulations-Stands. Liefert null
 * bei Erfolg, sonst die deutsche, feldbezogene Meldung (Feld-Präfix wie „Name:“).
 * Namen sind unter Simulationen EINDEUTIG (trim-Vergleich; Prüfkette M13 B3/N1
 * – Karten, Vergleichs-Auswahl und Bestätigungen identifizieren über den
 * Namen); excludeId nimmt beim Bearbeiten die eigene Simulation aus. Die
 * Ladeprüfung bleibt tolerant (Altdateien mit Doppelnamen laden unverändert).
 */
function checkSimulationInput(
  data: FinanceData,
  input: SimulationInput,
  excludeId?: string,
): string | null {
  const trimmedName = input.name.trim()
  if (trimmedName === '') {
    return 'Name: Der Name darf nicht leer sein.'
  }
  const nameTaken = data.simulations.some(
    (simulation) => simulation.id !== excludeId && simulation.name.trim() === trimmedName,
  )
  if (nameTaken) {
    return 'Name: Es existiert bereits eine Simulation mit diesem Namen – bitte einen eindeutigen Namen wählen.'
  }
  const params = input.params
  if (
    typeof params.startDepotValue !== 'number' ||
    !Number.isFinite(params.startDepotValue) ||
    params.startDepotValue < 0
  ) {
    return 'Depot-Startwert: Der Startwert muss eine endliche Zahl ≥ 0 sein.'
  }
  if (
    typeof params.startTagesgeldValue !== 'number' ||
    !Number.isFinite(params.startTagesgeldValue) ||
    params.startTagesgeldValue < 0
  ) {
    return 'Tagesgeld-Startwert: Der Startwert muss eine endliche Zahl ≥ 0 sein.'
  }
  if (
    !Number.isInteger(params.months) ||
    params.months < 1 ||
    params.months > SIMULATION_MAX_MONTHS
  ) {
    return `Zeitraum: Der Zeitraum muss eine ganze Zahl zwischen 1 und ${SIMULATION_MAX_MONTHS} Monaten (100 Jahre) sein.`
  }
  if (
    typeof params.annualReturnRate !== 'number' ||
    !Number.isFinite(params.annualReturnRate) ||
    params.annualReturnRate < 0 ||
    params.annualReturnRate > SIMULATION_MAX_RETURN_RATE
  ) {
    return 'Rendite: Die jährliche Renditeannahme muss zwischen 0 % und 15 % liegen (negative Annahmen sind in Version 1 nicht vorgesehen).'
  }
  if (params.telekomMode !== 'real' && params.telekomMode !== 'smoothed') {
    return 'Telekom-Modus: Bitte „real“ oder „geglättet“ wählen.'
  }
  for (const contribution of params.monthlyContributions) {
    if (contribution.label.trim() === '') {
      return 'Beiträge: Jeder Beitrag braucht eine Bezeichnung.'
    }
    if (
      typeof contribution.amount !== 'number' ||
      !Number.isFinite(contribution.amount) ||
      contribution.amount < 0
    ) {
      return `Beiträge: Der Beitrag „${contribution.label}“ muss eine endliche Zahl ≥ 0 sein.`
    }
    if (!FLOW_TYPES.includes(contribution.flowType)) {
      return `Beiträge: Der Beitrag „${contribution.label}“ hat keine gültige Zuflussart.`
    }
    if (TRANSFER_FLOW_TYPES.includes(contribution.flowType)) {
      return `Beiträge: Der Beitrag „${contribution.label}“ ist eine Umbuchung – Umbuchungen sind in Simulationen nicht zulässig (kein Vermögenszufluss).`
    }
    if (
      contribution.target !== undefined &&
      contribution.target !== 'depot' &&
      contribution.target !== 'cash'
    ) {
      return `Beiträge: Der Beitrag „${contribution.label}“ hat ein ungültiges Ziel (zulässig: Depot oder Tagesgeld).`
    }
  }
  return null
}

/** Beiträge als Speicherform: target nur bei 'cash' materialisieren (K2; Default 'depot'). */
function toStoredContributions(
  contributions: readonly SimulationContributionInput[],
): SimulationContribution[] {
  return contributions.map((contribution) => {
    const stored: SimulationContribution = {
      label: contribution.label.trim(),
      amount: contribution.amount,
      flowType: contribution.flowType,
    }
    if (contribution.target === 'cash') stored.target = 'cash'
    return stored
  })
}

function toStoredParams(params: SimulationParamsInput): SimulationParams {
  return {
    startDepotValue: params.startDepotValue,
    startTagesgeldValue: params.startTagesgeldValue,
    months: params.months,
    annualReturnRate: params.annualReturnRate,
    monthlyContributions: toStoredContributions(params.monthlyContributions),
    telekomMode: params.telekomMode,
  }
}

/**
 * Legt eine neue Simulation an (createdAt = injiziertes Kalenderdatum,
 * M11-Präzedenz A2). Es werden NUR Parameter gespeichert – Ergebnisse sind
 * reproduzierbar berechenbar und werden nie gespeichert (§3.11).
 */
export function addSimulation(
  data: FinanceData,
  input: SimulationInput,
  todayIso: string,
): SimulationActionResult {
  if (!isValidBusinessDate(todayIso)) {
    return {
      ok: false,
      error: `Datum: "${todayIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  const issue = checkSimulationInput(data, input)
  if (issue !== null) return { ok: false, error: issue }
  const name = input.name.trim()
  const simulation: Simulation = {
    id: generateSimulationId(name, collectAllIds(data)),
    name,
    createdAt: todayIso,
    params: toStoredParams(input.params),
    note: input.note ?? null,
  }
  return { ok: true, data: { ...data, simulations: [...data.simulations, simulation] } }
}

/**
 * Aktualisiert eine Simulation (Teil-Patch; createdAt und unbekannte Felder
 * bleiben per Spread erhalten, K2-Byte-Identität bei No-Op-Patches auf
 * Objektebene – die Seite vergleicht zusätzlich vor applyDataChange).
 */
export function updateSimulation(
  data: FinanceData,
  simulationId: string,
  changes: Partial<SimulationInput>,
): SimulationActionResult {
  const index = findSimulationIndex(data, simulationId)
  if (index === -1) {
    return {
      ok: false,
      error:
        'Die Simulation existiert nicht (womöglich wurde sie gelöscht oder die Datei neu geladen).',
    }
  }
  const existing = data.simulations[index]
  const merged: SimulationInput = {
    name: changes.name ?? existing.name,
    params:
      changes.params !== undefined
        ? changes.params
        : {
            startDepotValue: existing.params.startDepotValue,
            startTagesgeldValue: existing.params.startTagesgeldValue,
            months: existing.params.months,
            annualReturnRate: existing.params.annualReturnRate,
            monthlyContributions: existing.params.monthlyContributions.map((contribution) => ({
              label: contribution.label,
              amount: contribution.amount,
              flowType: contribution.flowType,
              ...(contribution.target === 'cash' ? { target: 'cash' as const } : {}),
            })),
            telekomMode: existing.params.telekomMode,
          },
    note: changes.note !== undefined ? changes.note : (existing.note ?? null),
  }
  // Namens-Eindeutigkeit: die eigene Simulation ist ausgenommen (excludeId).
  const issue = checkSimulationInput(data, merged, simulationId)
  if (issue !== null) return { ok: false, error: issue }
  // Spread auf dem Bestand: unbekannte Felder, Schlüsselreihenfolge und
  // createdAt bleiben erhalten (Regel 16).
  const updated: Simulation = { ...existing }
  updated.name = merged.name.trim()
  if (changes.params !== undefined) {
    // params-Spread erhält unbekannte Zusatzfelder INNERHALB von params.
    updated.params = { ...existing.params, ...toStoredParams(merged.params) }
  }
  if (changes.note !== undefined) {
    updated.note = merged.note ?? null
  }
  const simulations = data.simulations.slice()
  simulations[index] = updated
  return { ok: true, data: { ...data, simulations } }
}

/**
 * Kopiert eine Simulation als neuen Entwurf: Name „<Name> (Kopie)“ (bei
 * Kollision „(Kopie 2)“, „(Kopie 3)“, …), NEUES createdAt = todayIso,
 * identische Parameter (tiefe Kopie inkl. unbekannter Zusatzfelder).
 */
export function duplicateSimulation(
  data: FinanceData,
  simulationId: string,
  todayIso: string,
): SimulationActionResult {
  if (!isValidBusinessDate(todayIso)) {
    return {
      ok: false,
      error: `Datum: "${todayIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  const index = findSimulationIndex(data, simulationId)
  if (index === -1) {
    return {
      ok: false,
      error:
        'Die Simulation existiert nicht (womöglich wurde sie gelöscht oder die Datei neu geladen).',
    }
  }
  const source = data.simulations[index]
  // NAMENS-Kollisionssuffix (nicht nur ID): „(Kopie)“ → „(Kopie 2)“ → … –
  // trim-Vergleich konsistent zur Eindeutigkeitsprüfung der Schreibseite.
  const existingNames = new Set(data.simulations.map((simulation) => simulation.name.trim()))
  let copyName = `${source.name} (Kopie)`
  let suffix = 2
  while (existingNames.has(copyName.trim())) {
    copyName = `${source.name} (Kopie ${suffix})`
    suffix += 1
  }
  const copy: Simulation = {
    ...source,
    id: generateSimulationId(copyName, collectAllIds(data)),
    name: copyName,
    createdAt: todayIso,
    params: {
      ...source.params,
      monthlyContributions: source.params.monthlyContributions.map((contribution) => ({
        ...contribution,
      })),
    },
  }
  return { ok: true, data: { ...data, simulations: [...data.simulations, copy] } }
}

/**
 * Löscht eine Simulation HART (ratifizierte Ausnahme: reine Szenario-Entwürfe
 * ohne Referenzen, keine historischen Finanzdaten – Begründung §3.11).
 * Darf NUR nach der G12-Bestätigung der Seite (confirm inkl. Name) aufgerufen
 * werden; ein Abbruch dort lässt den Bestand Byte-identisch.
 */
export function deleteSimulation(data: FinanceData, simulationId: string): SimulationActionResult {
  const index = findSimulationIndex(data, simulationId)
  if (index === -1) {
    return {
      ok: false,
      error:
        'Die Simulation existiert nicht (womöglich wurde sie bereits gelöscht oder die Datei neu geladen).',
    }
  }
  const simulations = data.simulations.slice()
  simulations.splice(index, 1)
  return { ok: true, data: { ...data, simulations } }
}
