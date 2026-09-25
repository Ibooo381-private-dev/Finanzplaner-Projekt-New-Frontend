/**
 * Kalenderlogik der Sparpläne (Modul M10): reale Monatssicht, nächster
 * geplanter Termin und abgeleiteter Status. Reine Funktionen ohne Systemzeit
 * (der Stichtag wird IMMER injiziert), ohne React; Kalenderarithmetik ist
 * rein string-/UTC-basiert – kein Datumsüberlauf, keine Zeitzonen-Drift.
 *
 * Konvention (data-model §3.6): validFrom ist der ERSTE Ausführungstermin;
 * bei quarterly/halfyearly liegen die Fälligkeiten im Zyklus +3 bzw. +6 Monate
 * ab dem validFrom-Monat, Zahltag = validFrom-Tag mit Monatsende-Klemmung
 * (31. → 30./28./29., Schaltjahre korrekt). Bei once ist validFrom das
 * Ausführungsdatum selbst.
 *
 * isPaused-Grenze (Auflage 2c, verbindlich dokumentiert): realAmountInMonth
 * liefert für pausierte Pläne (strikte Prüfung isPaused === true) IMMER 0 –
 * unabhängig vom angefragten Monat. Die Funktion ist deshalb NUR für Monate
 * ≥ Stichtagsmonat einzusetzen; die Vergangenheit kommt ausschließlich aus
 * tatsächlichen Buchungen (transactions), nie aus Planwerten. isPaused ist
 * ein Momentzustand ohne Pausenhistorie – vergangene Monate werden nicht
 * rückwirkend umgedeutet.
 */

import type { SavingsPlan } from '../types/finance'

// --- String-/UTC-Kalenderhelfer (kein new Date() ohne UTC-Fixierung) ---

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Tage im Monat (UTC-fixiert; Schaltjahre korrekt: 2024-02 → 29, 2026-02 → 28). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Fortlaufender Monatsindex (Jahr × 12 + Monat − 1) für Zyklusrechnungen. */
function monthIndexOf(year: number, month: number): number {
  return year * 12 + (month - 1)
}

/** ISO-Datum aus Monatsindex + Tag, mit Monatsende-Klemmung (31. → 30./28./29.). */
function clampedIsoFromMonthIndex(monthIndex: number, day: number): string {
  const year = Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const clampedDay = Math.min(day, daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(clampedDay)}`
}

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7))
}

function dayOf(iso: string): number {
  return Number(iso.slice(8, 10))
}

/** 'YYYY-MM' des ISO-Datums (fachliche Monatszuordnung ist rein textuell). */
export function isoMonthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** Zykluslänge in Monaten je wiederkehrendem Intervall. */
const CYCLE_MONTHS = { monthly: 1, quarterly: 3, halfyearly: 6 } as const

/**
 * Plan ohne ableitbaren Termin-/Monatsplan? true NUR bei yearly ohne dueMonth:
 * der reale Fälligkeitsmonat ist unbekannt – die Monats-Realsicht kann den
 * Jahresbetrag keinem Monat zuordnen („unbekannt“, nie 0 erfinden, G11).
 */
export function hasUnknownSchedule(plan: SavingsPlan): boolean {
  return plan.interval === 'yearly' && plan.dueMonth == null
}

/**
 * Tatsächlicher Planzufluss im Kalendermonat isoMonth ('YYYY-MM'):
 * monthly = amount in jedem Monat des Gültigkeitsfensters; quarterly/halfyearly
 * = amount nur in Zyklusmonaten ab dem validFrom-Monat; yearly = amount nur im
 * dueMonth (dueMonth null → 0, Erkennung über hasUnknownSchedule); once =
 * amount nur im validFrom-Monat. Pausiert/außerhalb des Fensters/amount null → 0.
 * Gültigkeitsfenster: validFrom-Monat ≤ Monat ≤ validUntil-Monat; im
 * validUntil-Monat zusätzlich TAGGENAU: liegt der geklemmte Zahltag des Monats
 * NACH validUntil, findet die Zahlung nicht mehr statt (konsistent mit
 * nextDueDate; calculation-tester-Befund M10-1).
 * NUR für Monate ≥ Stichtagsmonat einsetzen (isPaused-Grenze, Kopfkommentar).
 *
 * U4-Defensivguard (Auflage A): nicht endliche oder ≤ 0-Beträge zählen als 0
 * („zählt nicht“ ist die ratifizierte Fachregel – kein Throw, keine
 * Negativ-Durchreichung). Validierung/Datenlayer lehnen solche Werte weiterhin
 * beim Laden/Speichern ab (doppelte Verteidigungslinie).
 */
export function realAmountInMonth(plan: SavingsPlan, isoMonth: string): number {
  if (plan.isPaused === true) return 0
  if (plan.amount === null) return 0
  if (typeof plan.amount !== 'number' || !Number.isFinite(plan.amount) || plan.amount <= 0) {
    return 0
  }
  const fromMonth = isoMonthOf(plan.validFrom)
  if (isoMonth < fromMonth) return 0
  if (plan.validUntil != null) {
    if (isoMonth > isoMonthOf(plan.validUntil)) return 0
    // Taggenau: Zahltag des angefragten Monats (validFrom-Tag, geklemmt) muss
    // ≤ validUntil liegen – greift nur im validUntil-Monat selbst.
    const monthIndex = monthIndexOf(Number(isoMonth.slice(0, 4)), Number(isoMonth.slice(5, 7)))
    if (clampedIsoFromMonthIndex(monthIndex, dayOf(plan.validFrom)) > plan.validUntil) return 0
  }
  switch (plan.interval) {
    case 'monthly':
      return plan.amount
    case 'quarterly':
    case 'halfyearly': {
      const cycle = CYCLE_MONTHS[plan.interval]
      const fromIndex = monthIndexOf(yearOf(plan.validFrom), monthOf(plan.validFrom))
      const monthIndex = monthIndexOf(Number(isoMonth.slice(0, 4)), Number(isoMonth.slice(5, 7)))
      return (monthIndex - fromIndex) % cycle === 0 ? plan.amount : 0
    }
    case 'yearly': {
      if (plan.dueMonth == null) return 0
      return Number(isoMonth.slice(5, 7)) === plan.dueMonth ? plan.amount : 0
    }
    case 'once':
      return isoMonth === fromMonth ? plan.amount : 0
  }
}

/**
 * Nächster geplanter Termin ≥ todayIso oder null („unbekannt“/keiner):
 * pausiert → null; beendet (validUntil < todayIso) → null; once: validFrom ≥
 * todayIso → validFrom, sonst null (abgeschlossen); yearly ohne dueMonth →
 * null (unbekannt); sonst Zyklus ab validFrom mit Zahltag = validFrom-Tag und
 * Monatsende-Klemmung; Termine nach validUntil → null. Auch variable Pläne
 * (amount null) haben einen Rhythmus und damit einen Termin.
 */
export function nextDueDate(plan: SavingsPlan, todayIso: string): string | null {
  if (plan.isPaused === true) return null
  if (plan.validUntil != null && plan.validUntil < todayIso) return null

  if (plan.interval === 'once') {
    return plan.validFrom >= todayIso ? plan.validFrom : null
  }

  const payDay = dayOf(plan.validFrom)

  if (plan.interval === 'yearly') {
    if (plan.dueMonth == null) return null
    // Kandidat je Jahr: dueMonth mit geklemmtem validFrom-Tag; der erste
    // Kandidat ≥ heute UND ≥ validFrom ist der nächste Termin. Startjahr ist
    // das SPÄTERE aus Stichtagsjahr und validFrom-Jahr – auch weit
    // vorausgeplante Jahres-Pläne haben so einen ableitbaren ersten Termin
    // (finance-analyst-Befund M10-F2).
    let year = Math.max(yearOf(todayIso), yearOf(plan.validFrom))
    for (let i = 0; i < 3; i += 1) {
      const candidate = clampedIsoFromMonthIndex(monthIndexOf(year, plan.dueMonth), payDay)
      if (candidate >= todayIso && candidate >= plan.validFrom) {
        if (plan.validUntil != null && candidate > plan.validUntil) return null
        return candidate
      }
      year += 1
    }
    return null
  }

  // monthly/quarterly/halfyearly: kleinster Zyklusmonat ab validFrom, dessen
  // geklemmter Zahltag ≥ heute liegt.
  const cycle = CYCLE_MONTHS[plan.interval]
  const fromIndex = monthIndexOf(yearOf(plan.validFrom), monthOf(plan.validFrom))
  const todayIndex = monthIndexOf(yearOf(todayIso), monthOf(todayIso))
  let k = Math.max(0, Math.ceil((todayIndex - fromIndex) / cycle))
  let candidate = clampedIsoFromMonthIndex(fromIndex + k * cycle, payDay)
  if (candidate < todayIso) {
    k += 1
    candidate = clampedIsoFromMonthIndex(fromIndex + k * cycle, payDay)
  }
  if (plan.validUntil != null && candidate > plan.validUntil) return null
  return candidate
}

/**
 * Abgeleiteter Planstatus (Auflage 2b, verbindliche Rangfolge):
 * (1) abgeschlossen = once UND validFrom < todayIso;
 * (2) beendet = validUntil < todayIso;
 * (3) pausiert = isPaused === true;
 * (4) geplant = validFrom > todayIso;
 * (5) aktiv. (once mit validFrom = todayIso ist aktiv; validUntil = todayIso
 * ist aktiv – beendet erst NACH dem Enddatum.)
 */
export type SavingsPlanStatus = 'completed' | 'ended' | 'paused' | 'planned' | 'active'

export function planStatus(plan: SavingsPlan, todayIso: string): SavingsPlanStatus {
  if (plan.interval === 'once' && plan.validFrom < todayIso) return 'completed'
  if (plan.validUntil != null && plan.validUntil < todayIso) return 'ended'
  if (plan.isPaused === true) return 'paused'
  if (plan.validFrom > todayIso) return 'planned'
  return 'active'
}
