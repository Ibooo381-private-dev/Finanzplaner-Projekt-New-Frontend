# Finance OS v1.0.0

## Status

- **Lokal final freigegeben** (Finalabnahme M17 am 2026-07-21)
- Feature Complete: alle 14 V1-Module umgesetzt und geprüft
- **Privates persönliches Projekt** – keine Veröffentlichung, keine Weitergabe
- Freigabedatum: 2026-07-21
- Commit: der mit dem lokalen Tag `v1.0.0` markierte Release-Commit („chore: finalize local Finance OS v1.0.0 release“; exakter Hash in `release-manifest.json`)
- Lokaler Git-Tag: `v1.0.0` (annotiert, **nur lokal**)
- **Kein Push** – die lokalen Commits und der Tag wurden nicht zum Remote übertragen
- **Kein öffentliches Release**, kein GitHub-Release, kein Upload

## Highlights

- Vollständig lokale persönliche Finanzverwaltung: eine JSON-Datei ist die einzige dauerhafte Datenquelle
- Übersicht/Dashboard mit Vermögens- und Sparleistungs-Kennzahlen (eigene Sparleistung und Gesamtzufluss strikt getrennt; real vs. geglättet gekennzeichnet)
- Konten mit Typen, Zweckbindung und datierten Salden-Historien
- Depot & Tagesgeld mit gesperrten Snapshots (unveränderliche Historie) und Depot-Gewichtung inkl. „MSCI World gesamt“
- Sparpläne und Zuflüsse mit Zuflussarten, Rhythmen inkl. einmalig, 1.000-€-Sparziel und Fälligkeitskalender
- Finanzielle Ziele mit abgeleitetem Status, Monatsrate und Prognose ohne Renditeannahme
- Rebalancing-Analyse mit Empfehlungen ausschließlich im Konjunktiv und gespeicherten Planungen („geplant, nicht ausgeführt“)
- Simulator & Projektionen (0 % und konstante Renditeannahme 0–15 %, Warnung > 8 %) – strikt von den Ist-Daten getrennt
- Einstellungen (Notgroschen mit Übersteuerung, Sparbudget, Anzeige, Zielprofil-Auswahl, Sicherungsmodus)
- Import mit Validierung, Vorschau und Bestätigung; JSON-Export; automatische und manuelle Backups
- Durchgehende Validierung (Schema, Referenzen, NaN/Infinity-Verbote) und Schutzmechanismen (G1–G12)

## Architektur

Storage → Provider → Pure Finance Functions → React UI

Keine Finanzlogik in React-Komponenten; alle Berechnungen sind reine, getestete Funktionen; die Zeit wird injiziert (kein verstecktes `new Date()` in den Fachmodulen).

## Sicherheit und Datenschutz

- Kein Cloud-Zwang, keine Cloud-Synchronisation – die App macht **keinerlei Netzwerkzugriffe**
- Keine automatische Orderausführung, keine Bank-/Broker-APIs
- Simulationen und Empfehlungen verändern keine Ist-Daten
- Import überschreibt bei Fehlern oder Abbruch niemals den geladenen Bestand
- Private Daten gehören nicht in Release-Artefakte: `reference/` (private Notizen), `backups/` und echte JSON-Finanzdateien sind aus Release und Quellcode-Backup ausgeschlossen (validiert). Doku/Tests/Beispieldatei basieren auf den realen Werten des Projektinhabers – auch Quellcode-Backups sind daher vertraulich. Das App-Bundle selbst enthält keine Kontostände oder persönlichen Kennungen; dokumentierte Ausnahmen sind der Netto-Standardwert 1170, die fachliche Telekom-Jahreskonstante und zwei „z. B.“-Beispieltexte (Details README „Umgang mit echten Finanzdaten“).
- Release und Backup bleiben ausschließlich lokal auf diesem Rechner
- Das vorhandene Git-Remote ist privat und blieb unverändert; **es wurde nichts gepusht oder hochgeladen**

## Qualität

- Tests: **815/815 grün in 37 Dateien** (Vitest + React Testing Library)
- Build: grün (tsc + Vite); Lint: grün (ESLint); `check-all.bat`: grün
- Reviewfreigaben: alle 14 Module einzeln (Prüfketten mit data-architect/finance-analyst/accessibility/calculation-tester/reviewer), V1-Abschlussprüfung M15 (data-architect + reviewer: Freigabe), Release-Tooling M16 (Freigabe), Finalabnahme M17 (data-architect, Security/Privacy, Accessibility, reviewer)
- Smoke-Test: automatisierte Abläufe und Serverstart-/Release-Build-Prüfungen bestanden; Details und ehrliche Grenzen (keine manuelle Browser-Bedienprüfung durch einen Menschen) im M17-Eintrag von `progress.md`

## Bekannte Einschränkungen

Siehe `README.md`, Abschnitt „Bekannte Einschränkungen (V1)“ – u. a.: direktes Dateispeichern nur in Chrome/Edge (sonst Download-Fallback), Aufbewahrungsanzahl der Backups nicht durchsetzbar, Zielprofile nur Auswahl (keine Bearbeitung), feste deutsche Formate, kein Strg+S, keine Snapshot-Verlaufsansicht, keine Anlage-, Rechts- oder Steuerberatung.

## V1.x-Ausblick

Die konsolidierte Restpunkteliste steht in `progress.md` (Abschnitt „V1.x – Offene Punkte“), die Priorisierung in `docs/V1_X_ROADMAP.md`. Nichts davon ist zugesagt oder terminiert.
