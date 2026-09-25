/**
 * Reine Datenfunktionen für gespeicherte Planungen (M11, plannedChanges §3.10) –
 * ohne React, unabhängig testbar (Muster src/data/savingsPlans.ts). Alle
 * Funktionen sind pur, mutieren nie die Eingabe (Top-Level-Shallow-Klon) und
 * geben entweder neues FinanceData oder ein Fehlerobjekt mit deutscher,
 * feldbezogener Meldung zurück. Fehlertexte nennen NAMEN, nie technische IDs.
 *
 * Verbindliche Regeln (Spec M11, data-architect-ratifiziert):
 * - Eine Planung entsteht NUR durch ausdrückliche Bestätigung (G5, confirm mit
 *   Beträgen in der Seite) und ändert NIE Ist-Daten oder Sparpläne (M11-AK 2).
 * - createdAt ist das injizierte ISO-Kalenderdatum (todayIso) OHNE
 *   Uhrzeitanteil (A2) – hier gibt es kein new Date().
 * - Verwerfen (A3): additiver Status 'discarded' nach pauseSavingsPlan-Muster;
 *   KEIN Löschen (Historie bleibt), KEIN Zurücksetzen discarded → planned in
 *   V1 (das würde die G5-Bestätigungskette umgehen – dokumentierter Restpunkt).
 * - Schreibseitige Prüfungen (A5): basedOnProfileId existiert, items nicht
 *   leer, Referenzen existieren passend zu refKind, Beträge endlich ≥ 0.
 */

import type {
  FinanceData,
  PlannedChange,
  PlannedChangeItem,
  PositionGroup,
  WeightRefKind,
} from '../types/finance'
import { collectAllIds } from './accounts'
import { isValidBusinessDate } from '../validation/validateFinanceData'
import { formatIsoDateGerman } from '../format/date'

export interface PlannedChangeItemInput {
  refKind: WeightRefKind
  ref: string
  /** Geplante Monatsrate in EUR, endlich und ≥ 0 (0 = „erhält bewusst nichts"). */
  plannedMonthlyAmount: number
}

export interface PlannedChangeInput {
  basedOnProfileId: string
  items: PlannedChangeItemInput[]
  note?: string | null
}

export type PlannedChangeActionResult =
  | { ok: true; data: FinanceData }
  | { ok: false; error: string }

const POSITION_GROUPS: readonly PositionGroup[] = ['world', 'em', 'gold', 'telekom']

/** "plan-" + Kalenderdatum; bei Kollision Suffix "-2", "-3", … (ID-Konvention data-model §2). */
export function generatePlannedChangeId(
  createdAtIso: string,
  existingIds: ReadonlySet<string>,
): string {
  const base = `plan-${createdAtIso}`
  if (!existingIds.has(base)) return base
  let suffix = 2
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

/**
 * Speichert eine bestätigte Empfehlung als geplante Einstellung (G5).
 * todayIso ist der injizierte Stichtag (Kalenderdatum JJJJ-MM-TT) – er wird
 * unverändert als createdAt gespeichert (A2, bewusst ohne Uhrzeitanteil).
 */
export function addPlannedChange(
  data: FinanceData,
  input: PlannedChangeInput,
  todayIso: string,
): PlannedChangeActionResult {
  if (!isValidBusinessDate(todayIso)) {
    return {
      ok: false,
      error: `Datum: "${todayIso}" ist kein gültiges Kalenderdatum im Format JJJJ-MM-TT.`,
    }
  }
  const profile = data.targetProfiles.find((entry) => entry.id === input.basedOnProfileId)
  if (profile === undefined) {
    return {
      ok: false,
      error:
        'Zielprofil: Das zugrunde liegende Zielprofil existiert nicht (womöglich wurde die Datei neu geladen).',
    }
  }
  if (input.items.length === 0) {
    return {
      ok: false,
      error: 'Beträge: Es gibt keine geplanten Monatsraten zu speichern.',
    }
  }
  for (const item of input.items) {
    if (
      typeof item.plannedMonthlyAmount !== 'number' ||
      !Number.isFinite(item.plannedMonthlyAmount)
    ) {
      return {
        ok: false,
        error: 'Beträge: Jede geplante Monatsrate muss eine endliche Zahl sein.',
      }
    }
    if (item.plannedMonthlyAmount < 0) {
      return {
        ok: false,
        error: 'Beträge: Keine geplante Monatsrate darf negativ sein.',
      }
    }
    if (item.refKind === 'position') {
      if (!data.portfolioPositions.some((position) => position.id === item.ref)) {
        return {
          ok: false,
          error:
            'Ziel: Eine geplante Rate verweist auf eine Depotposition, die im Bestand nicht existiert. Bitte den Vorschlag neu berechnen.',
        }
      }
    } else if (!POSITION_GROUPS.includes(item.ref as PositionGroup)) {
      return {
        ok: false,
        error:
          'Ziel: Eine geplante Rate verweist auf eine unbekannte Positionsgruppe. Bitte den Vorschlag neu berechnen.',
      }
    }
  }
  const items: PlannedChangeItem[] = input.items.map((item) => ({
    refKind: item.refKind,
    ref: item.ref,
    plannedMonthlyAmount: item.plannedMonthlyAmount,
  }))
  const change: PlannedChange = {
    id: generatePlannedChangeId(todayIso, collectAllIds(data)),
    createdAt: todayIso,
    basedOnProfileId: input.basedOnProfileId,
    status: 'planned',
    items,
    note: input.note ?? null,
  }
  return { ok: true, data: { ...data, plannedChanges: [...data.plannedChanges, change] } }
}

/**
 * Verwirft eine gespeicherte Planung (status 'discarded', A3). Kein Löschen –
 * die Historie bleibt erhalten; ein Zurücksetzen auf 'planned' gibt es in V1
 * nicht (G5-Schutz, dokumentierter Restpunkt).
 */
export function discardPlannedChange(
  data: FinanceData,
  plannedChangeId: string,
): PlannedChangeActionResult {
  const index = data.plannedChanges.findIndex((entry) => entry.id === plannedChangeId)
  if (index === -1) {
    return { ok: false, error: 'Die gespeicherte Planung existiert nicht.' }
  }
  const change = data.plannedChanges[index]
  const profileName =
    data.targetProfiles.find((entry) => entry.id === change.basedOnProfileId)?.name ??
    'unbekanntes Profil'
  if (change.status === 'discarded') {
    return {
      ok: false,
      error: `Die Planung vom ${formatIsoDateGerman(change.createdAt.slice(0, 10))} (Profil „${profileName}“) wurde bereits verworfen.`,
    }
  }
  const plannedChanges = data.plannedChanges.slice()
  plannedChanges[index] = { ...change, status: 'discarded' }
  return { ok: true, data: { ...data, plannedChanges } }
}
