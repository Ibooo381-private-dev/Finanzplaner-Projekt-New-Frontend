# Finance OS – Teststrategie (V1, Ist-Stand)

Stand: 2026-07-20 (V1-Abschlussprüfung). Dieses Dokument beschreibt die tatsächlich umgesetzte Teststrategie; der Speicher-Prüfkatalog ST1–ST6 steht in `storage-concept.md` §9, die fachlichen Pflichttestfälle T1–T9 in `calculation-rules.md` §10, die Lade-/Speichertestfälle DM1–DM16 in `data-model.md` §7.

## Werkzeuge und Aufbau

- **Vitest + React Testing Library + jsdom**; Ausführung über `npm test` (einmalig) bzw. `npm run test:watch`.
- Struktur spiegelt die Architekturschichten: `tests/finance/` (reine Formeln F1–F22 + Modul-Bausteine), `tests/data/` (reine Datenfunktionen, K2-Byte-Identität), Lade-/Import-/Backup-/Schutzregeln in `tests/storage/`, `tests/pages/` (Seiten-/Bedientests), `tests/layout/` (Navigation), `src/App.test.tsx` (Grundlayout/Leerzustand).
- Endstand V1: **815 Tests in 37 Dateien**, Build (`tsc` + Vite) und ESLint verpflichtend grün (C1: nichts gilt als fertig ohne bestehende Tests).

## Prinzipien

1. **Reine Schicht zuerst:** Jede Finanzformel ist React-frei und wird mit gepinnten Seed-Werten der Beispieldatei nachgerechnet (z. B. Depot 2.522,47; Telekom-Anteil 54,27775 %; Notgroschen 4.680). Mutationsfreiheit wird per Deep-Freeze-/Snapshot-Vergleich erzwungen.
2. **Datenfunktionen mit K2-Pins:** No-Op-Patches müssen Byte-identisch serialisieren; optionale Schlüssel werden nie als Default materialisiert; unbekannte Zusatzfelder überleben jede Rundreise (DM3).
3. **Zeit ist injiziert:** Seitentests laufen mit festem Stichtag (`FIXED_NOW`), nie mit der Systemuhr.
4. **Storage über Modul-Mocks:** Dateizugriffe (`fileAccess`, `featureDetection`) werden per `vi.mock` kontrolliert; Auto-Backup-Tests pinnen die Byte-Identität von gespeicherter Datei und Sicherungskopie.
5. **Verhalten statt Implementation:** Seitentests prüfen sichtbare Texte, Rollen (getByRole), Bestätigungsdialoge, Fokusführung und role=status-Feedback – keine internen Zustände.
6. **Schutzregeln als Stop-Tests:** G10 (Import/Laden überschreibt nie Daten), G3/G4 (gesperrte Snapshots), G12 (Bestätigungen) und die NaN-/Infinity-Verbote haben eigene Negativtests.

## Grenzen (V1)

Keine E2E-/Browser-Automatisierung (jsdom statt echter File System Access API – der echte Dateidialog ist manuell zu prüfen), keine visuelle Regression, keine Performance-Tests. T6 folgt mit dem Fixkosten-Modul (kein V1-Modul, requirements §5.1-Ausweis).
