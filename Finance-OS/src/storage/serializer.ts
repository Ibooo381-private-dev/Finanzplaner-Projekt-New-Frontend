/**
 * Serialisierung (Blueprint §4).
 *
 * serializeFinanceData serialisiert IMMER das State-Objekt selbst
 * (JSON.stringify desselben Objekts, nie eine Neuabbildung) – so überleben
 * unbekannte Felder Laden + Speichern unverändert (Regel 16).
 */

import type { FinanceData } from '../types/finance'

/** JSON.stringify(data, null, 2) + "\n" – UTF-8 ohne BOM (Blueprint §7.8). */
export function serializeFinanceData(data: FinanceData): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

/**
 * Flacher Top-Level-Klon, der ausschließlich metadata.updatedAt setzt.
 * Wird nur bei (a) direktem Speichern und (b) Export mit "als gespeichert
 * markieren" verwendet (updatedAt-Entscheidung, Blueprint §4).
 */
export function withUpdatedTimestamp(data: FinanceData, nowIso: string): FinanceData {
  return { ...data, metadata: { ...data.metadata, updatedAt: nowIso } }
}
