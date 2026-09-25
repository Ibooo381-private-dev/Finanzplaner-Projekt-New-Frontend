/**
 * Validierungs-Grundtypen und deutsche Meldungsbausteine
 * (Blueprint §3). Der verbindliche Katalog aller Fehler- und
 * Warnungscodes steht in docs/data-model.md Abschnitt 5.
 *
 * path-Format: accounts[3].balanceHistory[0].amount
 * Meldungen: deutsch, mit Ist-Wert.
 */

import type { FinanceData } from '../types/finance'

export interface ValidationIssue {
  code: string
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  data: FinanceData | null
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

/** Formatiert einen Ist-Wert lesbar für deutsche Fehlermeldungen. */
export function formatValue(value: unknown): string {
  if (value === undefined) return 'nicht vorhanden'
  if (value === null) return 'null'
  if (typeof value === 'number') return String(value)
  try {
    const text = JSON.stringify(value)
    if (text === undefined) return String(value)
    return text.length > 80 ? `${text.slice(0, 77)}…` : text
  } catch {
    return String(value)
  }
}

export function msgMissing(field: string): string {
  return `Das Pflichtfeld »${field}« fehlt.`
}

export function msgWrongType(field: string, expected: string, actual: unknown): string {
  return `»${field}« hat einen ungültigen Typ: erwartet ${expected}. Ist-Wert: ${formatValue(actual)}.`
}

export function msgEnum(field: string, allowed: readonly string[], actual: unknown): string {
  return `»${field}« muss einer der Werte ${allowed.map((v) => `"${v}"`).join(', ')} sein. Ist-Wert: ${formatValue(actual)}.`
}
