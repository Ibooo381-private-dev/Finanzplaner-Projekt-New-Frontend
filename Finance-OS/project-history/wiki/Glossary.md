# Glossary

[Home](Home.md) · Vollversion: [Development History §16/§17](../Finance_OS_Development_History.md#16-glossar)

| Begriff | Kurzdefinition |
|---|---|
| G1–G12 | Die 12 globalen verbindlichen Anforderungen (requirements §3) |
| F1–F22 | Formelkatalog mit Seed-Sollwerten (calculation-rules §12) |
| T/DM/ST-Tests | Pflicht-Testkataloge fachlich / Datenmodell / Storage |
| U1–U4 | Verbindliche Nutzerentscheidungen (Quellenbestätigung, Sparraten, U3-Bezugsgröße, U4-own_variable) |
| Seed | Beispieldatei mit den realen bestätigten Werten (Start-Snapshot 2026-07-17) |
| Eigene Sparleistung / Gesamtzufluss | F8 vs. F9 – strikt getrennte Kennzahlen (G8) |
| real / geglättet | Tatsächliche Zahlung vs. Monatsdurchschnitts-Analysewert (G9) |
| flowType | Zuflussart: own_fixed/own_variable/employer/provider/reserve_transfer/liquidity_transfer |
| Snapshot / locked | Datierter Vollstand; nach Speicherung unveränderlich (G3/G4, DM21) |
| actionLevel | 3-stufige Abweichungsbewertung (5/10 Pp); Verkaufsoption nur bei Übergewichtung |
| plannedChange | Gespeicherte Rebalancing-Planung (planned/discarded) |
| K2-Byte-Identität | No-Op-Patch ⇒ identisches Serialisat; Defaults nie materialisieren |
| Kein-Löschen-Linie | Deaktivieren/Archivieren statt Löschen (Ausnahme: Simulationen) |
| todayIso | Injizierter Stichtag statt Systemuhr |
| Dirty | Ungespeicherter Unterschied zur Datei (Text + Symbol im Kopf) |
| Prüfkette | data-architect → frontend-developer → finance-analyst/accessibility → calculation-tester → reviewer |
| Konflikt-Ausweis | Dokumentierte begründete Abweichung von einer Anforderung |
| Grauzone | Dokumentierte offene Fachfrage → Nutzerentscheidung |
| Stop-Test | Negativtest, der ein Verbot aktiv zu verletzen versucht |
| B1/B2/B3 | A11y-Fokusmuster (Statusmeldung / bleibender Anker / Erstfehler) |
| A2–A8 | Auto-Backup-Auflagen (M14) |
| V1.x | Konsolidierte Restpunkteliste (progress.md) + [Roadmap](Roadmap.md) |
| FSA | File System Access API (direktes Dateispeichern in Chrome/Edge) |
| Pp | Prozentpunkte |
