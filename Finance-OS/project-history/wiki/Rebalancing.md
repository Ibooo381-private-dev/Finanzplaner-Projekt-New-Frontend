# Rebalancing (M11)

[Home](Home.md) · Verwandt: [Depot](Depot.md), [Savings-Plans](Savings-Plans.md), [Simulator](Simulator.md)

**Zweck:** Abweichung Ist-Depot vs. Zielprofil zeigen und regelkonforme **Empfehlungen** berechnen – nie ausführen (G1/G2).

**Prägende Entscheidungen:**
- **Nur drei Stufen** (`actionLevel`): < 5 Pp Anzeige, ≥ 5 Empfehlung, ≥ 10 zusätzlich Verkaufsoption als letzte Möglichkeit – Verkaufsoption **nur bei Übergewichtung** (der in Phase 8 gefundene und behobene Fehler). Eine vierte „Beobachten“-Stufe wurde als quellenlos abgelehnt.
- **Konjunktiv-Pflicht:** „Wenn du deine Zielallokation annähern möchtest, könntest du …“ – getestete Sprachregel.
- Maßnahmen-Reihenfolge fest: Sparraten umlenken → zusätzliches Geld → flexible reduzieren → pausieren → Verkäufe zuletzt; keine Rate < 0; F17-Budget = aktive flexible eigene Monats-Positionspläne (Seed 60,00 €).
- **plannedChanges:** Nach G5-Bestätigung als „geplant, nicht ausgeführt“ speicherbar; „verworfen“ ist final (kein Zurücksetzen in V1); createdAt = injiziertes Datum.
- Voll-Simulation („wird nie automatisch übernommen“) erzeugt **nie** einen [Simulator](Simulator.md)-Eintrag (Auflage A7 – klare Modulgrenze).
- Lokale Profilauswahl der Seite ändert nie das aktive Profil ([Settings](Settings.md) besitzt die globale Auswahl).

**Seed-Pins:** Telekom 54,28 % vs. 10 % (größte Abweichung); Vorschlag 23,84/22,00/10,65/3,52 → F19-Ausgleich −0,01 → Summe exakt 60,00; T9 (3/6/12 Pp).

**Dateien:** `src/finance/targets.ts`/`rebalancing.ts`, `src/data/plannedChanges.ts`, `src/pages/RebalancingPage.tsx`; Tests: `tests/finance/rebalancingAnalysis.test.ts`, `tests/pages/rebalancingPage.test.tsx`.
