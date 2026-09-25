# Depot (M9 – Depot und Tagesgeld)

[Home](Home.md) · Verwandt: [Accounts](Accounts.md), [Rebalancing](Rebalancing.md), [Validation](Validation.md)

**Zweck:** Depotpositionen mit datierten Werten, Depot-Gewichtung, unveränderliche Snapshot-Historie.

**Prägende Entscheidungen:**
- **Snapshot-Vollerfassung** als Ganz-oder-gar-nichts (`captureSnapshot`, 9 Fehlerstufen): alle aktiven Positionen + Tagesgeldkonten zu einem Datum; ab Speicherung `locked`; Rückdatierung nur mit Bestätigung; fehlende Werte werden **nie** als 0 gespeichert.
- Depotgewichtung: Nenner ausschließlich Depotwert (Tagesgeld nie); „MSCI World gesamt“ als Aggregat der drei World-Positionen.
- Keine Stückzahlen/WKN/Kurse – nur bestätigte Werte („nichts erfinden“); Positionen deaktivierbar statt löschbar.
- Zielvergleich (nur Anzeige) mit lokaler Profilauswahl – ändert nie das aktive Profil (G5); Konsolidierung auf `calculateRebalancingAnalysis` ist V1.x-13.

**Bekannte Grenzen:** W4-Warn-Semantik (neue Positionen lassen ältere Snapshots „unvollständig“ erscheinen, V1.x-10); Snapshot-**Verlaufsansicht** und Zwei-Snapshot-Vergleich wurden nie gebaut (requirements-Nachtrag, V1.x-7).

**Seed-Pins:** Depot 2.522,47; Telekom +44,28 Pp vs. Job-Profil; Σ Kauf = Σ Verkauf = 1.573,80.

**Dateien:** `src/pages/DepotPage.tsx`, `src/data/positions.ts`, `src/data/snapshot.ts`; Tests: `tests/pages/depotPage.test.tsx`, `tests/data/snapshot.test.ts`.
