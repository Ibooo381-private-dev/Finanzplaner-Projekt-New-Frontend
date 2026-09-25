# Import (M4)

[Home](Home.md) · Verwandt: [Storage](Storage.md), [Validation](Validation.md), [Export](Export.md), [Backup](Backup.md)

**Zweck:** Der einzige Weg, Fremd-/Backup-Daten zu übernehmen – maximal abgesichert.

**Ablauf:** Datei wählen → vollständige [Validierung](Validation.md) → **Vorschau** (schemaVersion, Anzahlen, jüngstes Datum, Vergleich mit dem geladenen Bestand, Warnung „geladener Bestand ist neuer“) → angebotene Sicherungskopie des bisherigen Bestands → ausdrückliche Bestätigung → Übernahme (löst den Datei-Handle bewusst).

**Garantien (G10/G12, DM5-getestet):** Ungültige Dateien und Abbrüche verändern **nichts** am fachlichen Bestand – referenzidentisch; einzige Spur ist ein `importHistory`-Protokolleintrag (`rejected`/`cancelled`), der bewusst keinen Dirty-Status auslöst (Regel 17).

**Wiederherstellung = Import:** Es gibt absichtlich keinen zweiten „Restore“-Kanal – Backups werden über denselben geprüften Weg eingespielt ([Backup](Backup.md)).

**Nicht in V1:** Merge zweier Bestände; andere Formate (der Markdown/CSV-Monatsimport ist ein dokumentiertes Später-Modul, Skill S4).

**Dateien:** `src/storage/importFlow.ts`, `src/pages/DataBackupsPage.tsx`; Tests: `tests/storage/importProtectsData.test.tsx`, `importInvalid`, DM5-Suiten.
