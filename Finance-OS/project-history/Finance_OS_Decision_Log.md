# Finance OS – Decision Log

Chronologische Liste der wichtigen Entscheidungen (Phasen 0–20). Raster je Eintrag: Hintergrund → Problem → Alternativen → gewählte Lösung → Begründung → Auswirkungen → betroffene Dateien → heutiger Status. Querverweise: [Development History](Finance_OS_Development_History.md), [Knowledge Base](Finance_OS_Knowledge_Base.md).

> Quellen: progress.md, docs/, Sitzungswissen M10–M17. Wörtliche Diskussionen der Phasen 0–12 waren in der Archivierungs-Sitzung nicht mehr verfügbar; die Entscheidungen selbst sind dokumentarisch gesichert.

---

## D1 – Dokumentation vor Code (Phase 0–5)

- **Hintergrund/Problem:** Widersprüchliche Finanznotizen; ohne geklärte Fakten wäre jeder Code auf Sand gebaut.
- **Alternativen:** Direkt losbauen und iterieren.
- **Lösung:** Fünf reine Doku-Phasen: Source Map mit Konfliktregister (K1–K16) → Nutzerentscheidungen U1/U2 → requirements (G1–G12) → Datenmodell → Formelkatalog mit nachgerechneten Sollwerten.
- **Begründung:** Finanzdaten verzeihen keine „ungefähr“-Implementierung; Sollwerte machen Fehler zu Testfehlern.
- **Auswirkungen:** Der gesamte Code entstand gegen vorab fixierte Zahlen; die Prüfkette konnte immer gegen Dokumente prüfen.
- **Dateien:** docs/investment-source-map.md, requirements.md, data-model.md, calculation-rules.md, storage-concept.md.
- **Status:** Fundament aller späteren Phasen; unverändert gültig.

## D2 – JSON-Datei als einzige dauerhafte Datenquelle (CLAUDE.md/Phase 3)

- **Problem:** Wo leben die Finanzdaten? Browser-Speicher ist bequem, aber flüchtig.
- **Alternativen:** localStorage/IndexedDB als Primärspeicher; Backend/Datenbank; Cloud.
- **Lösung:** Eine vom Nutzer gewählte JSON-Datei; localStorage höchstens für unkritische UI-Merker; kein Backend, keine Cloud, keine Netzwerkzugriffe.
- **Begründung:** Nutzerhoheit, Portabilität, „Cache-Löschung überlebbar“, Datenschutz.
- **Auswirkungen:** FSA-API + Download-Fallback, Import mit Vorschau, Auto-Backups; die gesamte Storage-Schicht (M1–M6) als erstes Codepaket.
- **Dateien:** src/storage/, src/state/, docs/storage-concept.md.
- **Status:** Kernprinzip, mehrfach reviewbestätigt.

## D3 – G1–G12 als globale, testbare Regeln (Phase 3)

- **Problem:** Doppelzählungs- und Automatik-Risiken zogen sich durch alle Quellen.
- **Lösung:** 12 globale Anforderungen (keine Automatik nach außen, Snapshot-Schutz, TR-Trennung, keine ING/Equatex-Doppelzählung, getrennte Kennzahlen, real/geglättet getrennt, Datenintegrität, nichts erfinden, Bestätigungspflichten).
- **Begründung:** Modul-Akzeptanzkriterien setzen sie voraus; jedes Review prüft gegen dieselbe Liste.
- **Auswirkungen:** In der V1-Abschlussprüfung wurde jede G-Regel einzeln mit Datei:Zeile-Beleg bestätigt.
- **Status:** Verbindlich; wörtlich in requirements §3.

## D4 – Keine ING/Equatex-Doppelzählung (U1, G7)

- **Hintergrund:** 75 €/Monat ING-Rücklage und 1.000 €/Jahr Equatex-Einzahlung sind **dieselben** Gelder.
- **Alternativen:** Monatlich 75 € als Sparleistung zählen; beides zählen.
- **Lösung:** Umbuchungs-flowTypes (`reserve_transfer`/`liquidity_transfer`) zählen nie; die eigene Telekom-Sparleistung zählt genau einmal – bei der Equatex-Einzahlung.
- **Begründung:** Alles andere wäre eine 900-€-Lüge pro Jahr (T1: 1.000, nicht 1.900).
- **Dateien:** src/finance/savings.ts, tests/finance/wealthAndSavings.test.ts (T1).
- **Status:** Getestet, unverrückbar.

## D5 – Zwei Kennzahlen: eigene Sparleistung vs. Gesamtzufluss (U1, G8)

- **Problem:** „Wie viel spare ich?“ hat zwei ehrliche Antworten (118,50 € eigenes Geld vs. 250 € Gesamtzufluss fest).
- **Lösung:** Beide Kennzahlen getrennt berechnen und anzeigen; Saveback = Anbieterleistung, Round-up = eigene Leistung, nie kombinierbar.
- **Auswirkungen:** Vier getrennte Dashboard-Kacheln; F8/F9 als getrennte Funktionen.
- **Status:** Kernkennzahlen der App.

## D6 – Vier-Ebenen-Architektur ohne Finanzlogik in React (Phase 3/6)

- **Lösung:** Storage → Provider → reine Finanzfunktionen → React-UI; Rechenfunktionen React-frei.
- **Begründung:** Testbarkeit und Nachrechenbarkeit; CLAUDE.md-Regel.
- **Auswirkungen:** 100 % der Formeln ohne DOM testbar; Seiten sind „nur Anzeige + Formulare“.
- **Status:** In der Abschlussprüfung per Import-Analyse bestätigt (kein React-Import in finance/data/validation/storage).

## D7 – Bewusst keine Fremdbibliotheken (Phase 6/9)

- **Alternativen:** react-router, UI-Kit, Chart-Bibliothek.
- **Lösung:** useState-Navigation über `pages.ts`; eigenes CSS; einziges Diagramm als handgerolltes Inline-SVG (nur Zusatz).
- **Begründung:** 9 feste Seiten brauchen keinen Router; jede Dependency ist Update-/Lizenz-Risiko; Diagramm darf nie Primärquelle sein (A11y).
- **Status:** Nur react/react-dom als Laufzeit-Dependencies.

## D8 – Vierstufige Ladevalidierung mit sicherem Fehlverhalten (Phase 4/7)

- **Lösung:** Stufen A–D (Format → Referenzen → Fachregeln → Schutzregeln), deutsche pfadgenaue Meldungen; Ablehnung lässt den Bestand referenzidentisch unverändert; abgelehnte Importe erzeugen nur einen importHistory-Eintrag ohne Dirty-Status.
- **Begründung:** G10 – ein Ladefehler darf nie Daten kosten.
- **Dateien:** src/validation/validateFinanceData.ts (1.600+ Zeilen), parseFinanceJson.ts, issues.ts.
- **Status:** 21 Fehler- + 5 Warnungscodes, verbindlich in data-model §5 katalogisiert.

## D9 – Unveränderliche Snapshots (G3/G4, DM21; Phasen 4/10/11)

- **Problem:** Historie muss vertrauenswürdig sein – auch gegen versehentliche Edits.
- **Lösung:** Snapshots werden mit Speicherung `locked`; jede Schreiboperation auf ein gesperrtes Datum wird von `lockedDates.ts` abgelehnt; Korrektur nur als neuer Snapshot; Rückdatierung nur mit Bestätigung.
- **Status:** Projektweit verdrahtet; T8/DM21-getestet.

## D10 – Kein-Löschen-Linie (Phase 10 ff.)

- **Lösung:** Konten/Positionen werden deaktiviert, Ziele archiviert – nie gelöscht (stabile Referenzen). Einzige dokumentierte Ausnahme: Simulationen (referenzlos) dürfen mit Bestätigung hart gelöscht werden (M13).
- **Begründung:** savingsPlans/weights/transactions referenzieren IDs; Löschen würde Historie zerreißen.
- **Status:** Projektmuster; in data-model §3.11 begründet.

## D11 – Injizierter Stichtag `todayIso` (Phase 12)

- **Hintergrund:** finance-analyst-Befund: Systemuhr im Fachcode macht Tests und Nachvollzug unzuverlässig.
- **Lösung:** Der Provider injiziert das Datum; Seiten/Funktionen nehmen es als Parameter.
- **Status:** Standard ab M7; Altlast in zwei M8/M9-Formular-Defaults (V1.x-17).

## D12 – U3: Primärer 1.000-€-Fortschritt = eigene REALE Monatsrate (Phase 13)

- **Alternativen:** Geglättete Rate (201,83); Gesamtzufluss; Mischwert.
- **Lösung:** Real 118,50/1.000 = 11,85 % als primärer Fortschritt; geglättet nur als gekennzeichneter Analysewert; extern/Umbuchung nie.
- **Begründung:** Das Ziel misst eigenes Verhalten, nicht Arbeitgeberglück; geglättete Werte sind Rechenkonstrukte.
- **Status:** Verbindliche Nutzerentscheidung; U3-Nachtrag in requirements M10.

## D13 – Bewusste Nicht-Anzeige der „ca. 260–265 €“-Schätzsumme (Phase 13)

- **Problem:** requirements verlangten eine Summe „inkl. typischer variabler Zuflüsse“ – ohne erfasste Istwerte.
- **Lösung:** Nicht anzeigen; Hinweis „zzgl. variable Zuflüsse (nicht garantiert)“; Nachrüstung erst mit transactions-Ist-Erfassung.
- **Begründung:** G11 – keine Finanzwerte erfinden.
- **Status:** Reviewer-Ausweis in requirements M10; V1.x-4.

## D14 – U4: own_variable mit festem positivem Betrag zählt (Phase 14)

- **Problem:** Letzte Grauzone der Sparleistung („variabler Plan mit festem Planbetrag“).
- **Lösung:** Gültiger positiver Betrag → zählt vollständig; null/0/negativ/nicht endlich → zählt nicht (defensiver 0-Guard statt Exception in savings/schedule; Validierung lehnt negative/nicht endliche Beträge ab).
- **Auswirkungen:** 12 Pflichttests; Grauzone projektweit entfernt.
- **Status:** Verbindliche Nutzerentscheidung; U4-Nachträge in requirements/calculation-rules.

## D15 – „Gespeichert wird Nutzerwille, abgeleitet wird Wahrheit“ (Phase 14)

- **Lösung:** `reached` wird nur als manueller Abschluss gespeichert; rechnerisch erreicht wird immer abgeleitet und fällt bei sinkendem Ist zurück; kein gespeicherter Fortschritt.
- **Begründung:** Keine Drift zwischen gespeichertem und wahrem Zustand.
- **Status:** Statusprinzip von M12; auch M13-Zielanalyse folgt ihm.

## D16 – Rebalancing: Konjunktiv-Pflicht + nur drei Stufen (Phase 15)

- **Alternativen:** Imperative Empfehlungen; zusätzliche „Beobachten“-Schwelle.
- **Lösung:** Ausschließlich „Wenn du … möchtest, könntest du …“; exakt die bestehenden actionLevel-Schwellen (5/10 Pp); Verkaufsoption nur bei Übergewichtung ≥ 10 Pp.
- **Begründung:** G1/G2 (nur Empfehlung); eine vierte Schwelle wäre quellenlos erfunden.
- **Status:** Sprachregel ist getestet.

## D17 – plannedChanges: verworfen bleibt verworfen (Phase 15)

- **Lösung:** Status `planned` → `discarded` additiv; kein Löschen, kein Zurücksetzen in V1.
- **Begründung:** G5-Schutz – eine einmal verworfene Planung soll nicht still reaktivierbar sein.
- **Status:** Dokumentiert als bewusstes Nicht-Feature.

## D18 – Simulator: startMonth = Folgemonat des Stichtags (Phase 16, Korrektur 2.1)

- **Problem:** Die Orchestrator-Spezifikation hätte den Stichtagsmonat mitprojiziert (Off-by-one).
- **Lösung:** data-architect-Korrektur; gepinnt mit dem 6-Monats-Sollwert 777,59/3.122,47/3.900,06, der den Fehler nicht überleben würde.
- **Status:** Verbindliche Konvention (F22-Anschluss).

## D19 – Simulator ohne Inflation/Rebalancing-Schalter/negative Rendite (Phase 16)

- **Begründung:** Nicht-Ziele der requirements sind ranghöher als Auftrags-Wunschlisten; ein Rebalancing-Schalter wäre im Aggregatmodell (nur Depot verzinst) eine Scheinfunktion.
- **Status:** Konflikt-Ausweise in requirements M13.

## D20 – Auto-Backup: everySave-Default, Byte-Identität, nie fatal (Phase 17, Korrektur Nr. 3 + A2–A8)

- **Problem:** Die eigene M14-Spezifikation schlug „kein Backup bei fehlendem Modus“ vor – gegen die dokumentierte Storage-Konzept-Vorgabe.
- **Lösung:** Fehlender Modus WIRKT als `everySave` (nie materialisiert, K2); Backup-Bytes = exakt der geschriebene JSON-String (A2); Backup-Fehler erzeugt nur einen Hinweis (A3); kein Backup im Download-Fallback (A4); manuelle Sicherung nie gegated (A5); keine „aus“-Option.
- **Status:** 12 autoBackup-Tests inkl. Byte-Identitäts- und Rundreise-Stop-Test.

## D21 – Ein einziger localStorage-Schlüssel (Phase 17, A5)

- **Lösung:** Allowlist mit exakt `financeos.lastAutoBackupDay`; alle Zugriffe try/catch; Privatmodus degradiert sicher.
- **Begründung:** CLAUDE.md erlaubt localStorage nur für Unkritisches; eine Allowlist macht das erzwingbar und testbar.
- **Dateien:** src/state/localStoragePolicy.ts (+ Pin in unsavedChanges.test).

## D22 – Zielprofil in V1 nur Auswahl, keine Bearbeitung (Phase 17)

- **Problem:** requirements-Eingaben nannten „bearbeiten“, der ratifizierte Auftrag „nur Auswahl“.
- **Lösung:** Auswahl mit G12-Bestätigung (+ Job-Warnung vor 2027-10-01 über todayIso); Bearbeitung als abnahme-relevanter Konflikt-Ausweis → V1.x-2.
- **Status:** Der ranghöhere ratifizierte Auftrag schlägt die ältere Formulierung – dokumentiert, nicht still.

## D23 – percentDecimals-Ganzzahl als einzige Ladeverschärfung (Phase 17, A6)

- **Begründung:** Verhindert einen Intl-Format-Crash; alle regelkonformen Altdateien laden unverändert; §6-Ausweis dokumentiert die Verschärfung.
- **Status:** Muster für „Verschärfung nur mit Ausweis + Altdatei-Nachweis“.

## D24 – V1-Abschlussprüfung: fehlende Zusagen ausweisen statt nachbauen (Phase 18)

- **Problem:** Strg+S, Snapshot-Verlaufsansicht und das Kennzahlen-Trio waren versprochen, aber nie gebaut – und nirgends begründet.
- **Alternativen:** Schnell nachimplementieren (verboten: „keine neuen Funktionen“) oder still lassen.
- **Lösung:** requirements-Nachträge + V1.x-Punkte + Korrektur des irreführenden UI-Hilfetexts (einziger Mini-Codeeingriff).
- **Status:** „Keine Requirement darf unbegründet fehlen“ wurde erfüllt – durch Begründung.

## D25 – Fehlercode-Katalog gehört in die Doku, nicht als toter Export in den Code (Phase 18)

- **Problem:** `ERROR_CODES`/`WARNING_CODES` waren nirgends referenziert (Codes leben als String-Literale); Entfernen riss aber die „verbindlicher Katalog“-Referenz.
- **Lösung:** Export entfernt, Katalog vollständig in data-model §5 nachgetragen (data-architect H1).
- **Status:** Eine Quelle der Wahrheit; keine Drift-Gefahr zwischen Katalog-Objekt und Literalen.

## D26 – Lizenz: „Alle Rechte vorbehalten“ statt erfundener Open-Source-Lizenz (Phase 19)

- **Begründung:** package.json `private: true`, reale Finanzdaten in Doku/Tests – eine MIT-Lizenz wäre falsch und gefährlich gewesen.
- **Dateien:** LICENSE, README, Manifest.
- **Status:** Option A des Auftrags, begründet gewählt.

## D27 – Backups sind selbst vertraulich (Phase 19, data-architect H1)

- **Problem:** Das Backup-Skript versprach „keine echten Finanzdaten“ – aber Doku/Tests/Beispieldatei BASIEREN auf den realen Werten.
- **Alternativen:** docs/tests aus dem Backup werfen (absurd für ein Quellcode-Backup) oder die Zusicherung korrigieren.
- **Lösung:** Ehrliche Vertraulichkeits-Kennzeichnung in Skriptkopf, Skriptausgabe, README, RELEASE_NOTES (+ progress.md in der Aufzählung, M17).
- **Status:** Lesson Learned Nr. 8; `.gitignore` schützt zusätzlich `user-data/*` (außer Beispieldatei) vor versehentlichem Commit.

## D28 – Stop-dev darf nie fremde Prozesse töten (Phase 19)

- **Lösung:** PID-Datei mit PID + Prozessname + Startzeit (+ projectRoot, M17); beendet wird nur der validierte Prozessbaum; im Zweifel nichts; nie `taskkill /IM node.exe`.
- **Begründung:** Windows vergibt PIDs neu; der Nutzer kann eigene Node-Prozesse laufen haben.
- **Status:** Grenzen ehrlich im Skriptkopf dokumentiert; real getestet.

## D29 – reference/-Tracking bleibt (Fall B, Phase 20)

- **Problem:** Echte Finanznotizen + private TXT sind seit dem Initial-Commit im (privaten) Repo.
- **Alternativen:** `git rm --cached` + Historien-Umschreibung.
- **Lösung:** Keine Secrets gefunden (Scan über Stand, Historie, PDF) → Tracking bleibt als bewusste Nutzerentscheidung; Artefakt-Ausschluss verifiziert; Rückbau-Befehl dokumentiert.
- **Begründung:** „Bestehende Daten nicht ohne ausdrückliche Anweisung löschen“ schlägt ein pauschales „mittel-Finding beheben“.
- **Status:** Offene, dokumentierte Nutzerentscheidung.

## D30 – Release-Dirty-Check auf das Projektverzeichnis gescopet (Phase 20)

- **Problem:** Ein fremder privater Ordner auf Repo-Ebene hätte den Release fälschlich „dirty“ gemacht.
- **Lösung:** `git status --porcelain -- .` aus der Projektwurzel; der minutenalte, nie gepushte Tag wurde einmalig transparent auf den Fix-Commit neu gesetzt.
- **Begründung:** Der Release beschreibt Finance-OS, nicht die Repo-Wurzel; Tag-Neusetzung war das kleinere Übel gegenüber einem Manifest, das nicht zum getaggten Stand passt.
- **Status:** Dokumentiert in progress.md Phase 20; kein Verstoß gegen „kein Überschreiben bestehender Tags“ (der Tag existierte vor M17 nicht).
