/**
 * Deutsche Datumsformatierung (wiederverwendbar, KEINE Rechenlogik).
 * Eine zentrale Funktion, damit fachliche Daten überall identisch als
 * TT.MM.JJJJ erscheinen (Muster src/format/money.ts).
 */

const GERMAN_DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Formatiert ein ISO-Datum (JJJJ-MM-TT) als deutsches Datum TT.MM.JJJJ.
 * Kein gültiges ISO-Datum → Eingabe unverändert zurück (nie werfen, nie raten).
 */
export function formatIsoDateGerman(iso: string): string {
  const match = ISO_DATE_RE.exec(iso)
  if (match === null) return iso
  const [, year, month, day] = match
  // UTC fixiert: das fachliche Datum ist zeitzonenfrei (docs/data-model.md, A5).
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  // Kalendarisch ungültige Werte (z. B. „2026-02-30“) laufen in Date über –
  // nie raten: solche Eingaben gehen unverändert zurück.
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return iso
  return GERMAN_DATE_FORMAT.format(date)
}

const GERMAN_DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Formatiert einen ISO-Zeitstempel (z. B. „2026-07-19T10:30:00.000Z“) als
 * deutsches Datum mit Uhrzeit, z. B. „19.07.2026, 12:30 Uhr“. Zeitstempel sind
 * technische Zeitpunkte (Speichern) – sie erscheinen in der LOKALEN Zeitzone
 * des Geräts. Reine ISO-Datumsangaben und ungültige Eingaben gehen an
 * formatIsoDateGerman (nie werfen, nie raten).
 */
export function formatIsoTimestampGerman(iso: string): string {
  if (!iso.includes('T')) return formatIsoDateGerman(iso)
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return `${GERMAN_DATE_TIME_FORMAT.format(parsed)} Uhr`
}
