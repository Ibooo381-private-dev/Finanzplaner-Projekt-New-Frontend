/**
 * Zielwerte, Abweichungen, Kauf-/Verkaufsbedarf (Formelkatalog F11–F16, F21;
 * rebalancing-Skill S2): Sollwert = Zielgewicht × Depotwert (Nenner = Depot,
 * nie Tagesgeld); Prozentpunkte absolut; Schwellen 5/10 Pp (U1). Zielgewichte
 * werden validiert (Σ = 1,0 ± 0,001, jedes Gewicht ∈ [0;1]); ungültige oder
 * leere Profile rechnen nicht. Reine Funktionen; Eingaben werden nicht mutiert.
 */

import type { Level1, WeightEntry } from '../types/finance'
import { assertFinite } from './rounding'

/** Toleranz der Gewichtssummen-Prüfung (data-model Regel 11, DM10). */
export const WEIGHT_SUM_TOLERANCE = 0.001

/** Schwelle für Handlungsempfehlung in Prozentpunkten, absolut (U1/K12). */
export const RECOMMENDATION_THRESHOLD_PP = 5

/** Schwelle, ab der die Verkaufsoption als letzte Möglichkeit erwähnt wird (U1/K12). */
export const SALE_MENTION_THRESHOLD_PP = 10

export type WeightsStatus = 'empty' | 'valid' | 'invalid'

export interface WeightsValidation {
  status: WeightsStatus
  /** Ist-Summe der Gewichte (0 bei leerem Profil). */
  sum: number
  /** Sichtbare Differenz zur 1,0 (F19/DM10); 0 bei leerem Profil. */
  difference: number
  /** Deutsche Begründungen bei status "invalid". */
  issues: string[]
}

/** F21 – Zielgewichte validieren: leer = gültig, aber „nicht befüllt“ (es wird nicht gerechnet). */
export function validateWeights(
  weights: readonly WeightEntry[] | null | undefined,
): WeightsValidation {
  if (weights == null || weights.length === 0) {
    return { status: 'empty', sum: 0, difference: 0, issues: [] }
  }
  const issues: string[] = []
  let sum = 0
  weights.forEach((entry, index) => {
    if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight)) {
      issues.push(`Gewicht ${index + 1} (»${entry.ref}«) ist keine endliche Zahl.`)
      return
    }
    if (entry.weight < 0 || entry.weight > 1) {
      issues.push(
        `Gewicht ${index + 1} (»${entry.ref}«) muss zwischen 0 und 1 liegen. Ist-Wert: ${entry.weight}.`,
      )
    }
    sum += entry.weight
  })
  const difference = sum - 1
  if (issues.length === 0 && Math.abs(difference) > WEIGHT_SUM_TOLERANCE) {
    issues.push(
      `Die Gewichte müssen zusammen 1,0 ergeben (±${WEIGHT_SUM_TOLERANCE}). Ist-Summe: ${Math.round(sum * 1e6) / 1e6}.`,
    )
  }
  return { status: issues.length === 0 ? 'valid' : 'invalid', sum, difference, issues }
}

export interface TargetValue {
  refKind: WeightEntry['refKind']
  ref: string
  weight: number
  /** Sollwert in EUR (ungerundet; Anzeige-Rundung über F19). */
  target: number
}

/**
 * F11/F12 – Zielwerte: soll_i = gewicht_i × Depotwert. null bei leerem oder
 * ungültigem Profil („nicht befüllt“/abgelehnt, M11-AK 4) sowie bei Depotwert ≤ 0
 * (F20: keine Berechnung auf leerem Depot).
 */
export function targetValues(
  weights: readonly WeightEntry[] | null | undefined,
  depotValue: number,
): TargetValue[] | null {
  assertFinite(depotValue, 'depotValue')
  const validation = validateWeights(weights)
  if (validation.status !== 'valid' || depotValue <= 0) return null
  return (weights as readonly WeightEntry[]).map((entry) => ({
    refKind: entry.refKind,
    ref: entry.ref,
    weight: entry.weight,
    target: entry.weight * depotValue,
  }))
}

/** F13 – Abweichung in Euro: Ist − Soll (positiv = übergewichtet). */
export function deviationEur(actualValue: number, targetValue: number): number {
  assertFinite(actualValue, 'actualValue')
  assertFinite(targetValue, 'targetValue')
  return actualValue - targetValue
}

/**
 * F14 – Abweichung in Prozentpunkten, absolut: (Ist-Anteil − Zielanteil) × 100.
 * Anteile sind Dezimalzahlen; ohne die Skalierung ×100 greifen die 5/10-Pp-Schwellen nicht.
 */
export function deviationPp(actualShare: number, targetShare: number): number {
  assertFinite(actualShare, 'actualShare')
  assertFinite(targetShare, 'targetShare')
  return (actualShare - targetShare) * 100
}

export type ActionLevel = 'none' | 'recommendation' | 'recommendation-with-sale-option'

/**
 * Rebalancing-Toleranz (U1/K12, F14): |Abweichung| < 5 Pp → nur Anzeige;
 * |Abweichung| ≥ 5 Pp → Handlungsempfehlung. Die Verkaufsoption wird nur bei
 * ÜBERGEWICHTUNG (positive Abweichung ≥ 10 Pp) erwähnt – bei Untergewichtung
 * gibt es nichts zu verkaufen (F14-Beispiel: EM −11,07 Pp → nur Empfehlung,
 * Telekom +44,28 Pp → Empfehlung inkl. Verkaufsoption).
 * Immer nur Empfehlung, nie Ausführung (G1/G2).
 */
export function actionLevel(deviationInPp: number): ActionLevel {
  assertFinite(deviationInPp, 'deviationInPp')
  if (deviationInPp >= SALE_MENTION_THRESHOLD_PP) return 'recommendation-with-sale-option'
  if (Math.abs(deviationInPp) >= RECOMMENDATION_THRESHOLD_PP) return 'recommendation'
  return 'none'
}

/** F21 – level1-Validierung: Anteile einzeln ∈ [0;1], Summe 1,0 ± 0,001 (fehlend = "empty"). */
export function validateLevel1(level1: Level1 | null | undefined): WeightsValidation {
  if (level1 == null) {
    return { status: 'empty', sum: 0, difference: 0, issues: [] }
  }
  const issues: string[] = []
  let sum = 0
  ;(
    [
      ['depotShare', level1.depotShare],
      ['cashShare', level1.cashShare],
    ] as const
  ).forEach(([name, value]) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(`»${name}« ist keine endliche Zahl.`)
      return
    }
    if (value < 0 || value > 1) {
      issues.push(`»${name}« muss zwischen 0 und 1 liegen. Ist-Wert: ${value}.`)
    }
    sum += value
  })
  const difference = sum - 1
  if (issues.length === 0 && Math.abs(difference) > WEIGHT_SUM_TOLERANCE) {
    issues.push(
      `»depotShare« und »cashShare« müssen zusammen 1,0 ergeben (±${WEIGHT_SUM_TOLERANCE}). Ist-Summe: ${Math.round(sum * 1e6) / 1e6}.`,
    )
  }
  return { status: issues.length === 0 ? 'valid' : 'invalid', sum, difference, issues }
}

export interface SavingsQuoteSplit {
  /** Depot-Sparbetrag = depotShare × Sparquote (Job-Beispiel: 0,85 × 988 = 839,80). */
  depotAmount: number
  /** Tagesgeld-Sparbetrag = cashShare × Sparquote (Job-Beispiel: 0,15 × 988 = 148,20). */
  cashAmount: number
}

/**
 * F11 Ebene 1 – Sparquoten-Split auf Gesamtvermögensebene:
 * depot = depotShare × S, tagesgeld = cashShare × S. null bei fehlendem oder
 * ungültigem level1 (es wird nicht gerechnet) sowie bei negativer Sparquote.
 */
export function splitSavingsQuote(
  savingsQuote: number,
  level1: Level1 | null | undefined,
): SavingsQuoteSplit | null {
  assertFinite(savingsQuote, 'savingsQuote')
  if (savingsQuote < 0) return null
  if (level1 == null || validateLevel1(level1).status !== 'valid') return null
  return {
    depotAmount: level1.depotShare * savingsQuote,
    cashAmount: level1.cashShare * savingsQuote,
  }
}

/** F15 – Kaufbedarf = MAX(0, Soll − Ist); nie negativ. */
export function buyRequirement(actualValue: number, targetValue: number): number {
  assertFinite(actualValue, 'actualValue')
  assertFinite(targetValue, 'targetValue')
  return Math.max(0, targetValue - actualValue)
}

/** F16 – Verkaufsbedarf = MAX(0, Ist − Soll); nie negativ; reine Information (G1). */
export function sellRequirement(actualValue: number, targetValue: number): number {
  assertFinite(actualValue, 'actualValue')
  assertFinite(targetValue, 'targetValue')
  return Math.max(0, actualValue - targetValue)
}
