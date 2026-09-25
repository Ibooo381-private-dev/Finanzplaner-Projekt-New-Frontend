# Dashboard (M7 – Übersicht)

[Home](Home.md) · Verwandt: [Accounts](Accounts.md), [Depot](Depot.md), [Goals](Goals.md)

**Zweck:** Zentrale Kennzahlen auf einen Blick – rein lesend.

**Inhalt:** Vermögens-Kacheln (Gesamtvermögen, Depotwert, Tagesgeld, sonstiges Kontovermögen), die **getrennten** Sparleistungs-Kennzahlen (eigene Sparleistung real/geglättet, Gesamtzufluss – vier Kacheln, G8/G9), Zielübersicht (archivierte Ziele ausgeblendet), Datenqualitäts-/Warnhinweise, Direktlinks in die Module.

**Prägende Entscheidungen:**
- **G11-Präzisierung (Phase 12):** Ohne erfasste Werte zeigt eine Kachel „unbekannt“, nie 0; Teilsummen tragen „enthält unbekannte Werte“. Reviewer-Auflage M1 dehnte das auf die „World gesamt“-Zeile aus.
- **todayIso-Injektion** wurde hier eingeführt (finance-analyst-Befund) und Projektstandard.
- Das requirements-Kennzahlen-Trio (Finanzvermögen/Anlagevermögen/freie Liquidität) wurde **nicht** gebaut – erst die V1-Abschlussprüfung fand die fehlende Begründung → Nachtrag + V1.x-23 ([Lessons-Learned](Lessons-Learned.md) Nr. 7).

**Akzeptanz-Pins:** Depot 2.522,47 / Tagesgeld 627,59 / GV 3.150,06 / Telekom-Anteil 54,28 %; Notgroschen 627,59/4.680 ≈ 13,4 %.

**Dateien:** `src/pages/DashboardPage.tsx`, Kennzahlen aus `src/finance/wealth.ts`/`savings.ts`/`goals.ts`; Tests: `tests/pages/dashboardPage.test.tsx` (30).
