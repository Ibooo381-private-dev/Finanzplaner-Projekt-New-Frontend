# Savings-Plans (M10 – Sparpläne und Zuflüsse)

[Home](Home.md) · Verwandt: [Goals](Goals.md), [Rebalancing](Rebalancing.md), [Data-Model](Data-Model.md)

**Zweck:** Feste und variable Zuflüsse korrekt klassifizieren – die Datenbasis aller Sparleistungs-Kennzahlen.

**Prägende Entscheidungen:**
- **flowType-Taxonomie** trennt eigenes Geld, Arbeitgeber, Anbieter (Saveback!) und Umbuchungen (zählen nie, G7).
- **U3:** Primärer 1.000-€-Fortschritt = eigene **reale** Monatsrate (118,50 → 11,85 %); geglättet (201,83) nur Analysewert; Gesamtzufluss getrennte Info.
- **U4** (in M12 entschieden, wirkt hier): own_variable zählt nur mit gültigem positivem Festbetrag; sonst defensiv 0.
- Intervalle inkl. quarterly/halfyearly/once mit atomar gekoppelten Glättungsfaktoren; `isPaused` als Momentzustand (bewusst keine Pausen-Historie); In-place-Bearbeitung ohne Planversionierung (Vergangenheit kommt nur aus `transactions`).
- **„ca. 260–265 €“ bewusst nicht angezeigt** – ohne Ist-Buchungen wäre die Summe erfunden (G11, [Decision D13](../Finance_OS_Decision_Log.md)).
- Budget-Warnung gegen das M14-Sparbudget (strikt >, nie blockierend – M14 löste den Restpunkt ein).

**Berühmter Fehler:** Doppelte Accessibility-Namen (Tabelle = Sektion) brachen 8 Tests → „eigene Namen für Scroll-Regionen“ wurde Projektmuster.

**Dateien:** `src/pages/SavingsPlansPage.tsx`, `src/data/savingsPlans.ts`, `src/finance/savings.ts`/`schedule.ts`; Tests: `tests/pages/savingsPlansPage.test.tsx` (39), `tests/finance/wealthAndSavings.test.ts` (T1/T2/U4-Pins).
