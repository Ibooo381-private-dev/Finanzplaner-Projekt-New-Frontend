# Finance OS – Fortschritt

## 2026-09-25 – Redesign der Oberfläche („Tinte & Papier“)

**Auftrag:** moderneres, übersichtlicheres und intuitiveres Frontend in der vom Nutzer vorgegebenen Farbwelt (Vorlage „Finanzplaner“: Tinte #1B2B34 auf Papier #EFF1EC, blau hinterlegte Eingaben, grünlich hinterlegte Rechenwerte, Serifen-Überschriften), klarere Button-Beschriftungen – bei **unveränderter Funktionsweise**. Branch `claude/elegant-maxwell-8l6ikk`.

- **Design-System** (`src/index.css`, dokumentiert in `docs/design-system.md`): Farb-Tokens mit nachgerechnetem WCAG-AA-Kontrast (Vorlagen-Gelb und Eingaberahmen dafür abgedunkelt), Button-Hierarchie primär/sekundär/Gefahr/leise, Karten, Status-Plaketten, Zahlenspalten (`.num`), gestaltete Erklärblöcke, Formulare, Fortschrittsbalken. Nur helles Farbschema. Keine neuen Abhängigkeiten, keine Webfonts.
- **App-Rahmen:** Kopfbereich mit Status-Pille und „In Datei speichern“ auf jeder Seite (dieselbe `saveDirect`-Aktion; ohne Save-Picker „Als Download speichern“), gruppierte Seitenleiste (Start · Vermögen · Planung · Verwaltung, Reihenfolge unverändert) mit Inline-SVG-Icons, Skip-Link, Fokus/Scroll beim Seitenwechsel, globale Meldung fehlgeschlagener Datei-Vorgänge. Breite Tabellen: Aktionsspalte bleibt beim waagerechten Scrollen sichtbar (Desktop).
- **Startzustand:** gemeinsame Komponente `StartHint` statt 8 Kopien; „Datei öffnen …“ und „Neue leere Datei anlegen“ direkt auf jeder Seite.
- **Übersicht:** Gesamtvermögen als Blickfang mit Aufteilungsband Depot/Tagesgeld (dekorativ, Anteile als Text), Ziel-Status als Plaketten, aufgabenorientierter Schnellzugriff; Dateistatus nach unten.
- **Daten & Backups:** Aktionen in Aufgaben-Karten (Öffnen & neu anlegen · Speichern · Exportieren & sichern · Importieren); Fehlerlisten zeigen Klartext zuerst, Code/Pfad als technisches Detail.
- **Beschriftungen:** „Speichern“ ist der Datei vorbehalten. Formulare heißen „<Objekt> anlegen“ / „Änderungen übernehmen“ / „Wert übernehmen“ / „Snapshot übernehmen“; weitere: „Bestand durch Import ersetzen“, „Import abbrechen“, „Vorschau schließen“, „Kopie exportieren (Download)“, „Neue leere Datei anlegen“, „Datei öffnen …“, „Als geplante Einstellung vormerken“ (Abschnitt „Vorgemerkte Planungen“). Hinweistexte, die Buttons zitieren, wurden angepasst; README und USER_GUIDE beschreiben die neue Bedienung.
- **Kleine Korrekturen im Zuge des Redesigns:** Konten zeigen „Letzte Aktualisierung“ jetzt im deutschen Datumsformat (vorher ISO-Rohtext); die Linienmuster der Simulator-Legende wurden von der Diagramm-Regel nicht mehr auf volle Breite gezogen.
- **Nicht geändert:** Finanzlogik (`src/finance`), Datenfunktionen (`src/data`), Datenmodell/Schema, Validierung, Speicher-/Importabläufe, Handler, Bestätigungsdialoge (außer Texten, die umbenannte Buttons zitieren), Fokusführung, `id`s/`aria-*`.
- **Tests:** 819 → **853 grün (37 Dateien)**; angepasst wurden nur erwartete Beschriftungen, neu sind u. a. Tests für Kopfbereich-Speichern, StartHint-Direktaktionen, Navigationsgruppen, Vermögensband, Button-Hierarchie, Zahlenspalten und Plaketten. Lint ✓, Build ✓ (Hinweis: JS-Bundle 502 kB, knapp über Vites 500-kB-Empfehlung – nur Warnung). Zusätzlich End-to-End-Durchlauf im echten Chromium (Playwright, 17 Prüfpunkte: Startzustand, neue Datei, Import mit Vorschau, Konto anlegen + Wert übernehmen, Position, Ziel, Simulation, Einstellungen, Export mit Inhaltsprüfung und Rundreise-Import, Speichern-Button auf allen Seiten; keine Konsolenfehler) sowie Sichtprüfung bei 1400 px und 390 px Breite und Tastaturprüfung (Skip-Link, Fokusrahmen).

## 2026-07-21 – Bugfix: Escape-Bubbling aus nativen Select-/Datums-Popups schloss offene Formulare (4 Seiten)

**Gemeldetes Symptom:** Im Ziele-Formular ließen sich Einträge der Dropdowns „Konto"/„Depotposition" teilweise nicht auswählen bzw. die Auswahl wurde „nicht übernommen". **Reproduktion:** In jsdem sind alle Optionen wählbar (eigener Durchwahl-Test aller Konten/Positionen grün) – der Fehler ist ein Echtbrowser-Fall: Schließt der Nutzer das native Select-Popup (oder den Datumspicker) mit **Escape**, bubbelt das keydown in Chromium vom `<select>` zur Seite hoch; der sektionsweite Escape-Handler schloss dann das GESAMTE Formular samt Eingaben – für den Nutzer sah das wie „Auswahl nicht übernommen" aus (in jsdom via `fireEvent.keyDown(select, Escape)` reproduziert, Test war rot).

**Ursache/Reichweite:** Der identische `handleKeyDown`-Escape-Handler existierte auf **GoalsPage, DepotPage, SimulatorPage und SavingsPlansPage** (alle Editor-Seiten mit Selects/Datumsfeldern). Auf der SettingsPage war GENAU dieses Muster im M14-Accessibility-Review als B3 erkannt und entfernt worden („Escape kann aus Select/IME bubbeln") – die Nachrüstung der vier älteren Seiten fehlte damals als Restpunkt. Kein gemeinsames Dropdown-Component (alle 18 Selects der App sind native Controlled-Selects); RebalancingPage/AccountsPage/SettingsPage haben keinen solchen Handler und sind nicht betroffen.

**Fix (minimalinvasiv, Ursachen-Ebene):** Der Escape-Handler ignoriert Events, deren `target` ein `<select>` oder `input[type=date]` ist – Escape schließt dort nur das native Popup; von allen anderen Feldern aus schließt Escape das Formular unverändert (bestehende Escape-Tests feuern auf Text-Inputs/Formular und bleiben grün). Bewusster Mini-Trade-off: Mit Fokus AUF einem Select/Datumsfeld schließt Escape das Formular nicht mehr (erst Tab) – das ist das etablierte Muster für dieses Chromium-Verhalten.

**Tests:** +4 dauerhafte Regressionstests (je Seite „Escape aus einem Select des Formulars schließt das Formular NICHT"; GoalsPage zusätzlich mit Auswahl-Erhalt und Kontrastfall „Escape auf dem Namensfeld schließt weiterhin"). Temporärer Reproduktionstest (Durchwahl ALLER Konto-/Positions-Optionen, gemeldete Wechsel-Sequenz, alle Zielarten) nach Bestätigung wieder entfernt. **Endstand: 819/819 Tests grün (37 Dateien), Build ✓, Lint ✓.** Geänderte Dateien: die 4 Seiten (nur der Handler) + 4 Testdateien; keine Daten-/Finanzlogik berührt.

## 2026-07-21 – Phase 20: Lokale Finalabnahme und privater Projektabschluss (M17) – **v1.0.0 LOKAL FINAL FREIGEGEBEN**

**Status: Finance OS v1.0.0 – lokal final freigegeben – privates persönliches Projekt.** Release-Commits: „chore: finalize local Finance OS v1.0.0 release“ (79f1090) + dieser Finalisierungs-Nachtrag (Dirty-Check des Release-Skripts auf das Projektverzeichnis gescopet, da die Repo-Wurzel private Ordner außerhalb der App enthält; trägt den annotierten **lokalen** Tag `v1.0.0` – der Minuten zuvor auf 79f1090 gesetzte, nie gepushte Tag wurde dafür einmalig lokal neu gesetzt, transparent dokumentiert). **Push-Status: nicht durchgeführt** (master bleibt vor origin/master; kein Tag hochgeladen). **Veröffentlichungsstatus: nicht veröffentlicht** – kein GitHub-Release, kein Upload, Remote unverändert (nur lesend geprüft).

- **Datenschutz-/Tracking-Entscheidung (Fall B):** Secrets-Scans über die Arbeitskopie UND alle Commits (git grep über rev-list --all) sowie eine zlib-Streamextraktion der 94,7-MB-PDF in reference\: **keine** Passwörter/Tokens/API-Keys/Private Keys/IBANs/BIC/Kontonummern/Telefonnummern/Adressen (E-Mail-„Treffer“ in der PDF = Binärmüll aus Bildströmen; unabhängig vom Security-Review reproduziert). `reference\` (11 Dateien echter Finanznotizen) und `wie starte ich im daily use.txt` bleiben bewusst git-getrackt (Nutzerentscheidung, privates Remote; Rückbau-Befehl siehe Phase-19-Eintrag) und sind nachweislich aus Release und Backup ausgeschlossen. Keine Historien-Umschreibung, nichts gelöscht.
- **Neue Doku:** RELEASE_NOTES.md, docs/USER_GUIDE.md (28 Punkte, gegen die echte App verifiziert), docs/V1_X_ROADMAP.md (nur dokumentierte Restpunkte, nichts zugesagt); README-/CHANGELOG-Finalstatus; package-lock.json 0.1.0 → 1.0.0 synchronisiert (`npm install --package-lock-only`); release.ps1 erzeugt das M17-Manifest-Schema (releaseType local-final, privacyMode private-local-only, gitTag/tagScope/pushed real per git ermittelt, published false, Testzahlen aus dem realen Lauf geparst, smokeTestStatus-Parameter, excludedPrivatePaths, confidentialityNotice) und packt RELEASE_NOTES + USER_GUIDE als Pflichtdateien ins Release.
- **Smoke-Test (ehrlich):** Dev-Server über scripts\start-dev.bat (HTTP 200); **Headless-Edge (Chromium)** rendert die App real (Leerzustand „Keine Finanzdaten geladen“ + alle 9 Navigationspunkte im DOM); Produktions-Build über `npm run preview` (HTTP 200 + Headless-Render „Finance OS“/Leerzustand); file://-Grenze per index.html-Inspektion belegt (type=module, absolute /assets-Pfade). **Firefox headless: nicht ausführbar** (Prozess hängt ohne Screenshot – als nicht getestet markiert; der Firefox-Fallback-Pfad ist über die automatisierten Fallback-Tests abgedeckt, eine manuelle Firefox-Bedienprüfung steht aus). **Interaktive Bedienabläufe (Dateiflüsse, Fachseiten, A11y) wurden NICHT manuell im Browser durchgeklickt**, sondern sind durch die 815 automatisierten RTL-Tests abgedeckt (Zuordnung je Pflichtablauf im M17-Abschlussbericht; A11y-Muster-Zuordnung im Accessibility-Finalreview). **Bundle-Scan mit Ausweis:** keine Personennamen, keine ISIN-Werte, keine IBANs/E-Mails; enthalten sind aber die fachlichen Begriffe „Telekom“ (49 Vorkommen: Anlageklasse/Modus/Labels), „ING-Rücklage“ und „Shares2you“ (Hilfetexte), der dokumentierte Netto-Default 1170, die Telekom-Jahreskonstante 1.500 = 1.000 + 500 und zwei „z. B.“-Beispieltexte mit den Seed-Zahlen 627,59/2.522,47 („ING“-27×-Treffer sind nur Substrings von E_MISSING_KEY/E_WRONG_TYPE) – ausgewiesen in README „Umgang mit echten Finanzdaten“; Generische-Beispielzahlen-Kosmetik = V1.x-Punkt 25.
- **Gesamtprüfung:** npm test **815/815 (37 Dateien)**, Lint ✓, Build ✓, scripts\check-all.bat ✓ – nach gezielter Härtung des lastabhängigen appLayout-Flakes (ein `it` rendert alle 9 Seiten; jetzt `{ timeout: 30000 }` mit Begründungskommentar; Assertions unverändert – vom Reviewer als legitime Härtung bestätigt).
- **Finalreviews (alle 4: JA):** **data-architect** (Datenmodell seit be83794 byte-identisch, schemaVersion 1, Beispieldatei unverändert, Manifest nur reale Werte; Auflage Reihenfolge Commit→Tag→Release: eingehalten; N2 Backup-Positivliste um RELEASE_NOTES ergänzt ✓, N4 pushed=null bei Git-Fehler ✓) → **Security/Privacy** (keine Secrets in Stand+Historie+PDF; Release ohne private Dateien; Backup „JA – bewusst und ausgewiesen“ vertraulich; keinerlei Netzwerkaktionen in Skripten/App/Bundle – einziges fetch = Vite-Preload-Polyfill; Auflagen = Commit/Tag + Release-Neubau: erfüllt; progress.md in die Vertraulichkeits-Aufzählung aufgenommen ✓) → **accessibility-review** (keine Regressionen; beide Textänderungen musterkonform; Kernmuster testevident; USER_GUIDE-Zusagen gedeckt; Checkbox-Hint-Verknüpfung → in V1.x-Punkt 20 aufgenommen) → **reviewer** („Lokale finale Freigabe v1.0.0: JA mit Auflagen“; M-1 README-Bundle-Satz qualifiziert ✓, M-2 Telekom-Ausweis in diesem Eintrag ✓, N-2 USER_GUIDE „pausieren“ ✓, N-1/N-3/N-4 über die mechanischen Abschluss-Schritte erledigt).
- **Finale Artefakte (nach Commit + Tag erzeugt):** releases\finance-os-v1.0.0\ + .zip (Manifest: gitTag v1.0.0, tagScope local-only, pushed false, published false, dirty false, 815/815; Inhalt: app\, README, CHANGELOG, LICENSE, RELEASE_NOTES, RELEASE-HINWEISE, docs\USER_GUIDE, Manifest – ZIP-validiert, keine verbotenen Einträge) und ein validiertes Quellcode-Backup in project-backups\.
- **Bekannte Einschränkungen:** unverändert README „Bekannte Einschränkungen (V1)“; offene Punkte ausschließlich in „V1.x – Offene Punkte“ (unten) + docs/V1_X_ROADMAP.md.

## 2026-07-20 – Phase 19: Release Engineering & Entwickler-Workflow (M16, abgeschlossen, Freigabe)

Reines Tooling/Doku-Modul – keine Finanzfunktionen, keine V1.x-Punkte, `src/` unverändert. **Commit `be83794` „chore: complete Finance OS v1 release tooling"** (17 Dateien, +878/−5); Arbeitskopie danach sauber; kein Push, kein Tag.

- **Skripte `scripts/`** (9 .bat-Einstiegspunkte + 3 PowerShell-Helfer, alle arbeitsverzeichnis-unabhängig via `%~dp0`, leerzeichenfest, Exitcode-treu mit `if not "%ERRORLEVEL%"=="0"`): start-dev/stop-dev (PID-Datei `.runtime\dev-server.pid`; beendet NUR den eigenen Prozessbaum nach PID+Prozessname+Startzeit+projectRoot-Abgleich, nie `taskkill /IM node.exe`; Doppelstart-Blockade; Grenzen ehrlich im Kopfkommentar), test/lint/build, check-all (ruft die Einzelskripte, bricht beim ersten Fehler ab), clean (nur dist\ + .runtime\, PID-Schutzabbruch bei laufendem Server; `--full` = node_modules nur nach J-Bestätigung; nie Nutzer-/Finanzdaten), backup-project (Positivlisten-Staging in %TEMP%, ZIP-Validierung mit Verbotsliste und Löschung bei Befund/Abbruch), release (Dirty-Schutz mit `--allow-dirty`-Kennzeichnung im Manifest, Überschreib-Bestätigung, Staging-Swap erst nach Validierung, `release-manifest.json` nur mit echten Laufwerten, ZIP; keine Pushes/Tags).
- **Doku:** CHANGELOG.md (Keep-a-Changelog, 1.0.0), LICENSE („Alle Rechte vorbehalten", Option A – konsistent zu `private: true`, bewusst KEINE Open-Source-Lizenz), README-Abschnitte Entwickler-Workflow/Troubleshooting/„Umgang mit echten Finanzdaten"; npm-Skript `check`.
- **.gitignore-Schutz:** `.runtime/`, `project-backups/`, `releases/`, `backups/` sowie `user-data/*` mit Ausnahme `!user-data/*.example.json` (data-architect H2 – echte Finanzdateien können nicht mehr versehentlich committet werden; GitHub-Remote existiert).
- **Prüfkette:** data-architect (Dateisicherheit; Mechanik bestätigt, H1/H2 + M2 + 5 niedrige → ALLE behoben: Vertraulichkeits-Klarstellung [docs/tests/Beispieldatei basieren auf realen Finanzwerten → Backup vertraulich, Zusicherungstexte korrigiert], gitignore-Regel, Release-Staging-Swap mit Bestätigung, Teil-ZIP-Aufräumung, DateTime-Parse im try, projectRoot-Abgleich, clean-PID-Schutz, Metadaten-Exitcode-Checks) → reviewer (**Freigabe JA ohne Auflagen**; M-1 README-Präzisierung + N-1–N-5 ebenfalls umgesetzt: toter RELEASE_NOTES-Zweig entfernt, robustere Errorlevel-Prüfung, public\-leer-Hinweis, 2-s-Heuristik im Troubleshooting, Manifest-Selbstlistung).
- **Skripttests (real ausgeführt):** fremdes Arbeitsverzeichnis; absichtlicher Testfehler → Exit 1; Server-Start (HTTP 200) + Doppelstart-Blockade + Stop nur des eigenen Baums + fehlende/veraltete PID-Datei; clean schont user-data/reference/backups, `--full` mit N; Backup-ZIP validiert (129 Einträge, dabei Regex-Bug `\.git`→`.gitignore` gefunden und behoben); Release-Dirty-Abbruch, Ablehnungspfad der Überschreib-Bestätigung, zwei volle Release-Läufe; check-all grün.
- **Offen ausgewiesen (Nutzerentscheidung, bewusst NICHT geändert):** `reference/` (echte Finanznotizen) und „wie starte ich im daily use.txt" sind seit dem Initial-Commit git-getrackt und liegen auf dem privaten GitHub-Remote; Entfernen aus der Versionierung wäre `git rm -r --cached reference "wie starte ich im daily use.txt"` + Commit (Dateien bleiben lokal erhalten) – bis zur Entscheidung dokumentierte Vertraulichkeitsgrenze (README).
- **Endstand:** npm test **815/815 (37 Dateien)**, Build ✓, Lint ✓, `check-all.bat` ✓; finales Quellcode-Backup in `project-backups\` (validiert); finaler Release `releases\finance-os-v1.0.0\` + ZIP mit Manifest **dirty=False**.

## 2026-07-20 – Phase 18: V1-Abschlussprüfung (FEATURE COMPLETE)

Übergreifende Abschlussprüfung nach requirements §5 – keine neuen Funktionen, nur Prüfung, Bereinigung und Doku. Prüfschritte: vollständiger Soll-Ist-Abgleich aller sechs Dokumente gegen die Implementierung; Architekturprüfung (madge: 0 Circular Dependencies ab src/main.tsx; tote Exporte entfernt: `ERROR_CODES`/`WARNING_CODES`-Katalog in issues.ts [Codes leben als String-Literale, verbindlicher Katalog jetzt in data-model §5], `pageLabel`, `SnapshotSubmitOutcome`, `makeTextFile`); Codequalität (keine TODO/FIXME/HACK/XXX, keine console.*, kein auskommentierter Code); README + Version (package.json **1.0.0**, Abschnitte „Bekannte Einschränkungen (V1)" und „Version und Lizenz"); konsolidierter V1.x-Abschnitt (oben); leere docs/testing-strategy.md mit dem Ist-Stand befüllt.

**Review-Kette der Abschlussprüfung:** **data-architect** („Datenmodell V1-abnahmefähig: JA"; H1 = Fehlercode-Katalog in data-model §5 nachgetragen [21 Fehler- + 5 Warnungscodes]; M1 = DM12-/§6-Präzisierung „Migrationsangebot ab schemaVersion ≥ 2, in V1 harte sichere Ablehnung von Version < 1"; N1/N2 als V1.x-Punkte 18/24 ausgewiesen; Strukturen/Enums/Rundreise/IDs/Beispieldatei/localStorage-Politik vollständig bestätigt) → **reviewer** (**Freigabe „Feature Complete": JA** unter zwei Doku-Auflagen, beide umgesetzt: **A1** Kennzahlen-Trio Finanzvermögen/Anlagevermögen/freie Liquidität als M7-/M8-Nachtrag + V1.x-Punkt 23 ausgewiesen und der irreführende AccountsPage-Hilfetext korrigiert; **A2** T6-Ausnahme in §5.1 ausgewiesen [Fixkosten kein V1-Modul] inkl. T4-Teilausweis. G1–G12 einzeln am Code belegt; T1–T9 den Testdateien zugeordnet; 10 Soll-Ist-Stichproben quer über M1–M14 bestanden; M2-/M9-Nachträge sachlich bestätigt).

**Soll-Ist-Ergebnis:** Alle Anforderungen sind erfüllt oder als bewusste, begründete Abweichung dokumentiert; unbegründet fehlend war vor der Prüfung nur das Trio M2-Strg+S / M9-Snapshot-Verlaufsansicht+Vergleich / M7-M8-Kennzahlen-Trio – alle drei jetzt als requirements-Nachträge + V1.x-Punkte 6/7/23 ausgewiesen. Widersprüche: keine verbliebenen (DM12 präzisiert, §5-Katalog nachgetragen, AccountsPage-Hilfetext korrigiert, V1.x-Punkte 1/17 aktualisiert).

**Endstand: 815/815 Tests grün (37 Dateien), Build ✓, Lint ✓, Version 1.0.0 – Finance OS ist FEATURE COMPLETE.** Einziger verbleibender Schritt vor der formalen V1-Abnahme: der Abschluss-Commit der Abschlussprüfungs-Änderungen (V1.x-Punkt 1).

## V1.x – Offene Punkte (konsolidiert, V1-Abschlussprüfung 2026-07-20)

Sämtliche bekannten Restpunkte aus den Phasen 1–17 und der V1-Abschlussprüfung, konsolidiert. **Keiner ist blockierend**; bewusste Nicht-Ziele (z. B. kein Zurücksetzen verworfener Planungen, keine Pausen-Historie, keine „aus"-Option für Auto-Backups) sind KEINE V1.x-Punkte, sondern in den Modul-Phasen als Entscheidungen dokumentiert. Nur dokumentiert – nichts davon ist in V1 zu implementieren.

**Organisatorisch**

1. Abschluss-Commit: Checkpoint-Commits existieren (zuletzt „checkpoint 6“, 2026-07-20); uncommittet sind nur noch die Änderungen der V1-Abschlussprüfung (Doku-Nachträge, README/Version, tote-Export-Bereinigung). Vor der V1-Abnahme committen.

**Fachlich/Funktional (spätere Ausbaustufen)**

2. Zielprofil-Bearbeitung und „Eigene Aufteilung"/Ebene B befüllen (abnahme-relevanter Konflikt-Ausweis, requirements M14-Nachtrag).
3. Sicherungsverzeichnis (`showDirectoryPicker`) + durchsetzbare Aufbewahrungsanzahl; V1 ist bewusst der Download-Weg.
4. Ist-Erfassung variabler Zuflüsse über `transactions` (M10, Datenmodell existiert); damit verbunden die bewusst nicht angezeigte „ca. 260–265 €"-Schätzsumme.
5. CSV-Export (optionaler M3-Punkt, in M14 bewusst zurückgestellt); PDF bleibt Nicht-Ziel.
6. Tastenkürzel Strg+S für „Speichern" (requirements M2-Nachtrag der Abschlussprüfung; Speichern per Button erfüllt die M2-Akzeptanzkriterien).
7. Snapshot-Verlaufs-Ansicht und Vergleich zweier Snapshots (requirements M9-Nachtrag der Abschlussprüfung; die Daten-Historie ist vollständig, es fehlt nur die Ansicht).
8. Notgroschen-Folgeziel-Vorschlagsliste nach Zielerreichung (M12; Statusanzeige existiert).
9. Positionsgruppe „Sonstige" (M9; Nutzer-Fachentscheidung nötig, betrifft Zielprofile/World-Aggregation).
10. W4-Präzisierung: nach einem Snapshot neu angelegte/reaktivierte Positionen lassen ältere gesperrte Snapshots dauerhaft als „unvollständig" warnen (nur Warnebene; spätere data-architect-Entscheidung).
11. i18n-Umsetzung (`numberLocale`-Schreibpfad; V1 fest de-DE/EUR/TT.MM.JJJJ, nur Architektur vorbereitet).
23. Kennzahlen **Finanzvermögen / Anlagevermögen / frei verfügbare Liquidität** als berechnete Anzeigen (requirements M7-/M8-Nachtrag der Abschlussprüfung; Datenbasis über `countsAsFreeLiquidity`/`includeInInvestedWealth` vollständig vorbereitet, Definitionen data-model §4/DM7; damit auch der T4-Erwartungsteil „freie Liquidität +100 €“ automatisierbar). T6 (Fixkosten-Pauschale) folgt mit dem Fixkosten-Modul (kein V1-Modul, §5.1-Ausweis).

**Technisch/Code (Refactoring-Kandidaten ohne Verhaltensänderung)**

12. `formatShare`/`amountToInputText`-Helfer inzwischen siebenfach je Seite → nach `src/format` extrahieren.
13. DepotPage-Zielvergleich auf `calculateRebalancingAnalysis` konsolidieren (identische Formeln, reines Dedup).
14. Summenzeilen-/Karten-Aggregationen (M11/M12/M13-Tabellen, Ziel-Zusammenfassung) als Analyse-Felder der reinen Schicht extrahieren.
15. `TELEKOM_ANNUAL_EVENT`-Konstante parametrisierbar machen (dokumentierte Konstante in projection.ts).
16. `updateSimulation` trimmt den Namen auch bei reinen params-Patches (N3-Normalisierungslinie).
17. `localTodayIso` in AccountsPage/DepotPage auf den injizierten `todayIso` umstellen – betrifft Formular-Datums-Defaults UND die Zukunftsdatums-Validierung von `captureSnapshot` (DepotPage übergibt `localTodayIso()` als Stichtag).
18. M8-Altpunkte: `collectAllIds` doppelt (accounts.ts + Provider); `updateAccount` trimmt Texteingaben nicht; DATA_CHANGED räumt veraltete Warnungen (z. B. W_EMPTY_HISTORY) nicht auf; Konto-Notiz nur im Formular sichtbar; K2-Guard fehlt in den M8/M9-Formular-Edits (AccountsPage/DepotPage übergeben immer alle optionalen Felder – ein reiner Namens-Edit materialisiert fehlende Schlüssel wie `purpose: null` als Default; Rundreise Laden→Speichern bleibt Byte-identisch, data-architect-Ausweis N1 der Abschlussprüfung).
19. Fehlertext-Kosmetik: captureSnapshot enthält ISO-Rohdaten; `E_AMOUNT_NULL`-Wiederverwendung für dueMonth-/validUntil-Prüfungen.
24. §3.1-Festwerte (`metadata.currency` „fest EUR“, `appName`) werden beim Laden nur als String geprüft, nicht erzwungen – die App rendert ohnehin fest de-DE/EUR (data-architect-Ausweis N2 der Abschlussprüfung; nur Ausweis, keine Änderung gefordert).
25. Bundle-Kosmetik (M17-Finalreviews): die „z. B. 627,59“/„z. B. 2.522,47“-Beispieltexte des Simulators auf erkennbar fiktive Werte ändern; UI-Begriffe „ING-Rücklage“/„Shares2you“ in Hilfetexten neutralisierbar (fachlich gewollt, nur falls je eine Weitergabe ansteht).
26. release.ps1-Randfälle (data-architect M17, niedrig): Swap-Restfenster zwischen Remove-Item und Move-Item (Alt-ZIP überlebt als letzte Kopie); `tagScope` ist gesetzt statt gemessen; bei mehreren Tags auf HEAD wird nur der erste übernommen; release.bat reicht `-SmokeTestStatus` nicht durch (direkter ps1-Aufruf nötig).

**A11y/UI (Muster-Nachrüstung in Altseiten)**

20. B3-Fehlerfeld-Fokus, B6-fokussierbare Tabellen-Region und Pflichtfeld-Legende in den älteren Formularen (AccountsPage/DepotPage) nachrüsten; `disabled={isSaving}`-Fokusverlust-Muster projektweit vereinheitlichen; dabei auch die AccountsPage-Checkbox-Hilfetexte per aria-describedby verknüpfen (Accessibility-Finalreview M17).
21. M9-Kleinpunkte: Spez-Kürzel/ISO-Daten in einzelnen Fehlertexten, kein dynamischer „wird ersetzt"-Marker in der Einzelwert-Erfassung, Sortierpfeile im Button-Namen, Snapshot-Datumsfehler als Sammel-Alert, Teilsummen-Marker nur an der Ist-Spalte, Fehlertext bei leerer Kontoauswahl.
22. Sparraten-Analysequote uneinheitlich als €- bzw. %-Darstellung je Seite (M12; kein Verstoß).

## 2026-07-20 – Phase 17: Modul „Einstellungen & Datenverwaltung" (M14, abgeschlossen, Freigabe – LETZTES V1-Modul)

Implementierung exakt nach der data-architect-ratifizierten Spezifikation (KORREKTUR Nr. 3 + Auflagen A2–A8); Skills finance-rules, frontend-design und quality-check angewendet. Damit sind **alle 14 V1-Module** umgesetzt – die App enthält keinen Platzhalter mehr.

Vollständige Prüfkette durchlaufen: **data-architect** (ratifiziert mit KORREKTUR Nr. 3 + Auflagen A2–A8) → **frontend-developer** (Implementierung) → **finance-analyst** + **accessibility-review** (Befunde B1–B9 und Grauzonen 10–14, alle behoben – siehe unten) → **calculation-tester** (alle Nachrechnungen ohne Abweichung; Testlücken geschlossen: saveAs-Auto-Backup Byte-identisch, Tagesmerker-Randfälle [ungültiger Wert liest als null, Schreibfehler wirft nie], Budget-Grenzfall 118 knapp unter 118,50 → Warnung, percentDecimals-0-Anzeigetest „80 %" auf der Übersicht) → **reviewer** (**FREIGABE ohne blockierende Auflagen**; 0 kritisch, 0 mittel; K-1 Retention-Label präzisiert [„leer" = keine Änderung eines gespeicherten Werts, Label/Hinweis/Fehlertext angepasst], K-2 nicht mehr referenzierte `PlaceholderPage.tsx` gelöscht, K-3 = formatShare-Restpunkt Nr. 3 bestätigt).

### Prüfketten-Nachbesserungen (finance-analyst + accessibility-review, behoben 2026-07-20)

- **B1 (mittel):** Nach „Einstellungen übernehmen" landet der Fokus gezielt auf der Erfolgs-Statusmeldung (tabIndex −1 + ref, requestAnimationFrame) – der key-Remount des Formulars wirft ihn nie mehr auf document.body; Fokus-Test (waitFor) ergänzt.
- **B2 (mittel):** Nach erfolgreichem Override-Zurücksetzen (der Button verschwindet) wandert der Fokus auf den bestehen bleibenden Anker (Override-Eingabefeld, M13-Muster); Fokus-Test ergänzt.
- **B3 (mittel):** Globaler Escape-Handler ENTFERNT (das immer offene Formular ist kein Dialog/Editor; Escape kann aus Select/IME bubbeln) – **gewollte Musterangleichung, der Escape-Seitentest wurde entsprechend umgeschrieben** (Escape setzt nicht mehr zurück); „Eingaben verwerfen" meldet jetzt per role=status „Eingaben auf den gespeicherten Stand zurückgesetzt." und bleibt bei unveränderten Werten ein No-Op (getestet).
- **B4 (klein):** submitError-Sammelmeldung mit tabIndex −1 + ref + Fokus (GoalsPage-Muster).
- **B5 (klein):** Dezimalstellen-Select mit aria-invalid/aria-describedby-Umschaltung auf die Fehler-ID; aria-Verdrahtungstest ergänzt.
- **B6 (klein):** Zielprofil-Fehler („Bitte zuerst ein Zielprofil wählen." und Datenlayer-Fehler) jetzt feldnah am Select (id settings-profile-error, aria-invalid/aria-describedby) + Fokus aufs Select; Test ergänzt.
- **B7 (klein):** Direktlink „Zu ‚Daten & Backups'" zusätzlich in der Sektion „Sicherung & Wiederherstellung" (Wiederherstellungsweg ohne Sektionswechsel).
- **B8 (klein):** `.form-actions` mit flex-wrap; in der ≤30rem-Media-Query gestapelt.
- **B9 (klein):** localStorage-Schlüsselname aus dem Endnutzertext entfernt – umschrieben als „ein einzelner Tagesmerker dieses Geräts" (Schlüssel bleibt in localStoragePolicy.ts/storage-concept dokumentiert); Test prüft die Abwesenheit des technischen Namens.
- **Grauzone 10 (niedrig):** percentDecimals geht nur noch in den Patch, wenn der Wert vom gespeicherten Stand abweicht – ein unverändertes Übernehmen materialisiert bei Minimaldateien ohne display-Block nichts (K2-Linie); UI-Regressionstest „Datei ohne display-Block + unverändertes Übernehmen → Byte-identisch" ergänzt.
- **Grauzone 11 (niedrig):** Notgroschen-Vorschau rechnet bei Faktor außerhalb 3–5 weiter, trägt aber den Hinweis „außerhalb des zulässigen Bereichs 3–5 – wird beim Übernehmen abgelehnt" (Test ergänzt).
- **Grauzone 12 (niedrig):** percentDecimals-Hinweis präzisiert: „gilt für alle Anteils- und Abweichungsanzeigen der App; die Renditeeingabe des Simulators ist eine Parameter-Anzeige".
- **Grauzone 13 (niedrig):** storage-concept §5 stellt jetzt VOR den Zielkonzept-Bullets klar, dass der V1-Umsetzungsabsatz sie übersteuert.
- **Grauzone 14 (niedrig):** Code-Kommentar in `src/data/settings.ts`, warum der Fehlertext zum nicht existenten Zielprofil bewusst OHNE Namen formuliert ist (ein nicht existentes Profil hat keinen Namen; jede Nennung wäre die verbotene technische ID oder erfunden).

### Verbindliche Entscheidungen (ratifiziert, dokumentiert)

- **KORREKTUR Nr. 3 – Backup-Default 'everySave':** fehlendes `backup.mode` WIRKT als 'everySave' (nur berechnet, nie materialisiert – K2); `shouldAutoBackup(undefined, …)` → **true**; bewusst KEINE „aus"-Option (Enum ohne Aus-Zustand, dokumentierte V1-Grenze); retentionCount Default 10 als reine Empfehlungs-Anzeige (bei Browser-Downloads nicht durchsetzbar).
- **A2–A4 – Auto-Backup:** Hook läuft NACH SAVE_SUCCEEDED (saveDirect UND „Speichern unter"), lädt EXAKT den bereits geschriebenen json-String herunter (Byte-identisch – nie backupDownload, das läse den alten State); try/catch – ein Backup-Fehler erzeugt nur einen Hinweis (OPERATION_FAILED) und lässt das Speichern nie scheitern; KEIN Backup beim Download-Fallback (EXPORT_MARKED_SAVED – der Export ist bereits die datierte Kopie), bei Dialog-Abbruch (SAVE_FINISHED) oder Schreibfehler (SAVE_FAILED).
- **A5 – localStorage-Gerätemarke:** `financeos.lastAutoBackupDay` (JJJJ-MM-TT) als EINZIGER Allowlist-Schlüssel in `localStoragePolicy.ts`; alle Zugriffe try/catch (Privatmodus degradiert sicher zu everySave-Verhalten); Merker wird nach jedem erfolgten Auto-Backup gesetzt, speist die Statuszeile (Tagesgranularität ausgewiesen) und gated NIE die manuelle Sicherung. Doku: storage-concept §1/§5 + data-model §3.2 (kein Dokument-Widerspruch).
- **A6 – percentDecimals Ganzzahl 0–4 = EINZIGE Ladeverschärfung** (E_SETTINGS_RANGE, §6-Ausweis; Beispieldatei/Seed = 2 laden unverändert; verhindert Intl-Format-Crash); alle übrigen Wertebereiche prüfte die Ladevalidierung bereits – die Schreibseite übernimmt sie identisch.
- **A7 – updateSettings-K2:** exakt das goals.ts-Muster (undefined = „nicht ändern"; Override-Reset = null, vorhandener Schlüssel bleibt als null; optionale Schlüssel/Blöcke werden nie als Default materialisiert; No-Op Byte-identisch); `numberLocale` hat KEINEN Schreibpfad – read-only-Zeile „de-DE/EUR/TT.MM.JJJJ – fest in V1" inkl. Klarstellung, dass ein abweichend gespeicherter Wert wirkungslos wäre.
- **A8 – Job-Profil-Warnung** (vor 2027-10-01) ausschließlich über den injizierten Stichtag (todayIso), sichtbar UND im G12-confirm.
- **Konflikt-Ausweise (dokumentiert, ABNAHME-RELEVANT):** KEINE Profilbearbeitung in V1 (Auftrag §6 „nur Auswahl" schlägt requirements-„bearbeiten"; Restpunkt V1.x – requirements-M14-Nachtrag), kein CSV/PDF/Cloud, keine i18n; keine Duplikat-Funktionsnamen (calculateEmergencyFund/effectiveEmergencyFund SIND effectiveEmergencyFundTarget; validateBackup/validateImport SIND parseFinanceJson/validateFinanceData; createBackup/restoreBackup = backupDownload + Import-Flow mit Vorschau, G10).
- **M10-Restpunkt eingelöst:** Budget-Warnung auf der SPARPLÄNE-Seite bei eigener fester Sparleistung (F8 real, ownMonthlySavings – keine zweite Summe) STRIKT über dem `monthlySavingsBudget`; nie blockierend; null = „offen", keine Prüfung.

### Umgesetzt

- **NEU `src/storage/autoBackup.ts`:** `shouldAutoBackup(mode, lastBackupDayIso, todayIso)` (rein, testbar) + `readLastAutoBackupDay`/`writeLastAutoBackupDay` (try/catch, Formatprüfung); `src/state/localStoragePolicy.ts` mit dokumentiertem Allowlist-Eintrag.
- **NEU `src/data/settings.ts`:** `updateSettings` als K2-Teil-Patch mit deutschen, feldnahen Fehlertexten ohne IDs (factor 3–5; Netto > 0; Override > 0 | null; Budget ≥ 0 | null; percentDecimals Ganzzahl 0–4; mode-Enum; retention ≥ 1; Profil-Existenz mit Fehlertext ohne technische ID); ausschließlich `settings` wird ersetzt (Stop-Bedingung).
- **Validierung additiv:** percentDecimals-Ganzzahl-0–4-Prüfung in validateFinanceData (E_SETTINGS_RANGE, §6-Kommentar).
- **Provider additiv:** `runAutoBackupAfterSave` in beiden SAVE_SUCCEEDED-Pfaden von saveDirect + saveAs (A2–A5-Kommentare); Download-Fallback bewusst ohne Backup.
- **Seite NEU `src/pages/SettingsPage.tsx`** (ersetzt den letzten Platzhalter „einstellungen"; AppLayout ohne PlaceholderPage-Zweig): (1) Hauptformular „Einstellungen in der Finanzdatei" mit Fieldsets Allgemein & Finanzen (Netto mit Bezugsgrößen-Hinweis, Sparbudget „leer = offen" mit Warn-Grenzwert-Erklärung), Notgroschen (Faktor mit Randwert-Hinweis 3/5, Live-Vorschau „Faktor × Netto = X" und wirksamer Wert NUR über effectiveEmergencyFundTarget – „berechnet" = Aufruf mit entfernter Übersteuerung, keine zweite Formel; Übersteuerung setzen/zurücksetzen mit G12-confirm inkl. BEIDER Werte; Unterschreitungs-Warnung; M12-Hinweis), Darstellung (percentDecimals 0–4 mit formatShare-Vorschau 0,8008; read-only de-DE/EUR/TT.MM.JJJJ), Automatische Sicherungen (Modus-Auswahl mit Klartext, „nicht festgelegt"-Option nur bei unmaterialisiertem Modus, Aufbewahrungsempfehlung); Pflichtfeld-Legende, parseGermanAmount, B3-Fehlerfokus, Escape/„Eingaben verwerfen", Dirty NUR nach JSON-Vergleich mit Status-Feedback („Keine Änderungen" bei Byte-Identität). (2) Zielprofil-Sektion: reine Auswahl (Namen, aktives markiert) + „Zielprofil aktivieren …" mit G12-confirm (beide Profilnamen; Job-Warnung sichtbar + im confirm, todayIso), Hinweis auf die lokale Rebalancing-Auswahl und die V1-Grenze „keine Bearbeitung". (3) Sicherung & Wiederherstellung: Statuszeile „letzte automatische Sicherung dieses Geräts" aus dem Tagesmerker (deutsches Datum/„unbekannt", Tagesgranularität), „Sicherung jetzt erstellen" (vorhandener backupDownload) mit role=status-Feedback, Wiederherstellung-=-Import-Erklärung. (4) Import & Export: Erklärblöcke + sichtbare Datenprüfungs-Liste (Schema/Version, Pflichtfelder/Typen, NaN/Infinity, Datumsformate, doppelte IDs, Referenzen, Enums/Wertebereiche, Fachregeln) + Direktlink „Daten & Backups"; KEINE Duplikat-Datei-Buttons. (5) Speicherorte-Transparenz inkl. Dateiverbindungs-/Berechtigungsstatus der Sitzung. **CSS additiv:** .settings-form/.settings-fieldset.
- **SavingsPlansPage (NUR additiv):** Budget-Warnung in der Summen-Sektion (Text + Symbol, role=status, beide Beträge, „Nur ein Hinweis"-Klarstellung).
- **Doku:** data-model §3.2 (Wertebereiche präzisiert, Gerätemarken-Absatz) + §6-Protokolleintrag M14; storage-concept §1 (Allowlist) + §5 (V1-Umsetzung A2–A5, Download-Weg, retention-Grenze); calculation-rules „Einstellungs-Bausteine (M14)" (Override-/Reset-Regeln, Budget-Warnung = F8-real-Vergleich strikt >, Auto-Backup-Regel, percentDecimals, Konflikt-Ausweise Profilbearbeitung/CSV/i18n/keine-aus-Option, keine Duplikat-Funktionsnamen); requirements M14-Nachtrag (inkl. ABNAHME-RELEVANTEM Profilbearbeitungs-Ausweis); README (Alle-Module-Stand + Einstellungen-Absatz + Auto-Backup-Hinweis); dieser progress-Eintrag.

### Tests (Endstand **815/815 grün**, 37 Dateien; Build ✓, Lint ✓; inkl. +4 Tests aus finance-analyst/accessibility und +4 aus calculation-tester)

- NEU `tests/data/settings.test.ts` (51): alle Feld-Validierungen (Faktor 2,9/5,1/NaN/∞ ↔ 3/4,5/5; Netto ≤ 0/NaN/∞; Override 0/negativ/NaN/∞; Budget −1 ↔ 0/null; percentDecimals 5/−1/1,5/2,5 ↔ 0–4; mode 'foo'; retention 0/−1/1,5; totes Profil mit ID-freiem Fehlertext), Override setzen/Rücksetzen (Schlüssel bleibt als null; Rücksetzen ohne Schlüssel Byte-identisch; Override überlebt Netto-Änderung, T7), K2 (leerer + wertgleicher Patch Byte-identisch; fehlende Blöcke werden nie materialisiert; backup-Patch erzeugt NUR den gesetzten Schlüssel; unbekannte Zusatzfelder überleben), Mutationsfreiheit, Stop-Test (nur settings ersetzt, alle übrigen Bereiche referenzidentisch), `shouldAutoBackup` (beide Modi, Tageswechsel, KORRIGIERT undefined → TRUE), Ladeverschärfung percentDecimals (0/4 laden; 5/−1/2,5 → E_SETTINGS_RANGE; Beispieldatei lädt unverändert).
- NEU `tests/storage/autoBackup.test.tsx` (12, davon +2 calculation-tester: „Speichern unter" mit Auto-Backup Byte-identisch zum saveAs-Serialisat + Tagesmerker; Merker-Randfälle [ungültige Werte „gestern"/„2026-7-1" lesen als null, werfendes Storage.setItem wirft nie]): everySave-Backup mit **Backup-Bytes = gespeicherte Bytes** (Mock-Handle vs. downloadAsFile-Mock) + Backup-Dateiname + Tagesmerker; Stop-Test Backup-Datei → parseFinanceJson → Deep-Equal zum gespeicherten Bestand; fehlender backup-Block → Backup läuft (KORREKTUR Nr. 3) OHNE Materialisierung; dailyFirstSave nur einmal pro Tag + Merker von gestern + manuelle Sicherung nie gegated; Backup-Fehler → Speichern bleibt erfolgreich (nur Hinweis, kein Merker); A4-Negativpfade (Download-Fallback exakt EIN Export-Download ohne Backup/Merker; Dialog-Abbruch nichts; SAVE_FAILED nichts).
- NEU `tests/pages/settingsPage.test.tsx` (30, davon +4 Prüfkette: B1-Fokus auf der Statusmeldung nach Übernehmen, B5-aria-Verdrahtung des Dezimalstellen-Selects, B6-Zielprofil-Fehler feldnah mit Fokus, Grauzone-10-K2-Regression „ohne display-Block Byte-identisch"; B2-Fokus- und Grauzone-11-Prüfungen in bestehenden Tests ergänzt; Escape-Test als gewollte Musterangleichung umgeschrieben): StartHint; Sektionen/Pflichtfeld-Legende/localStorage-Transparenz + Dateiverbindungsstatus; Seed-Vorschau 4 × 1.170 = 4.680 + „wirksam (automatisch berechnet)"; Live-Vorschau 5 × 2.000 = 10.000 + Randwert-Hinweis; Override-Flow (confirm mit beiden Werten, Speicherung, „(manuell)"-Anzeige, Feedback), Override-Abbruch Byte-identisch, Unterschreitungs-Warnung (1.000 < 4.680), Rücksetzen (confirm mit beiden Werten, Schlüssel bleibt null), ungültiger Override ohne confirm; Dirty-Regeln (unverändert „Keine Änderungen" ohne Dirty; echte Änderung Netto/Budget/Faktor; Verwerfen mit role=status-Meldung + No-Op; Escape bewusst OHNE Rücksetz-Wirkung, B3); B3-Fehlerfokus (Netto 'abc', Faktor 6 über den Datenlayer); percentDecimals-Vorschau 80,08 %/80 % + Speicherung; read-only-Zeilen ohne Schreibpfad; Backup-Modus setzen (retentionCount bleibt; keine „aus"-Option); retention 0 → Feldfehler; Zielprofil (Job-Warnung sichtbar + im confirm mit Stichtag 19.07.2026, Aktivierung, Abbruch Byte-identisch, Nicht-Job ohne Warnung, „bereits aktiv" ohne confirm); Sicherungen (Statuszeile unbekannt/18.07.2026, manuelle Sicherung mit Feedback, Empfehlungs-/Wiederherstellungs-Hinweise); keine IDs/NaN/Infinity (NaN nur im ausgenommenen Erklärsatz der Prüfliste).
- Angepasst `tests/pages/savingsPlansPage.test.tsx` (+4 = 39): Budget 100 → Warnung mit beiden Beträgen (118,50/100), Text + Symbol, nie blockierend; Budget exakt 118,50 → KEINE Warnung (strikt >); Budget 118 knapp darunter → Warnung (calculation-tester-Grenzfall); Budget null → keine Prüfung.
- Angepasst `tests/pages/dashboardPage.test.tsx` (+1 = 30): percentDecimals 0 wirkt auf die Anteilsanzeigen der Übersicht („80 %"/„20 %" statt „80,00 %").
- Angepasst `tests/layout/appLayout.test.tsx` (12): der letzte Platzhalter-Test „Einstellungen" wurde durch den Echte-Seite-Test ersetzt (StartHint; kein Platzhalter mehr in der App).
- Angepasst `tests/storage/unsavedChanges.test.tsx`: der localStorage-Policy-Pin prüft jetzt die dokumentierte Allowlist mit exakt EINEM Gerätemarken-Schlüssel (kein Abschwächen – die Kernaussagen „kein Finanzdaten-Autosave" und „Cache-Löschung überlebbar" bleiben unverändert gepinnt).
- Regression: alle Vormodul-Suiten unverändert grün (u. a. M12-Notgroschen-Pins/effectiveEmergencyFundTarget-Konsistenz, Import-Abbruch-Schutz DM5).

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. Profilbearbeitung/„Eigene Aufteilung befüllen" (Ebene B) = Restpunkt V1.x (Konflikt-Ausweis, requirements-M14-Nachtrag).
2. Sicherungsverzeichnis (`showDirectoryPicker`) + durchsetzbare retention = spätere Ausbaustufe; V1 ist bewusst der Download-Weg.
3. `formatShare`-Helfer inzwischen siebenfach je Seite – Kandidat für `src/format` (Altpunkt fortgeschrieben).
4. Commit aller Phasen weiterhin offen (Reviewer-Hinweis Phase 16, in Phase 17 bestätigt) – vor dem nächsten Checkpoint nachholen. Die M14-Prüfkette selbst ist vollständig durchlaufen (Freigabe, siehe oben).

### Bewusst nicht implementiert

Benutzerkonten/Logins/API-Schlüssel, i18n (numberLocale ohne Schreibpfad), Profilbearbeitung, CSV/PDF/Cloud, Theme-Verwaltung, „aus"-Option für Auto-Backups, durchsetzbare Aufbewahrung, Backup ohne Nutzeraktion.

## 2026-07-20 – Phase 16: Modul „Simulator & Projektionen" (M13, abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **data-architect** (ratifiziert mit KORREKTUR 2.1 startMonth-Folgemonat + Auflagen 2.2–2.6) → **frontend-developer** (Implementierung; Skills finance-rules und frontend-design) → **finance-analyst** (alle Pflicht-Pins unabhängig bestätigt; 4 niedrige Befunde N1–N4 + Grauzonen) → **accessibility-review** (0 kritisch, 3 mittel, 4 klein: B1–B7) → **calculation-tester** (alle Nachrechnungen ohne Abweichung; 1 mittlere + 5 kleine Testlücken → geschlossen: AK-3-Stop-Test am update-Pfad, schreibseitiger target-Negativtest, 1.200-Monate-Exaktheits-Pin 121.000,00, Ereignis-Ziel-Kombination Monat 36 = Juli 2029, Zieltermin im Erreichungsmonat → rechtzeitig) → **reviewer** (**Freigabe mit Auflagen**: M-1 = dieser Eintrag; M-2 = README auf tatsächliche Bedienung nachgezogen; K-1 als Doku-Satz ergänzt; K-2 dem M11-Restpunkt zugeschlagen). Alle Befunde behoben.

### Prüfketten-Nachbesserungen (behoben, 2026-07-20)

- **B1 (mittel):** „Detailansicht schließen" fokussiert jetzt den Karten-Anker `sim-card-heading-<id>` (GoalsPage-Muster) – Fokus landet nie auf document.body.
- **B2 (mittel):** Beitragszeile entfernen → role="status"-Feedback „Beitrag N entfernt." + Fokus auf den bestehen bleibenden „Beitrag hinzufügen"-Button (id sim-add-contribution).
- **B3 + N1 (mittel):** (a) Namen sind unter Simulationen jetzt EINDEUTIG (trim-Vergleich in checkSimulationInput; Fehlertext „Name: Es existiert bereits eine Simulation mit diesem Namen …"; updateSimulation nimmt die eigene ID aus; duplicateSimulation war bereits NAMENS-kollisionssicher – „(Kopie)"/„(Kopie 2)" – und vergleicht jetzt trim-konsistent; Ladeprüfung bleibt tolerant, Altdateien mit Doppelnamen laden unverändert – Ausweis data-model §3.11). (b) Vergleichs-UI: React-Keys und Ziel-Kurzstatus laufen über die Simulations-ID (goalShortStatusById, key={column.id}); Checkbox-Labels ergänzen das Anlagedatum „(vom TT.MM.JJJJ)".
- **N2 (fachlich):** „bereits zum Start erreicht" (Monatsindex 0) ist IMMER 'reachable' – nie 'late', auch bei vergangenem Zieltermin (M12-Philosophie „erreicht schlägt überfällig"); eigene Begründung „… bereits zum Start der Projektion erreicht ist."
- **B4 (klein):** Rendite-Slider mit deutschem aria-valuetext („7,25 % pro Jahr") und aria-describedby (Warnung/Hinweis) auch am Slider.
- **B5 (klein):** role="status"-Meldungen beim Auslöser für „Aktuelle Werte übernehmen" und beide Vorbelegungs-Buttons („N Beitragszeilen befüllt – Telekom-Sicht: real / geglättet (Analysewert)").
- **B6 (klein):** kompakte Verlaufstabelle (> 24 Monate) sichtbar als „Jahresschritte" gekennzeichnet (Hinweis + präzisierte caption); der Chart-Hinweis verweist auf die vollständige Tabelle im Details-Block.
- **B7 (klein):** Legende „* = Pflichtfeld" am Formularanfang; ins design-system-Formular-Muster aufgenommen (Nachrüstung älterer Formulare = dokumentierter Restpunkt, dort NICHT angefasst).
- **Doku-Ausweise:** G9-Grauzone (telekomMode 'real' + manuell eingetragene geglättete Zeilen wäre eine Doppelzählung – Schutz über Vorbelegung/Hinweise, keine harte Prüfung möglich; Nutzerverantwortung), N3 (Bearbeiten normalisiert Beträge/Rendite auf 2 Nachkommastellen – parseGermanAmount-Grenze aus M8), N4 (Bearbeiten ersetzt die Beitragsliste vollständig – unbekannte Zusatzfelder INNERHALB einzelner Beiträge überleben nur Rundreise/Kopieren) – alle in calculation-rules „Simulations-Bausteine (M13)" bzw. data-model §3.11.
- **Testanpassung (dokumentiert, kein Abschwächen):** Der frühere ID-Suffix-Test legte zwei Simulationen mit IDENTISCHEM Namen an – das lehnt die neue Eindeutigkeitsprüfung korrekt ab; der ID-Kollisionsfall wird jetzt über verschiedene Namen mit gleichem Slug („Plan A"/„Plan a") gepinnt.

### Verbindliche Entscheidungen (ratifiziert, dokumentiert)

- **KORREKTUR 2.1 – startMonth = FOLGEMONAT des Stichtags** (F22 „Real (Start August 2026)" bei Juli-Stichtag); Pflicht-Pin real 6 Monate **777,59/3.122,47/3.900,06** (ohne Juli-Ereignis – pinnt die Konvention) zusätzlich zu den 12-Monats-Pins 927,59/5.222,47/**6.150,06** (real = geglättet).
- **Rechenmodell:** geometrischer Monatsfaktor (1 + r)^(1/12); NUR das Depot wird verzinst; Monatsende-Regel (erst Verzinsung, dann Beiträge – Beiträge des Zuführungsmonats unverzinst); Growth-Pin 1.000 × 12 % → exakt 1.120,00; Rendite 0–15 % (negative Annahmen bewusst NICHT, Konflikt-Ausweis), WARNUNG > 8 % („sehr optimistische Annahme", nie Fehler, W_RETURN_ASSUMPTION); months Ganzzahl 1–1200.
- **2.3 – G8-Ereignis-Partition:** telekomMode 'real' → implizites Juli-Ereignis **1.500 = 1.000 eigen + 500 Arbeitgeber** (Equatex-Zählpunkt; dokumentierte Konstante TELEKOM_ANNUAL_EVENT, Restpunkt); bei 'smoothed' NIE (Doppelzählung, G9). Seed-Pins eingezahlt: eigen 2.422,00 / gesamt 3.000,00.
- **2.4 – Vorbelegungen flowType-getrennt** (nur Formular-Befüllung): real 93,50 eigen + 6,50 Arbeitgeber (Depot) + 25 eigen (Tagesgeld) + Ereignis; geglättet ZEILENWEISE 33,50/6,50/60/83,33/41,67/25 – KEINE Sammelzeile „225 eigen" (G8-Verfälschung); geglättete Zeilen als „geglättet (Analysewert)" (G9).
- **2.5 – DM9/G9-Ausnahme dokumentiert:** gespeicherte smoothed-Parameter zulässig, weil telekomMode 'smoothed' die Kennzeichnung strukturell trägt (data-model §3.11 + calculation-rules).
- **2.6:** Name nicht leer (trim); sim-Slug-ID + Kollisionssuffix; leere Beiträge gültig; Kennzeichnungstexte exakt („Projektion ohne Kursentwicklung" / „Projektion mit Annahme X % p. a. – keine Prognose, keine Anlageberatung"); compareSimulations mit G9-Sicht-Mischungs-Hinweis.
- **Konflikt-Ausweise (§1):** KEINE Inflationsannahme (M13-Nicht-Ziel ranghöher); KEIN Rebalancing-Schalter (Aggregatmodell – Scheinfunktion; note-Feld für Annahmen); kein Start-/Enddatum-Feld (Anzeige berechnet); Beschreibung = note. **Hartes Löschen zulässig** (reine Szenario-Entwürfe ohne Referenzen; NUR mit G12-confirm inkl. Name – Begründung data-model §3.11); Export-Minimal-Auslegung (kein eigener Kanal – JSON über „Daten & Backups"). **Keine Duplikat-Funktionsnamen** (Auftragsnamen sind Bestandteile von simulateScenario/summarizeSimulation; projectNoGrowth bleibt die 0-%-Referenz).

### Umgesetzt

- **Typen (additiv, schemaVersion bleibt 1, §6-Protokoll):** `SimulationContribution.target?` ('depot' Default | 'cash'); Schreibseite materialisiert nur 'cash' (K2).
- **Validierung (additiv + Verschärfungen mit §6-Ausweis):** simulations-Tiefenprüfung – Startwerte/Beiträge ≥ 0, months Ganzzahl 1–1200 (E_SETTINGS_RANGE), annualReturnRate ∈ [0; 0,15] (E_SETTINGS_RANGE; > 0,08 → W_RETURN_ASSUMPTION als WARNUNG), Transfer-flowType-Verbot (E_FLOWTYPE, G7), target-Enum. Entlastung: es gab nie einen Schreibpfad für simulations (Beispieldatei [], keine App-Version schrieb sie).
- **Reine Funktionen (ADDITIV src/finance/projection.ts):** `simulateScenario` (monatliche Reihe Index 0..n, G8-partitionierte Einzahlungssummen, Ereignis-Logik, assertFinite-Guards), `summarizeSimulation` (Endwerte, eingezahlt gesamt/eigen, Wertzuwachs aus der Annahme NUR bei r > 0), `goalReachMonthInSeries` + `isProjectableSimulationMetric` (NUR tagesgeld/depotValue/totalWealth), `analyzeGoalsInSimulation` (4 Status IMMER mit Begründungssatz „weil …"; archivierte/pausierte Ziele ausgenommen; Notgroschen über effectiveGoalTarget), `compareSimulations` (≥ 2, viewsMixed-G9-Flag), `firstProjectionStartMonth`/`projectionMonthIso`/`formatIsoMonthGerman`, Konstanten TELEKOM_ANNUAL_EVENT/SIMULATION_MAX_MONTHS/SIMULATION_MAX_RETURN_RATE/SIMULATION_RETURN_WARN_THRESHOLD.
- **Datenlayer NEU src/data/simulations.ts** (Muster plannedChanges.ts): `generateSimulationId` (sim-Slug + Suffix), `addSimulation` (createdAt = todayIso, A2), `updateSimulation` (Teil-Patch, K2-Byte-Identität bei No-Op), `duplicateSimulation` („(Kopie)"/„(Kopie 2)", neues createdAt, tiefe Kopie), `deleteSimulation` (hart, G12-confirm ist Sache der Seite). Fehlertexte deutsch, feldnah, ohne IDs.
- **Seite NEU src/pages/SimulatorPage.tsx** (ersetzt Platzhalter „simulation"): (A) Übersicht (Anzahl-Kachel mit Trennungs-Hinweis, Projektionsstart-Kachel „Folgemonat des Stichtags", Pflicht-Banner „Projektion – keine Prognose, keine Anlageberatung. Simulationen ändern nie Konten, Depot, Sparpläne oder Ziele.", Export-Hinweis, Erklärblock); (B) Liste als Karten (Name, createdAt deutsch, Kernannahmen inkl. Beitragssumme + Ereignis-Hinweis, Kennzeichnung je r; Aktionen Ansehen/Bearbeiten/Kopieren/Löschen mit G12-confirm inkl. Name, Feedback beim Auslöser, Fokus-Anker auf der Listenüberschrift nach dem Löschen); Formular (key={id}, parseGermanAmount, B3-Fehlerfokus, Escape/Fokus-Rückgabe, „Aktuelle Werte übernehmen"-Seed 2.522,47/627,59, Vorbelegungs-Buttons real/geglättet nach 2.4, Beitragszeilen mit label/Betrag/Zuflussart/Ziel depot|cash, Monats-Schnellwahl 12/60/120, Rendite-Feld + Slider mit > 8-%-Warnung, telekomMode, Dirty nur nach JSON-Vergleich); (C) Detailansicht (Kennzeichnungs-Banner mit Zeitraum „ab <Folgemonat>, n Monate (bis <Endmonat>)", 4 KPI-Kacheln inkl. eingezahlt gesamt vs. eigen (G8) und „Wertzuwachs aus der Annahme", Verlaufstabelle als PRIMÄRquelle in fokussierbarer benannter Region – bei > 24 Monaten Jahresschritte + letzte Zeile, vollständige Monate über details –, handgerolltes inline-SVG-Liniendiagramm (Gesamtvermögen/Depot/Tagesgeld) aria-hidden mit sichtbarem Hinweis „alle Werte stehen in der Tabelle" + Legende mit Farbe UND Strichmuster (CVD-validierte Palette), Zielanalyse mit Status Text+Symbol und Begründungen); (D) Vergleich per Checkboxen (≥ 2; Annahmen-/Endwert-/G8-Zeilen, Zielerreichungs-Kurzstatus, G9-Hinweis bei gemischten Sichten). **AK-3-Stop-Bedingung erfüllt: Speichern/Kopieren/Löschen berühren ausschließlich simulations[].**
- **AppLayout:** „simulation" ist eine echte Seite (Platzhalter-Test auf „Einstellungen" umgezogen). **CSS additiv:** .sim-chart/.sim-chart-legend/.sim-contribution-row/.sim-compare-choice.
- **Doku:** calculation-rules „Simulations-Bausteine (M13)" (Monatsfaktor, Monatsende-Regel, Nur-Depot-Verzinsung, startMonth-Konvention + Pins, Ereignis-Konstante, target-Feld, Grenzen + 8-%-Warnung, Zielanalyse-Status, Vergleich, Kennzeichnungstexte, Konflikt-Ausweise Inflation/Rebalancing/negative Rendite, DM9/G9-Ausnahme); data-model §3.11 (target, Wertebereiche, Lösch-Begründung, DM9-Abgrenzung) + §6-Protokolleintrag; requirements M13-Nachtrag; design-system „SVG-Chart-Zusatz-Muster".

### Tests (Endstand **717/717 grün**, 34 Dateien, Build ✓, Lint ✓; inkl. +10 Tests aus der Prüfkette)

- NEU `tests/finance/simulation.test.ts` (44, davon +1 N2-Pin „bereits zum Start erreicht + vergangener Zieltermin → reachable" und +3 calculation-tester-Randfall-Pins: 1.200 Monate exakt 121.000,00; Ereignis + Ziel Monat 36 = Juli 2029; Zieltermin im Erreichungsmonat → rechtzeitig): startMonth-/projectionMonthIso-Konvention (Juli → August, Jahreswechsel), PFLICHT-PIN real 6 Monate 777,59/3.122,47/3.900,06, real 12 Monate = projectNoGrowth-Referenz = 6.150,06, geglättet 12 Monate identisch, AK 1 (Endwert = Start + Σ Zuflüsse; leere Beiträge gültig), Reihenform (n + 1 Punkte, Zwischenpunkte), Ereignis im ersten Monat (Juni- vs. Juli-Stichtag), Growth-Pin 1.000 × 12 % → exakt 1.120,00, Monatsende-Regel (1/2 Monate), Nur-Depot-Verzinsung (Tagesgeld 1.000 bleibt bei 15 %), cash-Beiträge unverzinst, 1.200-Monate-Performance ohne NaN, G8-Partition (Ereignis 1.000/1.500; Seed real eigen 2.422/gesamt 3.000; geglättet ohne Ereignis), Grenzen (months 1/1200 ok, 0/1,5/1201 abgelehnt; Rendite 0/0,15 ok, −0,01/0,16/NaN/∞ abgelehnt; Beitrag −1; Transfer-flowTypes; startMonth 0/13), Mutationsfreiheit (deepFreeze + Snapshot), summarize (growth null bei r = 0; 120,00 bei 12 %), goalReach (alle Kennzahlen, Start-Erreichung, nicht projizierbare Kennzahlen), analyzeGoals (alle 4 Status mit Begründungs-Greps, Ausnahme archived/deferred, Notgroschen-Override), compare (null unter 2, Spalten, viewsMixed).
- NEU `tests/data/simulations.test.ts` (28, davon +2 Namens-Eindeutigkeit add/update inkl. trim; Duplikat-Test um manuellen „(Kopie)"-Namen erweitert; ID-Suffix-Pin über Slug-Kollision „Plan A"/„Plan a"): ID-Konvention (Umlaute, Suffixe, Leer-Slug), add (createdAt ohne Uhrzeit, K2-target nur bei 'cash', AK-3-Byte-Identität, Namens-Eindeutigkeit, leere Beiträge, alle Fehlertexte ohne IDs, ungültiges Datum), update (Teil-Patch, No-Op Byte-identisch, params-Patch mit Neuprüfung, unbekannte Zusatzfelder, unbekannte Simulation), duplicate („(Kopie)"/„(Kopie 2)", neues createdAt, tiefe Kopie, AK-3), delete (genau eine, AK-3, unbekannt), Rundreise (target 'cash' + Default depot + Zusatzfelder in Simulation UND Beitrag), Verschärfungs-Negativtests (months 0/1,5/1201; Rendite −0,01/0,16; Beitrag −1; Transfer-flowType; target 'foo'; Startwert −0,01), 8-%-Warnung (0,09 warnt, 0,08 nicht, nie Fehler), Altdatei-Regression (Seed-Pin 2.522,47).
- NEU `tests/pages/simulatorPage.test.tsx` (29, davon +4 Prüfkette: B1-Fokus beim Detail-Schließen, B2-Zeilen-Entfernen mit Status + Fokus, B7/B4-Pflichtfeld-Legende + Slider-aria-valuetext, B3/N1-Namensduplikat feldnah; B5-Status- und B6-Jahresschritt-Prüfungen in bestehenden Tests ergänzt; Vergleichs-Labels mit Anlagedatum): StartHint, Pflicht-Banner + Trennung + Projektionsstart „August 2026" + Export-Hinweis, reale Vorbelegung (93,50/6,50/25 mit Zuflussarten und Zielen, Modus real), geglättete Vorbelegung (zeilenweise 33,5/6,5/60/83,33/41,67/25, G8/G9-Kennzeichnungen, Modus smoothed), „Aktuelle Werte übernehmen" ohne Dirty, Karten-Anzeige mit Pins und Ereignis-Hinweis, AK-3-STOP (accounts/positions/savingsPlans/goals Byte-identisch), B3-Fehlerfokus, 8-%-Warnung als Status + 16-%-Feldfehler, Abbrechen/Escape ohne Dirty, unverändertes Bearbeiten ohne applyDataChange (Referenz-identisch), Bearbeiten 60 Monate, Kopieren, Löschen mit confirm inkl. Name + Feedback + Fokus-Anker, Abbruch Byte-identisch, Detail (F22-Pins 6.150,06/5.222,47/927,59, G8-Kacheln 3.000/2.422, „entfällt (0 %)"), Verlaufstabelle (benannte fokussierbare Region, Monat 0 = Start Juli 2026, Monat 12 = Juli 2027), Chart aria-hidden + Tabellen-Hinweis + Legende + 3 Polylines, > 24 Monate (Jahresschritte + vollständige Tabelle über details), Zielanalyse (Erreichbar/Im Horizont nicht erreicht/„nicht Teil des Aggregatmodells", pausierte Ziele fehlen, Pflicht-Kennzeichnung), r > 0-Kennzeichnung „5 % p. a.", Vergleich (< 2-Hinweis, Tabelle mit G8-Zeile + Kurzstatus + G9-Mischungs-Hinweis, beide Sichten enden bei 6.150,06), keine IDs/NaN/Infinity/undefined, A11y-Grundmuster.
- Angepasst `tests/layout/appLayout.test.tsx` (+1): „Simulation" ist echte Seite; Platzhalter-Test auf „Einstellungen" umgezogen. Regression: alle Vormodul-Suiten unverändert grün (Dashboard 28/Depot 43/Sparpläne 35/Ziele 24/Rebalancing 23 usw.).

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. Telekom-Ereignis-Konstante (Juli/1.500 = 1.000 + 500) ist bewusst fest im Rechenkern (TELEKOM_ANNUAL_EVENT) – eine Parametrisierung wäre eine spätere Fachentscheidung (2.6).
2. `formatShare`/Prozent-Helfer inzwischen sechsfach je Seite – Kandidat für `src/format` (Altpunkt fortgeschrieben).
3. Die Zielanalyse vergleicht Zieltermine auf Monatsebene (konservative Monatslogik der Reihe); eine taggenaue Betrachtung wäre Schein-Präzision im Monatsraster.
4. A11y B3 (projektweit): disabled={isSaving} kann den Fokus transient verlieren – Bestandsmuster aller Module.
5. Reviewer K-1: updateSimulation trimmt den Namen auch bei reinen params-Patches (N3-Normalisierungslinie, in calculation-rules miterwähnt); Reviewer K-2: Karten-Beitragssumme ist Anzeige-Aggregation – dem M11-K-2-Restpunkt (Summen als Analyse-Felder) zugeschlagen.
6. Pflichtfeld-Legende „* = Pflichtfeld" (B7) in den ÄLTEREN Formularen (Konten/Depot/Sparpläne/Ziele) nachrüsten – design-system-Muster existiert seit M13.
7. Alle Phasen liegen uncommittet im Arbeitsbaum – vor dem nächsten Checkpoint bewusst gemeinsam committen (Reviewer-Hinweis).

### Bewusst nicht implementiert

Monte-Carlo-/Wahrscheinlichkeitsrechnung, historische Daten/KI-Schätzungen, Inflations-/Steuermodellierung, negative Renditen, Rebalancing-Schalter in der Simulation, Produktempfehlungen, separater Export-Kanal, Chart-Bibliothek (inline-SVG handgerollt), Speicherung von Ergebnissen (nur Parameter).

## 2026-07-20 – Phase 15: Modul „Rebalancing und Handlungsempfehlungen" (M11, abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **data-architect** (alle 8 Entscheidungen ratifiziert, Auflagen A1–A7) → **frontend-developer** (Implementierung exakt nach Spezifikation; REIN lesend bis auf addPlannedChange/discardPlannedChange, G5) → **finance-analyst** (alle Formelkatalog-Pins unabhängig bestätigt; 1 niedriger Befund + 2 Grauzonen) → **calculation-tester** (alle Nachrechnungen ohne Abweichung; 4 Testlücken) → **accessibility-review** (0 kritisch, 2 mittel, 5 klein: B1–B7) → **reviewer** (**Freigabe mit Auflagen**; M-1 = dieser Eintrag, K-1 behoben, K-2 als Restpunkt). Skills finance-rules, frontend-design, rebalancing und quality-check angewendet.

### Prüfergebnisse (je Stufe) und behobene Auflagen

- finance-analyst: alle Pins bestätigt (Ist-Anteile; ±Pp inkl. Telekom +44,27775; Kauf/Verkauf Σ 1.573,80444; Budget 60,00/55,00; F17 23,83/22,00/10,65/3,52 mit −0,01-Ausgleich am SPDR; Dauer 27 Monate; Voll-Simulation = Zielverteilung). **Niedrig (behoben):** VL-Vertragsbindungs-Hinweis (F16-Randfall) im Verkaufsoption-Satz – neue reine Funktion `isContractBoundPosition` (own_fixed/own_variable + isFlexible false; employer/provider lösen nicht aus) + Seiten-Text + Tests. **Grauzonen dokumentiert:** Mehrfach-Pläne auf dieselbe Position (V1-Regel: Lücke zählt je Plan – gepinnt), Aufrufer-Vorfilterung als API-Vertrag, Dauer-Schätzung als bewusste Untergrenze (Zusatz „parallele feste Zuflüsse … können die Dauer verlängern" in UI + calculation-rules).
- accessibility-review: **B1** Verwerfen-Erfolg mit role=status-Feedback + Fokus-Anker auf dem ersetzenden Status-Span; **B2** Aktions-Feedback beim Auslöser (Speichern in Sektion D, Verwerfen in Sektion F); **B4** unresolvedRefs mit Anzahl (Singular/Plural); **B5** role=status von statischen Rechen-Texten entfernt; **B6** „1 Monat"/„n Monate"; **B7** Kurz-Codes-Konvention (F19/G5-Verweise nur in Erklärtexten) in design-system dokumentiert – **alle umgesetzt**; B3 (disabled während isSaving) als projektweites Bestandsmuster fortgeschrieben.
- calculation-tester: keine numerische Abweichung. **4 Testlücken geschlossen:** Gruppen-Gewicht mit unbewerteter Position (Pin), zwei flexible Pläne auf dieselbe Position (10/10-Pin der V1-Regel), own_variable+isFlexible-false-Zweig, VL-Hinweis als Seitentest.
- reviewer: **Freigabe mit Auflagen.** **M-1** (dieser Eintrag: Testzahlen + Prüfkette nachgetragen). **K-1** (behoben): Verwerfen-Erfolgstext + Fokus-Anker jetzt getestet (waitFor auf document.activeElement). **K-2** (Restpunkt): Summenzeilen-Aggregation der Tabellen als Analyse-Felder extrahierbar.

### Verbindliche Entscheidungen (data-architect-ratifiziert, dokumentiert)

- **A1 – Budget-Herleitung:** flexibles F17-Monatsbudget = Summe der am Stichtag aktiven Pläne mit `isFlexible !== false`, `flowType` ∈ {own_fixed, own_variable}, `interval "monthly"`, **`targetKind "position"`**, endlicher Betrag > 0. Seed-Pins 60,00 € (23+22+10+5) bzw. 55,00 € mit pausiertem Gold-Plan; Budget 0 = definierter „keine Empfehlung"-Zustand; UI zeigt Budget SAMT Herleitung.
- **A2 – createdAt:** injiziertes ISO-Kalenderdatum (todayIso, isValidBusinessDate-geprüft), bewusst OHNE Uhrzeitanteil; Ladeprüfung akzeptiert tolerant volle Zeitstempel; Anzeige in Array-Reihenfolge.
- **A3 – Verwerfen:** additiver Status `discarded` (kein Löschen, Historie bleibt); Fehler mit Profilname + deutschem Datum bei Doppel-Verwerfen; KEIN Zurücksetzen discarded → planned in V1 (G5-Schutz, Restpunkt).
- **A4 – Statuslabel-Mapping:** die vier Auftrags-Labels auf die DREI bestehenden actionLevel-Stufen abgebildet („OK (nur Anzeige)" / „Empfehlung – prüfen" / „Empfehlung – Rebalancing sinnvoll (inkl. Verkaufsoption als letzte Möglichkeit)"); „beobachten" ist KEINE eigene Stufe; T9 3/6/12 Pp exakt gültig.
- **A5 – items-Ladeprüfung additiv:** `plannedChanges[].items[].ref` wird beim Laden analog zu den Profil-Gewichten geprüft (position → existiert, group → bekannte Gruppe, E_REF_TARGET); Schreibseite prüft zusätzlich Profil-Existenz, nicht-leere items und endliche Beträge ≥ 0 (Fehlertexte mit Namen, nie IDs); Verschärfungs-Ausweis in data-model §6.
- **A6 – Analyse-Vollständigkeit:** bewertete aktive Positionen OHNE Gewichtseintrag erhalten KEIN erfundenes Soll 0 – eigener Hinweis „nicht im Zielprofil enthalten" mit Namen; Σ Kauf = Σ Verkauf-Pflichtprüfung nur bei voller Abdeckung, sonst sichtbare Abdeckungslücke. Explizites Gewicht 0 bleibt: Soll 0, voller Verkaufsbedarf.
- **A7 – Begriffsklärung:** `calculateFullRebalancing` erzeugt NIE einen `simulations[]`-Eintrag (M13-Territorium) – reine Anzeige, UI-Text stellt das klar.
- **Keine Duplikat-Funktionen:** die Auftragsnamen (calculateCurrentAllocation usw.) sind Bestandteile von `calculateRebalancingAnalysis`; die bestehenden F-Funktionen SIND die Implementierung (targets.ts unangetastet).

### Umgesetzt

- **Datenmodell (additiv, schemaVersion bleibt 1, §6-Protokoll):** `PlannedChange.status` +`discarded`; Validierung: PLANNED_CHANGE_STATUS-Enum + A5-items-Referenzprüfung im B-Block. Beispieldatei UNVERÄNDERT; kein Migrationscode.
- **Reine Funktionen (ADDITIV `src/finance/rebalancing.ts`; targets.ts/wealth.ts unverändert):** `calculateRebalancingAnalysis` (Komposition über share/targetValues/deviationPp/deviationEur/buy-/sellRequirement/actionLevel; Gruppen über groupTotal; G11-unbewertete raus + Namen; A6-Abdeckung; Gesamtabweichung = Σ Kaufbedarf plus größte |Pp|; Σ Kauf = Σ Verkauf ± sichtbarer Differenz), `deriveFlexibleMonthlyBudget` (A1 inkl. beitragender Pläne für die Herleitung), `calculateSavingsOnlyRebalancing` (F17/F18-Wrapper; Gruppen-Lücke gleichmäßig auf flexible Gruppen-Pläne verteilt – keine Doppelzählung; employer/provider wie fest, F18; `remainingAfterSavings`: Übergewichtungen bleiben), `estimateSavingsDuration` (CEIL, Budget ≤ 0 → null; Seed 27 Monate), `calculateFullRebalancing` (neue Verteilung = Zielverteilung, Rest ausgewiesen), `sortRebalancingEntries` (|Pp| ↓, Name de-DE), `groupRecommendations` (Partition nach Stufe). Alle pur, deterministisch, mutationsfrei, NaN/Infinity-sicher, stichtagsfrei (Injektion).
- **Datenlayer NEU `src/data/plannedChanges.ts`** (Muster savingsPlans.ts): `generatePlannedChangeId` (plan-JJJJ-MM-TT + Kollisions-Suffix), `addPlannedChange` (G5, A2, A5-Schreibprüfungen), `discardPlannedChange` (A3, pauseSavingsPlan-Muster). Fehlertexte mit Namen, nie IDs.
- **Seite NEU `src/pages/RebalancingPage.tsx`** (ersetzt Platzhalter „rebalancing"): (A) Übersicht mit lokaler Profilauswahl (Default aktives Profil; ändert NIE activeTargetProfileId, G5), 4 KPI-Kacheln (Depotwert-Basis + Anzahl bewerteter Positionen, Gesamtabweichung, größte Abweichung mit Name + Pp, Handlungsebene gesamt Text+Symbol), G11-/A6-Hinweise mit Namen, Job-Profil-Datumshinweis (30.09.2027), Leerzustände je Profiltyp (Sparraten-Referenz Ebene A / „nicht befüllt" / F21-Fehler am Profil / F20 „nicht berechenbar"); (B) Abweichungstabelle (|Pp| absteigend, Ist/Soll in € und %, Abweichung Pp+€ mit Vorzeichen, Kauf-/Verkaufsbedarf, Handlungsebene Text+Symbol, Summenzeile, Konsistenztext mit sichtbarer Differenz, fokussierbare table-wrap-Region B6); (C) Empfehlungen ausschließlich im Konjunktiv („Wenn du deine Zielallokation annähern möchtest, könntest du …"), S2-Reihenfolge sichtbar als Liste, Verkaufsoption NUR ≥ +10 Pp und an LETZTER Stelle im Satz, „keine Empfehlung nötig"-Zustand, Pflichthinweis „Empfehlungen sind rein informativ…"; (D) Sparraten-Vorschlag (Budget mit Herleitung, F17-Tabelle mit Begründungen fixed/paused/no-gap/proportional, sichtbare Rundungsdifferenz + Ausgleichs-Plan, Dauer gesamt und je Position IMMER „ungefähr …, ohne Kursentwicklung", Pflichttext „Übergewichtungen sind ohne Verkäufe nicht abbaubar" mit Beträgen, Übernahme-Button → confirm inkl. Beträgen → addPlannedChange; Abbruch = Byte-identisch); (E) Voll-Simulation mit Banner „Simulation – wird nie automatisch übernommen" + A7-Klarstellung, ohne jeden Button; (F) gespeicherte Planungen (deutsches Datum, Profil-/Positionsnamen – nie IDs, Status „geplant, nicht ausgeführt"/„verworfen" mit Symbol, Verwerfen mit confirm). Dirty-State nur bei echter Änderung (JSON-Vergleich vor applyDataChange).
- **AppLayout:** „rebalancing" ist eine echte Seite (Platzhalter ersetzt; Platzhalter-Test auf „Simulation" umgezogen). **CSS additiv:** `.simulation-banner`.
- **Doku:** calculation-rules „Rebalancing-Bausteine (M11)" (A1-Budget-Herleitung, A4-Mapping, Gesamtabweichungs-Definition, Dauer, Simulation, discarded, Konjunktiv-Regel, DepotPage-Restpunkt); data-model §3.10 + §5 Regel 5 + §6-Protokoll; requirements M11-Nachtrag; design-system „Simulations-/Hypothese-Kennzeichnung".

### Tests (Endstand **615/615 grün**, 31 Dateien, Build ✓, Lint ✓; +4 neue Tests aus der Prüfkette, K-1 erweiterte einen bestehenden)

- NEU `tests/finance/rebalancingAnalysis.test.ts` (32, inkl. der 4 Prüfketten-Nachtests): Seed×tp-job-Pins (Telekom +44,27775 Pp/+1.116,89 €; EM −11,07091; Gold −3,65529; World-Gruppe −29,55155; Kaufbedarfe 577,11/625,23/279,26/92,20; Σ 1.573,80444 = Σ Verkauf), A1-Budget 60,00/55,00/0, F17-Verteilung 23,83/22,00/10,65/3,52 mit −0,01-Ausgleich und Endsumme 60,00, remainingAfterSavings (Telekom/VL), Gruppen-Lücken-Gleichverteilung, Dauer 27 Monate (gesamt und je Position; Budget 0/NaN/∞ → null), FullRebalancing (neue Verteilung = Ziel, Rest-Ausweis), Sortierung/Gruppierung, T9 3/6/12, alle Fehlerfälle (leeres Depot, Depotwert 0, leeres/ungültiges Profil 0,9/1,1/negativ, eine Position, Gewicht 0, G11-unbewertet, A6-Abdeckungslücke, tote Referenz), Mutationsfreiheit/deepFreeze.
- NEU `tests/data/plannedChanges.test.ts` (15): ID-Konvention + Kollisions-Suffix, add (createdAt ohne Uhrzeit, Byte-Identität des übrigen Bestands, Gruppen-Referenz + Betrag 0), Fehlertexte ohne IDs (totes Profil/leere items/negativ/NaN/tote Referenz/unbekannte Gruppe/ungültiges Datum), discard (ok/Doppel mit Name+Datum/unbekannt), Rundreise (discarded + Zusatzfeld; createdAt als Datum UND Zeitstempel ladbar), Status-Enum-Negativtest, A5-E_REF_TARGET-Negativtests, Altdatei-Regression (Seed-Pin 2.522,47).
- NEU `tests/pages/rebalancingPage.test.tsx` (23): Leerzustände je Profiltyp, Seed×tp-job-Anzeige (KPIs, Tabelle inkl. Summenzeile, Job-Hinweis), Konjunktiv-Greps („könntest du" vorhanden, „solltest" NIE), Empfehlungs-Gruppen (Verkaufsoption letzte Stelle, Gold nur Anzeige, „keine Empfehlung nötig" bei < 5 Pp überall), Sparraten-Tabelle (Budget-Herleitung, Begründungen, Rundungsausgleich am SPDR, Dauer 27, „Übergewichtungen…"-Pflichttext, pausierter Gold-Plan 55,00, Budget 0-Zustand), Übernahme-Flow (confirm inkl. Beträgen → plannedChange + Dirty; Ist-Daten/Sparpläne unverändert; Abbruch Byte-identisch ohne Dirty), Simulations-Kennzeichnung + kein Button (A7), gespeicherte Planungen (Namen statt IDs, Verwerfen mit confirm/Abbruch, verworfen ohne Button), keine IDs/NaN/Infinity, A11y-Grundmuster (benannte Regionen, fokussierbare table-wrap).
- Angepasst `tests/layout/appLayout.test.tsx` (+1): „Rebalancing" ist echte Seite; Platzhalter-Test auf „Simulation" umgezogen. Regression: Dashboard (28)/Depot (43)/Sparpläne (35)/Ziele (24) und alle übrigen Suiten unverändert grün (Seed-Pins).

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. DepotPage-Zielvergleich auf `calculateRebalancingAnalysis` konsolidieren (identische Formeln, nur Dedup – als Restpunkt in calculation-rules ausgewiesen).
2. Kein Zurücksetzen verworfener Planungen (discarded → planned) in V1 – bewusster G5-Schutz.
3. `formatShare`/`formatPp` inzwischen fünffach (Dashboard/Depot/Sparpläne/Ziele/Rebalancing) – Kandidat für `src/format` (Altpunkt fortgeschrieben).
4. Gruppen-Gewichte im Sparraten-Vorschlag: die Gruppen-Lücke wird gleichmäßig auf die flexiblen Pläne der Gruppe verteilt (dokumentierte V1-Regel; eine bedarfsgenauere Aufteilung je Positions-Lücke innerhalb der Gruppe wäre eine spätere Fachentscheidung).
5. Reviewer K-2: Summenzeilen-Aggregation (Ist-/Soll-/Anteils-Summen der Tabellen per reduce in der Seite) als Analyse-Felder extrahierbar – reine Anzeige-Aggregation, kein Formel-Duplikat.
6. A11y B3 (projektweit): disabled={isSaving} kann den Fokus transient verlieren – Bestandsmuster aller Module, bei einer späteren Runde einheitlich lösen (aria-disabled + Guard).

### Bewusst nicht implementiert

Orderausführung/Broker-Anbindung, automatische Profilumschaltung, Steuerlogik, Kursabfragen, automatisches Anwenden von Planungen (auch gespeicherte Planungen ändern NIE Sparpläne), Verkaufs-Übernahme-Buttons, vierte Statusschwelle „beobachten", simulations[]-Einträge aus der Voll-Simulation (M13), Renditeannahmen in der Dauer-Schätzung.

## 2026-07-20 – Phase 14: Modul „Finanzziele und Zielerreichung" (M12) + Nutzerentscheidung U4 (abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **data-architect** (alle 10 Modellentscheidungen ratifiziert, Auflagen A–H) → **frontend-developer** (Implementierung nach verbindlicher Spezifikation) → **finance-analyst** (alle Seed-Kennzahlen und U4-Pins unabhängig bestätigt; Befunde N1/N2 + Grauzonen G1/G2) → **calculation-tester** (30+ Nachrechnungen ohne Abweichung; Testlücken L1–L6) → **accessibility-review** (0 kritisch, 3 mittel, 3 klein: B1–B6) → **reviewer** (**Freigabe mit Auflagen**; M1 behoben, K1 behoben, K2/K3 als Restpunkte). Skills finance-rules, frontend-design und quality-check angewendet.

### Prüfergebnisse (je Stufe) und behobene Auflagen

- finance-analyst: alle Werte bestätigt (U4-Pins 118,50/201,83/125/250 + 133,50-Variante; Zielwerte 627,59/2.522,47/3.150,06; Notgroschen 4.680/13,41 %; Summen 64.680/58.379,88; Zuordnungen 25/93,50/176,83/5). **N1** (behoben): F8-Katalogeintrag auf die U4-Fassung nachgezogen. **N2** (behoben): „Validierung lehnt ≤ 0 ab"-Behauptung präzisiert (negativ/nicht endlich abgelehnt; 0 speicherbar, zählt per Guard 0). **G1** (entschieden + umgesetzt): assignedOwnPlans filtert bei depotValue auf AKTIVE Positionen (konsistent zum Ziel-Ist); accountBalance/positionValue bewusst OHNE Aktiv-Filter (ausdrückliche Referenz) – dokumentiert + Tests. **G2** (dokumentiert): pausierte/manuell abgeschlossene Ziele bleiben in den Zielbetrags-Summen (nur archived raus).
- accessibility-review: **B1** Alle-Ziele-archiviert-Hinweis im Dashboard statt leerem Kartenrest; **B2** stabiler Pausieren/Reaktivieren-Umschalt-Button + Fokus auf die Kartenüberschrift nach Abschließen/Archivieren/Reaktivieren-aus-abgeschlossen; **B3** refId wird bei JEDEM Zielartwechsel geleert (kein unsichtbar klebender Zustand); **B4** Dashboard-Zielstatus mit Symbol (Text + Symbol, konsistent zu den M12-Karten); **B5** updateGoal-archived-Guard + Editor schließt beim Archivieren des bearbeiteten Ziels; **B6** design-system-Kopfzeile aktualisiert – **alle umgesetzt**.
- calculation-tester: bestanden ohne Abweichungen (inkl. Monatsraten-Kette 874,48/175/849,48 und kompletter Statuskaskade). Testlücken **L1–L6 geschlossen**: Validierungs-Negativtests (Sparplan-Betrag −5 → E_NEGATIVE_AMOUNT; Zielbetrag 0 → E_SETTINGS_RANGE), Zuordnung auf deaktivierte AUSDRÜCKLICHE Referenz bleibt bestehen, planned-vor-notComputable, Archiv-Summen-Test (64.680 → 54.680), Sortier-/Zähl-Grenzfälle, U4-Seed-Variante (Round-up mit 15 € → 133,50).
- reviewer: **Freigabe mit Auflagen.** **M1** (behoben): versehentlich gelöschte requirements-Überschrift „### M13 – Einfacher Vermögenssimulator" wiederhergestellt. **K1** (behoben): GoalsPage nutzt jetzt `assignedOwnSavings` aus der reinen Schicht statt einer Inline-Summe. **K2/K3** als Restpunkte fortgeschrieben (siehe unten).

### Verbindliche Entscheidung U4 (own_variable, ersetzt die M10-Grauzone)

- own_fixed UND own_variable zählen mit gültigem POSITIVEN festen Betrag vollständig zur eigenen Sparleistung (F8) und zum primären U3-Fortschritt; ohne Betrag (null), 0, negativ, NaN/Infinity → „zählt nicht". employer/provider bleiben extern; Umbuchungen nie; M10-Status-/Termin-/Rhythmusregeln unverändert; einmalige eigene variable Zuflüsse mit Betrag zählen real NUR im Ausführungsmonat (nie geglättet, nie F8-Rate). Kein neues Klassifikationsfeld.
- Defensivguard (Auflage A, dokumentierte Guard-Asymmetrie): `monthlyAmount` und `realAmountInMonth` behandeln nicht endliche/≤ 0-Beträge als 0 statt zu werfen (zweite Verteidigungslinie hinter Validierung/Datenlayer); wealth.ts und `annualAmount` behalten assertFinite (NaN-als-0 wäre ein erfundener Vermögenswert bzw. reiner Anzeigewert).
- Grauzonen-Restpunkt 6 der Phase 13 ist als „per U4 entschieden" fortgeschrieben; Doku in calculation-rules (U4-Absatz) + requirements (M10-U4-Nachtrag) + Kommentar in savings.ts.

### Umgesetzt (M12)

- **Datenmodell (additiv, schemaVersion bleibt 1, §6-Protokoll):** `GoalMetric` +`accountBalance` +`positionValue` +`manual`; `GoalStatus` +`archived`; `Goal` +`refId`/+`manualCurrentAmount`/+`startDate` (Defaults null). Validierung mit strikter Kopplung (Auflage B): refId nur/Pflicht bei Konto-/Positionszielen, tote/art-fremde Referenz = harter Fehler (E_REF_TARGET-Analogie), deaktivierte Referenz nur UI-Warnung; manualCurrentAmount ≥ 0 und nur bei "manual"; targetDate ≥ startDate. Beispieldatei UNVERÄNDERT; kein Migrationscode. Semantik: gespeichertes `reached` = ab M12 verbindlich „manuell abgeschlossen"; rechnerisch erreicht wird NIE gespeichert.
- **Reine Schicht (src/finance/goals.ts, Teil C):** `isEmergencyFundGoal` (Auflage-D-Doppel-Guard, exakte Dashboard-Parität), `effectiveGoalTarget`, `goalActualValue` (metric-Verzweigung NUR hier; latestEntry-Wiederverwendung; refInactive-Warn-Flag; U3-Basis für monthlySavingsRate), `normalizedActualForStatus` (G11/Auflage E: vollständig unbekannter Ist → null, nie erfundene 0), `goalSurplus`, `remainingFullMonths` (konservative Monatszählregel: volle Kalendermonatswechsel, angebrochener Monat zählt nicht), `requiredMonthlyRate`, `forecastMonthsToTarget` (reine Division OHNE Rendite-/Kursannahme), `rateGap`, `deriveGoalStatus` (verbindliche 8-Stufen-Rangfolge inkl. manuell-vor-rechnerisch), `assignedOwnPlans`/`assignedOwnSavings` (ableitbare Zuordnung ohne goalId-Feld; Doppelzählungs-Schutz dokumentiert), `countGoalsByStatus`, `compareGoalEntries` (Status-Rang → Zieldatum → Name de-DE).
- **Datenlayer (NEU src/data/goals.ts):** generateGoalId/addGoal/updateGoal (Teil-Patch, K2-Byte-Identität: optionale Schlüssel nie als Default-null-Schlüssel materialisiert; Auflage-C-Metrikwechsel-Normalisierung: weg von Konto-/Positionsziel verwirft nicht mitgegebenes refId, weg von manual verwirft manualCurrentAmount; isAutoCalculated per Spread erhalten, nicht änderbar)/pauseGoal/resumeGoal/completeGoal (manueller Abschluss)/archiveGoal (endgültig, KEIN Löschen). Fehlertexte mit Namen, nie IDs.
- **UI (NEU src/pages/GoalsPage.tsx, ersetzt den Platzhalter „ziele"):** Zusammenfassung (aktive/rechnerisch erreichte Ziele, Summe Zielbeträge/verbleibend MIT Pflicht-Überschneidungs-Kennzeichnung, ohne Sparraten-Ziele; bewusst KEINE Ist-Summen-Kachel; Aufmerksamkeitsliste); Zielliste als Karten (goal-list-Muster, mobile-tauglich) mit G11-Anzeigen („unbekannt"/„offen"/„nicht berechenbar"), M10-Balkenmuster (gedeckelt + echter Prozenttext via aria-describedby), Rest + informativem Überschuss, Status Text+Symbol, Zieldatum + verbleibenden vollen Monaten, benötigter Monatsrate mit Zeitbasis-Erklärung, zugeordneter bzw. klar gekennzeichneter allgemeiner eigener Sparleistung, Referenz-Warnungen (Namen); aufklappbares Zieldetail (Berechnungsgrundlage in Worten, real vs. „geglättet (Analysewert)", Prognose mit Pflichttext „Ohne Rendite-/Kursannahme – keine Prognosegarantie", benötigt vs. vorhanden mit Differenz, rechtzeitig/verspätet, Statusbegründung, fehlende Daten); Verwaltung mit key={goal.id}-Formular, parseGermanAmount, Fokus aufs erste Fehlerfeld (B3), Escape/Fokus-Rückgabe, Zielart steuert Referenz-/Manuell-Felder, Notgroschen-Sonderfall (Zielart/Zielbetrag nicht editierbar, berechneter Wert + Einstellungs-Hinweis); Statusaktionen mit window.confirm inkl. Name + Kerninfo; Dirty-Vergleich vor applyDataChange ÜBERALL (K3). Auflage F: Sparraten-Ziele ohne Monatsrate/Prognose/Monatszählung.
- **Dashboard-Minimaländerung (Auflage H, atomar):** GoalEntry nutzt jetzt `goalActualValue`/`effectiveGoalTarget`/`normalizedActualForStatus` statt einer eigenen metric-Verzweigung (Verzweigung EINMAL in der reinen Schicht); GOAL_STATUS_LABELS +archived; archivierte Ziele werden im Dashboard AUSGEBLENDET (dokumentiert). Alle 28 Dashboard-Tests unverändert grün (Seed-regressionstreu).
- **AppLayout:** „ziele" ist eine echte Seite (Platzhalter ersetzt).
- **Doku:** data-model §3.9 (neue Felder, Status-Semantik, bewusste Nicht-Felder) + §6-Protokolleintrag; calculation-rules „Ziel-Bausteine (M12)" + U4-Absatz bei den Sparplan-Bausteinen; requirements M10-U4-Nachtrag + M12-Nachtrag; design-system Zielkarten-Muster.

### Tests (Endstand **544/544 grün**, 28 Dateien, Build ✓, Lint ✓; +9 aus der Prüfkette: L1×2, L2, L3, L4, L5, L6, B1-Dashboard-Test, updateGoal-archived-Guard)

- Erweitert `tests/finance/goals.test.ts` (10 → 46): effectiveGoalTarget (Guard-Parität Auflage D), goalActualValue je Zielart inkl. toter/inaktiver Referenz und Stichtag-Injektion, G11-Normalisierung (Auflage E inkl. „nie überfällig mit 0 %"-Integration), goalSurplus/rateGap, remainingFullMonths (gleicher Monat, Monatsende, Jahreswechsel, Vergangenheit, ungültig), requiredMonthlyRate/forecastMonthsToTarget (0 Monate, erreicht, ceil, Rate 0/NaN/Infinity ohne Throw), deriveGoalStatus-Komplettkaskade (reached schlägt sinkenden Ist; reachedNow fällt zurück; targetDate=Stichtag nicht überfällig; startDate=Stichtag nicht geplant; reachedNow trotz überschrittenem Termin), assignedOwnPlans/-Savings je Zielart + Doppelzählungs-Schutz, Sortierung/Aggregation, Reinheit.
- Erweitert `tests/finance/wealthAndSavings.test.ts` (+12): U4-Suite mit den 12 Pflicht-Fällen (Seed-Pins 118,50/201,83/125/250; Round-up bleibt amount null; Guard-Pins ohne Throw). Erweitert `tests/finance/schedule.test.ts` (+1): realAmountInMonth-U4-Guard.
- NEU `tests/data/goals.test.ts` (21): add/update/pause/resume/complete/archive, K2-Byte-Identität (leerer Patch, identische Werte, Altdatei-Ziel ohne optionale Schlüssel), Auflage-C-Metrikwechsel, isAutoCalculated unveränderbar, Fehlertexte ohne IDs, Rundreise mit neuen Feldern + archived + unbekanntem Zusatzfeld (DM9-Analogie), Negativtests je Auflage B, Altdatei-Regression mit gepinnten Seed-Werten, Reinheit.
- NEU `tests/pages/goalsPage.test.tsx` (24): Leerzustände, Zusammenfassung (64.680/58.379,88 inkl. Pflicht-Kennzeichnung, keine Ist-Summen-Kachel), Notgroschen-Karte (4.680/627,59/13,41 % + Balkenmuster), offene/pausierte Ziele, Auflage-F-Ausschluss, >100 % (Balken gedeckelt, 106,84 %, Überschuss 320), Auflage-E-Anzeige, Referenz-Warnung (Namen), Monatsrate 874,48 € mit Zeitbasis-Erklärung, Prognose 175 Monate + Pflichttext, Formulare (anlegen je Zielart, A→B-key, B3-Fokus, Abbruch/unverändert/Escape ohne Dirty, Notgroschen-Sonderfall), Statusaktionen mit confirm + Dirty inkl. Dashboard-Ausblendung nach Archivieren, keine IDs/NaN/Infinity/undefined.
- Additiv `tests/layout/appLayout.test.tsx` (+1): „Ziele" ist echte Seite. Regression: dashboardPage (28), savingsPlansPage (35), savingsPlans-Datenlayer und alle übrigen Suiten unverändert grün (U3/F8/F10/F19/F20-Pins).

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. `formatShare` inzwischen vierfach (Dashboard/Depot/Sparpläne/Ziele) – Kandidat für `src/format` (Altpunkt fortgeschrieben).
2. Notgroschen-Folgeziel-Vorschläge nach Zielerreichung (requirements M12 „nur Vorschläge") sind als Statusanzeige umgesetzt; eine eigene Vorschlagsliste kann später folgen.
3. Reviewer K2: die Summenregeln der Ziel-Zusammenfassung (Archiv-/Sparraten-Ausschluss) leben als dokumentierte, testgepinnte Anzeige-Regel in der GoalsPage – Extraktionskandidat für die reine Schicht.
4. Reviewer K3: Fehlercode `E_AMOUNT_NULL` wird (M10-Konvention) auch für dueMonth-/validUntil-Prüfungen wiederverwendet – kosmetisch.
5. Die 20,18-%-Analysequote des Sparraten-Ziels erscheint auf der Ziele-Seite als €-Betrag, die Prozent-Darstellung nur im Dashboard/auf der Sparplan-Seite (uneinheitlich, kein Verstoß).

### Bewusst nicht implementiert (Teil H)

Bank-/Broker-Sync, automatische Überweisungen/Sparplanänderungen/Käufe, Rebalancing-Empfehlungen aus Zielen, F10-Übernahme, Kursabfragen, Cloud, Performance/Dividenden/Steuern, Rendite-/Inflationsannahmen, automatische Zielpriorisierung, automatische Verteilung freier Sparleistung, versteckte Empfehlungen, Schein-Präzision.

## 2026-07-20 – Phase 13: Modul „Sparpläne und Zuflüsse" (M10, abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **data-architect** (alle 10 Modellentscheidungen ratifiziert, Auflagen 2a–2h) → **frontend-developer** (Implementierung nach verbindlicher Spezifikation inkl. Nutzerentscheidung **U3** zur Sparraten-Bezugsgröße) → **finance-analyst** (alle Seed-Kennzahlen unabhängig bestätigt; Befunde F1–F3) → **calculation-tester** (20 Nachrechnungen ohne Abweichung; Befunde M10-1/2/3 + kleine Testlücken) → **accessibility-review** (0 kritisch, 3 mittel, 3 klein: B1–B6) → **reviewer** (**Freigabe mit Auflagen**; Auflage M1 = dieser Eintrag, Kleinbefunde K2/K3/K4 behoben, K1/K5 als dokumentierte Entscheidungen ausgewiesen). Skills finance-rules, frontend-design und quality-check angewendet.

### Prüfergebnisse (je Stufe) und behobene Auflagen

- finance-analyst: alle Kennzahlen bestätigt (eigen 118,50/201,83; extern 6,50/48,17; gesamt 125/250; Jahr 2.422/578/3.000; F19-Differenz 0,04; Juli-Realsicht 1.625; U3 11,85 %/20,18 %; F10 Σ 225). **F1** (mittel, behoben): die „Einmalige Zuflüsse"-Jahressicht war ans Aktivfenster gebunden und damit faktisch leer → jetzt kalenderjahresbasiert (auch geplante/abgeschlossene Einmalzuflüsse des Jahres, pausierte nicht). **F2** (niedrig, behoben): nextDueDate-yearly-Kandidatenjahre starten jetzt beim späteren aus Stichtags-/validFrom-Jahr. **F3** (niedrig, behoben): F10 zeigt zusätzlich die aggregierte „MSCI World gesamt"-Zeile (85 € · 37,78 %), Granularität in calculation-rules geklärt.
- accessibility-review: **B1** roher Gruppen-Schlüssel im Soll-Vergleich → GROUP_LABELS („World (Gruppe)"); **B2** Filter-Dimensionen als benannte Gruppen (role=group + aria-labelledby); **B3** Fokus aufs erste Fehlerfeld nach Absenden + fokussierbare Sammelmeldung; **B4** Formular-Überschrift h4 (Hierarchie); **B5** bewusste Entscheidung dokumentiert (Status-Spalte ist das Gruppensignal); **B6** table-wrap als fokussierbare benannte Region mit eigenem Namen + sichtbarem Fokus – **alle umgesetzt**.
- calculation-tester: 20 Sollwerte exakt reproduziert, Kalender-Randfälle bestätigt. **M10-1** (mittel, behoben): realAmountInMonth prüft validUntil jetzt TAGGENAU am geklemmten Zahltag (konsistent mit nextDueDate). **M10-2/3** (mittel, behoben): Intervallwechsel-Normalisierung in updateSavingsPlan (weg von yearly → dueMonth verworfen; weg von once → Normalisierungs-Enddatum zurückgesetzt, ausdrückliches Enddatum bleibt) + UI-Feldleerung beim Rhythmuswechsel. Kleine Lücken behoben: NaN-Negativtest, Reinheitstest schedule, yearly-nextDueDate mit validUntil.
- reviewer: **Freigabe mit Auflagen.** **K2** (behoben): unverändertes Speichern eines Plans OHNE isFlexible-Schlüssel bleibt jetzt Byte-identisch (Schlüssel wird nur bei Abweichung vom Default angelegt, Regressionstest). **K3** (behoben): „Beenden" vergleicht vor applyDataChange (kein falscher Dirty-State bei bereits gesetztem Enddatum). **K4** (behoben): Sparziel-Überschrift kommt aus goal.name statt hartkodiert. **K1/K5** (dokumentiert in requirements M10 „Bewusste Abweichungen"): keine „ca. 260–265 €"-Schätzsumme ohne Ist-Buchungen (G11); In-place-Bearbeitung ohne Planversionierung (Vergangenheit ausschließlich aus transactions).

### Umgesetzt

- **Datenmodell (additiv, schemaVersion bleibt 1, §6-Protokoll):** `Interval` +`quarterly` +`halfyearly` +`once`; `SavingsPlan.isPaused` (Default false). Validierung: INTERVALS erweitert, `optBoolean(isPaused)`, once erfordert amount ≠ null und validUntil null/= validFrom (tolerant, 2a), numerisches `dueMonth` nur bei yearly (Verschärfung 2f, als Ausweis in data-model §6 protokolliert). Beispieldatei UNVERÄNDERT; kein Migrationscode.
- **Reine Funktionen:** `src/finance/savings.ts` +`paymentsPerYear` (12/4/2/1/1), +`annualAmount` (amount null → null, G11), +`aggregateMonthlyBy` (generischer Summen-Gruppierer); `monthlyAmount` erweitert (smoothed: quarterly /3, halfyearly /6, once → 0 – atomar mit INTERVALS, Auflage 2g); `isPlanActiveOn` schließt pausierte Pläne aus (F8/F9-Folge gewollt). NEU `src/finance/schedule.ts` (pur, stichtags-injiziert, string-/UTC-Kalender): `realAmountInMonth` (Monats-Realsicht inkl. Zyklus ab validFrom, dueMonth, once; isPaused-Grenze 2c im Docblock), `nextDueDate` (Monatsende-Klemmung 31./Februar/Schaltjahr, Zyklus über Jahresgrenze, validUntil), `hasUnknownSchedule`, `planStatus` (Rangfolge 2b: abgeschlossen → beendet → pausiert → geplant → aktiv).
- **Datenlayer NEU `src/data/savingsPlans.ts`** (Muster accounts.ts, Result-Typ, Fehlertexte mit Namen, nie IDs): `generateSavingsPlanId` (sp-…, collectAllIds), `addSavingsPlan` (once-Normalisierung validUntil = validFrom, 2a), `updateSavingsPlan` (zieht bei once das validUntil mit; fügt fehlende optionale Schlüssel nicht neu hinzu → unverändertes Speichern bleibt Byte-identisch), `pauseSavingsPlan`/`resumeSavingsPlan`, `endSavingsPlan` (once nicht beendbar – automatisch abgeschlossen). Kein Löschen von Sparplänen.
- **Seite NEU `src/pages/SavingsPlansPage.tsx`:** Liste (13 Spalten, Statusgruppen aktiv/geplant → pausiert → beendet/abgeschlossen, Standard-Sortierung nächster Termin ↑ dann Betrag ↓, 6 Sortier-Buttons mit aria-sort, Filter Status/Herkunft/Regelmäßigkeit/Zieltyp mit sichtbarem Aktiv-Zustand + „Filter zurücksetzen", inaktive Ziele mit sichtbarer Warnung, variable Beträge als „variabel (nicht garantiert)"); Summen (eigen/extern/gesamt je real und geglättet (Analysewert), Monats-Realsicht des Stichtagsmonats klar abgegrenzt von F8, Jahreswerte mit sichtbarer F19-Anzeige-Rundungsdifferenz 0,04, Einmalbeträge GETRENNT (2h), Umbuchungszeile, Gruppierung nach Ziel und Herkunft); 1.000-€-Sparziel nach U3 (primärer Balken eigene reale Sparleistung 11,85 %, geglätteter Analysewert 20,18 % gekennzeichnet, Gesamtzufluss nur zur Einordnung, Erklärtext inkl. Risiko-d-Hinweis zu quarterly/halfyearly); F10-Referenzverteilung (Datenbasis sichtbar benannt, je Ziel Betrag + Anteil, Ebene-A-Hinweis im Seed, Pflichthinweis wörtlich, Abweichungsvergleich NUR bei savingsRate-Profil mit gespeicherten Gewichten – über targets.ts, ohne Empfehlungen); Formulare (key={plan.id}, parseGermanAmount, feldnahe Fehler, dueMonth nur bei yearly, „variabel" nur bei own_variable/provider, validFrom-Konventions-Hilfetext 2e, Escape/Fokus-Rückgabe); Pausieren/Reaktivieren/Beenden mit window.confirm inkl. Namens-/Betragsnennung; Abbrechen/unverändertes Speichern → KEIN applyDataChange (Vergleich vor Übernahme). Einbindung in AppLayout (Platzhalter ersetzt); CSS additiv (.filter-bar/.filter-button).
- **Dashboard-Minimaländerung:** GoalEntry-Zweig `monthlySavingsRate` zeigt jetzt nach U3 den primären Fortschritt (Balken + „Fortschritt auf Basis deiner eigenen realen monatlichen Sparleistung") plus geglätteten Analysewert (Text, gekennzeichnet); GoalEntry erhält ownReal/ownSmoothed als Props. Sonst NICHTS am Dashboard geändert.
- **Doku:** data-model §3.6 (Intervalle, isPaused, once-Regeln, Statusmodell, Herkunfts-Mapping, provider-Abgrenzung 2d, validFrom-Konvention 2e) + §6-Protokolleintrag; calculation-rules „Sparplan-Bausteine (M10)" (U3, Glättungsfaktoren, Kalenderregeln, Statusmodell, F10-Datenbasis, Monats-Realsicht-Verwechslungsschutz) + M7-Absatz „offen" aufgelöst; requirements M10 U3-Nachtrag + Restpunkte; design-system Filterleiste + Statusgruppen-Liste.

### Tests (Endstand **440/440 grün**, 26 Dateien, Build ✓, Lint ✓)

- NEU `tests/finance/schedule.test.ts` (27): realAmountInMonth je Intervall inkl. Fenster/Zyklus über Jahresgrenze/isPaused/TAGGENAUES validUntil (M10-1); nextDueDate inkl. 31.-Klemmung, Februar, Schaltjahr 2024/2026, validUntil mitten im Zyklus und bei yearly, once vergangen, yearly ohne dueMonth, yearly weit vorausgeplant (F2); Status-Kaskade 2b komplett; Reinheitstest.
- NEU `tests/data/savingsPlans.test.ts` (26): add/update/pause/resume/end inkl. once-Normalisierung 2a, Intervallwechsel-Normalisierung (M10-2/3), Fehlertexte ohne IDs, unverändertes Speichern Byte-identisch (inkl. Plan ohne isFlexible-Schlüssel, K2), NaN-Ablehnung, deepFreeze; Validierungs-Rundreise quarterly/halfyearly/once/isPaused + unbekanntes Zusatzfeld; Altdatei-Regression (Seed, 118,50/201,83/125/250 gepinnt); Negativtests weekly, dueMonth auf nicht-yearly (2f), once+amount null, once+validUntil≠validFrom, isPaused nicht-boolean.
- NEU `tests/pages/savingsPlansPage.test.tsx` (35): Summen (inkl. Monats-Realsicht Juli 1.625,00, Jahreswerte 2.422/578/3.000, F19-Differenz 0,04, Umbuchungen 75, G11-„unbekannt"), Filter/Sortierung/Statusgruppen, keine IDs/kein NaN, Pausieren/Beenden mit confirm + Dirty-State, Formulare (A→B-key, Abbruch, unverändertes Speichern ohne Dirty, 1.234/1.234,56/1234,56/0,01, negative/ungültige Beträge, Enddatum<Start, Escape), once-Zeile + kalenderjahresbasierte Jahressicht inkl. geplanter Einmalzufluss (F1), Sparziel (11,85 %/20,18 %, nur-extern → 0 %, exakt 1.000 → 100 %, über 1.000 → Balken gedeckelt, pausierte Pläne zählen nicht, kein Ziel/kein Zielbetrag, datengetriebene Überschrift K4), F10 (Datenbasis, 17,78 %/55,56 %, World-gesamt 37,78 % (F3), Gruppen-Namen im Soll-Vergleich (B1), Ebene-A- und Pflichthinweis, nicht berechenbar).
- Additiv `tests/finance/wealthAndSavings.test.ts` (+7): paymentsPerYear, annualAmount, monthlyAmount je Intervall (120 vierteljährlich → 40 geglättet/0 real), isPlanActiveOn-isPaused, aggregateMonthlyBy, 12-Monats-Konsistenz 2.422,00 inkl. sichtbarer 0,04-Anzeige-Differenz, F10-Basis über aggregateMonthlyBy (0,3777778/0,0444444/0,0222222/0,5555556), Reinheit.
- Angepasst: `tests/pages/dashboardPage.test.tsx` (Sparraten-Ziel: 11,85 %-Fortschritt + 20,18 %-Analysewert ersetzt den „KEIN Fortschritt"-Test; neuer Test „externe Zuflüsse erhöhen den primären Fortschritt nicht"); `tests/layout/appLayout.test.tsx` (Sparpläne ist echte Seite; Platzhalter-Test auf Rebalancing umgezogen).

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. Ist-Erfassung variabler Zuflüsse (`transactions`) folgt in einer späteren Runde (Datenmodell existiert; Spec-Abschnitt 8) – damit hängt auch die bewusst NICHT angezeigte „ca. 260–265 €"-Schätzsumme zusammen (K1, in requirements M10 als Entscheidung ausgewiesen).
2. Budget-Warnung gegen den M14-Grenzwert folgt mit M14.
3. Keine Pausen-HISTORIE – `isPaused` ist ein Momentzustand (dokumentiert in data-model §3.6 und schedule.ts); In-place-Bearbeitung ohne Planversionierung (K5, in requirements M10 ausgewiesen).
4. „Beenden" setzt das Enddatum auf den Stichtag (heute); ein frei wählbares Enddatum ist über „Bearbeiten" möglich.
5. `formatShare` inzwischen dreifach (Dashboard/Depot/Sparpläne) – Kandidat für `src/format` (Altpunkt fortgeschrieben).
6. ~~Grauzone (finance-analyst): ein `own_variable`-Plan MIT gesetztem Betrag zählte voll in F8 und damit in den primären U3-Fortschritt – der Fall „variabler Plan mit festem Planbetrag" ist fachlich nicht entschieden.~~ **Per verbindlicher Nutzerentscheidung U4 ENTSCHIEDEN (Phase 14, 2026-07-20):** own_variable mit gültigem positivem festem Betrag zählt vollständig zur eigenen Sparleistung und zum primären U3-Fortschritt; ohne Betrag/0/negativ/nicht endlich zählt nicht (Defensivguard in der reinen Schicht). Dokumentiert in calculation-rules „Sparplan-Bausteine (M10)" (Absatz U4) und requirements M10 (U4-Nachtrag); 12 Pflicht-Testfälle in tests/finance/wealthAndSavings.test.ts.
7. Fokus-aufs-Fehlerfeld-Muster (B3) und fokussierbare Tabellen-Region (B6) auf AccountsPage/DepotPage übertragen (dort gleiche Alt-Lücke).

### Übergabepunkte für kommende Module

M11 (Rebalancing) kann direkt aufsetzen: F10-Basis + `aggregateMonthlyBy` liefern die Sparraten-Ist-Verteilung, der Soll-Vergleich (targets.ts) existiert bereits als reine Anzeige – M11 ergänzt Schwellen/Empfehlungen (actionLevel) und geplante Einstellungen; `nextDueDate`/`realAmountInMonth` sind Bausteine für Monatsfinanzen/Simulation; das Ziele-Modul (M12) übernimmt die U3-Bezugsgröße unverändert aus calculation-rules „Sparplan-Bausteine (M10)".

## 2026-07-19 – Phase 12: Modul „Übersicht / Dashboard" (M7, abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **frontend-developer** (Implementierung nach verbindlicher Spezifikation) → **finance-analyst** (alle Seed-Kennzahlen unabhängig bestätigt, 1 mittlerer + 1 kleiner Befund) → **calculation-tester** (15 Nachrechnungen ohne Abweichung, 2 mittlere + 4 kleine Testlücken) → **accessibility-review** (0 kritisch, 1 mittel, 5 klein) → **reviewer** (**Freigabe mit Auflagen**; die mittlere Auflage wurde umgesetzt). Alle mittleren und die sinnvollen kleinen Befunde behoben. Skills finance-rules, frontend-design und quality-check angewendet.

### Umgesetzt

- **Seite `src/pages/DashboardPage.tsx` (rein LESEND – kein applyDataChange/dispatch):** Dateistatus (Dateiname, Speicherzeitpunkt bzw. „Stand der Datei", Ungespeichert-Status als Text+Symbol, aktuelles Bewertungsdatum); Vermögen (4 KPI-Kacheln Gesamtvermögen F1 / Depotwert F2 / Tagesgeld / sonstiges aktives Kontovermögen + Sekundärzeilen World F7, Anteile F3/F4, Zähler aktiver Konten und Positionen); Sparen und Zuflüsse (eigene Sparleistung und Gesamtzufluss je real und geglättet – vier getrennte Kacheln, geglättete mit Label „geglättet (Analysewert)", Erklärblock im Details-Muster); Ziele (Dateireihenfolge, Notgroschen auto-berechnet, Ist/Ziel/Rest/Prozent, natives `<progress>` mit sichtbarem Textwert und aria-describedby, Erreicht-Hinweis ohne Automatik, Leerzustand); Datenqualität (fehlende Werte als NAMEN, geladene Warnungen mit ID→Name-Ersetzung, neuester vollständiger Snapshot, Hinweis bei Wertänderungen seit Snapshot mit Navigations-Button); Navigations-Toolbar (Konten/Depot/Daten & Backups).
- **Neue reine Funktionen:** `src/finance/goals.ts` (`effectiveEmergencyFundTarget` = manualOverride ?? factor × netto; `goalProgress` mit Rest = max(0, Ziel−Ist), Anteil über share/F20, erreicht bei Ist ≥ Ziel, Ziel ≤ 0 → null); `accountsValue` in `src/finance/wealth.ts` (Summe jüngster Salden je Typenliste, missingIds nach G11); 4 Snapshot-Helfer in `src/data/snapshot.ts` (`isSnapshotComplete`, `latestCompleteSnapshotDate`, `hasEntriesAfter`, `latestValuationDate`); `formatIsoTimestampGerman` in `src/format/date.ts`.
- **„Sonstiges aktives Kontovermögen"** = giro + cash + ruecklage + bargeld + sonstiges + krypto (pension NIE – Merkposten ohne Wert; depot NIE – kein Doppelzählen über Kontosalden); fließt NICHT ins Gesamtvermögen (GV bleibt strikt Tagesgeld + Depot) und ist auf der Kachel entsprechend beschriftet.
- **docs/design-system.md erstmals befüllt** (KPI-Kacheln, StartHint, Details-Muster, Warn-Panels, Fortschrittsanzeige inkl. aria-describedby-Regel, Formulare, Tabellen, deutsche Formate inkl. „unbekannt"-Regel).

### Getroffene Entscheidungen (dokumentiert, keine stillen Fachregeln)

- **Ziel „Monatlich 1.000 € Sparrate" (metric `monthlySavingsRate`): bewusst KEIN Fortschritt berechnet** – die Bezugsgröße (eigene Sparleistung vs. Gesamtzufluss, real vs. geglättet) ist fachlich nicht festgelegt. Das Dashboard zeigt Zielbetrag + Hinweis; die offene Entscheidung steht im M7-Absatz von calculation-rules.md. **→ Nutzerentscheidung nötig.**
- **G11-Präzisierung:** Hat KEIN relevanter Eintrag einer Summen-Kennzahl einen erfassten Wert, zeigt die Kachel/Zeile „unbekannt" – nie eine leere 0-Summe (defensiver `>=`-Vergleich); Teilsummen tragen „enthält unbekannte Werte". Gilt für GV/Depot/Tagesgeld/Sonstiges UND die World-Zeile (Reviewer-Auflage M1).
- **Stichtag injiziert:** neuer Kontextwert `todayIso` im FinanceDataProvider (aus der now-Prop) – das Dashboard nutzt nie die eigene Systemuhr für den Sparplan-Aktivitätsfilter (finance-analyst-Befund; Altseiten siehe Restpunkte).
- **`isSnapshotComplete` ohne vakuumwahre Vollständigkeit:** 0 aktive Positionen UND 0 aktive Tagesgeldkonten → nichts zu bewerten → NICHT vollständig.
- **`hasEntriesAfter` bewusst OHNE Aktiv-Filter:** auch ein späterer Eintrag an einer inzwischen deaktivierten Position gilt als Wertänderung nach dem Stichtag (Test + Doku).
- **Auto-Ziel-Guard:** `isAutoCalculated` greift nur für die Tagesgeld-Kennzahl (Notgroschen); ein Auto-Ziel mit fremder Kennzahl läuft in seinen Kennzahl-Zweig und wird nie stillschweigend als Notgroschen behandelt.
- **Krypto-Flag-Hinweis dokumentiert:** die Typenliste des sonstigen Kontovermögens enthält `krypto` unabhängig von `includeInInvestedWealth`; bei Einführung einer Anlagevermögen-Kennzahl ist die Zuordnung je Flag neu zu entscheiden (keine Doppelzählung).

### Prüfergebnisse (je Stufe) und behobene Auflagen

- finance-analyst: alle Kennzahlen am Seed bestätigt (GV 3.150,06; World 1.020,30; Anteile 80,08/19,92 %; Sparen 118,50/201,83/125,00/250,00; Notgroschen 4.680/627,59/4.052,41/13,41 %; Depotziel 25,22 %; GV-Ziel 6,30 %); 1 mittel (Systemuhr statt injiziertem Stichtag → todayIso im Kontext) + 1 klein (hasEntriesAfter-Doku/Testlücke) – **behoben**; Grauzonen „0,00 € bei vollständig unbekannter Summe" und „isAutoCalculated vor metric" ebenfalls **umgesetzt**.
- accessibility-review: 1 mittel (roher ISO-Zeitstempel bei „Zuletzt gespeichert" – neuer gemeinsamer Formatter `formatIsoTimestampGerman`, auch im Header verwendet) + 5 klein (B2 „–" → „unbekannt – noch kein Bewertungsdatum erfasst"; B3 deutsche Daten in W_FUTURE_DATE/W_SNAPSHOT_INCOMPLETE upstream in validateFinanceData; B4 aria-describedby am `<progress>`; B5 Dubletten-Button „Snapshot erfassen (Depot)" entfernt; B6 `.goal-heading`-CSS definiert) – **alle behoben**.
- calculation-tester: 15 Nachrechnungen ohne Abweichung; 2 mittlere Testlücken (Balken-Kappung real ausgeübt: 5.000/4.680 → Balken 4.680, Text 106,84 %; negatives Ist: −100 → Balken 0, Text −2,14 %, Rest 4.780) + 3 kleine (vakuumwahre Vollständigkeit, Override ≤ 0 → „kein gültiger Zielbetrag", Kalender-Überlauf-Guard in formatIsoDateGerman inkl. Schaltjahr-Tests, defensives `>=`) – **alle umgesetzt**.
- reviewer: **Freigabe mit Auflagen**; Auflage M1 (World-Zeile folgt der G11-Regel + Testfall) **umgesetzt**; K3 (Import-Kosmetik) behoben; K2 als Restpunkt fortgeschrieben.
- Endstand: **342/342 Tests grün** (23 Dateien; dashboardPage 27, goals 10, date 6, snapshot +8 M7-Helfer, wealthAndSavings +4 accountsValue), `npm run build` ✓, `npm run lint` ✓.

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. **Bezugsgröße des Sparraten-Ziels** (`monthlySavingsRate`) – Nutzerentscheidung nötig, bis dahin kein Fortschritt im Dashboard.
2. `localTodayIso` in AccountsPage/DepotPage nutzt weiterhin die Systemuhr (nur Formular-Defaults; mit dem neuen `todayIso` aus dem Kontext existiert jetzt der saubere Ersatzpfad – in einer späteren Runde nachziehen; Altpunkt M8/M9).
3. captureSnapshot-Fehlertext (snapshot.ts) enthält weiterhin ISO-Rohdaten (M9-Restpunkt 5, fortgeschrieben).
4. `todayIso` aktualisiert sich erst mit dem nächsten Render (kein Mitternachts-Refresh) – für ein Anzeige-Stichtagsdatum akzeptabel.
5. `formatShare` ist in DashboardPage und DepotPage identisch implementiert – Kandidat für `src/format` (reine Anzeige-Helfer-Dedup).
6. W4-Folge aus M9 unverändert: nach einem Snapshot neu angelegte Positionen lassen ältere Snapshots als unvollständig gelten → Dashboard meldet dann „Noch kein vollständiger Snapshot vorhanden" (dokumentierte Warn-Semantik).

### Bewusst nicht implementiert

Komplexe Diagramme/Charts (bewusst; kleine barrierefreie `<progress>`-Anzeigen mit Textwerten stattdessen), jede Bearbeitungsfunktion (Dashboard ist rein lesend), automatische Korrekturen/Rebalancing-Ausführung, Zielverwaltung (Anlegen/Ändern von Zielen – späteres Modul M12), Fortschritt des Sparraten-Ziels (offene Bezugsgröße), Mitternachts-Refresh des Stichtags.

### Übergabepunkte für kommende Module

KPI-Kacheln (`kpi-grid`/`kpi-tile` + `aggregatedDisplay`-Regel), `facts-list`, `goal-list`/`goal-progress` (inkl. aria-describedby-Muster), Warn-Panel mit ID→Name-Ersetzung, `formatIsoTimestampGerman` und `todayIso` aus dem Kontext sind wiederverwendbar; die Zielverwaltung (M12) sollte zuerst die Bezugsgrößen-Entscheidung des Sparraten-Ziels einholen; `goals.ts`/`accountsValue`/Snapshot-Helfer sind reine Bausteine für Simulation (M11) und Monatsfinanzen.

## 2026-07-19 – Phase 11: Modul „Depot" (M9, abgeschlossen, Freigabe)

Vollständige Prüfkette durchlaufen: **data-architect** (7 Modellvorschläge ratifiziert/präzisiert) → **frontend-developer** (Phasen A–E) → **finance-analyst** (fachliche Prüfung, Seed-Kennzahlen nachgerechnet) → **calculation-tester** (+9 Tests, unabhängige Nachrechnung) → **accessibility-review** → **reviewer** (**Freigabe**, alle wesentlichen Auflagen behoben). Skills finance-rules, frontend-design und quality-check angewendet.

### Getroffene Entscheidungen (data-architect-ratifiziert)

- **Additive Schema-Erweiterung (schemaVersion bleibt 1, Protokoll §6):** `PortfolioPosition.isActive` (Default true). **Kein Löschen** von Positionen (stabile Referenzen in savingsPlans/weights/transactions) – nur Deaktivieren/Reaktivieren mit Bestätigung inkl. Betragsnennung. **Keine** Felder Stückzahl/WKN/Ticker (nicht im Modell; „sofern vorgesehen"-Auftrag) und **keine** Gruppe „Sonstige" (Zielprofile/World-Aggregation beruhen auf den vier Gruppen – Erweiterung wäre Nutzer-Fachentscheidung, Restpunkt). Gruppe bestehender Positionen nicht änderbar; Konto-Umzug nur auf aktives Depot-Konto.
- **Snapshot-Semantik (`captureSnapshot`, src/data/snapshot.ts):** ganz-oder-gar-nicht mit 9 Fehlerstufen (Kalenderdatum, keine Zukunft, gesperrtes Datum, vorhandener Snapshot – Ersetzen ist nach Regel 6/15 NICHT erlaubt, Korrektur nur als neuer Snapshot –, leerer Inhalt, Unvollständigkeit ohne stille 0, überzählige/inaktive IDs, Endlichkeit, Negativregeln: Positionswerte strikt ≥ 0, Kontosalden nach DM20). Registry-Eintrag `locked: true`/`source: "user"` ab Speicherung; Rückdatierung vor den jüngsten Snapshot nur mit Bestätigung. Vollerfassung = alle AKTIVEN Positionen + alle AKTIVEN Tagesgeldkonten.
- **W4-Neufassung** (dokumentierte M8-Übergabe): Vollständigkeitswarnung erwartet nur aktive Positionen/Tagesgeldkonten; Einträge inaktiver sind legitime Historie.
- **Doppelzählungsschutz:** unverändert – Depotwert ausschließlich aus aktiven Positionen; Depot-Konten ohne Saldo (C2); Pflicht-Hinweis wörtlich auf der Seite. Fehlende Werte = „unbekannt", nie 0 (missingIds); Division durch 0 → „nicht berechenbar". Inaktive Positionen in keiner aktiven Summe (Aufruferfilter; reine Funktionen unverändert; `groupTotal` als F7-Verallgemeinerung ergänzt, worldTotal delegiert).
- **Zielvergleich nur Anzeige:** lokale Profilauswahl ohne Änderung von activeTargetProfileId (G5); actionLevel unverändert aus src/finance (Verkaufsoption nur bei +≥10 Pp, nie bei Untergewichtung); sichtbarer Hinweis „Empfehlungen sind rein informativ…".

### Umgesetzt

Depotübersicht (4 KPI-Kacheln, sortierbare 11-Spalten-Liste, aktiv vor inaktiv, Wert absteigend, deutsche Formate inkl. neuem formatIsoDateGerman); Positionsverwaltung (anlegen/bearbeiten/deaktivieren/reaktivieren/Wert erfassen mit strengem de-DE-Parser, key gegen Formular-Zustandsübernahme, ISIN-Dubletten-Warnung mit Reaktivierungs-Hinweis); Snapshot-Vollerfassung mit Vorschau-Feldliste, Vorbelegung („bereits erfasst – wird ersetzt"), Vollständigkeitsprüfung mit Namensliste, Erfolgsmeldung; Kennzahlen/Warnungen (Zielvergleich, missingIds-Hinweise inkl. Gesamtvermögen-G11-Hinweis, W4-Anzeige); UX/A11y (Escape, Fokusführung mit Rückgabe an Auslöser, aria-invalid/-describedby/-sort, feldnahe Snapshot-Fehler, Text+Symbol).

### Prüfergebnisse (je Stufe) und behobene Auflagen

- finance-analyst: 1 mittel (fehlender G11-Hinweis bei Tagesgeldkonten ohne Saldo im Gesamtvermögen-Anteil) + 2 klein (Doku-Wortlaut §4/F2 „aller"→„aktive"; irreführender Warntext inaktives Depotkonto) – **alle behoben**. Kernarithmetik am Seed vollständig bestätigt (+44,27775/−11,07091/−3,65529 Pp; Σ Kauf = Σ Verkauf = 1.573,80444).
- accessibility-review: 0 kritisch, 3 mittel (B1 KPI-Infos nur als title; B2 Gruppen-Begründung nur als title; B3 Snapshot-Fehler nicht feldnah) – **alle behoben** (DepotRules-Erweiterung, sichtbarer Text, fieldIssues mit aria-invalid/role=alert und Rücknahme beim Korrigieren); B6/B7/B9 ebenfalls behoben (select/summary-Fokus, Rückdatierungs-Hinweis am Datumsfeld, role=status).
- calculation-tester: +9 Tests (Schwellen ±5,01/+10,01; Snapshot-Rundreise nach erneutem Öffnen inkl. inaktiver Position; kein Depotkonto; alle World deaktiviert → Depotwert 1.502,17; Abbruch-Fälle; rückdatierter Snapshot; Cent-genaue Zielvergleichs-Summen), keine Produktfehler.
- reviewer: **Freigabe**; 1 mittlerer Doku-Befund (W4-Folge, siehe Restpunkte – dokumentiert in data-model.md §3.5) + 4 kleine; behobene Auflagen einzeln verifiziert.
- Endstand: **287/287 Tests grün** (20 Dateien), `npm run build` ✓, `npm run lint` ✓.

### Bekannte Restpunkte (dokumentiert, nicht blockierend)

1. **W4-Folge (Reviewer 3.1, in data-model.md §3.5 dokumentiert):** Nach einem Snapshot neu angelegte/reaktivierte Positionen lassen ältere gesperrte Snapshots dauerhaft als „unvollständig" warnen (nur Warnebene; Präzisierung wäre spätere data-architect-Entscheidung).
2. Datum-Fehler im Snapshot-Formular erscheinen als Sammel-Alert, nicht am Datumsfeld (Reviewer 4.1). 3. Teilsummen-Marker im Zielvergleich nur an der Ist-Wert-Spalte (4.2). 4. Fehlertext „Das Konto "" existiert nicht." bei leerer Auswahl (4.4). 5. A11y-Kleinpunkte B4/B5/B8/B10 (Spez-Kürzel und ISO-Daten in Fehlertexten, kein dynamischer „wird ersetzt"-Marker in der Einzelwert-Erfassung, Sortierpfeile im Button-Namen). 6. Keine Gruppe „Sonstige" (Nutzer-Fachentscheidung nötig). 7. localTodayIso nutzt weiterhin die Systemuhr (Altpunkt M8).

### Bewusst nicht implementiert

Orderausführung, Broker-Synchronisation, automatische Kursabfragen, Performanceberechnung (Kostenbasis/Cashflows nicht spezifiziert), Dividendenverwaltung, Charts, neue Rebalancing-Regeln, F17-Sparraten-Vorschläge (M11), Löschen von Positionen, Snapshot-Ersetzen.

### Übergabepunkte für das nächste Modul

„Sparpläne" (M10) kann applyDataChange, die Formular-/Testmuster und parseGermanAmount direkt wiederverwenden; „Übersicht" (M7) kann KPI-Kacheln, groupTotal und den Zielvergleich als Bausteine nutzen; Restpunkt 1 (W4-Präzisierung) bei nächster data-architect-Runde entscheiden.

## 2026-07-19 – Phase 10: Modul „Konten" (abgeschlossen, Freigabe unter erfüllter Auflage)

Workflow: Spezifikation mit Modellentscheidungen → **frontend-developer** (Implementierung) → **calculation-tester** (+5 Tests) → **reviewer** (Freigabe unter Auflage; beide Auflagen behoben und mit Regressionstests abgesichert). Skills finance-rules, frontend-design und quality-check angewendet.

### Umgesetzt

- **Dokumentierte additive Schema-Erweiterung (schemaVersion bleibt 1, Protokoll in data-model.md §3.3/§4/§6):** AccountType + `bargeld` + `sonstiges` (Vor-Erstveröffentlichungs-Amendment; Kennzahlen-Zuordnung nachgetragen); Account + `isActive` (Default true) + `purpose` (Default null). Beispieldatei unverändert gültig und rundreisestabil.
- **Reine Datenfunktionen** (`src/data/accounts.ts`, ohne React): addAccount (6 wählbare Typen: Girokonto, Tagesgeld, Depot, Verrechnungskonto, Bargeld, Sonstiges; Bestandstypen ruecklage/krypto/pension nur anzeigen), updateAccount (Typ unveränderbar), setAccountActive, setAccountBalance (**DM21 erstmals verdrahtet**: gesperrte Snapshot-Daten abgelehnt; gleiches Datum ersetzt statt DM23-Duplikat; depot/pension ohne eigenen Wert = C2). ID-Konvention mit dateiweiter Eindeutigkeit.
- **Doppelzählungs-Modell doppelt dokumentiert** (Code-Kommentar + aufklappbarer UI-Hinweis): Depot-Konten haben keinen eigenen Saldo, ihr Wert kommt ausschließlich aus den Positionen; jedes Konto zählt genau einmal nach Typ; Tagesgeld = Σ **aktive** tagesgeld-Konten; deaktivierte Konten fließen in keine Summe ein, bleiben sichtbar.
- **UI** (`src/pages/AccountsPage.tsx`): sortierbare Liste (deutsche Typ-Labels, „unbekannt" statt 0, Datum der letzten Aktualisierung, Status als Text), Formulare mit Labels und feldnahen Fehlern, Bestätigung beim Deaktivieren, Tagesgeld-Summe (de-DE-Formatierung via `src/format/money.ts`), Leerzustände. **Jede Änderung setzt „ungespeichert"** (neue Reducer-Action DATA_CHANGED + Provider-Aktion applyDataChange mit isSaving-Guard).

### Prüfungen und behobene Befunde

- calculation-tester: +5 Randfalltests (u. a. krypto/pension im Formular abgelehnt, Betrag 0, Saldo auf inaktivem Konto dokumentiert, DM21-Meldungstext verschärft, Summen-Konsistenz Giro ≠ Tagesgeld, isSaving-Guard); keine Produktfehler.
- reviewer: **Freigabe unter Auflage** (0 kritisch). Beide mittleren Auflagen behoben: (1) fehlendes React-`key` an Edit-/Saldo-Formular – Zustand „klebte" beim Zielwechsel und hätte Werte auf das falsche Konto schreiben können (Regressionstest Zielwechsel A→B); (2) Betrag-Parsing deutete den deutschen Tausenderpunkt als Dezimalpunkt („1.234" → 1,23 €) – jetzt strenges de-DE-Muster `parseGermanAmount` („1.234" = 1.234,00 €; „12.34"/„0x10"/„1e3" abgelehnt; eigene Testdatei tests/format/money.test.ts). Zusätzlich Doku-Hinweis am setAccountBalance-Kommentar ergänzt.
- Stand: **192/192 Tests grün** (17 Dateien; accounts 27, accountsPage 15, money 3), `npm run build` ✓, `npm run lint` ✓.

### Offene Punkte (Reviewer, klein – für spätere Phasen)

Zeit-Injektion umgangen in localTodayIso (Seitenkontext); collectAllIds doppelt implementiert (accounts.ts + Provider); DATA_CHANGED räumt veraltete Warnungen (z. B. W_EMPTY_HISTORY nach Salden-Erfassung) nicht auf; Notiz-Feld nur im Formular sichtbar; updateAccount trimmt Texteingaben nicht; **an M9 übergeben:** W4-Snapshot-Vollständigkeitswarnung ignoriert isActive (deaktivierte Tagesgeldkonten würden dauerhaft als „fehlend" gewarnt).

### Nächster sinnvoller Schritt

Modul „Depot" (M9): Positionswerte erfassen, Snapshot-Vollerfassung mit locked-Registry (nutzt den hier verdrahteten DM21-Schutz und applyDataChange), Depot-Gewichtung mit F5/F7 aus src/finance.

## 2026-07-19 – Phase 9: App-Grundlayout (abgeschlossen, Freigabe)

Umgesetzt durch den **frontend-developer** (frontend-design-Skill angewendet), unabhängiger Abschlussreview durch den **reviewer**: **Freigabe, 0 kritische, 0 mittlere Befunde.**

### Umgesetzt

- Grundlayout ohne Router-Paket (useState-Navigation, keine neuen Dependencies): `src/layout/` (pages.ts als einzige Quelle der 9 Navigationspunkte in fester Reihenfolge – Übersicht, Konten, Depot, Sparpläne, Rebalancing, Ziele, Simulation, Einstellungen, Daten & Backups –, Header.tsx, Navigation.tsx, AppLayout.tsx) und `src/pages/` (DataBackupsPage mit der kompletten bisherigen Speicher-UI; PlaceholderPage für die 8 künftigen Module).
- Desktop-Seitenleiste + mobil einklappbare Navigation (echter Button mit aria-expanded/aria-controls, Menü schließt nach Auswahl, Media Query ≤ 45rem); aktiver Punkt semantisch (aria-current="page") und mehrfach nicht-farblich markiert (Marker, Schriftstärke, Balken).
- Kopfbereich auf allen Seiten: Dateiname („Keine Datei geöffnet" ohne Datei), Speicherstatus (inkl. ehrlichem Download-Hinweis), Ungespeichert-Hinweis „● Ungespeicherte Änderungen" (role="status") – per Test auf allen 9 Seiten nachgewiesen.
- Verständlicher leerer Startzustand mit direktem Button zu „Daten & Backups"; **keine Finanzdaten als Literale im UI** (per Grep nachgewiesen); `src/finance`, `src/storage`, `src/validation` und die State-Logik unverändert; `StorageScreen` bleibt als Kompatibilitäts-Export für die Bestandstests erhalten.

### Tests und Prüfungen

- 8 neue Layout-UI-Tests (`tests/layout/appLayout.test.tsx`): 9 Punkte + Reihenfolge, aria-current-Wechsel, Header-Status mit/ohne Daten, Dirty-Hinweis auf jeder Seite, Speicher-Buttons unter „Daten & Backups", Menü-Button-Verhalten. Bestehende M1–M6-Tests laufen unverändert gegen die neue UI (keine Regression).
- Stand: **147/147 Tests grün** (14 Dateien), `npm run build` ✓, `npm run lint` ✓ – vom reviewer selbst nachvollzogen.

### Offene Punkte (Reviewer, alle klein)

1. UI-Test für die Sichtbarkeit des „Speichern unter …"-Buttons (canDirectSave-Zweig; Technik aus saveHandle.test.tsx vorhanden). 2. Manuelle Browser-Prüfung des mobilen Einklappverhaltens (zusammen mit der offenen FSA-Prüfung). 3. Zeitstempel im Kopfbereich weiterhin rohes ISO-Format statt de-DE (seit Phase 7 dokumentiert). 4. Leerzustands-Text doppelt als Literal (zentralisieren). 5. Escape schließt das mobile Menü nicht; kein Skip-Link. 6. Fokus-Farbe im Dark-Mode knapp unter 3:1-Empfehlung. 7. README-Aktualisierung (Bedienung der Navigation) folgt mit dem ersten Fachmodul.

### Nächster sinnvoller Schritt

M7 „Übersicht" als erste Fachseite: Kennzahlen aus `src/finance/` (F1–F7) über `useFinanceData` anzeigen – gemäß CLAUDE.md mit finance-analyst-Vorprüfung der Kennzahlen-Darstellung, frontend-developer, calculation-tester und reviewer.

## 2026-07-19 – Phase 8: Reine Finanzberechnungen (abgeschlossen, Freigabe)

Agentenworkflow durchlaufen: Implementierung auf Basis des verifizierten Formelkatalogs (docs/calculation-rules.md Abschnitt 12) → **finance-analyst** (fachliche Prüfung) → **calculation-tester** (Testabdeckung, 14 Tests ergänzt) → **reviewer** (Abschlussreview, nach Behebung der Befunde **Freigabe** mit unabhängiger Nachrechnung). Skills finance-rules, rebalancing und quality-check angewendet.

### Umgesetzt (src/finance/ – pur, keine React-Abhängigkeit, Eingaben werden nie mutiert)

- `rounding.ts` (F19: roundToUnit/floorToUnit/roundWithVisibleAdjustment – Cent und volle Euro, Rundungsdifferenz sichtbar, Ausgleich an der größten Position), `wealth.ts` (F1–F7: Gesamtvermögen, Depot-/Tagesgeldwert, Anteile, World gesamt; leere Historien als missingIds statt 0), `savings.ts` (F8–F10: eigene Sparleistung, Gesamtzufluss, real/geglättet strikt getrennt, Referenzverteilung Ebene A), `targets.ts` (F11–F16, F21: Zielwerte, Level1-Split 85/15, Abweichungen EUR/Pp, actionLevel mit 5/10-Pp-Schwellen, Kauf-/Verkaufsbedarf, Gewichts- und level1-Validierung ±0,001), `rebalancing.ts` (F17/F18: proportionale Budget-Verteilung, fixe Mindestbeträge, pausierte/übergewichtete flexible Pläne → 0), `projection.ts` (F22: 6/12-Monats-Projektion ohne Kursentwicklung, reale Jahresereignisse via dueMonth).
- Alle Auftragsregeln nachgewiesen: keine negativen Raten, keine Division durch 0 (null = „nicht berechenbar“), keine NaN/Infinity, Tagesgeld nie im Depotnenner, Zielgewichte validiert, Rundungsdifferenzen sichtbar, Reinheit per deepFreeze- UND Snapshot-Tests.

### Prüfergebnisse und behobene Befunde

- **finance-analyst:** Kernarithmetik vollständig korrekt (alle Seed-Werte unabhängig nachgerechnet). Ein Fehler (hoch) behoben: `actionLevel` erwähnte die Verkaufsoption auch bei Untergewichtung – jetzt nur bei positiver Abweichung ≥ 10 Pp (F14-Beispiel: EM −11,07 Pp → nur Empfehlung); der Test hatte das falsche Verhalten festgeschrieben und wurde korrigiert. Lücke (mittel) geschlossen: validateLevel1 + splitSavingsQuote (988 € → 839,80/148,20).
- **calculation-tester:** 14 Randfalltests ergänzt (u. a. Budget 0,01, leere Verteilerliste, Datumsgleichheit, Einzelgewicht 1,0, Summe 0, Reinheits-Snapshots); keine Produktcode-Fehler.
- **reviewer:** Erst keine Freigabe (M1: Exception bei nicht einheiten-genauen Budgets; M2: F10 fehlte undokumentiert). Behoben: Budgets werden per floorToUnit abgerundet verteilt (Regressionstests 59,996 € und 62,50 €/Euro-Einheit → 24/23/11/4 = 62), F10 als `referenceAllocation` implementiert und mit Spezifikationswerten getestet; zusätzlich K1 (minAmount-Validierung) und K2 (Kommentar). **Nachprüfung: Freigabe, 138/138 Tests bestätigt.**

### Ergebnis der Befehle

- `npm test` ✓ **138/138 Tests grün** (13 Dateien; davon 70 Finance-Tests in tests/finance/)
- `npm run build` ✓, `npm run lint` ✓
- Hinweis: Ein lastbedingt flakiger Timeout eines Storage-Tests in einem Zwischenlauf wurde durch Wiederholung als umgebungsbedingt bestätigt (Test läuft normal in ~0,6 s).

### Offene Punkte für spätere Phasen (Reviewer-Hinweise, klein)

- K3/K4: JSDoc-Vertrag „nur aktive Pläne übergeben“ + Pinning-Test für F8/F9-Aktivitätsfilter; F18-Test für current < minAmount.
- UI-Phase: Der Abrundungsrest aus M1 (flexibleBudget − distributedBudget, z. B. 0,50 € bei 62,50 €) steckt nicht in roundingDifference – bei der Anzeige als sichtbare Differenz ausweisen (F19).
- savings.ts kennt bewusst keinen „Equatex-Monat“-Parameter – reale Monatsbuchungen kommen künftig aus transactions; F22-real bildet das Jahresereignis bereits ab.

### Nächster sinnvoller Schritt

Erstes Fachmodul (Übersicht/Konten) auf Basis von `useFinanceData` + `src/finance` (F1–F7-Kennzahlen in der UI, markDirty-Anbindung), gemäß CLAUDE.md mit frontend-developer und anschließendem Review.

## 2026-07-19 – Phase 7a: Nachprüfung Speicherfunktion / Handle-Verhalten (abgeschlossen)

Gezielte Code-Prüfung des Speicherverhaltens gegen fünf erwartete Verhaltensweisen (erster Klick „Speichern" ohne Handle → „Speichern unter" + Handle im State; Folge-Speichern direkt ohne Dialog; nur „Speichern unter" öffnet immer einen Dialog; Öffnen speichert das Handle; Download-Fallback behauptet kein Überschreiben).

### Prüfergebnis

- **Korrekt bestätigt:** Erstes Speichern legt den von `saveAsNewFile` zurückgegebenen Handle im State ab (`SAVE_SUCCEEDED` mit `handle`); Folge-Speichern nutzt den `state.fileHandle`-Zweig und öffnet keinen Dialog; `openViaFilePicker` liefert das Handle, `LOAD_SUCCEEDED` speichert es; kein Reducer-Zweig (markDirty, Fehler-Aktionen, abgelehnter Import) entfernt den Handle versehentlich – nur die dokumentierten Ausnahmen Import-Übernahme und „Neue Datei" lösen ihn bewusst.
- **Drei tatsächliche Fehler gefunden und behoben:**
  1. **Falscher Feature-Check im Speicherpfad:** Es wurde `showOpenFilePicker` geprüft, aber `showSaveFilePicker` benutzt – in einem Browser mit Open- aber ohne Save-Picker wäre das Speichern kommentarlos als „Dialog-Abbruch" verpufft. Neu: `isSaveFilePickerSupported()` in `src/storage/featureDetection.ts`; `saveDirect` nutzt jetzt den korrekten Check. Chrome/Edge (beide Picker) und Firefox (keiner) werden damit sauber unterschieden.
  2. **„Speichern unter …" fehlte als eigene Aktion:** Neue `saveAs()`-Aktion (öffnet immer den Dialog, ersetzt den gehaltenen Handle, Vorschlagsname = aktueller Dateiname) + Button, nur bei Save-Picker-Unterstützung sichtbar.
  3. **Download-Fallback-UI (Firefox) war missverständlich:** Button heißt dort jetzt „Speichern (als Download)", und die Statuszeile ergänzt nach einem Download-Speichern den Hinweis „(als Download – die ursprünglich geöffnete Datei wurde nicht überschrieben)".
- Keine fachlichen Finanzregeln geändert; Änderungen ausschließlich in `featureDetection.ts`, `financeDataContext.ts`, `FinanceDataProvider.tsx`, `App.tsx`.

### Regressionstests (neu: tests/storage/saveHandle.test.tsx, 5 Tests)

1. Erstes Speichern ruft „Speichern unter" auf und speichert den Handle im State. 2. Zweites Speichern schreibt direkt in denselben Handle (kein neuer Dialog, `getWriteCount() === 1`). 3. „Speichern unter" erzeugt auch mit vorhandenem Handle einen neuen Handle (alter bleibt unbeschrieben). 4. Öffnen + Speichern schreibt direkt in den geöffneten Handle. 5. markDirty/SAVE_FAILED/OPERATION_FAILED/LOAD_FAILED/abgelehnter Import behalten den Handle (Referenzidentität); Import-Übernahme löst ihn gewollt.

### Ergebnis der Befehle

- `npm test` ✓ **68/68 Tests grün** (10 Testdateien)
- `npm run build` ✓ (tsc + vite, ~72,7 kB gzip)
- `npm run lint` ✓ (keine Befunde)

### Verbleibender manueller Prüfpunkt

Die echten Browser-Dialoge (Berechtigungs-Prompts, tatsächliches Zurückschreiben in dieselbe Datei in Chrome/Edge, Download-Verhalten in Firefox) sind in jsdom nicht testbar und weiterhin manuell per `npm run dev` zu verifizieren.

## 2026-07-19 – Phase 7: Speichergrundlage (abgeschlossen)

Agentenworkflow gemäß CLAUDE.md vollständig durchlaufen: **data-architect** (Vorprüfung + verbindlicher Implementierungs-Blueprint) → **frontend-developer** (Implementierung) → **calculation-tester** (Testabdeckungsprüfung, 8 Tests ergänzt) → **reviewer** (unabhängiger Abschlussreview) → bestätigte mittlere Befunde behoben. Skills quality-check und frontend-design angewendet.

### Umgesetzt (alle 12 Phasen-Anforderungen)

- Öffnen per Dateidialog (File System Access API + `input[type=file]`-Fallback); vierstufige Validierung (Stufen A–D aus data-model.md Abschnitt 5) mit deutschen Meldungen inkl. Pfadangabe **vor** jeder Übernahme; ungültige Dateien lassen den Bestand nachweislich referenzidentisch unverändert (nur `importHistory`-Protokolleintrag, Regel 17/DM5).
- Direktes Zurückspeichern in dieselbe Datei nach Benutzerfreigabe (inkl. Selbstprüfung des Serialisats vor dem Schreiben); Download-Fallback; Export-Reimport-Rundreise deep-equal inkl. unbekannter Zusatzfelder; Sicherungskopie-Button; „Neue leere Finanzdatei" (nur dokumentierte M14-Standardwerte); Statuszeile (Dateiname, schemaVersion, letzter Speicherzeitpunkt); Ungespeichert-Indikator als Text + Symbol; beforeunload-Warnung; localStorage komplett ungenutzt (leere Allowlist als dokumentierte Sperre); keinerlei Netzwerkzugriffe.
- Struktur wie beauftragt: `src/types/`, `src/validation/`, `src/storage/`, `src/state/`, `tests/storage/`; Finanz-/Speicherlogik strikt außerhalb der React-Komponenten. Keine Depot-/Rebalancing-UI (Phasengrenze eingehalten).

### Tests und Prüfungen

- Pflichttests ST1–ST6 (gültiger/ungültiger Import, Rundreise, schemaVersion, ungespeicherte Änderungen, Bestandsschutz) plus fileNames-, lockedDates- (DM21-Vorgriff) und Grenzfalltests. Stand nach allen Phasen: **63/63 Tests grün**, `npm run build` und `npm run lint` ohne Befund.
- Reviewer-Ergebnis: **Freigabe** für den beauftragten Umfang; 0 kritische, 4 mittlere Befunde – alle 4 behoben und mit Regressionstests abgesichert:
  1. Unbehandelte Fehlerpfade (Öffnen/Import-Lesen/„Speichern unter") melden jetzt verständliche Fehler (`OPERATION_FAILED`/`SAVE_FAILED`), Bestand bleibt erhalten.
  2. Importvorschau zeigt jetzt den Vergleich mit dem aktuell geladenen Bestand, warnt, wenn der geladene Bestand neuer ist als die Importdatei (M4-AK3), und bietet aktiv eine Sicherungskopie vor dem Import an.
  3. Speicher-Wettlauf beseitigt: `isSaving`-Sperre blockiert alle Aktionen während des asynchronen Schreibens (UI-Buttons deaktiviert, Guards in allen Aktionen).
  4. Validierungslücken geschlossen: `level1`-Anteile einzeln ∈ [0;1], `minAmount` ≥ 0, `plannedMonthlyAmount` ≥ 0.

### Offene Punkte (dokumentiert, bewusst nicht in dieser Phase)

- Manuelle Browser-Prüfung der FSA-Pfade (Öffnen/Speichern/„Speichern unter" in Chrome/Edge, Fallback in Firefox) steht aus – jsdom kann Berechtigungsdialoge nicht testen.
- Kleinere Reviewer-Befunde (niedrig, nicht behoben gemäß Auftrag „nur kritisch/mittel"): teils unpassende Fehlercodes (z. B. E_NOT_FINITE für Bereichsfehler), `Date.parse`-Toleranz bei Zeitstempeln, keine Fixwert-Prüfung von `metadata.currency`, rohes ISO-Format in der Statusanzeige, Dateinamens-Vorschlag nach Import, `dueMonth` bei monatlichen Plänen nicht abgewiesen, pad2-Duplikat, Backup-Namenskollision innerhalb derselben Minute, Tastenkürzel „Speichern" fehlt.
- M5-Vollausbau (automatische Sicherungsintervalle, Verzeichnis-Freigabe, Retention) und Migrationen folgen in einer späteren Phase; `lockedDates.ts` ist ein getesteter DM21-Vorgriff und wird erst mit den Fachmodulen verdrahtet.
- README-Abschnitt zur Bedienung der Speicherfunktionen aktualisieren (folgt mit dem ersten Fachmodul).

### Nächster sinnvoller Schritt

Manuelle FSA-Browserprüfung, dann erstes Fachmodul (Übersicht/Konten) auf Basis von `useFinanceData`/`markDirty` – mit den berechneten Kennzahlen aus `docs/calculation-rules.md` (Formelkatalog F1–F7).

## 2026-07-19 – Phase 6: Technisches Grundprojekt (abgeschlossen)

- Projektgerüst eingerichtet: React + TypeScript + Vite, Vitest + React Testing Library (jsdom), ESLint (Flat Config mit typescript-eslint, react-hooks, react-refresh), Prettier. Bewusst **keine** Diagrammbibliothek und **kein** UI-Framework installiert; keine Finanzmodule implementiert.
- Minimale lauffähige Startseite (`src/App.tsx`): Titel „Finance OS“, Hinweis „noch keine Finanzdaten geladen“; zwei bestehende RTL-Tests (`src/App.test.tsx`). Konfigurationsdateien: `package.json`, `vite.config.ts` (inkl. Vitest-Konfiguration), `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore` (Doku/Daten ausgenommen), `.gitignore`, `index.html`, `src/setupTests.ts`.
- `README.md` beschreibt die tatsächliche Bedienung (CLAUDE.md-Regel).

### Installierte Pakete (npm ls --depth=0; 265 Pakete gesamt, 0 bekannte Sicherheitslücken)

- Laufzeit: react 19.2.7, react-dom 19.2.7
- Build/Sprache: vite 7.3.6, typescript 5.8.3, @vitejs/plugin-react 5.2.0
- Tests: vitest 3.2.7, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1, @testing-library/user-event 14.6.1, jsdom 26.1.0
- Qualität: eslint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.64.0, eslint-plugin-react-hooks 5.2.0, eslint-plugin-react-refresh 0.4.26, globals 16.5.0, prettier 3.9.5
- Typen: @types/react 19.2.17, @types/react-dom 19.2.3

### Erfolgreiche Befehle

- `npm install` ✓ (265 Pakete, 0 Vulnerabilities; Node 22.14.0, npm 11.12.1)
- `npm run build` ✓ (tsc --noEmit + vite build; dist/ erzeugt, ~194 kB JS / 61 kB gzip)
- `npm test` ✓ (2/2 Tests bestanden) – beim ersten Lauf schlug 1 Test fehl, weil ohne Vitest-Globals das automatische RTL-Cleanup nicht läuft; behoben durch explizites `cleanup()` in `src/setupTests.ts`, danach grün
- `npm run lint` ✓ (keine Befunde)

### Offene technische Probleme

- Keine blockierenden Probleme. Hinweise:
  - npm-Deprecation-Warnung für das transitive Paket `whatwg-encoding@3.1.1` (via jsdom) – rein informativ, keine Aktion nötig.
  - Das Projekt ist **kein Git-Repository** (keine Versionskontrolle); vor Beginn der Code-Phasen empfohlen: `git init` + erster Commit.
  - Projektpfad liegt in einem OneDrive-Ordner mit Leerzeichen – bisher problemlos, aber OneDrive-Synchronisation von `node_modules` kann die Performance beeinträchtigen (ggf. Ordner von der Synchronisation ausnehmen).

### Nächster sinnvoller Schritt

`docs/testing-strategy.md` und `docs/design-system.md` ausarbeiten; danach erste Code-Phase: Datenschicht (Typen aus `docs/data-model.md`, Laden/Validieren/Speichern gemäß `docs/storage-concept.md`) mit den Tests T1–T9, DM1–DM23 und den F-Katalog-Sollwerten – gemäß CLAUDE.md-Agentenworkflow (data-architect-Vorgaben liegen vor; calculation-tester und reviewer nach Implementierung).

## 2026-07-19 – Phase 5: Formelkatalog (abgeschlossen)

- `docs/calculation-rules.md` auf **Version 2** erweitert: neuer Abschnitt 12 „Formelkatalog F1–F22“ mit exakt den geforderten 22 Formeln (Gesamtvermögen, Depotwert, Tagesgeld-/Depot-/Positionsanteile, MSCI World gesamt, eigene Sparleistung, Gesamtzufluss inkl. Arbeitgebervorteil, Zielwerte Student/Job/Eigene, Abweichung EUR/Prozentpunkte, Kauf-/Verkaufsbedarf, Sparraten-Rebalancing, fixe/flexible Raten, Rundung, Nullwerte, ungültige Zielgewichte, Projektionen 6/12 Monate ohne Kursentwicklung) – jede Formel mit Eingaben, Formel, Ausgabe, Randfällen und erwartetem numerischen Testergebnis auf Basis des bestätigten Seed-Snapshots.
- Bestehende Abschnitte 0–10 und Testfälle T1–T9 blieben nummerierungsstabil (werden aus requirements.md und data-model.md referenziert); Abschnitt 11 als „aufgelöst“ markiert (Klärung erfolgte im Datenmodell).
- Skills finance-rules und rebalancing angewendet; **finance-analyst hat alle 22 Formeln unabhängig nachgerechnet: rechnerisch fehlerfrei**, u. a. exakte Konsistenz Σ Kaufbedarf = Σ Verkaufsbedarf = 1.573,80 € (Job-Profil auf Seed) und identische 12-Monats-Projektion in realer und geglätteter Sicht (6.150,06 €). Zwei niedrigschwellige Doku-Befunde behoben (F6-Quellenangabe präzisiert; Pp-Skalierung ×100 in Abschnitt 9 ergänzt).
- **Kein Code implementiert** – ausschließlich Dokumentation.

### Nächster sinnvoller Schritt

Unverändert: `docs/testing-strategy.md` und `docs/design-system.md` ausarbeiten, danach Implementierungsplan für die erste Code-Phase (Datenlogik mit Tests T1–T9, DM1–DM23 und den F-Katalog-Testergebnissen als Sollwerte).

## 2026-07-19 – Phase 4: JSON-Datenmodell (abgeschlossen)

- Datenmodell für schemaVersion 1 durch den Subagenten **data-architect** entworfen (Entitäten, IDs, Validierung, Versionsstrategie, Migrationsrisiken, Testfälle) und durch den Subagenten **finance-analyst** fachlich gegengeprüft; Skills finance-rules, rebalancing und quality-check angewendet.
- Erstellt: `docs/data-model.md` (Top-Level-Struktur mit allen geforderten Bereichen inkl. optional-leerer transactions/fixedCosts/monthlyClosings/journalEntries; Snapshot-Registry mit locked-Schutz; Zuflussarten-Taxonomie mit flowType; Kennzahlen-Ableitung über Konto-Flags; Validierungsregeln; Migrationsstrategie; Testfälle DM1–DM23), `docs/storage-concept.md` (Validierung, Import mit Pflicht-Vorschau, Export, direkte Dateispeicherung mit Benutzerfreigabe, Download-Fallback, Sicherungsexporte, ungespeicherte Änderungen, beschädigte Dateien, Migrationen) und `user-data/finance-data.example.json` (Startvorlage, syntaktisch validiert; ausschließlich bestätigte Werte, als Beispieldaten gekennzeichnet; Job-Gewichtssumme exakt 1,0).
- Gegenprüfung: Wertetreue vollständig bestätigt (alle Beträge, ISINs, Summen exakt; nichts erfunden). Drei mittlere Befunde behoben: geglättete Zahlenwerte aus Notiztexten entfernt (DM9 bleibt streng), importHistory-Ausnahme beim abgelehnten Import präzisiert, Snapshot-Schutz um Verbot nachträglicher Einträge am gesperrten Datum ergänzt. Zusätzlich: dueMonth für Jahrespläne (Telekom: Juli), Krypto-Zuordnung im Finanzvermögen eindeutig, Notgroschen-null-Semantik, backup-Modus-Enum, Seed-Vorbelegungen dokumentiert, Negativtests DM17–DM23 ergänzt; V1-Einschränkung „nur Zuflüsse in transactions“ ausdrücklich dokumentiert.
- Damit sind die offenen Definitionsfragen aus calculation-rules.md Abschnitt 11 aufgelöst (Kennzahlen über Konto-Flags; Begriffshierarchie totalWealth ⊆ investedWealth ⊆ financialWealth).
- **Keine React-Anwendung implementiert** – ausschließlich Dokumentation und Beispieldatei.

### Nächster sinnvoller Schritt

`docs/testing-strategy.md` und `docs/design-system.md` ausarbeiten, danach Implementierungsplan für die erste Code-Phase (Datenlogik: Laden/Validieren/Speichern gemäß storage-concept, Tests T1–T9 und DM1–DM23) – gemäß CLAUDE.md mit calculation-tester und reviewer.

## 2026-07-19 – Phase 3: Anforderungen Version 1 (abgeschlossen)

- `docs/requirements.md` erstellt: vollständige Anforderungen für Version 1 auf Basis von CLAUDE.md, Source Map Version 3 (U1/U2), calculation-rules.md und allen fünf Skills.
- Inhalt: Produkt-/Technikrahmen; Umfang V1 (14 Module M1–M14) und explizite Nicht-Ziele (kein Online-Banking, Backend, Cloud, Benutzerkonten, Steuerautomatisierung, Live-Kurse, Broker-Anbindung, keine KI-API in der App); 12 globale verbindliche Anforderungen G1–G12 (u. a. keine Automatik nach außen, Snapshot-Schutz, TR-Trennung, keine ING/Equatex-Doppelzählung, getrennte Kennzahlen eigene Sparleistung vs. Gesamtzufluss); je Modul Zweck, Eingaben, Ausgaben, Bedienablauf, Validierungen, Akzeptanzkriterien und Nicht-Ziele; Abnahmekriterien für V1 (Tests T1–T9, quality-check-Katalog, Review G1–G12).
- Kein Anwendungscode implementiert.

### Nächster sinnvoller Schritt

Entwurf des JSON-Datenmodells (`docs/data-model.md`) durch den **data-architect** (schemaVersion, Snapshot-/Zeitreihenstruktur, Zuflussarten, Profile, Ziele, Simulationen; offene Definitionsfragen aus calculation-rules.md Abschnitt 11).

## 2026-07-19 – Phase 2: Entscheidungsrunde 2 (abgeschlossen)

- Verbindliche Nutzerbestätigungen (Quelle „U2“, 2026-07-19) in `docs/investment-source-map.md` eingearbeitet (→ **Version 3**):
  - **Entscheidung 25 / K15 gelöst:** Monatlicher Sparauftrag insgesamt 160 € = 25 € Volkswagen-Bank-Tagesgeld + 75 € ING-Rücklage (Shares2you) + 60 € Trade-Republic-Depot-Sparrate; die frühere Angabe „50 € TR“ ist veraltet.
  - **Entscheidung 18 vollständig gelöst:** World-ISINs bestätigt (iShares Core MSCI World VL IE00B4L5Y983; SPDR MSCI World Acc IE00BFY0GT14; Xtrackers MSCI World Dist IE00BK1PV551) – ISIN-Status von „wahrscheinlich“ auf „eindeutig“ angehoben.
  - **Entscheidung 24 / K14 geschlossen:** PDF- und HEIC-Quellen werden für Version 1 nicht weiter ausgewertet; R11 bleibt als nicht ausgewertete historische Quelle dokumentiert.
- **Gelöste Entscheidungen in dieser Runde: 3.** Damit sind **alle offenen Entscheidungen geschlossen** (Register 16.2 leer); es verbleiben ausschließlich die **6 bewusst zurückgestellten Themen** (16.3): Studenten-Bestandszielallokation (Ebene B), Beträge/Termine Auto und Urlaub, Telekom-Pensionsfonds, Krypto-Bestand, Zeitpunkt der Job-Profil-Aktivierung, Gold-Umwandlungsschwelle.
- Kein Anwendungscode implementiert; außer Source Map und progress.md keine Dateien geändert.

### Nächster sinnvoller Schritt

Unverändert: Erstellung bzw. Überarbeitung von `docs/requirements.md`, anschließend Entwurf des JSON-Datenmodells durch den **data-architect**.

## 2026-07-19 – Phase 1: Entscheidungsrunde 1 (abgeschlossen)

- Verbindliche Nutzerentscheidungen (Quelle „U1“, direkte Nutzerbestätigung vom 2026-07-19) in die Dokumentation eingearbeitet.
- `docs/investment-source-map.md` auf **Version 2** überarbeitet: Snapshot datiert (2026-07-17), Konfliktregister mit verbindlichen Auflösungen für **K1–K13** (K14 bleibt offen; historische Konflikte bleiben dokumentiert), Entscheidungsregister mit drei Listen (gelöst / offen / bewusst zurückgestellt), neue Abschnitte Kontenabgrenzung, finanzielle Ziele und Verbot automatischer Änderungen.
- `docs/calculation-rules.md` erstellt: Zuflussarten-Taxonomie, alle geforderten Formeln (Sparleistung, Gesamtzufluss, Telekom/Shares2you inkl. fünf Datenmodell-Konzepten, VL, Trade Republic, Vermögenskennzahlen, Notgroschen, Fixkosten-Pauschale, Rebalancing-Schwellen) sowie Testbeispiele T1–T9 gegen Doppelzählung.
- **Gelöste Entscheidungen: 17 vollständig + 6 teilweise** (von 24 aus Phase 0).
- **Verbleibend offen:** 2 kleine Punkte (World-ISIN-Bestätigung; PDF-/Bildquellen-Auswertung K14) sowie 6 bewusst zurückgestellte Teilpunkte (Studenten-Bestandszielallokation Ebene B; Beträge/Termine Auto und Urlaub; Telekom-Pensionsfonds; Krypto-Bestand; Zeitpunkt der Job-Profil-Aktivierung; Schwelle ETC-Gold → physisches Gold).
- **Es wurde weiterhin kein Anwendungscode implementiert** – ausschließlich Dokumentation.

### Ergebnis der Abschlussprüfung (finance-analyst, 2026-07-19)

- Alle 8 Prüffragen bestanden: Nutzerentscheidungen korrekt übertragen; ING-Rücklage/Equatex ohne Doppelzählung; eigene Sparleistung und Gesamtzufluss getrennt; Saveback und Round-up getrennt; 60 € feste TR-Sparrate korrekt (50/75 € nur noch historisch); 265-€-Darstellung als ungefähr/beispielhaft gekennzeichnet; Verbot automatischer Änderungen mehrfach verankert; keine Werte erfunden. Alle expliziten Summen und Formeln wurden nachgerechnet und stimmen.
- Zwei neue Befunde aus der Prüfung wurden dokumentiert und korrigiert: **K16** (Rechenfehler in der Referenzdatei R2: SPDR-Depotanteil 9,14339 % → korrekt 9,41339 %; in Abschnitt 3 der Source Map korrigiert) und **K15** (Dauerauftrag „160 €“, dessen Teile 25+75+50 nur 150 € ergeben – Hypothese 25+75+60 = 160 € zur Nutzerbestätigung offen, Entscheidung 25).
- Kleinere Präzisierungen eingearbeitet: TR-interne Zielgewichte als historisch/illustrativ gekennzeichnet und normativ neu berechnet (36,38/40,14/17,61/5,87 %); World-Summenprüfung mit sichtbarer Rundungsdifferenz; T5-Klarstellung in calculation-rules.md.

### Nächster sinnvoller Schritt

Erstellung bzw. Überarbeitung von `docs/requirements.md` und anschließend Entwurf des JSON-Datenmodells durch den **data-architect** (inkl. Klärung der Begriffshierarchie „Gesamtvermögen“ vs. „Finanzvermögen/Anlagevermögen“ und der Kontenzuordnung für die Liquiditätskennzahl).

---

## 2026-07-19 – Phase 0: Quellenanalyse (abgeschlossen)

- Projektstruktur angelegt (Ordner, leere Dateien, Skills, Agenten).
- Alle Referenzdateien unter `reference/` gelesen und ausgewertet (10 Markdown-Dateien; die 94-MB-PDF konnte in dieser Umgebung nicht gerendert werden → offen, siehe K14).
- `docs/investment-source-map.md` erstellt: vollständige Quellenübersicht (Depotpositionen, Positionswerte, Sparraten, Tagesgeld, Zielaufteilungen, Einzahlungen, Telekom-Mechanik, World-Unterpositionen, EM, Gold) mit Statusbewertung je Wert, Aktualitätslogik und Konfliktregister K1–K14.
- Subagent finance-analyst hat die Source Map gegen die Originalquellen geprüft (kleine Korrekturen eingearbeitet) und 24 offene Entscheidungen priorisiert.
- Kein Code implementiert, keine Pakete installiert (bewusst – nur Analyse und Dokumentation).
