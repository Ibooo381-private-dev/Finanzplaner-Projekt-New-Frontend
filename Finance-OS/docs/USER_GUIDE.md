# Finance OS – Benutzerhandbuch (v1.0.0)

Stand: 2026-07-21. Dieses Handbuch beschreibt die tatsächlich vorhandene App – ein **privates, ausschließlich lokal laufendes** Finanzwerkzeug ohne Cloud, ohne Netzwerkzugriffe und ohne Anlageberatung. Screenshots sind bewusst nicht enthalten.

## 1. Voraussetzungen

- Windows (für die Skripte unter `scripts/`; die App selbst läuft im Browser)
- Node.js ≥ 22 und npm ≥ 11 (geprüft mit Node 22.14.0 / npm 11.12.1)
- Chrome oder Edge für direktes Dateispeichern; Firefox/Safari funktionieren über den Download-/Import-Fallback

## 2. Projekt lokal starten

Am einfachsten: `scripts\start-dev.bat` doppelklicken. Das Skript prüft Node/npm, bietet bei fehlenden Abhängigkeiten `npm ci` an und startet den Entwicklungsserver in einem eigenen Fenster (üblich: http://localhost:5173 – die tatsächliche URL steht im Serverfenster). Alternativ im Terminal: `npm ci` (einmalig), dann `npm run dev`.

## 3. Entwicklungsserver stoppen

`scripts\stop-dev.bat` beendet ausschließlich den von `start-dev.bat` gestarteten Serverprozess (gemerkt in `.runtime\dev-server.pid`). Fremde Node-Prozesse werden nie beendet. Alternativ das Serverfenster schließen.

## 4. Finanzdatei öffnen

Ohne geladene Datei direkt auf der Startseite oder unter **„Daten & Backups“** → „Datei öffnen …“. In Chrome/Edge wählst du die JSON-Datei direkt und kannst später in dieselbe Datei speichern; in Firefox/Safari wird die Datei eingelesen und Speichern läuft über Downloads. Als Startvorlage dient `user-data/finance-data.example.json`.

## 5. Neue Finanzdatei erstellen

Startseite oder „Daten & Backups“ → „Neue leere Datei anlegen“. Es entsteht ein leerer, gültiger Datenbestand (schemaVersion 1), den du anschließend speicherst und befüllst.

## 6. Speichern

Kopfbereich (auf jeder Seite) oder „Daten & Backups“ → „In Datei speichern“ (Browser ohne Direktspeichern: „Als Download speichern“). Wichtig: Die Formular-Buttons („… anlegen“, „Änderungen übernehmen“, „Wert übernehmen“) übernehmen Eingaben nur in den Arbeitsspeicher – in die Datei gelangen sie erst mit diesem Speichern; der Kopfbereich zeigt bis dahin „● Ungespeicherte Änderungen“. In Chrome/Edge wird nach Browser-Freigabe direkt in die geöffnete Datei geschrieben; danach lädt die App automatisch eine datierte Sicherungskopie herunter (Modus siehe Einstellungen). Ohne Direktspeichern bietet die App den Download-Fallback an. Ein Tastenkürzel (Strg+S) gibt es in V1 nicht.

## 7. „Speichern unter“

„Daten & Backups“ → „Speichern unter …“ (nur Chrome/Edge): schreibt den Bestand in eine neue Datei und verbindet die App mit dieser Datei.

## 8. Backup erstellen

Automatisch: nach jedem erfolgreichen direkten Speichern (Modus „bei jedem Speichern“ oder „täglich beim ersten Speichern“, einstellbar). Manuell: Einstellungen → „Sicherung jetzt erstellen“ oder „Daten & Backups“ → „Sicherungskopie herunterladen“. Backups sind vollständige, wieder ladbare JSON-Dateien mit Zeitstempelnamen.

## 9. Backup wiederherstellen

Wiederherstellung = **Import** der Sicherungsdatei: „Daten & Backups“ → Karte „Importieren“ → Backup-Datei wählen → Vorschau prüfen → „Bestand durch Import ersetzen“ → anschließend speichern. Es gibt keinen separaten Wiederherstellungs-Kanal – das ist beabsichtigt (ein geprüfter Weg).

## 10. Importvorschau verstehen

Die Vorschau zeigt Schema-Version, Anzahl Konten/Positionen/Snapshots/Ziele, das jüngste Datum und den Vergleich zum aktuell geladenen Bestand. Ist der geladene Bestand neuer als die Importdatei, warnt die App ausdrücklich. Vor der Übernahme kannst du eine Sicherungskopie des bisherigen Bestands herunterladen. Abbruch oder ungültige Dateien lassen den Bestand unverändert.

## 11. Dashboard (Übersicht)

Zeigt Vermögens-Kennzahlen (Gesamtvermögen, Depotwert, Tagesgeld, sonstiges Kontovermögen), die getrennten Sparleistungs-Kennzahlen (eigene Sparleistung real/geglättet, Gesamtzufluss), die Zielübersicht und Datenqualitäts-Hinweise. Unbekannte Werte erscheinen als „unbekannt“, nie als 0. Archivierte Ziele erscheinen nicht zwischen den aktiven.

## 12. Konten

Konten anlegen/bearbeiten (Name, Institut, Typ, Zweckbindung), Salden als **neue datierte Einträge** erfassen (Historie bleibt erhalten), Konten deaktivieren statt löschen (Bestätigung erforderlich). Die Liste ist sortierbar.

## 13. Depot

Positionen anlegen/bearbeiten/deaktivieren, Werte datiert erfassen, **Snapshot-Vollerfassung** (alle aktiven Positionen + Tagesgeldkonten zu einem Datum; nach „Snapshot übernehmen“ gesperrt – Korrekturen nur als neuer Snapshot), Depot-Gewichtung inkl. „MSCI World gesamt“ und Zielvergleich (nur Anzeige, ändert nichts).

## 14. Sparpläne

Pläne mit Zielposition/-konto, Betrag, Rhythmus (monatlich bis einmalig), Zuflussart (eigen fest/variabel, Arbeitgeber, Anbieter, Umbuchung) und Flexibilität. Pausieren/Reaktivieren/Beenden möglich. Eigene variable Pläne mit festem positivem Betrag zählen zur eigenen Sparleistung (U4). Summen real und geglättet getrennt; 1.000-€-Sparziel-Fortschritt; Warnung, wenn die eigene Sparleistung das Sparbudget aus den Einstellungen überschreitet (nur Hinweis).

## 15. Ziele

Zielarten: Sparrate, Depotwert, Gesamtvermögen, Kontostand, Positionswert, manuell gepflegt. Je Ziel: Betrag/Termin (oder „offen“), Fortschritt, benötigte Monatsrate und Prognose ohne Renditeannahme. Ziele lassen sich pausieren (Status „zurückgestellt“), manuell abschließen und archivieren – nie löschen.

## 16. Rebalancing

Analyse der Abweichung zwischen Ist-Depot und Zielprofil (lokale Vergleichsauswahl – das globale Profil bleibt unverändert), Handlungsempfehlungen ausschließlich als „könntest du“-Formulierungen ab definierten Schwellen, Sparraten-Vorschlag, Kauf-/Verkaufs-Simulation („wird nie automatisch übernommen“). Empfehlungen können nach Bestätigung mit „Als geplante Einstellung vormerken“ als **Planung** vorgemerkt werden („geplant, nicht ausgeführt“) und lassen sich verwerfen; Ist-Daten ändern sie nie.

## 17. Simulator

Simulationen anlegen/bearbeiten/kopieren/vergleichen/löschen (Löschen mit Bestätigung). Projektion ohne Kursentwicklung (0 %) oder mit konstanter Renditeannahme (0–15 %, Warnung über 8 %), monatliche Verlaufstabelle (Diagramm nur als Zusatz), Zielanalyse mit Begründung. Simulationen sind reine Szenarien und verändern keine Konten-, Depot- oder Sparplandaten.

## 18. Einstellungen

Monatliches Netto, Notgroschen-Faktor (3–5) mit Live-Vorschau, manuelle Notgroschen-Übersteuerung setzen/zurücksetzen (immer mit Bestätigung, die beide Werte nennt), monatliches Sparbudget, Prozent-Nachkommastellen (0–4), globale Zielprofil-Auswahl (Job-Profil vor dem 01.10.2027 mit Zusatzwarnung), Sicherungsmodus und Aufbewahrungsempfehlung, „Sicherung jetzt erstellen“, Transparenz-Sektion zu Speicherorten.

## 19. Warnungen und Bestätigungen

Alle destruktiven oder folgenreichen Aktionen (Deaktivieren, Löschen von Simulationen, Profilwechsel, Override setzen/zurücksetzen, Import-Übernahme, rückdatierte Snapshots) verlangen eine Bestätigung mit den konkreten Werten. Statusanzeigen nutzen Text + Symbol, nie nur Farbe. Warnungen (z. B. Budget überschritten, Rendite > 8 %) blockieren nie.

## 20. Umgang mit realen Finanzdaten

Deine echte JSON-Datei und ihre Backups bleiben dort, wo du sie speicherst – lege sie **nicht** in `user-data/` des Repos ab (die .gitignore blockiert das Committen, aber der saubere Weg ist ein Ordner außerhalb des Projekts). Beachte: Doku, Tests und Beispieldatei des Projekts basieren auf den realen Werten des Projektinhabers; auch Quellcode-Backups sind daher vertraulich. Die privaten Notizen in `reference/` sind Teil des privaten Repos.

## 21. Browserunterschiede

Chrome/Edge: direktes Öffnen/Speichern in dieselbe Datei (File System Access API). Firefox/Safari: Öffnen per Dateiauswahl, Speichern als Download, Rückweg über Import. Alle Fachfunktionen sind identisch.

## 22. Fehlerbehebung

Siehe README-Abschnitt „Troubleshooting (Windows)“: Pfade mit Leerzeichen/OneDrive, PID-Datei, Ausführungsrichtlinie, belegter Port, 2-Sekunden-Startheuristik, `npm ci`-Probleme. Bei App-Fehlern: Seite neu laden – der Datenbestand liegt sicher in deiner Datei; ungespeicherte Änderungen zeigt der Kopfbereich.

## 23. Datenverlust vermeiden

Regelmäßig speichern (Auto-Backup läuft dann mit), den Ungespeichert-Indikator beachten (beim Schließen mit ungespeicherten Änderungen warnt der Browser), Sicherungskopien an einem zweiten Ort aufbewahren, vor Importen die angebotene Sicherung nutzen. Nach Löschen des Browser-Caches stellt das erneute Öffnen der Datei alles wieder her.

## 24. Projektbackup

`scripts\backup-project.bat` erzeugt ein datiertes Quellcode-ZIP in `project-backups\` (validiert; ohne node_modules/dist/private Notizen/echte Finanzdateien). Vertraulich behandeln (siehe Punkt 20).

## 25. Lokalen Release erstellen

`scripts\release.bat` prüft den Git-Stand (Abbruch bei uncommitteten Änderungen; `--allow-dirty` kennzeichnet im Manifest), führt Lint/Tests/Build aus und erzeugt `releases\finance-os-v<version>\` + ZIP mit `release-manifest.json`. Bestehende Artefakte derselben Version werden nur nach Bestätigung ersetzt. Alles bleibt lokal; es wird nichts gepusht oder veröffentlicht.

## 26. Grenzen der Finanzberechnungen

Alle Werte sind Anzeige-/Analysewerte aus deinen eigenen Eingaben: keine Kurse, keine Renditeberechnung der Vergangenheit, keine Steuern/Inflation, Projektionen nur mit klar gekennzeichneten Annahmen („keine Prognose“). Geglättete Werte sind Analysewerte und werden nie mit realen Cashflows vermischt.

## 27. Keine Anlageberatung

Finance OS dokumentiert, berechnet und simuliert ausschließlich auf Basis deiner Eingaben. Nichts in der App ist Anlage-, Rechts- oder Steuerberatung; Empfehlungen sind unverbindliche Hinweise im Konjunktiv.

## 28. Privater und lokaler Betrieb

Das Projekt ist ein privates Einzelprojekt (LICENSE: alle Rechte vorbehalten). Es gibt keine Veröffentlichung, kein Deployment, keine Cloud und keine Synchronisation; Release-Artefakte, Backups, Commits und der lokale Git-Tag `v1.0.0` bleiben auf diesem Rechner. Das vorhandene GitHub-Remote ist privat und wird von den Skripten nie beschrieben.
