# Backup (M5 + M14-Auto-Backup + M16-Projektbackup)

[Home](Home.md) · Verwandt: [Export](Export.md), [Import](Import.md), [Settings](Settings.md)

## App-Datensicherung (Finanzdatei)

- **Automatisch:** Nach jedem erfolgreichen direkten Speichern lädt die App eine datierte Sicherungskopie herunter. Auflagen (M14, data-architect): **A2** Backup-Bytes = exakt der geschriebene JSON-String (nie neu serialisiert); **A3** Backup-Fehler erzeugt nur einen Hinweis, das Speichern bleibt erfolgreich; **A4** kein Auto-Backup im Download-Fallback/bei Abbruch/Fehler; **A5** manuelle Sicherung wird nie vom Tagesmerker blockiert.
- **Modi:** `everySave` (Default – wirkt auch bei fehlendem Modus, ohne materialisiert zu werden) oder `dailyFirstSave` (Tagesmerker `financeos.lastAutoBackupDay` – der einzige localStorage-Schlüssel).
- **Manuell:** „Sicherung jetzt erstellen“ ([Settings](Settings.md)) bzw. „Sicherungskopie herunterladen“ (Daten & Backups).
- **Wiederherstellung = [Import](Import.md)** mit Vorschau und Bestätigung – kein zweiter Kanal.
- **Grenze (ehrlich dokumentiert):** Browser-Downloads erlauben kein automatisches Löschen – die Aufbewahrungsanzahl ist reine Empfehlung; ein Sicherungsordner (`showDirectoryPicker`) ist V1.x-3.
- Stop-Test: Jede Sicherung ist eine vollständige, wieder ladbare Finanzdatei (Rundreise über den Parser, deep-equal).

## Projekt-Quellcode-Backup (M16)

`scripts\backup-project.bat` → datiertes ZIP in `project-backups\` per Positivliste + ZIP-Nachvalidierung mit Verbotsliste (löscht das ZIP bei Befund). Ausgeschlossen: node_modules, dist, `.git`, `.claude`, `reference\` (private Notizen), `backups\`, echte JSON-Finanzdateien, private TXT, alte Backups/Releases. **Vertraulichkeit:** docs/tests/progress.md/Beispieldatei basieren auf den realen Finanzwerten – das Backup selbst ist vertraulich ([Decision D27](../Finance_OS_Decision_Log.md)).
