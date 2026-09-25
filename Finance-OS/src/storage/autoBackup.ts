/**
 * Auto-Backup-Regel (M14/M5, data-architect-ratifiziert):
 *
 * - `shouldAutoBackup` ist eine REINE Entscheidungsfunktion (kein React, kein
 *   Systemdatum, kein localStorage) – unabhängig testbar.
 * - KORREKTUR Nr. 3 (verbindlich): Der Backup-Default ist 'everySave'.
 *   Ein FEHLENDER backup.mode WIRKT als 'everySave' (nur berechnet, nie
 *   materialisiert – K2): `shouldAutoBackup(undefined, …)` → true.
 *   Es gibt bewusst KEINEN „aus“-Zustand (das Enum kennt keinen – V1-Grenze).
 * - Der Tagesmerker für 'dailyFirstSave' ist eine unkritische GERÄTEMARKE in
 *   localStorage (Auflage A5, Schlüssel in src/state/localStoragePolicy.ts).
 *   Alle Zugriffe laufen über try/catch: Im Privatmodus oder nach
 *   Cache-Löschung degradiert 'dailyFirstSave' sicher zum
 *   everySave-Verhalten (höchstens ein zusätzliches Backup, nie Datenverlust).
 * - Der Merker gated NIE die manuelle Sicherung („Sicherung jetzt erstellen“).
 */

import type { BackupMode } from '../types/finance'
import { LAST_AUTO_BACKUP_DAY_KEY } from '../state/localStoragePolicy'

/**
 * Entscheidet, ob nach einem ERFOLGREICHEN Speichern ein automatisches
 * Backup ausgelöst wird:
 * - 'everySave' und fehlender Modus (Default, KORREKTUR Nr. 3) → immer true;
 * - 'dailyFirstSave' → nur beim ersten Speichern des Kalendertags
 *   (lastAutoBackupDayIso ≠ todayIso; unbekannter Merker → true).
 */
export function shouldAutoBackup(
  mode: BackupMode | undefined,
  lastAutoBackupDayIso: string | null,
  todayIso: string,
): boolean {
  if (mode === 'dailyFirstSave') return lastAutoBackupDayIso !== todayIso
  return true
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Liest den Tagesmerker (JJJJ-MM-TT) dieses Geräts; unlesbar/ungültig → null (A5). */
export function readLastAutoBackupDay(): string | null {
  try {
    if (typeof window === 'undefined') return null
    const value = window.localStorage.getItem(LAST_AUTO_BACKUP_DAY_KEY)
    return value !== null && DAY_RE.test(value) ? value : null
  } catch {
    // Privatmodus/gesperrter Speicher: degradiert sicher zu everySave-Verhalten.
    return null
  }
}

/** Setzt den Tagesmerker nach jedem ERFOLGTEN Auto-Backup; Fehler werden geschluckt (A5). */
export function writeLastAutoBackupDay(dayIso: string): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LAST_AUTO_BACKUP_DAY_KEY, dayIso)
  } catch {
    // Bewusst geschluckt: ein fehlender Merker kostet höchstens ein Extra-Backup.
  }
}
