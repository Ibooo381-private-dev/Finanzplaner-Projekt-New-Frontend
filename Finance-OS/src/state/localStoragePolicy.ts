/**
 * localStorage-Politik von Finance OS (Blueprint §5 – dokumentierte Sperre).
 *
 * Die Allowlist ist die EINZIGE Stelle, an der Phasen localStorage-Schlüssel
 * ergänzen dürfen:
 *
 * - Zulässig sind ausschließlich unkritische UI-/Geräte-Einstellungen
 *   (z. B. Theme, Spaltenbreiten, Gerätemarken).
 * - NIEMALS Finanzdaten: Die JSON-Datei ist die einzige dauerhafte
 *   Datenquelle (C1); Browser-Speicher darf nie die einzige Datenquelle sein.
 * - KEIN Autosave in den Browser-Speicher: Der Verlust ungespeicherter
 *   Änderungen ist gewolltes Verhalten – der sichtbare
 *   Ungespeichert-Indikator ist die Gegenmaßnahme (M6, Blueprint §7.10).
 * - Nach Löschen des Browser-Caches muss der vollständige Zustand allein
 *   durch erneutes Öffnen der JSON-Datei wiederherstellbar sein (DM16).
 *
 * Eingetragene Schlüssel:
 *
 * - `financeos.lastAutoBackupDay` (M14/M5, Auflage A5): Tagesmerker
 *   (JJJJ-MM-TT) des letzten ERFOLGTEN automatischen Sicherungs-Downloads
 *   DIESES Geräts. Reine unkritische Gerätemarke: sie steuert nur den Modus
 *   „dailyFirstSave“ (einmal pro Kalendertag) und speist die Statuszeile der
 *   Einstellungen. Geht sie verloren (Cache-Löschung, Privatmodus), entsteht
 *   höchstens EIN zusätzliches Backup – nie ein Datenverlust. Alle Zugriffe
 *   laufen über try/catch (src/storage/autoBackup.ts) und degradieren sicher
 *   zum everySave-Verhalten. Der Merker gated NIE die manuelle Sicherung.
 */
export const LAST_AUTO_BACKUP_DAY_KEY = 'financeos.lastAutoBackupDay'

export const LOCALSTORAGE_ALLOWED_KEYS: readonly string[] = [LAST_AUTO_BACKUP_DAY_KEY]
