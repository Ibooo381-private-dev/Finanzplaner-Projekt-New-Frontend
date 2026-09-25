/**
 * JSON.parse + validateFinanceData als ein Aufruf (Blueprint §3).
 * Parse-Fehler werden als verständliche deutsche Meldung mit Position
 * (falls im SyntaxError vorhanden) zurückgegeben – die Datei wird nie
 * teilrepariert oder teilgeladen (storage-concept.md Abschnitt 7).
 */

import type { ValidationResult } from './issues'
import type { ValidateOptions } from './validateFinanceData'
import { validateFinanceData } from './validateFinanceData'

function describeParseError(err: unknown): string {
  const technical = err instanceof Error ? err.message : String(err)
  const positionMatch = /position\s+(\d+)/i.exec(technical)
  const lineColumnMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(technical)
  let location = ''
  if (lineColumnMatch) {
    location = ` Fehlerstelle: Zeile ${lineColumnMatch[1]}, Spalte ${lineColumnMatch[2]}.`
  } else if (positionMatch) {
    location = ` Fehlerstelle: Zeichenposition ${positionMatch[1]}.`
  }
  return `Die Datei ist kein gültiges JSON und kann nicht gelesen werden.${location} Die Datei wurde nicht verändert. Technische Meldung: ${technical}`
}

export function parseFinanceJson(text: string, options?: ValidateOptions): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return {
      ok: false,
      data: null,
      errors: [{ code: 'E_PARSE', path: '', message: describeParseError(err) }],
      warnings: [],
    }
  }
  return validateFinanceData(parsed, options)
}
