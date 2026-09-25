# Finance OS

Lokale persönliche Finanzanwendung (React + TypeScript + Vite). **Version 1.0.0 – Feature Complete (Stand 2026-07-20).** Alle 14 V1-Module sind umgesetzt: Speichergrundlage (M1–M6), Übersicht (M7), Konten (M8), Depot & Tagesgeld (M9), Sparpläne (M10), Rebalancing (M11), Finanzielle Ziele (M12), Simulator (M13) und Einstellungen (M14). Details je Phase in `progress.md`.

Finance OS ist ausschließlich ein Analyse-, Planungs- und Dokumentationssystem: Es ändert niemals reale Sparpläne, Konten oder Brokerpositionen und hat keine Bank-, Broker- oder Handels-API.

## Voraussetzungen

- Node.js ≥ 22 und npm ≥ 11 (tatsächlich geprüft mit Node 22.14.0 und npm 11.12.1 unter Windows 11).
- Windows für die Skripte unter `scripts/` (die npm-Befehle selbst sind plattformunabhängig).

## Start und Entwicklung

```bash
npm ci             # Abhängigkeiten reproduzierbar installieren (einmalig; alternativ npm install)
npm run dev        # Entwicklungsserver starten (URL wird im Terminal angezeigt)
npm run build      # Typprüfung + Produktions-Build nach dist/
npm run preview    # gebauten Stand lokal ansehen
npm test           # Tests einmalig ausführen (Vitest + React Testing Library)
npm run test:watch # Tests im Watch-Modus
npm run lint       # ESLint
npm run check      # Lint + Tests + Build in einem Befehl
npm run format     # Prettier (formatiert nur den Quellcode, nicht docs/ und Daten)
```

## Entwickler-Workflow unter Windows (`scripts/`)

Alle Skripte funktionieren aus jedem Arbeitsverzeichnis (sie wechseln selbst ins Projekt), behandeln Pfade mit Leerzeichen korrekt und geben Fehler als Exitcode ≠ 0 weiter. Doppelklick im Explorer oder Aufruf im Terminal, z. B. `scripts\check-all.bat`.

| Skript | Zweck |
|---|---|
| `start-dev.bat` | Entwicklungsserver in eigenem Fenster starten; prüft Node/npm/node_modules (bietet `npm ci` an); merkt sich die Prozess-ID in `.runtime\dev-server.pid`; verhindert einen doppelten Start; URL: http://localhost:5173 (Vite-Standard) |
| `stop-dev.bat` | Beendet **ausschließlich** den von `start-dev.bat` gestarteten Serverprozessbaum (PID + Prozessname + Startzeit werden abgeglichen). Fremde Node-Prozesse werden nie beendet; bei fehlender/veralteter PID-Datei endet das Skript freundlich. |
| `test.bat` / `lint.bat` / `build.bat` | Einzelprüfungen (Tests einmalig ohne Watch; Build nach `dist\`) |
| `check-all.bat` | Lint → Tests → Build nacheinander; bricht beim ersten Fehler ab |
| `clean.bat` | Entfernt nur reproduzierbare Artefakte (`dist\`, `.runtime\`); mit `--full` nach Bestätigung auch `node_modules\`. Löscht **nie** `user-data\`, `backups\`, Projekt-Backups oder Releases. |
| `backup-project.bat` | Datiertes Quellcode-ZIP nach `project-backups\` (ohne `node_modules`, `dist`, private Notizen aus `reference\`, App-Sicherungen und echte Finanzdateien); das ZIP wird nach Erstellung validiert |
| `release.bat` | Lokaler Release: prüft den Git-Stand (bricht bei uncommitteten Änderungen ab; `--allow-dirty` kennzeichnet den Release im Manifest als dirty), führt clean/lint/Tests/Build aus und erzeugt `releases\finance-os-v<version>\` (+ ZIP) mit `release-manifest.json`. Keine Pushes, keine Tags. |

### Troubleshooting (Windows)

- **Pfade mit Leerzeichen/OneDrive:** Das Projekt liegt unter einem Pfad mit Leerzeichen – das ist überall berücksichtigt. Eigene Aufrufe immer in Anführungszeichen setzen (`"…\scripts\check-all.bat"`). Wenn OneDrive gerade synchronisiert, können Datei-Löschungen (z. B. `clean.bat` bei geöffnetem Explorer-Fenster) kurz fehlschlagen – erneut ausführen.
- **PID-Datei:** `.runtime\dev-server.pid` ist ein rein lokaler Laufzeitmerker (gitignored). Sie manuell zu löschen ist ungefährlich; `stop-dev.bat` räumt veraltete Einträge selbst auf und beendet im Zweifel lieber nichts als einen fremden Prozess.
- **PowerShell-Ausführungsrichtlinie:** Die `.bat`-Dateien starten die Helfer mit `-ExecutionPolicy Bypass` – es ist keine Systemkonfiguration nötig.
- **Port 5173 belegt:** Vite weicht automatisch auf den nächsten freien Port aus; die tatsächliche URL steht im Serverfenster.
- **start-dev meldet OK, aber der Server läuft nicht:** Die Startprüfung wartet nur ~2 Sekunden – stirbt der Server später (z. B. Konfigfehler), steht die Ursache im Serverfenster; ein erneuter `start-dev.bat`/`stop-dev.bat` räumt die dann veraltete PID-Datei automatisch auf.
- **`npm ci` schlägt fehl:** Node-Version prüfen (`node -v`, erwartet ≥ 22); danach `scripts\clean.bat --full` und erneut `npm ci`.

### Umgang mit echten Finanzdaten

Die App und alle Skripte arbeiten **ohne Cloud und ohne Synchronisation**; es gibt keinerlei Netzwerkzugriffe. Echte Finanz-**Dateien** (die JSON-Arbeitsdatei und ihre Sicherungskopien) liegen ausschließlich dort, wo der Nutzer sie speichert; `user-data/` im Repository enthält nur die Beispieldatei (die .gitignore blockiert das Committen weiterer Dateien daneben), und der Ordner `backups/` ist als lokales Sicherungsziel reserviert und gitignored.

Drei Dinge muss man dabei ehrlich wissen:

- Quellcode-Backups (`backup-project.bat`) und Releases (`release.bat`) enthalten **nie** die privaten Notizen aus `reference/`, den Ordner `backups/` oder echte JSON-Finanzdateien. **Aber:** Die Projektdokumentation (`docs/investment-source-map.md` u. a.), die Tests, das Projektlog `progress.md` und die Beispieldatei basieren inhaltlich auf den **realen, bestätigten Finanzwerten** des Projektinhabers (Start-Snapshot, Netto, Institute). Ein Quellcode-Backup ist deshalb selbst vertraulich zu behandeln und nicht zur Weitergabe gedacht.
- Die ursprünglichen Finanznotizen in `reference/` und die private Notiz „wie starte ich im daily use.txt" sind **Teil des versionierten Git-Repos** und wandern bei jedem Clone/Push zum (privaten) GitHub-Remote mit – nur Backup und Release filtern sie heraus.
- Das App-Release (`releases/…/app/`) enthält keine Kontostände, Salden-Historien oder persönlichen Kennungen (Personennamen, ISIN-Werte, IBANs, E-Mail-Adressen – geprüft). Dokumentierte Ausnahmen im JS-Bundle: der Standardwert `netIncomeMonthly: 1170` der „Neue leere Datei“-Funktion, die fachlich fest verdrahtete Telekom-Jahresmechanik (Begriff „Telekom“ + Konstante 1.500 = 1.000 + 500, V1.x-Punkt 15), zwei „z. B.“-Beispieltexte des Simulators mit den Seed-Zahlen 627,59/2.522,47 sowie die fachlichen UI-Begriffe „ING-Rücklage“ und „Shares2you“ in Hilfetexten (alles V1.x-Kosmetik; ein Empfänger könnte daraus Arbeitgeber-/Hausbank-Kontext ableiten – ein Grund mehr, warum Release und Backups privat bleiben).

## Bedienung

Die Anwendung läuft vollständig lokal im Browser; die dauerhafte Datenquelle ist eine JSON-Datei (kein localStorage für Finanzdaten, kein Backend).

1. **Datei öffnen:** Ohne geladene Datei bietet jede Seite direkt „Datei öffnen …“ und „Neue leere Datei anlegen“ an; dieselben Aktionen stehen unter „Daten & Backups“ in der Karte „Öffnen & neu anlegen“ (Chrome/Edge: direktes Speichern in dieselbe Datei; Firefox/Safari: Download-Fallback). Als Startvorlage dient `user-data/finance-data.example.json`.
2. **Arbeiten in den Modulen** (Seitenleiste): **Übersicht** (Kennzahlen, Ziele, Datenqualität – rein lesend), **Konten** (anlegen/bearbeiten/deaktivieren, Salden erfassen), **Depot** (Positionen, Werterfassung, Snapshot-Vollerfassung, Zielvergleich), **Sparpläne** (Pläne mit Rhythmen, Summen real/geglättet, 1.000-€-Sparziel, F10-Referenz, Budget-Warnung gegen das Sparbudget aus den Einstellungen), **Rebalancing** (Abweichungsanalyse, Empfehlungen, Sparraten-Vorschlag, vorgemerkte Planungen), **Ziele** (Zielarten, Fortschritt, Monatsrate, Prognose), **Simulation** (Zukunftsszenarien mit/ohne Renditeannahme, Vergleich – strikt von den Ist-Daten getrennt), **Einstellungen** (siehe Punkt 4).
3. **Speichern:** Formulare übernehmen Änderungen nur in den Arbeitsspeicher (Buttons „… anlegen“, „Änderungen übernehmen“, „Wert übernehmen“, „Snapshot übernehmen“). In die Datei schreibt erst „In Datei speichern“ (Browser ohne Direktspeichern: „Als Download speichern“) – erreichbar im Kopfbereich auf jeder Seite, der auch den Status „● Ungespeicherte Änderungen“ / „✓ Alle Änderungen gespeichert“ zeigt. „Daten & Backups“ bündelt zusätzlich „Speichern unter …“, Export, Sicherungskopien und den JSON-Import mit Vorschau („Bestand durch Import ersetzen“ erst nach Prüfung). Nach jedem erfolgreichen direkten Speichern lädt die App automatisch eine datierte Sicherungskopie herunter (Modus einstellbar: „bei jedem Speichern" oder „täglich beim ersten Speichern").
4. **Einstellungen:** monatliches Netto und Notgroschen-Faktor (3–5) mit Live-Vorschau „Faktor × Netto"; manuelle Übersteuerung des Notgroschen-Ziels setzen/zurücksetzen (immer mit Bestätigungsdialog inkl. beider Werte – ein manueller Wert wird nie ungefragt ersetzt); monatliches Sparbudget als Warn-Grenzwert für die Sparpläne-Seite (leer = offen); Dezimalstellen der Prozentanzeige (0–4) mit Vorschau; Sicherungsmodus und Aufbewahrungsempfehlung; globale Zielprofil-Auswahl mit Bestätigung (Job-Profil vor dem 01.10.2027 mit zusätzlicher Warnung; Profil-BEARBEITUNG folgt erst nach V1); „Sicherung jetzt erstellen" und die Statuszeile der letzten automatischen Sicherung dieses Geräts. Alle fachlichen Einstellungen liegen in der JSON-Datei (Cache-Löschung überlebbar); localStorage hält nur den unkritischen Backup-Tagesmerker. Zahlen-/Währungs-/Datumsformat sind in V1 fest deutsch (de-DE/EUR/TT.MM.JJJJ, nur Anzeige).

Alle Berechnungen sind reine Anzeige-/Analysewerte (keine Anlageberatung); Empfehlungen und Simulationen führen nie Käufe, Verkäufe oder Sparplanänderungen aus.

## Projektstruktur (Auszug)

- `src/finance/` – reine Finanzfunktionen (Formelkatalog F1–F22 + Modul-Bausteine, React-frei, vollständig getestet)
- `src/data/` – reine Datenfunktionen je Modul (immutable, Result-Typen)
- `src/pages/` – die Modul-Seiten; `src/layout/` – Grundlayout und Navigation
- `src/state/` – Provider/Reducer der geladenen JSON-Datei; `src/storage/` – Datei-/Import-/Export-Logik
- `src/validation/` – Lade-/Importvalidierung; `src/format/` – deutsche Formate
- `docs/` – verbindliche Projektdokumentation (Anforderungen, Berechnungsregeln, Datenmodell, Speicherkonzept, Design-System, Quellenübersicht)
- `user-data/` – Beispiel-/Startvorlage der JSON-Finanzdatei
- `reference/` – ursprüngliche Finanznotizen (Quellen)
- `scripts/` – Windows-Entwicklerskripte (Start/Stop, Prüfungen, Backup, Release)
- `backups/` – reserviertes lokales Sicherungsziel der App (gitignored, kann echte Finanzdaten enthalten)
- `progress.md` – Projektfortschritt je Phase (inkl. V1.x-Restpunkte)
- `CHANGELOG.md` – Versionshistorie; `LICENSE` – privater Lizenzhinweis
- `CLAUDE.md` – dauerhafte Projektregeln

## Bekannte Einschränkungen (V1)

- Kein Backend, keine Cloud-Synchronisation, keine Bank-/Broker-/Kurs-APIs; alle Werte werden manuell erfasst.
- Direktes Speichern in dieselbe Datei nur in Browsern mit File System Access API (Chrome/Edge); Firefox/Safari nutzen den Download-/Import-Fallback.
- Sicherungskopien laufen über Browser-Downloads: die Aufbewahrungsanzahl ist eine reine Empfehlung und wird nicht automatisch durchgesetzt; es wird nie automatisch gelöscht.
- Zielprofile können nur ausgewählt, nicht bearbeitet werden; „Eigene Aufteilung“/Ebene B bleiben leer bis zu einer späteren Version.
- Zahlen-, Währungs- und Datumsformat sind fest deutsch (de-DE/EUR); keine Sprachumschaltung.
- Der Simulator rechnet Projektionen mit klar gekennzeichneten Annahmen – keine Prognosen, keine Anlage- oder Steuerberatung.
- Kein Tastenkürzel für „Speichern“ (Strg+S); Speichern erfolgt über die Schaltflächen.
- Nur helles Farbschema („Tinte & Papier“, seit dem Redesign 2026-09); kein Dunkelmodus.
- Die vollständige, konsolidierte Restpunkteliste steht in `progress.md`, Abschnitt „V1.x“.

## Version und Lizenz

- Version 1.0.0 – **lokal final freigegeben** (Finalabnahme M17 am 2026-07-21; lokaler Git-Tag `v1.0.0`, nur lokal – kein Push, keine Veröffentlichung). „Feature Complete“ seit der V1-Abschlussprüfung am 2026-07-20; Testumfang siehe `progress.md`, Änderungshistorie in `CHANGELOG.md`, Release-Details in `RELEASE_NOTES.md`, Bedienung in `docs/USER_GUIDE.md`.
- Privates Einzelprojekt, alle Rechte vorbehalten – siehe `LICENSE` (keine Open-Source-Lizenz, `private: true`); keine Weitergabe oder Veröffentlichung vorgesehen. Screenshots sind bewusst nicht Teil des Repositories.
