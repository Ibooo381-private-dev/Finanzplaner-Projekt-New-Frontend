# Export (M3)

[Home](Home.md) · Verwandt: [Storage](Storage.md), [Import](Import.md), [Backup](Backup.md)

**Zweck:** Den kompletten Bestand jederzeit als JSON-Datei herunterladen – Fallback-Speichern und manuelle Sicherung zugleich.

**Eigenschaften:**
- Sprechender Dateiname mit ISO-Datum (`finance-data-…`); Sicherungskopien mit Zeitstempel (`finance-data-backup-JJJJ-MM-TT-HHmm.json`).
- Export enthält immer den **vollständigen** Bestand inkl. schemaVersion, aller Snapshots und unbekannter Zusatzfelder; die Rundreise Export → [Import](Import.md) ist deep-equal (DM2/DM3-getestet).
- Export verändert den Bestand nie; er ist auch mit ungespeicherten Änderungen möglich (und kann per Bestätigung „als gespeichert markieren“).
- Im Download-Fallback (Firefox/Safari) ist der Export **der** Speicherweg – die UI sagt ehrlich, dass die Originaldatei nicht überschrieben wurde.

**Bewusst nicht in V1:** Teil-Exporte, CSV (optionaler Punkt, in M14 zurückgestellt – V1.x-5), PDF; ein separater Simulations-Export (Simulationen sind Teil der Datei – M13-Minimal-Auslegung).

**Dateien:** `src/storage/` (serializer, backupDownload, fileNames), `src/pages/DataBackupsPage.tsx`; Tests: `tests/storage/fileNames.test.ts`, Rundreise-Suiten.
