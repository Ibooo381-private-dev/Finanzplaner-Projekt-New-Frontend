# Data-Model

[Home](Home.md) · Verwandt: [Validation](Validation.md), [Storage](Storage.md) · Verbindlich: `docs/data-model.md`

## Kern

- `schemaVersion: 1` – nie erhöht; alle M8–M14-Erweiterungen additiv mit §6-Protokolleintrag.
- Top-Level: metadata, settings, accounts, portfolioPositions, snapshots, savingsPlans, targetProfiles, goals, plannedChanges, simulations, transactions (V1: nur Struktur), importHistory (+ reservierte Arrays fixedCosts u. a.).
- Beträge = Zahlen (EUR), Daten = ISO `YYYY-MM-DD`, Prozente = Dezimalzahlen (0,15 = 15 %), IDs kebab-case, dateiweit eindeutig, nach Export/Import stabil.
- **Keine berechneten Werte gespeichert** – Status/Fortschritt/Summen immer abgeleitet.
- Unbekannte Zusatzfelder überleben jede Rundreise (`WithUnknownFields`).

## Historien statt Überschreiben

Salden/Werte = datierte Einträge; Snapshots nach Speicherung `locked` (unveränderlich, [Validation/DM21](Validation.md)); Korrektur nur als neuer Snapshot.

## K2-Byte-Identität

Teil-Patches (`src/data/*.ts`): `undefined` = nicht ändern; optionale Schlüssel nie als Default materialisieren; No-Op ⇒ Byte-identisches Serialisat (Testorakel; Grundlage des ehrlichen Dirty-Status). Altlast: M8/M9-Formular-Edits (V1.x-18).

## Zuflussarten (flowType)

`own_fixed` · `own_variable` · `employer` · `provider` · `reserve_transfer` · `liquidity_transfer` – strukturelle Antwort auf Doppelzählung ([Savings-Plans](Savings-Plans.md), G7/G8).

## Fehler-/Warnungskatalog

21 `E_*` + 5 `W_*`-Codes, verbindlich in data-model §5 (dorthin konsolidiert in der V1-Abschlussprüfung, [Decision D25](../Finance_OS_Decision_Log.md)). `E_LOCKED_DATE` ist bewusst eine Schreib-, keine Ladeprüfung.

## Migrationsstrategie

Definiert, aber nie gebraucht: Kette reiner `migrateVtoV+1`, Sicherung vorher, Validierung, atomare Übernahme; `schemaVersion < 1` wird hart abgelehnt (keine echte Altversion existiert).
