# Changelog

Alle nennenswerten Änderungen an Finance OS werden in dieser Datei dokumentiert.
Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) (ohne externe Abhängigkeit); Versionierung nach [SemVer](https://semver.org/lang/de/).

## [1.0.0] – 2026-07-20

Erste vollständige Version („Feature Complete“, V1-Abschlussprüfung mit data-architect- und reviewer-Freigabe; 815 automatisierte Tests grün). Details je Entwicklungsphase in `progress.md`. **Lokal final freigegeben am 2026-07-21 (Finalabnahme M17): lokaler Git-Tag `v1.0.0`, kein Push, keine Veröffentlichung – privates persönliches Projekt** (siehe `RELEASE_NOTES.md`).

### Added

- **Lokale Dateispeicherung (M1–M6):** JSON-Datei als einzige dauerhafte Datenquelle; Öffnen, direktes Speichern (Chrome/Edge) mit Download-/Import-Fallback (Firefox/Safari), JSON-Export, Import mit Validierung + Vorschau + Bestätigung, automatische datierte Sicherungskopien, Ungespeichert-Anzeige mit Schließen-Warnung.
- **Übersicht/Dashboard (M7):** Vermögens- und Sparleistungs-Kennzahlen (eigene Sparleistung und Gesamtzufluss strikt getrennt, real vs. geglättet gekennzeichnet), Zielübersicht, Datenqualitäts-Hinweise.
- **Konten (M8):** Kontenverwaltung mit Typen, Zweckbindung, datierten Salden-Historien; Deaktivieren statt Löschen.
- **Depot & Tagesgeld (M9):** Positionsverwaltung, Werterfassung, gesperrte Snapshot-Vollerfassung (unveränderliche Historie), Depot-Gewichtung inkl. „MSCI World gesamt“, Zielvergleich (nur Anzeige).
- **Sparpläne und Zuflüsse (M10):** Zuflussarten (eigen/Arbeitgeber/Anbieter/Umbuchung), Rhythmen inkl. einmalig, reale und geglättete Sicht, 1.000-€-Sparziel-Fortschritt, Fälligkeitskalender, Budget-Warnung.
- **Rebalancing (M11):** Abweichungsanalyse gegen Zielprofile, Empfehlungen ausschließlich im Konjunktiv mit Schwellenlogik, Sparraten-Vorschlag, Kauf-/Verkaufs-Simulation, gespeicherte Planungen („geplant, nicht ausgeführt“ / „verworfen“).
- **Finanzielle Ziele (M12):** Zielarten (Sparrate, Depot, Gesamtvermögen, Kontostand, Positionswert, manuell), abgeleiteter Zielstatus, Monatsrate, Prognose ohne Renditeannahme.
- **Simulator (M13):** Projektionen ohne Kursentwicklung und mit konstanter Renditeannahme (0–15 %, Warnung > 8 %), Szenarien speichern/kopieren/vergleichen – strikt von den Ist-Daten getrennt.
- **Einstellungen (M14):** Notgroschen (Faktor × Netto, manuelle Übersteuerung mit Bestätigung), Sparbudget, Prozent-Dezimalstellen, Zielprofil-Auswahl, Sicherungsmodus, Backup-/Import-/Export-Verwaltung.
- **Validierung:** vollständige Lade-/Importvalidierung (Schema, Typen, Referenzen, NaN/Infinity-Verbote, Fachregeln) mit deutschem Fehlerkatalog (`docs/data-model.md` §5).
- **Barrierefreiheit:** Tastaturbedienung, Fokusführung, feldnahe Fehlermeldungen, role=status-Feedback, Text+Symbol statt reiner Farbe.
- **Test- und Dokumentationsgrundlage:** 815 automatisierte Tests (Vitest + React Testing Library), verbindliche Doku unter `docs/` (Anforderungen, Berechnungsregeln, Datenmodell, Speicherkonzept, Design-System, Teststrategie).
- **Release-Engineering (M16):** Windows-Skripte unter `scripts/` (Start/Stop des Dev-Servers mit PID-Datei, Lint/Test/Build/Check-All, Clean, Quellcode-Backup, lokaler Release mit Manifest), CHANGELOG, LICENSE, erweiterter Entwickler-Workflow im README.

### Security / Safety

- Keine Cloud, kein Backend, keine Konten-Anbindung: die App macht keinerlei Netzwerkzugriffe; alle Daten bleiben lokal in der JSON-Datei des Nutzers.
- Import-Schutz: fehlgeschlagene oder abgebrochene Importe verändern nie den geladenen Bestand; Übernahme nur nach Vorschau und Bestätigung.
- Keine automatische Orderausführung, keine Broker-/Bank-APIs; Empfehlungen und Simulationen sind reine Anzeigen und verändern nie echte Finanzdaten oder gespeicherte Ist-Daten.
- Keine Zugangsdaten, API-Schlüssel oder Zahlungsdaten im Datenmodell.

### Known limitations

Siehe `README.md` Abschnitt „Bekannte Einschränkungen (V1)“ und die konsolidierte V1.x-Restpunkteliste in `progress.md` (u. a. Zielprofile nur Auswahl, Aufbewahrungsanzahl der Backups nicht durchsetzbar, feste deutsche Formate, kein Strg+S, keine Snapshot-Verlaufsansicht).
