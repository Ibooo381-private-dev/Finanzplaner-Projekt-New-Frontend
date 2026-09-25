/**
 * Sparleistungs-Kennzahlen (Formelkatalog F8/F9, calculation-rules Abschnitte 1–2):
 * Eigene Sparleistung und Gesamtvermögenszufluss sind getrennte Kennzahlen (G8);
 * reale und geglättete Sicht werden nie gemischt (G9). Rücklagen- und
 * Liquiditätsübertragungen zählen NIE als Sparleistung (G7). Variable Pläne
 * (amount null) fließen nicht ein – ihre Ist-Werte kommen nur aus Buchungen.
 *
 * U4 (verbindliche Nutzerentscheidung, 2026-07-20): own_fixed UND own_variable
 * zählen mit gültigem POSITIVEN festen Betrag vollständig zur eigenen
 * Sparleistung und damit zum primären U3-Fortschritt. Ohne Betrag (null),
 * mit 0, negativ oder nicht endlich → „zählt nicht“ (0, kein Absturz).
 * Doppelte Verteidigungslinie: Validierung/Datenlayer lehnen NEGATIVE und
 * nicht endliche Beträge beim Laden/Speichern ab; amount 0 ist speicherbar
 * (§3.6 „Zahl ≥ 0“) und zählt ausschließlich per Guard 0. Die reine Schicht
 * deutet ungültige Werte nie als Zufluss.
 * Reine Funktionen; Eingaben werden nicht mutiert.
 */

import type { Interval, SavingsPlan } from '../types/finance'
import { assertFinite } from './rounding'

/** Sicht der Berechnung: realer Monat (ohne Jahresereignisse) oder geglättete Analysesicht. */
export type SavingsView = 'realMonthly' | 'smoothed'

/**
 * Plan aktiv am Stichtag? (validFrom ≤ Datum ≤ validUntil; validUntil null =
 * unbefristet). M10-Erweiterung (dokumentiert, gewollt): pausierte Pläne
 * (isPaused === true, strikte Prüfung) sind NIE aktiv – F8/F9 und alle
 * Dashboard-Kennzahlen schließen sie damit automatisch aus. isPaused ist ein
 * Momentzustand ohne Pausenhistorie (data-model §3.6).
 */
export function isPlanActiveOn(plan: SavingsPlan, isoDate: string): boolean {
  if (plan.isPaused === true) return false
  if (plan.validFrom > isoDate) return false
  if (plan.validUntil != null && plan.validUntil < isoDate) return false
  return true
}

/**
 * Zahlungen pro Jahr je Intervall (M10): monthly 12, quarterly 4, halfyearly 2,
 * yearly 1, once 1 (einmalig – der Jahresbetrag zählt nur im Ausführungsjahr
 * und wird als Einmalbetrag gekennzeichnet, Auflage 2h).
 */
export function paymentsPerYear(interval: Interval): number {
  switch (interval) {
    case 'monthly':
      return 12
    case 'quarterly':
      return 4
    case 'halfyearly':
      return 2
    case 'yearly':
    case 'once':
      return 1
  }
}

/**
 * Jahresbetrag eines Plans = amount × paymentsPerYear (M10).
 * amount null → null („variabel/unbekannt“, G11 – nie 0 erfinden).
 * Bei once ist der Wert der Einmalbetrag des Ausführungsjahres – in
 * Jahressichten GETRENNT von regelmäßigen Jahresbeträgen ausweisen (2h).
 */
export function annualAmount(plan: SavingsPlan): number | null {
  if (plan.amount === null) return null
  assertFinite(plan.amount, `savingsPlan[${plan.id}].amount`)
  return plan.amount * paymentsPerYear(plan.interval)
}

/**
 * Monatsbeitrag eines Plans in der gewählten Sicht (M10-Erweiterung, atomar
 * gekoppelt mit INTERVALS in src/validation – Auflage 2g):
 * - realMonthly: NUR monthly zählt (regelmäßige Monatsrate; Jahres-/Quartals-/
 *   Halbjahres-/Einmalzahlungen sind kein realer Monats-Cashflow, G9 – die
 *   reale Monatssicht je Kalendermonat liefert schedule.realAmountInMonth).
 * - smoothed: monthly amount; quarterly amount/3; halfyearly amount/6;
 *   yearly amount/12; once → 0 (nicht wiederkehrend – konservative,
 *   dokumentierte Regel: Einmalzuflüsse gehen NICHT in die geglättete
 *   Monats-KPI und NICHT in den primären 1.000-€-Fortschritt ein, da nicht
 *   „regelmäßig“ i. S. v. U3; sie erscheinen in Monats-Realsicht und Jahressicht).
 * Variable Pläne (amount null) → 0 (nicht garantiert; nur Ist-Buchungen zählen).
 *
 * U4-Defensivguard (Auflage A, bewusste Guard-Asymmetrie): nicht endliche oder
 * ≤ 0-Beträge zählen hier als 0 („zählt nicht“ ist die ratifizierte Fachregel –
 * kein Throw wie in wealth.ts, wo NaN-als-0 ein ERFUNDENER Vermögenswert wäre,
 * G11). annualAmount behält dagegen sein assertFinite: reiner Anzeigewert je
 * Plan, nicht U3-relevant – ein kaputter Wert soll dort sichtbar knallen.
 */
export function monthlyAmount(plan: SavingsPlan, view: SavingsView): number {
  if (plan.amount === null) return 0
  if (typeof plan.amount !== 'number' || !Number.isFinite(plan.amount) || plan.amount <= 0) {
    return 0
  }
  if (plan.interval === 'monthly') return plan.amount
  if (view !== 'smoothed') return 0
  switch (plan.interval) {
    case 'quarterly':
      return plan.amount / 3
    case 'halfyearly':
      return plan.amount / 6
    case 'yearly':
      return plan.amount / 12
    case 'once':
      return 0
  }
}

function sumMonthly(
  plans: readonly SavingsPlan[],
  view: SavingsView,
  include: (plan: SavingsPlan) => boolean,
): number {
  return plans.reduce((sum, plan) => (include(plan) ? sum + monthlyAmount(plan, view) : sum), 0)
}

/**
 * F8 – Eigene monatliche Sparleistung (nur eigenes Geld). U4: own_fixed UND
 * own_variable zählen mit gültigem positivem festem Betrag; own_variable ohne
 * Betrag (amount null, z. B. Round-up) zählt 0 – Ist-Werte nur aus Buchungen.
 * reserve_transfer/liquidity_transfer zählen NIE (G7); employer/provider sind
 * extern und NIE U3-primär.
 * Seed: realMonthly = 33,50 + 23 + 22 + 10 + 5 + 25 = 118,50; smoothed = + 1.000/12 ≈ 201,83.
 */
export function ownMonthlySavings(plans: readonly SavingsPlan[], view: SavingsView): number {
  return sumMonthly(
    plans,
    view,
    (plan) => plan.flowType === 'own_fixed' || plan.flowType === 'own_variable',
  )
}

/**
 * Arbeitgeber- und Anbieterleistungen pro Monat (employer + provider; provider ist
 * variabel mit amount null und zählt hier 0). Seed: realMonthly = 6,50; smoothed = 6,50 + 500/12 ≈ 48,17.
 */
export function employerAndProviderInflow(
  plans: readonly SavingsPlan[],
  view: SavingsView,
): number {
  return sumMonthly(
    plans,
    view,
    (plan) => plan.flowType === 'employer' || plan.flowType === 'provider',
  )
}

/**
 * F9 – Gesamter Vermögenszufluss inkl. Arbeitgebervorteil = eigene Sparleistung +
 * Arbeitgeber-/Anbieterleistungen. Seed: realMonthly = 125,00; smoothed = 250,00.
 * Achtung Verwechslungsgefahr (F9-Randfall): realMonthly 125,00 und der geglättete
 * Telekom-Gesamtzufluss 125 sind verschiedene Kennzahlen mit zufällig gleichem Wert.
 */
export function totalMonthlyInflow(plans: readonly SavingsPlan[], view: SavingsView): number {
  return ownMonthlySavings(plans, view) + employerAndProviderInflow(plans, view)
}

export interface LabeledAmount {
  id: string
  amount: number
}

/**
 * M10 – Generischer Summen-Gruppierer: summiert monthlyAmount(plan, view) je
 * Schlüssel (z. B. Ziel-ID oder Zuflussart-Herkunft). Reihenfolge = erste
 * Nennung des Schlüssels; pur, keine Mutation. Variable Pläne (amount null)
 * zählen 0 – ihr Hinweis („variabel, nicht garantiert“) ist Sache des Aufrufers.
 */
export function aggregateMonthlyBy(
  plans: readonly SavingsPlan[],
  view: SavingsView,
  keyOf: (plan: SavingsPlan) => string,
): LabeledAmount[] {
  const order: string[] = []
  const sums = new Map<string, number>()
  for (const plan of plans) {
    const key = keyOf(plan)
    if (!sums.has(key)) {
      order.push(key)
      sums.set(key, 0)
    }
    sums.set(key, sums.get(key)! + monthlyAmount(plan, view))
  }
  return order.map((id) => ({ id, amount: sums.get(id)! }))
}

export interface ReferenceShare {
  id: string
  /** Referenzanteil als Dezimalzahl (Summe über alle Einträge = 1,0). */
  share: number
}

/**
 * F10 – Referenzverteilung des Studentenprofils (Ebene A):
 * anteil_i = zufluss_i / Σ zuflüsse, berechnet aus den festen bzw. geglätteten
 * Zuflüssen (nie gespeichert). Variable Zuflüsse (Saveback/Round-up) gehören
 * nicht in die Referenz (nicht garantiert). Seed-Depotebene (Σ = 225):
 * World 85/225 = 0,3777778; EM 10/225 = 0,0444444; Gold 5/225 = 0,0222222;
 * Telekom 125/225 = 0,5555556. Σ ≤ 0 oder leer → null („nicht berechenbar“, F20).
 */
export function referenceAllocation(entries: readonly LabeledAmount[]): ReferenceShare[] | null {
  let sum = 0
  for (const entry of entries) {
    assertFinite(entry.amount, `entries[${entry.id}].amount`)
    if (entry.amount < 0) {
      throw new Error(`»amount« von ${entry.id} darf nicht negativ sein.`)
    }
    sum += entry.amount
  }
  if (sum <= 0) return null
  return entries.map((entry) => ({ id: entry.id, share: entry.amount / sum }))
}
