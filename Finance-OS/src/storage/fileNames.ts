/**
 * Dateinamensschemata (Blueprint §4, storage-concept.md Abschnitte 4/5).
 * Alle Datumsteile in lokaler Zeit; das Datum wird als Parameter injiziert.
 */

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function localDatePart(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** "finance-data-JJJJ-MM-TT.json" */
export function exportFileName(date: Date): string {
  return `finance-data-${localDatePart(date)}.json`
}

/** "finance-data-backup-JJJJ-MM-TT-HHmm.json" – Sicherungen überschreiben einander nie. */
export function backupFileName(date: Date): string {
  return `finance-data-backup-${localDatePart(date)}-${pad2(date.getHours())}${pad2(date.getMinutes())}.json`
}
