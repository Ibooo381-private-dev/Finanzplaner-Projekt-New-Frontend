# Design-System – wiederverwendbare UI-Muster (Stand Phase 16 / M13, 2026-07-20)

Normative Quelle für Stil und Bedienbarkeit ist der Skill `frontend-design`
(`.claude/skills/frontend-design`). Dieses Dokument listet die in Finance OS
bereits umgesetzten, wiederverwendbaren Muster mit ihren CSS-Klassen
(`src/index.css`) als Referenz für kommende Module.

## Kennzahlen (KPI-Kacheln)

- `dl.kpi-grid` > `div.kpi-tile` (mit `dt` Label, `dd` Wert): responsives Raster
  (auto-fit/minmax), höchstens vier primäre Kennzahlen je Gruppe.
- Zusatztexte in Kacheln als sichtbarer Text über `span.kpi-note`
  (z. B. „⚠ enthält unbekannte Werte“, G11) – nie nur Farbe, keine title-only-Texte.
- Kompakte Sekundär-Kennzahlen als `dl.facts-list` (Zeilen `div` > `dt`/`dd`).

## Leerzustände und Starthinweis

- `div.start-hint`: verständlicher Leerzustand ohne geladene Datei mit direktem
  Button zu „Daten & Backups“ (Muster in jeder Seite identisch).
- Fachliche Leerzustände als `p.app-hint` mit konkretem nächsten Schritt.

## Erklärblöcke (Details-Muster)

- `details.model-hint` mit `summary`: aufklappbare Erklärung zentraler
  Berechnungen (tastaturzugänglich; Lehre aus M9: KEINE title-only-Infotexte).

## Warn- und Hinweis-Panels

- `p.warning-note` / `div.warning-note` (⚠ + Text), `p.app-hint` (ℹ + Text),
  `p.success-note` (✓ + Text, `role="status"`), `p.operation-error`
  (`role="alert"`), Sammel-Panel `div.issue-box` mit Liste.
- Status immer Text + Symbol; Farbe ist nie das einzige Signal.
- Endnutzertexte enthalten nie technische IDs/Codes/Pfade – IDs vor der
  Anzeige über Namens-Lookups auflösen.
- Bewusste Ausnahme (dokumentiert, A11y-Review M11 B7): kurze Quellenverweise
  in Klammern wie „(F19)“, „(G5)“ oder „(S2)“ sind in ERKLÄRTEXTEN zulässig –
  sie verweisen auf den dokumentierten Regelkatalog und sind keine technischen
  Identifikatoren von Datenobjekten. In Werten, Labels und Fehlermeldungen zu
  konkreten Einträgen bleiben sie tabu.

## Fortschrittsanzeige

- Natives `<progress max value>` mit `aria-label` PLUS sichtbarem Textwert
  daneben (`p.goal-progress`); bei Überschreitung: Balken auf `max` gedeckelt,
  der Text zeigt den echten Prozentwert.
- Der sichtbare Prozent-Text trägt eine `id` und ist über `aria-describedby`
  am `<progress>` verknüpft – Screenreader hören so den ECHTEN Wert, nicht nur
  den gedeckelten Balkenwert.

## Formulare und Feldfehler

- `form.account-form` mit `div.form-field` (Label immer vorhanden).
- Fehler feldnah: `p.field-error` mit `role="alert"`, Feld mit
  `aria-invalid` + `aria-describedby`; Warnungen (nicht blockierend) als
  `p.field-warning` mit `role="status"`.
- Kritische Aktionen mit Bestätigung (`window.confirm`) inkl. Betragsnennung.
- Pflichtfelder sind mit `*` markiert; das Formular beginnt mit der sichtbaren
  Legende „* = Pflichtfeld“ (`p.app-hint`, seit M13). Die Nachrüstung der
  älteren Formulare (Konten/Depot/Sparpläne/Ziele) ist ein dokumentierter
  Restpunkt.
- Formular-Aktionen, die Felder programmatisch befüllen oder Zeilen entfernen
  (Vorbelegungs-Buttons, „aktuelle Werte übernehmen“, Zeile entfernen),
  bestätigen das sichtbar per `role="status"`-Meldung beim Auslöser; nach dem
  Entfernen einer Zeile wandert der Fokus auf einen bestehen bleibenden
  Button (z. B. „Beitrag hinzufügen“), nie auf document.body (seit M13).

## Tabellen

- `div.table-wrap` (horizontal scrollbar) > `table.accounts-table` mit
  `caption.visually-hidden`; Sortier-Buttons in `th` (`button.sort-button`)
  mit `aria-sort` am Header und sichtbarem Richtungssymbol.

## Filterleiste (seit M10)

- `div.filter-bar` > `div.filter-group` (mit `span.filter-label` als Gruppentitel)
  > `button.filter-button` mit `aria-pressed`; aktiver Zustand sichtbar über
  Häkchen-Symbol im Text PLUS Rahmen/Schriftstärke (`[aria-pressed='true']`) –
  Farbe ist nie das einzige Signal.
- Jede Filter-Dimension ist eine benannte Gruppe: `div.filter-group` trägt
  `role="group"` + `aria-labelledby` auf die `id` des `span.filter-label` –
  Screenreader hören so den Dimensionskontext („Status: aktiv“), nicht nur den
  Buttontext.
- Je Dimension gilt: kein aktiver Filter = alles anzeigen; ein Button
  „Filter zurücksetzen“ erscheint, sobald irgendein Filter aktiv ist.
- Leeres Filterergebnis: verständlicher Leerzustand (`p.app-hint`) mit eigenem
  „Filter zurücksetzen“-Button – nie eine leere Tabelle ohne Erklärung.

## Statusgruppen-Liste (seit M10)

- Tabellenzeilen werden IMMER zuerst nach Statusgruppen geordnet
  (aktiv/geplant → pausiert → beendet/abgeschlossen); Sortier-Buttons wirken
  nur innerhalb der Gruppen. Status als Text MIT Symbol (● ◷ ⏸ ■ ✓), nie nur
  Farbe.
- Standard-Sortierung innerhalb der Gruppen: nächster Termin aufsteigend
  (unbekannte Termine ans Ende), dann Betrag absteigend.
- Bewusste Entscheidung (A11y-Review M10, B5): Die Status-SPALTE (Text + Symbol
  je Zeile) ist das Gruppensignal – es gibt KEINE Gruppen-Zwischenzeilen im
  Tabellenkörper. Wer Gruppen-Kopfzeilen einführt, muss Sortierung und
  Screenreader-Semantik (mehrere `tbody`) mitziehen.
- Breite Tabellen: `div.table-wrap` ist eine fokussierbare benannte Region
  (`tabindex=0`, `role="region"`, `aria-labelledby`/`aria-label`) mit sichtbarem
  Fokus (`:focus-visible`) – Tastaturnutzer können horizontal scrollen, ohne
  interaktive Zellen zu brauchen.
- Formular-Fehlerfokus: Nach fehlgeschlagenem Absenden wird das ERSTE
  fehlerhafte Feld fokussiert (Reihenfolge = Feldreihenfolge); nicht zuordenbare
  Sammelmeldungen erhalten `tabindex="-1"` und den Fokus.

## Zielkarten (seit M12)

- Ziele erscheinen als Karten in `ul.goal-list` > `li` (Muster aus M7) statt
  einer breiten Tabelle – mobile-tauglich, keine horizontale Scrollpflicht.
- Kartenaufbau: `p.goal-heading` (Name + abgeleiteter Status als Text MIT
  Symbol: ⚠ ● ✓ ∅ ◷ ⏸ ✔ ■ – nie nur Farbe), Zielart-Zeile (deutsches Label,
  bei Referenz-Zielen mit Referenz-NAME), Ist/Ziel-Zeile (G11: „unbekannt“ /
  „offen / nutzerdefinierbar“ / „nicht berechenbar“ – nie eine erfundene 0),
  Fortschrittsanzeige (etabliertes `<progress>`-Muster mit aria-describedby),
  Rest + informativer Überschuss, Aktionszeile `div.row-actions`.
- Zieldetail als `details.model-hint` je Karte („Details und Prognose“):
  Berechnungsgrundlage in Worten, reale vs. geglättete Sparleistung (geglättet
  IMMER „geglättet (Analysewert)“), Prognose mit Pflichttext „Ohne
  Rendite-/Kursannahme – keine Prognosegarantie“, Statusbegründung, fehlende
  Daten.
- Kartensortierung: abgeleiteter Status-Rang (Handlungsbedarf zuerst), dann
  Zieldatum aufsteigend (ohne Datum ans Ende), dann Name (de-DE) – Rangordnung
  in `src/finance/goals.ts` (`DERIVED_GOAL_STATUS_RANK`).
- Summen-Kacheln mit sich überschneidenden Bezugswerten tragen die
  Kennzeichnung in der Kachel (`span.kpi-note`); bewusst weggelassene Summen
  (z. B. Ist-Summe der Ziele) werden als Text erklärt statt still entfernt.

## Simulations-/Hypothese-Kennzeichnung (seit M11)

- Hypothetische Ansichten (z. B. das Voll-Rebalancing) tragen eine
  unübersehbare Pflicht-Kennzeichnung als `p.simulation-banner` mit
  `role="note"`: fett beginnend mit „Simulation – wird nie automatisch
  übernommen.“ plus Klartext, was die Ansicht NICHT tut (keine Ausführung,
  kein gespeicherter Eintrag).
- In solchen Abschnitten gibt es KEINEN Übernahme-/Aktions-Button – reine
  Anzeige (G1/G2).
- Empfehlungssätze stehen IMMER im Konjunktiv („Wenn du deine Zielallokation
  annähern möchtest, könntest du …“) – nie „solltest“, nie Imperative; die
  Verkaufsoption wird nur ab ≥ +10 Prozentpunkten erwähnt und steht im Satz an
  letzter Stelle.
- Geglättete/ungefähre Werte sind immer gekennzeichnet („ungefähr, ohne
  Kursentwicklung“); abgeleitete Größen (z. B. das flexible Budget) zeigen ihre
  Herleitung als sichtbaren Text.

## SVG-Chart-Zusatz-Muster (seit M13)

- Diagramme sind handgerollte inline-SVGs (`div.sim-chart` > `svg` mit
  `viewBox`) – KEINE Chart-Bibliothek. Ein Diagramm ist immer nur ZUSATZ:
  Die zugehörige Tabelle ist die Primärquelle, direkt daneben steht der
  sichtbare Hinweis „… alle Werte stehen in der Tabelle“.
- Der Chart-Container trägt `aria-hidden="true"` (Screenreader erhalten die
  vollständigen Werte über die Tabelle); das `svg` zusätzlich
  `role="presentation"` und `focusable="false"`.
- Serien tragen Farbe UND Strichmuster (durchgezogen/gestrichelt/gepunktet) –
  Farbe ist nie das einzige Signal; die sichtbare Legende
  (`ul.sim-chart-legend`) zeigt je Serie ein Linienmuster-Beispiel plus
  Klartext („Gesamtvermögen (durchgezogen)“).
- Serienfarben sind CVD-validiert für hellen UND dunklen Hintergrund
  (M13: #059669 Gesamtvermögen, #2563eb Depot, #b45309 Tagesgeld); Gitter und
  Achsentexte nutzen `currentColor` mit reduzierter Deckkraft (recessiv).
- Die y-Skala beginnt bei 0 (keine optische Übertreibung); bei komplett
  leerer Reihe wird nie durch 0 geteilt (F20 – Maximum-Guard statt NaN).
- Genau EINE Werteachse; verschiedene Größenordnungen bekommen eigene
  Diagramme, nie eine Zweitachse.

## Deutsche Formate

- Beträge: `formatEuro` (`src/format/money.ts`); Eingaben: `parseGermanAmount`
  (strenges de-DE-Muster, „1.234“ = 1234 €).
- Daten: `formatIsoDateGerman` (`src/format/date.ts`, TT.MM.JJJJ).
- Zeitstempel (z. B. Speicherzeitpunkt): `formatIsoTimestampGerman`
  (`src/format/date.ts`, „19.07.2026, 12:30 Uhr“ in lokaler Zeitzone) –
  ISO-Rohtexte erscheinen nie im Endnutzertext.
- Prozent: Dezimalanteil × 100 mit `settings.display.percentDecimals`
  (Standard 2), Anzeige „80,08 %“.
- Fehlende Werte: Summen ganz ohne bewertete Einträge zeigen „unbekannt“
  (nie eine leere 0); Teilsummen tragen den Hinweis „enthält unbekannte Werte“.
