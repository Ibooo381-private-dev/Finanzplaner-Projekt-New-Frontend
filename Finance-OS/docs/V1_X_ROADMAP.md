# Finance OS – V1.x-Roadmap (unverbindliche Priorisierung)

Stand: 2026-07-21 (nach der lokalen Finalabnahme v1.0.0). Diese Roadmap **priorisiert ausschließlich bereits dokumentierte Restpunkte** aus `progress.md` (Abschnitt „V1.x – Offene Punkte“, Nr. 1–24) und den requirements-Nachträgen. Nichts ist zugesagt oder terminiert; das Projekt bleibt privat.

## V1.1 – Bedienung und Darstellung

Kleine, risikoarme Verbesserungen der bestehenden Module:

- **Strg+S** als Tastenkürzel für „Speichern“ (V1.x-Punkt 6)
- **Kennzahlen-Trio** Finanzvermögen / Anlagevermögen / frei verfügbare Liquidität als berechnete Anzeigen – Datenbasis und Definitionen existieren bereits (Punkt 23; schließt den T4-Erwartungsteil auf)
- **Snapshot-Verlaufsansicht** und Vergleich zweier Snapshots (Punkt 7)
- **Format-Helfer-Dedup**: `formatShare`/`amountToInputText` nach `src/format` extrahieren (Punkt 12); zusammen mit den weiteren Refactoring-Kandidaten 13–16 (Zielvergleich-Konsolidierung, Summen-Aggregationen, Telekom-Konstante, Namens-Trim)
- **A11y-Nachrüstungen** in den Altseiten: B3-Fehlerfeld-Fokus, fokussierbare Tabellen-Regionen, Pflichtfeld-Legende, `disabled`-Fokusverlust-Muster, M9-Kleinpunkte (Punkte 20–21)
- **Profilbearbeitung** inkl. „Eigene Aufteilung“/Ebene B befüllen (Punkt 2 – abnahme-relevanter requirements-M14-Ausweis)
- Kleinere Punkte nach Gelegenheit: Retention-/Merker-Feinheiten, M8-Altpunkte, Fehlertext-Kosmetik, i18n-Vorbereitung aktivieren (Punkte 3, 5, 8–11, 17–19, 22, 24)

## Spätere Versionen (jenseits V1.1)

Größere Vorhaben, die neue Datenflüsse oder Module erfordern (teils in `CLAUDE.md` als Langfrist-Module genannt):

- **Transaktionshistorie**: Ist-Erfassung variabler Zuflüsse über das vorbereitete `transactions`-Modell (Punkt 4); erst danach die „ca. 260–265 €“-Schätzsumme und die T3-/DM8-Arithmetik
- **Performanceanalyse** (Rendite, Kostenbasis) – in V1 bewusst ausgeschlossen
- **Dividenden**-Verwaltung
- **Steuern** (Freistellungsauftrag, Vorabpauschale) – in V1 bewusst ausgeschlossen
- **Brokerimporte** (Monatsimport aus Markdown/CSV gemäß Skill S4; keine Live-APIs)
- **Erweiterte Projektionen** (z. B. variable Renditepfade) – ohne Prognose-Anspruch
- Weitere CLAUDE.md-Langfrist-Module: Monatsfinanzen, Fixkosten (inkl. T6), Investment-Journal, Monatsabschluss, Wissensbereich

## Nicht geplant

Cloud/Synchronisation, Benutzerkonten, Bank-/Broker-Live-APIs, automatische Orderausführung, Veröffentlichung.
