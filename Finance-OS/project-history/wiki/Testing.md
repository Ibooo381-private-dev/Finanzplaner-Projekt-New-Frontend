# Testing

[Home](Home.md) · Verwandt: [Reviews](Reviews.md), [Lessons-Learned](Lessons-Learned.md) · Verbindlich: `docs/testing-strategy.md`

## Zahlen

**815 Tests in 37 Dateien** (Vitest 3 + RTL + jsdom). Trajektorie je Phasenabschluss: 2 → 63 → 68 → 138 → 147 → 192 → 287 → 342 → 440 → 544 → 615 → 717 → 815. Kein Test wurde je gelöscht, um einen Fehler zu verdecken.

## Philosophie

1. **Sollwerte vor Code:** Der Formelkatalog (Phase 5) fixierte exakte Seed-Ergebnisse, bevor implementiert wurde – Pins wie 3.150,06 / 54,27775 % / 1.573,80 / 777,59.
2. **Pins gegen den plausibelsten Fehler:** Der 6-Monats-Projektions-Pin existiert, weil der 12-Monats-Pin allein einen Off-by-one maskiert hätte.
3. **Byte-Identität als Orakel:** K2-No-Op-Patches und das Auto-Backup (A2) werden über identische Serialisate bewiesen.
4. **Stop-/Negativtests:** Verbote (Import überschreibt nie, gesperrte Snapshots, NaN-Verbote, „lokale Profilauswahl ändert nie das aktive Profil“) werden aktiv zu verletzen versucht.
5. **Verhalten statt Implementation:** getByRole, sichtbare Texte, Bestätigungen, `document.activeElement` – keine internen Zustände.
6. **Determinismus:** Zeit injiziert (`FIXED_NOW`), Storage via `vi.mock` (fileAccess/featureDetection pro Test steuerbar).
7. **Flakes härten, nicht leugnen:** Der appLayout-„JEDER Seite“-Test rendert 9 Seiten in einem `it` und trägt dokumentierte `{ timeout: 30000 }` (zweimal unter Volllast über 5 s – Assertions unverändert, vom Reviewer als legitim bestätigt).

## Kataloge

| Katalog | Quelle | Inhalt |
|---|---|---|
| T1–T9 | calculation-rules §10 | Fachliche Pflichtfälle (T6 folgt mit dem Fixkosten-Modul – §5.1-Ausweis; T4-Teil hängt am Kennzahlen-Trio) |
| DM1–DM23 | data-model §7 | Laden/Speichern/Rundreise/Schutz |
| ST1–ST6 | storage-concept §9 | Speicherweg |

## Struktur

`tests/finance` (Formeln) · `tests/data` (Patches/K2) · `tests/storage` (Laden/Import/Backup/Handle) · `tests/pages` (Seiten/A11y) · `tests/layout` + `src/App.test.tsx` (Gerüst). Muster-Startpunkte: `settings.test.ts` (Datenfunktion), `autoBackup.test.tsx` (Provider+Mocks), `settingsPage.test.tsx` (Seite+A11y).
