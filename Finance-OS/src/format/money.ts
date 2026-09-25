/**
 * Deutsche Geldformatierung (wiederverwendbar, KEINE Rechenlogik).
 * Eine zentrale Funktion, damit Beträge überall identisch erscheinen.
 */

const EURO_FORMAT = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

/** Formatiert einen Betrag als Euro-Text im Format de-DE (z. B. "1.234,56 €"). */
export function formatEuro(amount: number): string {
  return EURO_FORMAT.format(amount)
}

/**
 * Strenges de-DE-Eingabemuster (Review-Befund 3.2, Modul Konten):
 * erlaubt "250", "250,5", "250,00", "1.234", "1.234,56", "-50" –
 * Tausenderpunkte nur in korrekten Dreiergruppen. Alles andere (z. B. "12.34",
 * "1,234", "0x10") → null, damit der Tausenderpunkt nie als Dezimalpunkt
 * fehlinterpretiert wird ("1.234" ist 1234 €, niemals 1,234 €).
 */
const GERMAN_AMOUNT_RE = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/

/** Parst eine deutsche Betragseingabe; null bei ungültigem Format. */
export function parseGermanAmount(text: string): number | null {
  const trimmed = text.trim()
  if (!GERMAN_AMOUNT_RE.test(trimmed)) return null
  const normalized = trimmed.replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}
