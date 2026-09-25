# Storage

[Home](Home.md) · Verwandt: [Import](Import.md), [Export](Export.md), [Backup](Backup.md), [Validation](Validation.md) · Verbindlich: `docs/storage-concept.md`

## Prinzip

Die JSON-Datei des Nutzers ist die **einzige** dauerhafte Datenquelle ([Decision D2](../Finance_OS_Decision_Log.md)). localStorage enthält genau einen unkritischen Merker (`financeos.lastAutoBackupDay`, Allowlist in `localStoragePolicy.ts`). Nach Cache-Löschung stellt das erneute Öffnen der Datei alles wieder her (DM16-getestet).

## Speichern

- **Chrome/Edge:** File System Access API – direktes Zurückschreiben in dieselbe Datei nach Benutzerfreigabe; Handle bleibt im State (5 gepinnte Verhaltensregeln aus Phase 7a in `tests/storage/saveHandle.test.tsx`).
- **Firefox/Safari:** Download-Fallback mit ehrlichem Hinweis, dass die Originaldatei nicht überschrieben wurde.
- Vor jedem Schreiben: Selbstprüfung des Serialisats; `isSaving`-Sperre gegen Wettläufe; danach [Auto-Backup](Backup.md) mit exakt den geschriebenen Bytes (A2).

## Phase-7a-Lektion

Eine gezielte Nachprüfung gegen fünf formulierte Verhaltenserwartungen fand drei echte Fehler (falscher Feature-Check, fehlendes „Speichern unter“, missverständliche Fallback-UI) – jsdom-Tests allein hätten sie nie gesehen. Seither gilt: Browser-Dialog-Verhalten braucht explizite Verhaltens-Pins + manuelle Verifikation.

## Ungespeicherte Änderungen

Dirty entsteht nur bei echtem Serialisat-Unterschied ([K2](Data-Model.md)); Anzeige als Text + Symbol; beforeunload-Warnung; Import-Protokolleinträge sind bewusst dirty-frei (Regel 17).
