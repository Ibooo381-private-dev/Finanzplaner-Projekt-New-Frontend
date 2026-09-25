# Finance OS – Anforderungen Version 1 (requirements)

Stand: 2026-07-19.
Grundlagen: `CLAUDE.md` (C1), `docs/investment-source-map.md` Version 3 (inkl. Nutzerbestätigungen U1/U2), `docs/calculation-rules.md`, Skills `finance-rules` (S1), `rebalancing` (S2), `monthly-import` (S4), `frontend-design` (S5), `quality-check` (S3), Referenzdateien unter `reference/`.

---

## 1. Produkt- und Technikrahmen

- Lokale persönliche Finanzanwendung, läuft im Browser. Frontend: React + TypeScript, Build: Vite.
- Kein Backend, keine serverbasierte Datenbank, keine externen Finanz- oder Banking-APIs.
- **Dauerhafte Hauptdatenquelle ist eine JSON-Datei.** Browser-Speicher ist nie die einzige Datenquelle; localStorage höchstens für unkritische UI-Einstellungen.
- Die Anwendung muss nach Löschen des Browser-Caches mit der vorhandenen JSON-Datei vollständig wiederherstellbar sein.
- Keine Bankzugänge, Passwörter, API-Schlüssel oder vollständigen Zahlungsdaten speichern.
- Finanzlogik und UI-Logik getrennt; Rechenfunktionen unabhängig von React-Komponenten testbar; Änderungen an Finanzberechnungen benötigen automatisierte Tests.
- Datenformat: `schemaVersion` verpflichtend; Formatänderungen benötigen Versionsnummer und Migrationsstrategie. Beträge als Zahlen in EUR, Prozentwerte als Dezimalzahlen (0,15 = 15 %), Datumswerte als ISO `YYYY-MM-DD`. Unbekannte Zusatzfelder werden beim Laden/Speichern nicht zerstört.
- UI gemäß S5: deutsch, ruhig, übersichtlich; Desktop und Smartphone; höchstens vier primäre Kennzahlen pro sichtbarer Gruppe; Eingaben und berechnete Werte visuell unterscheiden; Labels, Feld-Fehlermeldungen, Bestätigung vor kritischen Aktionen, Tastaturbedienbarkeit, Farbe nie als einziges Statussignal.

## 2. Umfang Version 1

**Enthalten (ausschließlich):**

| Nr. | Modul |
|-----|-------|
| M1 | Lokales Öffnen einer JSON-Finanzdatei |
| M2 | Speichern in dieselbe Datei (mit Benutzerfreigabe, soweit vom Browser unterstützt) |
| M3 | JSON-Export als Download |
| M4 | JSON-Import als Fallback |
| M5 | Automatische Sicherungsexporte |
| M6 | Anzeige ungespeicherter Änderungen |
| M7 | Übersicht |
| M8 | Konten |
| M9 | Depot und Tagesgeld |
| M10 | Sparpläne |
| M11 | Rebalancing |
| M12 | Finanzielle Ziele |
| M13 | Einfacher Vermögenssimulator |
| M14 | Einstellungen |

**Nicht in Version 1:** Online-Banking, Backend, Cloud-Synchronisation, Benutzerkonten, Steuerautomatisierung, Live-Kurse, automatische Broker-Anbindung, KI-API innerhalb der App. Ebenfalls nicht in V1 (Projektplan, spätere Versionen): Monatsimport aus Markdown/CSV (S4 gilt dann), Monatsfinanzen/Fixkosten-Modul, Investment-Journal, Wissensbereich, Monatsabschluss.

## 3. Globale verbindliche Anforderungen (G1–G12)

Diese Anforderungen gelten für alle Module; jedes Akzeptanzkriterium eines Moduls setzt sie voraus.

- **G1 – Keine Automatik nach außen:** Die Anwendung darf niemals reale Sparpläne, Bankdaten oder Brokerpositionen automatisch ändern. Sie berechnet, vergleicht, visualisiert, simuliert und zeigt Empfehlungen an – mehr nicht.
- **G2 – Empfehlungscharakter:** Alle Rebalancing-Ergebnisse sind ausschließlich Empfehlungen und werden als solche gekennzeichnet (keine verbindliche Anlage- oder Steuerberatung).
- **G3 – Snapshot-Schutz:** Historische Snapshots dürfen nicht überschrieben werden (Start-Snapshot: 2026-07-17, siehe Source Map Abschnitt 2).
- **G4 – Getrennte Erfassung:** Aktuelle Werte werden getrennt von historischen Snapshots erfasst (neuer Datenpunkt mit Datum, nie In-Place-Änderung der Historie).
- **G5 – Bestätigungspflicht:** Empfehlungen dürfen nur nach manueller Bestätigung als **geplante Einstellung innerhalb von Finance OS** gespeichert werden; auch danach erfolgt keine Änderung bei Banken oder Brokern.
- **G6 – TR-Trennung:** Trade-Republic-Cash und Trade-Republic-Depot werden getrennt geführt; Geld auf dem TR-Ausgabenkonto ist nicht automatisch Depotvermögen – erst eine tatsächliche Depotbuchung zählt als Investment.
- **G7 – Keine Doppelzählung ING/Equatex:** Die ING-Shares2you-Rücklage (75 €/Monat) und die spätere Equatex-Einzahlung (1.000 €/Jahr) sind dieselben Gelder; als eigene Sparleistung zählt der Betrag genau einmal (bei der Equatex-Einzahlung; Details `calculation-rules.md` 3.1, Testfall T1).
- **G8 – Zwei Kennzahlen:** Eigene Sparleistung und Gesamtvermögenszufluss werden getrennt berechnet und getrennt angezeigt; Saveback (Anbieterleistung) und Round-up (eigene Sparleistung) sind immer getrennte Zuflussarten.
- **G9 – Reale vs. geglättete Sicht:** Geglättete Analysewerte (z. B. Telekom 125 €/Monat) sind als solche gekennzeichnet und werden nie mit realen Cashflows in einer Kennzahl vermischt.
- **G10 – Datenintegrität:** Ein fehlgeschlagener Lade-/Importvorgang überschreibt nie den aktuellen Datenbestand; keine NaN-, Infinity- oder leeren Rechenergebnisse; keine Division durch 0 (stattdessen „nicht berechenbar“).
- **G11 – Keine Werte erfinden:** Fehlende Werte werden als unbekannt gespeichert und angezeigt; unsichere Zuordnungen als „zu prüfen“ markiert.
- **G12 – Destruktive Aktionen:** Löschen und Überschreiben erfordern eine Bestätigung; bestehende Daten werden nicht ohne ausdrückliche Nutzeraktion gelöscht.

---

## 4. Modul-Definitionen

### M1 – Lokales Öffnen einer JSON-Finanzdatei

- **Zweck:** Die JSON-Hauptdatei als einzige dauerhafte Datenquelle in die Anwendung laden.
- **Eingaben:** Dateiauswahl durch den Nutzer (File System Access API `showOpenFilePicker`, sonst `<input type="file">`); JSON-Datei mit `schemaVersion`.
- **Ausgaben:** Geladener Datenbestand im Arbeitsspeicher; Anzeige von Dateiname, `schemaVersion` und Ladezeitpunkt; bei Fehlern eine verständliche Fehlermeldung.
- **Bedienablauf:** Startbildschirm ohne Daten → „Datei öffnen“ → Auswahl → Validierung → Anzeige der Übersicht. Beispieldatei `user-data/finance-data.example.json` dient als dokumentierte Startvorlage.
- **Validierungen:** JSON parsebar; `schemaVersion` vorhanden und unterstützt (ältere Version → Migrationsangebot, neuere → verständliche Ablehnung); Pflichtstruktur vorhanden; unbekannte Zusatzfelder bleiben erhalten; ungültige Datei wird abgelehnt, ohne einen bereits geladenen Bestand zu verändern (G10).
- **Akzeptanzkriterien:**
  1. Eine gültige Datei lädt vollständig; alle Module zeigen danach Daten an.
  2. Eine ungültige Datei erzeugt eine verständliche Ablehnung mit Grund; ein zuvor geladener Bestand bleibt unverändert.
  3. Nach Löschen des Browser-Caches stellt das erneute Öffnen der Datei den vollständigen Zustand wieder her.
  4. Eine Datei mit unbekannten Zusatzfeldern übersteht Laden + Speichern ohne Verlust dieser Felder.
- **Nicht-Ziele:** Kein automatisches Öffnen ohne Nutzergeste; kein Zusammenführen mehrerer Dateien; keine Cloud-Quelle.

### M2 – Speichern in dieselbe Datei

- **Zweck:** Änderungen mit Benutzerfreigabe in die geöffnete Datei zurückschreiben.
- **Eingaben:** Aktueller Datenbestand; vorhandenes Datei-Handle; Nutzeraktion „Speichern“ (Button und Tastenkürzel).
- **Ausgaben:** Aktualisierte JSON-Datei; Statusanzeige „gespeichert um …“; Rücksetzen des Ungespeichert-Indikators (M6).
- **Bedienablauf:** „Speichern“ → ggf. Browser-Berechtigungsdialog → Schreiben → Bestätigung. Wenn der Browser direktes Dateispeichern nicht unterstützt: sichtbarer Hinweis und automatischer Wechsel auf den Download-Fallback (M3).
- **Validierungen:** Vor dem Schreiben Serialisierung prüfen (gültiges JSON, `schemaVersion` gesetzt); Schreibfehler abfangen und melden, Datenbestand im Speicher bleibt erhalten.
- **Akzeptanzkriterien:**
  1. In unterstützten Browsern wird nach Benutzerfreigabe dieselbe Datei aktualisiert.
  2. Export und erneuter Import bzw. Speichern und erneutes Öffnen ergeben identische Daten (Roundtrip, S3).
  3. In nicht unterstützten Browsern erscheint der Hinweis und der Fallback (M3) funktioniert.
  4. Ein fehlgeschlagener Schreibvorgang verliert keine Daten im Speicher und meldet den Fehler.
- **Nicht-Ziele:** Kein stilles Speichern ohne erteilte Freigabe; kein Autosave in localStorage als Ersatzpersistenz.
- **Nachtrag V1-Abschlussprüfung (2026-07-20):** Das in den Eingaben genannte **Tastenkürzel** (Strg+S) ist in V1 nicht umgesetzt – Speichern erfolgt über den Button (Kopfbereich/„Daten & Backups“). Restpunkt V1.x; alle Akzeptanzkriterien M2 sind davon unberührt erfüllt.

### M3 – JSON-Export als Download

- **Zweck:** Vollständigen Datenbestand jederzeit als Datei herunterladen (Fallback-Speichern und manuelle Sicherung).
- **Eingaben:** Aktueller Datenbestand; Nutzeraktion „Exportieren“.
- **Ausgaben:** Download einer JSON-Datei mit sprechendem Namen inkl. ISO-Datum (z. B. `finance-data-2026-07-19.json`).
- **Bedienablauf:** „Exportieren“ → Download → Bestätigungsmeldung.
- **Validierungen:** Export enthält den kompletten Bestand inkl. `schemaVersion` und aller historischen Snapshots; Export verändert den Bestand nicht.
- **Akzeptanzkriterien:**
  1. Die exportierte Datei ist mit M1/M4 wieder vollständig ladbar (identische Daten).
  2. Export ist auch bei ungespeicherten Änderungen möglich und enthält diese.
- **Nicht-Ziele:** Keine Teil-Exporte einzelner Module in V1; keine anderen Formate (CSV/PDF).

### M4 – JSON-Import als Fallback

- **Zweck:** Datenbestand aus einer Datei übernehmen, wenn direktes Öffnen/Speichern nicht genutzt wird (z. B. anderer Rechner, Wiederherstellung aus Backup).
- **Eingaben:** JSON-Datei über Dateiauswahl.
- **Ausgaben:** Importvorschau; nach Bestätigung der neue Datenbestand.
- **Bedienablauf (Sicherheitsprinzip aus S4):** Datei wählen → Validierung → **Vorschau** (mindestens: `schemaVersion`, Anzahl Konten/Positionen/Snapshots/Ziele, jüngstes Datum, Vergleich mit aktuell geladenem Bestand) → ausdrückliche Bestätigung → Übernahme. Vor der Übernahme wird ein Sicherungsexport des bisherigen Bestands angeboten (M5).
- **Validierungen:** Wie M1; zusätzlich Warnung, wenn der Import einen neueren geladenen Bestand ersetzen würde (Datenverlust-Hinweis, G12).
- **Akzeptanzkriterien:**
  1. Import erfolgt nie ohne Vorschau und Bestätigung.
  2. Ein abgebrochener oder fehlgeschlagener Import lässt den aktuellen Bestand unverändert (G10).
  3. Der Warnhinweis erscheint, wenn der geladene Bestand jüngere Änderungen enthält als die Importdatei.
- **Nicht-Ziele:** Kein Zusammenführen (Merge) zweier Bestände in V1; kein Import anderer Formate.

### M5 – Automatische Sicherungsexporte

- **Zweck:** Regelmäßige Sicherungskopien, damit Datenverlust durch Fehlbedienung oder Dateifehler begrenzt bleibt.
- **Eingaben:** Einstellungen (M14): Intervall (z. B. bei jedem Speichern / täglich beim ersten Speichern), Aufbewahrungsanzahl; optional einmalige Freigabe eines Sicherungsordners (z. B. `backups/`), sonst Download.
- **Ausgaben:** Zeitgestempelte Sicherungsdateien (`finance-data-backup-YYYY-MM-DD-HHmm.json`); Anzeige der letzten Sicherung.
- **Bedienablauf:** Automatisch gemäß Intervall im Rahmen einer Nutzeraktion (Speichern/Import/Migration); zusätzlich manuell „Sicherung jetzt erstellen“. Vor riskanten Aktionen (Import M4, Schema-Migration) wird immer eine Sicherung erstellt oder ausdrücklich angeboten.
- **Validierungen:** Sicherungen sind vollständige, wieder importierbare Exporte; Sicherungen überschreiben einander nicht (eindeutige Namen); Aufbewahrungslimit löscht älteste Sicherungen erst nach Bestätigungsregel aus den Einstellungen.
- **Akzeptanzkriterien:**
  1. Nach einer riskanten Aktion existiert eine unmittelbar zuvor erstellte Sicherung.
  2. Eine Sicherungsdatei ist über M4 vollständig wiederherstellbar.
  3. Ohne Ordner-Freigabe funktioniert der Download-Weg; der Nutzer sieht, wann zuletzt gesichert wurde.
- **Nicht-Ziele:** Keine Sicherung ohne jede Nutzeraktion im Hintergrund (Browser-Beschränkung, kein Backend); keine Cloud-Backups.

### M6 – Anzeige ungespeicherter Änderungen

- **Zweck:** Der Nutzer erkennt jederzeit, ob der angezeigte Zustand von der Datei abweicht.
- **Eingaben:** Änderungsereignisse aller Module.
- **Ausgaben:** Deutlich sichtbarer Indikator (nicht nur Farbe, S5) in der Navigation/Kopfzeile; Warndialog beim Schließen/Verlassen mit ungespeicherten Änderungen.
- **Bedienablauf:** Jede Datenänderung setzt den Status „ungespeichert“; erfolgreiches Speichern (M2) oder Export mit Bestätigung „als gespeichert markieren“ setzt ihn zurück.
- **Validierungen:** Statuswechsel exakt an echte Datenänderungen gekoppelt (keine falsch-positiven durch reine Ansichtswechsel).
- **Akzeptanzkriterien:**
  1. Nach jeder Datenänderung ist der Indikator sichtbar; nach dem Speichern verschwindet er.
  2. Beim Schließen des Tabs mit ungespeicherten Änderungen erscheint eine Warnung.
- **Nicht-Ziele:** Kein automatisches Speichern; keine Undo-Historie in V1.

### M7 – Übersicht

- **Zweck:** Zentrale Kennzahlen und der Zustand des Vermögens auf einen Blick.
- **Eingaben:** Geladener Datenbestand (aktuelle Werte und Snapshots); gewähltes Zielprofil (nur zur Anzeige der Abweichung).
- **Ausgaben:**
  - Kennzahlengruppe Vermögen (max. 4 primäre Kennzahlen, S5): Gesamtvermögen (Tagesgeld + Depot), Finanzvermögen, Anlagevermögen, frei verfügbare Liquidität.
  - Kennzahlengruppe Sparen: **eigene Sparleistung** und **Gesamtvermögenszufluss** getrennt (G8), jeweils mit Kennzeichnung real/geglättet (G9).
  - Depot-Gewichtung (Nenner = Depotwert, Tagesgeld getrennt ausgewiesen, nie vermischt – S1/S5) inkl. „MSCI World gesamt“ und Unterpositionen.
  - Höchstens vier Hauptdiagramme (S5), u. a. Ist- vs. Zielverteilung deutlich unterschieden.
  - Hinweisbereich: ungespeicherte Änderungen (M6), letzte Sicherung (M5), sachlicher Hinweis auf Telekom-Übergewichtung gegenüber dem Job-Profil (Source Map Abschnitt 8).
- **Bedienablauf:** Startansicht nach dem Laden; Kacheln/Diagramme verlinken in die Module; jede zentrale Berechnung hat eine kurze Erklärung oder einen Tooltip (S5).
- **Validierungen:** Pflichtprüfungen S2/S3 vor Anzeige (Summen = 100 %, Gesamtvermögen = Tagesgeld + Depot, keine NaN/Infinity, leere Bestände → verständlicher leerer Zustand).
- **Akzeptanzkriterien:**
  1. Mit dem Start-Snapshot (2026-07-17) zeigt die Übersicht: Depot 2.522,47 €, Tagesgeld 627,59 €, Gesamtvermögen 3.150,06 €, Telekom-Anteil 54,27775 % vom Depot.
  2. Eigene Sparleistung und Gesamtzufluss erscheinen als zwei getrennte, beschriftete Kennzahlen (fest/geglättet gekennzeichnet: 201,83 € eigen bzw. 250 € gesamt zzgl. variabler Zuflüsse).
  3. Ohne geladene Daten erscheint ein verständlicher leerer Zustand mit Handlungsaufforderung „Datei öffnen“.
- **Nicht-Ziele:** Keine Live-Kurse; keine Renditeberechnung in V1; keine frei konfigurierbaren Dashboards.
- **Nachtrag V1-Abschlussprüfung (2026-07-20):** Von der Kennzahlengruppe Vermögen sind **Finanzvermögen, Anlagevermögen und frei verfügbare Liquidität** in V1 NICHT als berechnete Kennzahlen umgesetzt – die Übersicht zeigt stattdessen Gesamtvermögen, Depotwert, Tagesgeld und sonstiges Kontovermögen (Phase-12-Entscheidung). Die Datenbasis ist vollständig vorbereitet (`countsAsFreeLiquidity`/`includeInInvestedWealth`-Flags, Definitionen in `data-model.md` §4/DM7); die Kennzahlen selbst sind Restpunkt V1.x. Alle M7-Akzeptanzkriterien (Seed-Kennzahlen, getrennte Sparleistungs-Kennzahlen, Leerzustand) sind erfüllt.

### M8 – Konten

- **Zweck:** Alle Konten mit Zweck, Typ und aktuellem Saldo führen; Grundlage der Vermögenskennzahlen.
- **Eingaben:** Kontenstammdaten (Name, Institut, Typ: Giro/Tagesgeld/Depot/Rücklage/Krypto), Zweckbindung, aktuelle Salden mit Datum; Startdaten aus der Source Map (Sparkasse Giro; ING Rücklagenkonto Shares2you; Volkswagen Bank Tagesgeld; Trade Republic **Cash und Depot getrennt** (G6); FNZ VL-Depot; Equatex; optional Bitget; Telekom Pensionsfonds nur als Merkposten ohne Wert).
- **Ausgaben:** Kontenliste (sortier-/filterbar, S5) mit Salden und Datum des Standes; Summen je Kennzahl (Finanzvermögen, Anlagevermögen, frei verfügbare Liquidität); Kennzeichnung zweckgebundener Konten (ING-Rücklage zählt nicht zur frei verfügbaren Liquidität).
- **Bedienablauf:** Konto anlegen/bearbeiten über Formular mit Labels; Saldo aktualisieren = neuer datierter Wert (G4), Historie bleibt erhalten; Löschen nur mit Bestätigung (G12).
- **Validierungen:** Salden sind Zahlen ≥ 0 oder mit ausdrücklicher Kennzeichnung negativ (Girokonto); Datum nicht in der Zukunft; TR-Cash kann nie einer Depotposition zugerechnet werden (G6); Umbuchungen zwischen eigenen Konten verändern weder Einnahmen noch Ausgaben (S1).
- **Akzeptanzkriterien:**
  1. TR-Cash und TR-Depot erscheinen als getrennte Einträge und fließen getrennt in die Kennzahlen ein.
  2. Die ING-Rücklage wird in „frei verfügbare Liquidität“ nicht mitgezählt, wohl aber im Finanzvermögen.
  3. Eine Saldo-Aktualisierung erzeugt einen neuen datierten Wert; ältere Werte bleiben abrufbar.
- **Nicht-Ziele:** Keine Buchungs-/Transaktionsverwaltung in V1 (nur Salden und definierte Sparvorgänge in M10); kein Online-Abruf.
- **Nachtrag V1-Abschlussprüfung (2026-07-20):** Die „Summen je Kennzahl (Finanzvermögen, Anlagevermögen, frei verfügbare Liquidität)“ sind in V1 nicht als Anzeige umgesetzt (siehe M7-Nachtrag; Restpunkt V1.x). **AK 2 ist auf Datenebene erfüllt:** die ING-Rücklage trägt `countsAsFreeLiquidity: false` und zählt damit strukturell nie zur frei verfügbaren Liquidität, wohl aber zum Finanzvermögen (Definition `data-model.md` §4; Löschen von Konten ist bewusst durch Deaktivieren ersetzt – Kein-Löschen-Linie, G12-Bestätigung vorhanden). AK 1 und AK 3 sind vollständig erfüllt und getestet.

### M9 – Depot und Tagesgeld

- **Zweck:** Depotpositionen und Tagesgeld getrennt führen (S1); Historie über unveränderliche Snapshots.
- **Eingaben:** Positionsstammdaten (Name, ISIN, Konto): VL iShares Core MSCI World IE00B4L5Y983; SPDR MSCI World Acc IE00BFY0GT14; Xtrackers MSCI World Dist IE00BK1PV551; iShares MSCI EM IMI IE00BKM4GZ66; iShares Physical Gold ETC IE00B4ND3602; Deutsche Telekom. Aktuelle Positionswerte mit Datum; der historische Start-Snapshot vom 2026-07-17 wird als Seed ausgeliefert.
- **Ausgaben:** Positionsliste mit Werten, Depotwert, Depot-Gewichtung (Nenner = Depotwert, Tagesgeld nie im Nenner); „MSCI World gesamt“ zusätzlich zu den drei Unterpositionen; Vermögensebene (Tagesgeld + Depot); Snapshot-Historie mit Verlauf.
- **Bedienablauf:** „Neue Werte erfassen“ → Formular mit allen Positionen und Tagesgeld → Datum → Speichern als neuer Snapshot (G4). Historische Snapshots sind schreibgeschützt (G3); Ansicht erlaubt Vergleich zweier Snapshots.
- **Validierungen:** Werte ≥ 0; Datum eindeutig und nicht vor dem letzten Snapshot rückdatiert ohne Warnung; World-Unterpositionen summieren zur World-Gesamtsumme; Depotwert = Summe aller Positionen; bei Depotwert 0 keine Gewichtung (G10); Pflichtprüfungen S2.
- **Akzeptanzkriterien:**
  1. Der Seed-Snapshot 2026-07-17 ist vorhanden und nicht editierbar; ein Bearbeitungsversuch erzeugt einen erklärenden Hinweis.
  2. Neue Werte erzeugen einen neuen Snapshot; die Übersicht rechnet danach mit den neuen Werten, die Historie zeigt beide.
  3. Gewichtungen: Einzeln und „World gesamt“ werden angezeigt; Summe der Depotanteile ergibt 100 % (Rundungsdifferenz sichtbar).
- **Nicht-Ziele:** Keine Kursabfrage; keine Transaktions-/Stückzahlverwaltung (nur Werte) in V1; keine Performance-/Renditeberechnung.
- **Nachtrag V1-Abschlussprüfung (2026-07-20):** Die Snapshot-**Daten**-Historie ist vollständig umgesetzt (unveränderliche, gesperrte Snapshots, G3/G4; Wert-Historien je Position/Konto in der Datei; Warnungen zu unvollständigen Snapshots). Eine eigene **Verlaufs-Ansicht** der Snapshots und der im Bedienablauf genannte **Vergleich zweier Snapshots** sind in V1 nicht umgesetzt – die Seite zeigt jeweils die aktuellen (jüngsten) Werte. Restpunkt V1.x; die Akzeptanzkriterien M9 (Seed-Snapshot gesperrt, neue Snapshots, Gewichtungen) sind erfüllt. Präzisierung zu AK 3: Die Depot-Seite zeigt die Anteile je Position (und „World gesamt“); eine eigene Anteils-**Summenzeile** mit sichtbarer Rundungsdifferenz erscheint erst in der Abweichungstabelle der Rebalancing-Seite (tfoot).

### M10 – Sparpläne

- **Zweck:** Feste und variable Zuflüsse mit korrekten Zuflussarten dokumentieren; Basis für Sparleistungs-Kennzahlen und Rebalancing.
- **Eingaben:** Sparplan-Stammdaten (Ziel-Position/-Konto, Betrag, Rhythmus, Zuflussart, flexibel ja/nein, gültig ab/bis). Startdaten (U1/U2): VL 40 € (33,50 eigen + 6,50 Arbeitgeber); TR fest 60 € = SPDR 23 + Xtrackers 22 + EM IMI 10 + Gold 5; Tagesgeld VW 25 €; Rücklagenübertragung ING 75 €; Telekom-Jahresmechanik (Eigenbeitrag 1.000 €/Jahr inkl. 100 € Sparergänzung, Bonus 500 €/Jahr, geglättet 83,33/41,67/125 als Analysewerte); variable Zuflüsse Saveback (Anbieterleistung) und Round-up (eigene Sparleistung) als getrennte Einträge, typisch ca. 10–15 €/Monat, als „variabel, nicht garantiert“ gekennzeichnet.
- **Ausgaben:** Sparplanliste nach Zuflussart gruppiert; Summen: eigene feste Sparleistung (118,50 €/Monat real; 201,83 € geglättet), Gesamtzufluss fest/geglättet (250 €/Monat) und „ca. 260–265 €“ inkl. typischer variabler Zuflüsse (als ungefähr gekennzeichnet); Jahressicht mit realen Cashflows (G9).
- **Bedienablauf:** Anlegen/Bearbeiten über Formular; Änderungen wirken ab Gültigkeitsdatum (Historie bleibt); tatsächliche variable Zuflüsse (Saveback/Round-up) werden als datierte Ist-Einträge erfasst, nicht geschätzt.
- **Validierungen:** Kein Sparplan ohne Zuflussart; Saveback und Round-up können nie in einem Eintrag kombiniert werden (G8); die ING-Rücklage kann nicht als Investment-Sparleistung markiert werden (G7); Beträge ≥ 0; Warnung, wenn die Summe der festen Raten das in M14 hinterlegte Budget überschreitet (S2).
- **Akzeptanzkriterien:**
  1. Testfall T1 (`calculation-rules.md`): Ein simuliertes Jahr ergibt Telekom-Sparleistung 1.000 € – nicht 1.900 €.
  2. Testfall T2: VL-Monat erhöht eigene Sparleistung um 33,50 € und Gesamtzufluss um 40 €.
  3. Testfall T3: Gold-Monat mit festen 5 € + Round-up + Saveback erzeugt drei getrennte Einträge zweier Zuflussarten.
  4. Die 265-€-Summe erscheint nie ohne die Kennzeichnung „ungefähr, inkl. variabler Zuflüsse“.
- **U3-Nachtrag (verbindliche Nutzerentscheidung, 2026-07-19):** Für das Ziel „Monatlich 1.000 € Sparrate“ (`metric: monthlySavingsRate`) ist der **primäre Fortschritt = eigene reale monatliche Sparleistung / Zielbetrag** (F8 realMonthly; Seed 118,50/1.000 = 11,85 %); zusätzlich wird der geglättete Analysewert gezeigt (201,83/1.000 = 20,18 %), gekennzeichnet als „Geglätteter Analysewert – nicht der primäre Zielfortschritt“. Externe Zuflüsse (employer/provider), Umbuchungen und variable Istwerte zählen NIE in den primären Fortschritt; der Gesamtzufluss (F9) bleibt eine getrennte Info-Kennzahl. Kein Widerspruch zu G1–G12: Die Anzeige ist rein informativ (G1/G2), reale und geglättete Sicht bleiben getrennt (G9), Umbuchungen zählen nie (G7), unbekannte Werte werden nie als 0 erfunden (G11).
- **Nicht-Ziele:** Keine automatische Übernahme in reale Sparpläne (G1); kein Import von Broker-Daten; keine Fixkosten-/Budgetverwaltung in V1 (nur ein Budget-Grenzwert in M14). Bewusste M10-Restpunkte (dokumentiert): Ist-Erfassung variabler Zuflüsse über `transactions` folgt in einer späteren Runde (Datenmodell existiert bereits); die Budget-Warnung gegen den M14-Grenzwert folgt mit M14; keine Pausen-HISTORIE (`isPaused` ist Momentzustand).
- **U4-Nachtrag (verbindliche Nutzerentscheidung, 2026-07-20):** `own_variable`-Pläne MIT gültigem positivem festem Betrag zählen vollständig zur eigenen Sparleistung (F8) und zum primären U3-Fortschritt – die frühere Grauzone „variabler Plan mit festem Planbetrag“ ist damit entschieden. Ohne Betrag (null), mit 0, negativ oder nicht endlich zählt der Plan NICHT (die reine Schicht behandelt solche Werte defensiv als 0; die Validierung lehnt NEGATIVE und nicht endliche Beträge ab, 0 ist speicherbar und zählt per Guard 0). Einmalige eigene variable Zuflüsse mit festem Betrag zählen real nur im Ausführungsmonat, nie geglättet, nie in der F8-Rate. Kein neues Klassifikationsfeld; Details in `calculation-rules.md` („Sparplan-Bausteine (M10)“, Absatz U4).
- **Bewusste Abweichungen (Reviewer M10, dokumentiert):** (1) Die Schätzsumme „ca. 260–265 € inkl. typischer variabler Zuflüsse" wird NICHT angezeigt – variable Zuflüsse haben keinen garantierten Betrag, und ohne erfasste `transactions`-Istwerte wäre jede Summe ein erfundener Wert (G11, „keine Finanzwerte erfinden"); stattdessen steht der Hinweis „zzgl. variable Zuflüsse (nicht garantiert)". Die Schätzsumme kann folgen, sobald die Ist-Erfassung über `transactions` existiert. (2) „Änderungen wirken ab Gültigkeitsdatum (Historie bleibt)" ist als In-place-Bearbeitung OHNE Planversionierung umgesetzt: Vergangenheit kommt ausschließlich aus `transactions` (nie aus Planwerten, isPaused-Grenze 2c); wer eine echte Historie braucht, beendet den Plan und legt einen neuen an.

### M11 – Rebalancing

- **Zweck:** Abweichungen zwischen Ist und Zielprofil zeigen und regelkonforme Empfehlungen berechnen – ausschließlich als Empfehlung (G2).
- **Eingaben:** Aktuelle Depotwerte (M9), Sparpläne (M10), Zielprofile: **Student Ebene A** (Sparraten-Ist als Referenz), **Student Ebene B** (Bestands-Zielallokation; leer bis vom Nutzer definiert), **Job** (70 % World [4,8/31/34,2], 15 % EM IMI, 5 % Gold, 10 % Telekom; 85/15-Sparquoten-Split; Prozentwerte normativ), **Eigene Aufteilung** (leer, frei editierbar); Kennzeichnung flexibel/nicht flexibel je Sparplan (Telekom wird nicht automatisch als „nicht flexibel“ vorbelegt – nur durch ausdrückliche Nutzerentscheidung).
- **Ausgaben:** Abweichungstabelle je Position (Ist-%, Ziel-%, Abweichung in Prozentpunkten und EUR, Kauf-/Verkaufsbedarf nach S2-Formeln); Empfehlungsvorschlag (Sparraten-Umlenkung zuerst); sichtbar ausgewiesene Rundungsdifferenzen; Simulations-Hinweis „ohne Kursentwicklung“ wo zutreffend.
- **Bedienablauf:** Profil wählen → Abweichungen ansehen (jederzeit) → ab ≥ 5 Prozentpunkten (absolut) erscheint eine Handlungsempfehlung → ab ≥ 10 Prozentpunkten wird zusätzlich die Verkaufsoption als letzte Möglichkeit erwähnt → Empfehlung kann per ausdrücklicher Bestätigung als **geplante Einstellung** gespeichert werden (G5) → gespeicherte Planung ist als „geplant, nicht ausgeführt“ gekennzeichnet. Job-Profil-Aktivierung nur manuell und frühestens nach dem 30.09.2027 sinnvoll (Hinweis, keine Automatik).
- **Validierungen:** Reihenfolge der Maßnahmen (S2): 1. laufende Sparraten umlenken, 2. zusätzliches Geld/Ausschüttungen, 3. flexible Pläne reduzieren, 4. pausieren, 5. Verkäufe zuletzt; keine vorgeschlagene Rate < 0; Summe der Vorschläge ≤ verfügbares Budget; nicht flexible Mindestbeträge eingehalten; Zielprofil summiert zu 100 % je Ebene (sonst Fehlermeldung am Profil); Prozentpunkte absolut.
- **Akzeptanzkriterien:**
  1. Testfall T9: 3 Pp → nur Anzeige; 6 Pp → Empfehlung ohne Verkaufsoption; 12 Pp → Empfehlung mit Verkaufsoption als letzter Möglichkeit.
  2. Keine Empfehlung wird ohne Bestätigungsdialog zu einer gespeicherten Planung; gespeicherte Planungen ändern keine Ist-Daten.
  3. Mit dem Seed-Snapshot und Job-Profil wird Telekom (54,27775 % vs. 10 %) als größte Abweichung ausgewiesen.
  4. Ein leeres Profil (Ebene B, Eigene Aufteilung) zeigt einen verständlichen leeren Zustand statt einer Berechnung.
- **Nicht-Ziele:** Keine Ordererzeugung, keine Broker-Anbindung, keine automatische Profilumschaltung, keine Steueroptimierungslogik.
- **M11-Nachtrag (Umsetzung 2026-07-20, data-architect-ratifiziert, Auflagen A1–A7):**
  - **Bewusste Entscheidungen (dokumentiert):** (1) **Keine Duplikat-Funktionsnamen** – die Auftragsnamen `calculateCurrentAllocation`/`calculateTargetAllocation`/`calculateDeviation`/`calculateDeviationEuro`/`calculateActionLevel` sind Bestandteile von `calculateRebalancingAnalysis`; die bestehenden Formelkatalog-Funktionen (F5/F11–F16, `actionLevel`) SIND die Implementierung. (2) **Statuslabel-Mapping (A4):** Die vier Statusbegriffe des Auftrags werden auf die drei bestehenden `actionLevel`-Stufen abgebildet („OK (nur Anzeige)“ / „Empfehlung – prüfen“ / „Empfehlung – Rebalancing sinnvoll (inkl. Verkaufsoption als letzte Möglichkeit)“); „beobachten“ erhält KEINE eigene Stufe – eine vierte Schwelle wäre quellenlos. (3) **Budget-Definition (A1):** Das flexible F17-Monatsbudget wird abgeleitet als Summe der am Stichtag aktiven Pläne mit `isFlexible !== false`, `flowType` ∈ {`own_fixed`, `own_variable`}, `interval "monthly"`, `targetKind "position"` und endlichem Betrag > 0 (Seed 60,00 €; mit pausiertem Gold-Plan 55,00 €); Budget 0 ist der definierte „keine Empfehlung“-Zustand.
  - **Gespeicherte Planungen:** `plannedChanges` mit `createdAt` = injiziertem Kalenderdatum (A2), Status `planned` („geplant, nicht ausgeführt“) und additiv `discarded` („verworfen“, A3 – kein Löschen, keine Rücknahme in V1); Speichern nur nach Bestätigungsdialog inkl. Beträgen (G5); Planungen ändern nie Ist-Daten oder Sparpläne.
  - **Pflicht-Kennzeichnungen:** Dauer immer „ungefähr … Monate, ohne Kursentwicklung“; „Übergewichtungen sind ohne Verkäufe nicht abbaubar“; Voll-Simulation „Simulation – wird nie automatisch übernommen“ inkl. A7-Klarstellung (es entsteht NIE ein `simulations[]`-Eintrag – das ist M13); Empfehlungen ausschließlich im Konjunktiv („Wenn du deine Zielallokation annähern möchtest, könntest du …“).
  - **Restpunkte (dokumentiert, nicht blockierend):** Konsolidierung des Depot-Zielvergleichs auf `calculateRebalancingAnalysis`; ein Zurücksetzen verworfener Planungen (discarded → planned) ist bewusst nicht vorgesehen (G5-Schutz).

### M12 – Finanzielle Ziele

- **Zweck:** Die bestätigten Ziele verwalten und Fortschritt anzeigen.
- **Eingaben:** Zielliste als Seed (Source Map Abschnitt 14): Notgroschen (Regel: 3–5 Nettogehälter, Standard 4 → 4.680 € bei Netto 1.170 €; manuell überschreibbar), 10.000 € Depot, 50.000 € Gesamtvermögen, physisches Gold (Betrag offen), Auto-Rücklage (offen), Urlaub (offen), Berufseinstieg (nach 30.09.2027), monatlich 1.000 € Sparrate. Je Ziel: Name, Zielbetrag (oder „offen“), Termin (oder „offen“), verknüpfte Kennzahl (z. B. Tagesgeld, Depotwert, Gesamtvermögen, Sparrate).
- **Ausgaben:** Zielliste mit Fortschritt (aktueller Wert / Zielwert, Prozent), offene Felder deutlich als „offen / nutzerdefinierbar“ markiert (G11); nach Erreichen des Notgroschens nur **Vorschläge** für Folgeziele – keine automatische Umwidmung.
- **Bedienablauf:** Ziel anlegen/bearbeiten/abschließen; Notgroschen: Faktor n und Netto aus M14, errechneter Zielbetrag mit „überschreiben“-Option; Neuberechnung bei Netto-Änderung wird angeboten, ersetzt aber keinen manuell gesetzten Wert ungefragt.
- **Validierungen:** Zielbeträge > 0 oder „offen“; Termine als ISO-Datum oder „offen“; Fortschritt nur berechnet, wenn die verknüpfte Kennzahl vorhanden ist (sonst „nicht berechenbar“).
- **Akzeptanzkriterien:**
  1. Der Notgroschen zeigt mit Standardwerten 4.680 € Ziel und den Fortschritt auf Basis des aktuellen Tagesgelds (Seed: 627,59 € → 13,4 %, gerundet angezeigt).
  2. Ziele ohne Betrag/Termin erscheinen ohne erfundene Werte, klar als offen gekennzeichnet.
  3. Zielerreichung löst ausschließlich eine Anzeige/einen Vorschlag aus (G1/G5).
- **Nicht-Ziele:** Keine automatische Sparratenumleitung; keine Zielpriorisierungs-Automatik.
- **M12-Nachtrag (Umsetzung 2026-07-20, data-architect-ratifiziert):**
  - Neue Zielarten (additiv, `data-model.md` §3.9/§6): Kontostand eines Kontos (`accountBalance` + `refId`), Wert einer Depotposition (`positionValue` + `refId`), freies Geldziel mit manuell gepflegtem Ist-Wert (`manual` + `manualCurrentAmount`); optionales `startDate` (Ziel „geplant“, wenn in der Zukunft); Status `archived` (beendet – Ziele werden NIE gelöscht).
  - Statusmodell: pausieren = `deferred` („zurückgestellt“), manuell abschließen = `reached` (GESPEICHERTER Nutzerwille), archivieren = `archived`; **rechnerisch erreicht wird nie gespeichert**, nur abgeleitet, und fällt bei sinkendem Ist-Wert zurück. Abgeleitete Rangfolge und alle Formeln (Monatszählregel, benötigte Monatsrate, Prognose OHNE Rendite-/Kursannahme, Zuordnung eigener Sparleistung) in `calculation-rules.md` „Ziel-Bausteine (M12)“.
  - U4 gilt: eigene variable Raten MIT festem Betrag zählen im primären Fortschritt (siehe M10-U4-Nachtrag).
  - **Bewusste Entscheidungen (dokumentiert):** kein `startAmount`/gespeicherter Bezugswert (kein definierter Abnehmer – Fortschritt bleibt Ist/Ziel); KEINE Ist-Summen-Kachel in der Übersicht (Bezugswerte überschneiden sich, z. B. Depot ⊂ Gesamtvermögen – eine Addition wäre irreführend; die Zielbetrags-Summen tragen eine Pflicht-Kennzeichnung und schließen Sparraten-Ziele in €/Monat aus); kein `goalId`-Feld an Sparplänen (Zuordnung über die vorhandene Zielreferenz ableitbar); für Sparraten-Ziele keine Monatsrate/Prognose (dimensional sinnlos); Notgroschen-Zielbetrag bleibt berechnet (Bearbeiten zeigt den Wert samt Hinweis auf die Einstellungs-Übersteuerung – keine ungefragte Ersetzung).

### M13 – Einfacher Vermögenssimulator

- **Zweck:** Szenarien der Vermögensentwicklung aus Sparraten und optionaler Renditeannahme durchrechnen – als klar gekennzeichnete Projektion.
- **Eingaben:** Startwerte (aktuelles Depot/Tagesgeld oder frei), monatliche Sparraten (Vorbelegung aus M10, editierbar), Zeitraum (Monate/Jahre), optionale jährliche Renditeannahme in Prozent (Standard: 0 % = „ohne Kursentwicklung“), optional Telekom-Jahreszufluss real oder geglättet (gekennzeichnet).
- **Ausgaben:** Verlaufstabelle und -diagramm (Endwert, eingezahlte Summe, davon eigene Sparleistung vs. Gesamtzufluss getrennt, G8); deutliche Kennzeichnung: „Projektion ohne Kursentwicklung“ bzw. „Projektion mit Annahme X % p. a. – keine Prognose, keine Anlageberatung“ (S2/C1).
- **Bedienablauf:** Parameter setzen → Ergebnis ansehen → Szenario optional benennen und als Simulation speichern (verändert keine Ist-Daten).
- **Validierungen:** Zeitraum > 0; Raten ≥ 0; Renditeannahme in plausiblem Eingabebereich mit Warnung bei Extremwerten; keine NaN/Infinity; Simulationen sind vom Ist-Datenbestand getrennt gespeichert.
- **Akzeptanzkriterien:**
  1. Mit 0 % Rendite entspricht der Endwert exakt Startwert + Summe der Zuflüsse (nachrechenbar).
  2. Jede Ergebnisansicht trägt die Projektions-Kennzeichnung.
  3. Das Speichern eines Szenarios verändert keine Konten-, Depot- oder Sparplandaten.
- **Nicht-Ziele:** Keine Monte-Carlo-/Wahrscheinlichkeitsrechnung, keine Steuer- oder Inflationsmodellierung, keine Produktempfehlungen in V1.
- **M13-Nachtrag (Umsetzung 2026-07-20, data-architect-ratifiziert, KORREKTUR 2.1 + Auflagen 2.2–2.6):**
  - **startMonth-Konvention (KORREKTUR 2.1):** Der erste projizierte Monat ist der **FOLGEMONAT des Stichtags** (F22 „Real (Start August 2026)“ bei Juli-Stichtag); Pflicht-Pin real 6 Monate 777,59/3.122,47/3.900,06 (ohne Juli-Ereignis) zusätzlich zum 12-Monats-Pin 6.150,06.
  - **Rechenmodell:** Aggregatmodell Tagesgeld + Depot; geometrischer Monatsfaktor (1 + r)^(1/12); verzinst wird NUR das Depot; je Monat erst Verzinsung, dann Beiträge (Monatsende-Regel); Rendite 0–15 % mit WARNUNG > 8 % („sehr optimistische Annahme“); months 1–1200; Telekom real = Juli-Ereignis 1.500 (1.000 eigen + 500 Arbeitgeber, G8-partitioniert), geglättet = 125 €/Monat als gekennzeichnete Beiträge (nie beides, G9). Details `calculation-rules.md` „Simulations-Bausteine (M13)“.
  - **Konflikt-Ausweise (bewusste Entscheidungen, dokumentiert):** (1) KEINE Inflationsannahme – das M13-Nicht-Ziel ist die ranghöhere Quelle (kein stilles Feld); (2) KEIN Rebalancing-Schalter/Zielprofil in der Simulation – Rebalancing verschiebt nur innerhalb des Depots und ändert die projizierten Aggregate nicht (Scheinfunktion; Annahmen gehören ins note-Feld, Zielprofil-Vergleiche liefert M11); (3) KEINE negative Rendite (Bereich 0–15 % laut Auftrag); (4) kein Start-/Enddatum-Feld – Zeitraum bleibt `months`, die Anzeige „ab <Monat>, n Monate (bis <Endmonat>)“ wird berechnet; (5) Beschreibung über das vorhandene `note`-Feld.
  - **Löschen (G12):** Simulationen sind reine Szenario-Entwürfe ohne Referenzen und keine historischen Finanzdaten → hartes Löschen mit Bestätigung inkl. Name ist zulässig (Begründung `data-model.md` §3.11); Kopieren erzeugt „<Name> (Kopie)“ mit neuem Datum.
  - **Zielanalyse:** projizierbar sind nur Tagesgeld/Depotwert/Gesamtvermögen; andere Kennzahlen → „keine Aussage möglich“ mit Begründung; Status erreichbar/voraussichtlich verspätet/im Horizont nicht erreicht/keine Aussage möglich, IMMER mit Begründungssatz; archivierte und pausierte Ziele ausgenommen.
  - **Export-Minimal-Auslegung (bewusst):** KEIN eigener Simulations-Export – Simulationen sind Teil der JSON-Datei und laufen über „Daten & Backups“ (M2/M3/M5); die Seite weist sichtbar darauf hin.
  - **Diagramm:** handgerolltes inline-SVG OHNE Chart-Bibliothek, `aria-hidden` und nur ZUSATZ – die Verlaufstabelle ist die Primärquelle („Alle Werte stehen in der Tabelle“).

### M14 – Einstellungen

- **Zweck:** Nutzerkonfiguration der App ohne sensible Daten.
- **Eingaben:** Notgroschen-Faktor n (3–5, Standard 4) und aktuelles Netto (Standard 1.170 €); monatliches Sparbudget (Grenzwert für Warnungen in M10/M11); Backup-Intervall und Aufbewahrungsanzahl (M5); Anzeigeoptionen (Zahlenformat de-DE, Dezimalstellen für Prozentanzeige); Profilverwaltung (Zielprofile ansehen/bearbeiten, „Eigene Aufteilung“ befüllen; Job-Profil-Aktivierung nur hier, manuell, mit Bestätigungsdialog); Speicherort-/Berechtigungsstatus der Dateizugriffe.
- **Ausgaben:** Wirksame Einstellungen; Hinweis, welche Einstellungen in der JSON-Datei (fachlich) und welche in localStorage (nur unkritische UI-Einstellungen wie Theme/Spaltenbreiten) liegen.
- **Bedienablauf:** Formularbasiert mit sofortiger Validierung; kritische Änderungen (Profilaktivierung, Schema-Migration, Löschen von Sicherungen) mit Bestätigungsdialog (G12).
- **Validierungen:** n ∈ [3; 5]; Netto > 0; Budget ≥ 0; fachliche Einstellungen werden ausschließlich in der JSON-Datei gespeichert (Cache-Löschung überlebt, S3); keine Zugangsdaten-Felder vorhanden.
- **Akzeptanzkriterien:**
  1. Änderung von n oder Netto aktualisiert den vorgeschlagenen Notgroschen-Zielwert (M12) als Vorschlag.
  2. Nach Cache-Löschung sind alle fachlichen Einstellungen über die JSON-Datei wiederhergestellt; nur unkritische UI-Einstellungen dürfen verloren gehen.
  3. Die Aktivierung des Job-Profils erfordert einen Bestätigungsdialog und ist vor dem 01.10.2027 mit einem zusätzlichen Warnhinweis versehen.
- **Nicht-Ziele:** Keine Benutzerkonten/Logins; keine API-Schlüssel; keine Theme-Vielfalt über hell/dunkel hinaus in V1.
- **M14-Nachtrag (Umsetzung 2026-07-20, data-architect-ratifiziert, KORREKTUR Nr. 3 + Auflagen A2–A8):**
  - **Bewusste Abweichung / Konflikt-Ausweis (ABNAHME-RELEVANT): KEINE Profilbearbeitung in V1.** Der ratifizierte Nutzerauftrag (§6: Zielprofil „nur Auswahl“) schlägt die obige Eingaben-Formulierung „Zielprofile ansehen/**bearbeiten**, ‚Eigene Aufteilung‘ befüllen“ – M14 bietet ausschließlich die globale **Auswahl** des aktiven Profils (`settings.activeTargetProfileId`) mit G12-Bestätigungsdialog; Profilbearbeitung und das Befüllen von „Eigene Aufteilung“/Ebene B sind ein dokumentierter **Restpunkt für V1.x**. AK 3 gilt unverändert: Job-Profil-Aktivierung nur mit Bestätigung, vor dem 01.10.2027 mit zusätzlichem sichtbarem UND im Dialog wiederholtem Warnhinweis (Vergleich ausschließlich über den injizierten Stichtag, A8). Die Rebalancing-Seite behält ihre lokale Analyse-Auswahl (Hinweis auf der Seite).
  - **Backup-Regeln (M5 eingelöst):** Default `everySave` – ein fehlender `backup.mode` WIRKT als `everySave` (nur berechnet, nie materialisiert, K2; KORREKTUR Nr. 3); bewusst KEINE „aus“-Option (Enum ohne Aus-Zustand, V1-Grenze). Auto-Backup nach jedem erfolgreichen direkten Speichern als Byte-identischer Download des geschriebenen Serialisats (A2), Fehler nur als Hinweis (A3), kein Backup beim Download-Fallback/Abbruch/Fehler (A4). `retentionCount` ist bei Browser-Downloads nicht durchsetzbar → reine Empfehlungs-Anzeige (dokumentierte Grenze). Tagesmerker `financeos.lastAutoBackupDay` als unkritische localStorage-Gerätemarke (A5; requirements-Ausgabe „Hinweis JSON vs. localStorage“ ist als Transparenz-Sektion umgesetzt); Wiederherstellung = Import einer Sicherungsdatei über den VORHANDENEN M4-Flow (Vorschau + Bestätigung, G10 – kein neuer Kanal).
  - **M10-Restpunkt eingelöst:** Die Budget-Warnung erscheint auf der Sparpläne-Seite, wenn die eigene feste Sparleistung (F8 real) das `monthlySavingsBudget` STRIKT überschreitet (nie blockierend; `null` = offen, keine Prüfung).
  - **Weitere Ausweise:** percentDecimals jetzt Ganzzahl 0–4 (einzige Ladeverschärfung, §6-Ausweis, A6); `numberLocale` ohne Schreibpfad – read-only „de-DE/EUR/TT.MM.JJJJ, fest in V1“ (keine i18n, A7); CSV-Export bewusst nicht (der „optional“-Punkt aus M3 bleibt offen); Notgroschen-Übersteuerung setzen/zurücksetzen nur mit G12-Bestätigung inkl. beider Werte (M12-Regel: nie ungefragte Ersetzung); Speicherort-/Berechtigungsstatus als read-only-Statuszeile („Dateiverbindung dieser Sitzung“).

---

## 5. Abnahme Version 1

Version 1 gilt als abgeschlossen, wenn:

1. Alle Modul-Akzeptanzkriterien erfüllt sind und die Testfälle T1–T9 aus `docs/calculation-rules.md` als automatisierte Tests bestehen (C1: keine Funktion „fertig“ ohne bestehende Tests). **Ausweis V1-Abschlussprüfung (2026-07-20):** T6 (Fixkosten-Pauschale) gehört zum Fixkosten-Modul, das laut §2 nicht Teil von V1 ist – T6 wird mit diesem Modul in einer späteren Version automatisiert; der T4-Erwartungsteil „frei verfügbare Liquidität +100 €“ hängt an der in V1 nicht umgesetzten Kennzahl (M7-/M8-Nachtrag), der G6-Kern von T4 ist strukturell getestet.
2. Der Prüfkatalog des Skills `quality-check` (Finanzlogik, Datenspeicherung, Oberfläche) durchlaufen wurde und der Abschlussbericht keine offenen Fehler hoher Schwere enthält.
3. Die globalen Anforderungen G1–G12 in einem Review (Subagent `reviewer`) bestätigt wurden.
4. `README.md` die tatsächliche Bedienung beschreibt und `progress.md` aktualisiert ist (C1).

Nächster Schritt nach diesem Dokument: Entwurf des JSON-Datenmodells (`docs/data-model.md`) durch den **data-architect** – inkl. `schemaVersion`, Snapshot-/Zeitreihenstruktur (G3/G4), Zuflussarten, Profile, Ziele, Simulationen sowie der offenen Definitionsfragen aus `calculation-rules.md` Abschnitt 11.
