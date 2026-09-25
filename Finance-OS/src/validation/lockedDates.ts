/**
 * Regel-15-Datenregel (G3/G4, DM21) als reine Funktionen.
 *
 * Diese Funktionen sind KEIN Bestandteil der Datei-Ladevalidierung. Seit den
 * Fachmodulen M8 (Konten: setAccountBalance) und M9 (Depot: setPositionValue,
 * captureSnapshot) sind sie die zentrale Sperrprüfung für alle schreibenden
 * Historien-Operationen – genau eine Implementierung, keine Duplikate.
 */

import type { FinanceData } from '../types/finance'
import type { ValidationIssue } from './issues'

/** true, wenn das Datum zu einem gesperrten Snapshot gehört (G3). */
export function isDateLocked(data: FinanceData, isoDate: string): boolean {
  return data.snapshots.some((snapshot) => snapshot.locked === true && snapshot.date === isoDate)
}

/**
 * Prüft, ob an einem Datum ein neuer Historien-Eintrag angelegt (oder ein
 * bestehender geändert/gelöscht) werden darf. Liefert bei gesperrtem Datum
 * eine erklärende Meldung (G3/DM21), sonst null.
 */
export function checkHistoryEntryAllowed(
  data: FinanceData,
  isoDate: string,
): ValidationIssue | null {
  const index = data.snapshots.findIndex(
    (snapshot) => snapshot.locked === true && snapshot.date === isoDate,
  )
  if (index === -1) return null
  const snapshot = data.snapshots[index]
  const label =
    typeof snapshot.label === 'string' && snapshot.label !== '' ? snapshot.label : snapshot.id
  return {
    code: 'E_LOCKED_DATE',
    path: `snapshots[${index}]`,
    message:
      `Das Datum ${isoDate} gehört zum gesperrten Snapshot "${label}". ` +
      'Einträge an diesem Datum sind unveränderlich, und neue Historien-Einträge dürfen an diesem Datum nicht angelegt werden ' +
      '(sonst ließe sich der Inhalt des gesperrten Snapshots stillschweigend erweitern). ' +
      'Erfasse neue Werte mit einem neuen Datum – Korrekturen nur als neuer Snapshot (G3/G4, DM21).',
  }
}
