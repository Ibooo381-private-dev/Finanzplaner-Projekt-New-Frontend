# Goals (M12 – Finanzielle Ziele)

[Home](Home.md) · Verwandt: [Savings-Plans](Savings-Plans.md), [Settings](Settings.md), [Simulator](Simulator.md)

**Zweck:** Ziele (Notgroschen, 10.000-€-Depot, 50.000-€-GV, Sparrate, …) mit ehrlichem Fortschritt und Prognose ohne Renditeannahme.

**Prägende Entscheidungen:**
- **„Gespeichert wird Nutzerwille, abgeleitet wird Wahrheit“:** `reached` nur als manueller Abschluss; rechnerisch erreicht wird abgeleitet und fällt bei sinkendem Ist zurück ([Decision D15](../Finance_OS_Decision_Log.md)).
- Zielarten additiv erweitert (Kontostand/Positionswert/manuell + refId/startDate); Ziele werden **nie** gelöscht (archived).
- Notgroschen: Faktor × Netto mit manueller Übersteuerung, die nie ungefragt ersetzt wird (T7: Override überlebt Netto-Änderung); wirksamer Wert ausschließlich über `effectiveGoalTarget`/`effectiveEmergencyFundTarget`.
- Bewusst keine Ist-Summen-Kachel (Bezugswerte überlappen: Depot ⊂ GV – Addition wäre irreführend); für Sparraten-Ziele keine Monatsrate/Prognose (dimensional sinnlos).
- U4 wurde in dieser Phase als Nutzerentscheidung fixiert (12 Pflichttests).

**Dateien:** `src/finance/goals.ts` (deriveGoalStatus-Kaskade, requiredMonthlyRate, forecast, assignedOwnSavings), `src/data/goals.ts`, `src/pages/GoalsPage.tsx`; Tests: `tests/finance/goals.test.ts`, `tests/data/goals.test.ts` (21), `tests/pages/goalsPage.test.tsx`.
