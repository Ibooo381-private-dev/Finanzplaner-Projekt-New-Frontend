# Finance OS – dauerhafte Projektregeln

## Projektziel

Finance OS ist eine lokal laufende persönliche Finanzanwendung.

Die Anwendung soll langfristig folgende Module enthalten:

- Übersicht
- Monatsfinanzen
- Konten
- Fixkosten
- Depot
- Tagesgeld
- Sparpläne
- Rebalancing
- finanzielle Ziele
- Simulationen
- Investment-Journal
- Monatsabschluss
- Wissensbereich
- Datenimport und Datenexport
- Backups

## Technischer Rahmen

- Frontend: React und TypeScript
- Build-System: Vite
- Die Anwendung läuft lokal im Browser.
- Es gibt zunächst kein Backend.
- Es gibt zunächst keine serverbasierte Datenbank.
- Die dauerhafte Hauptdatenquelle ist eine JSON-Datei.
- Browser-Speicher darf nicht die einzige Datenquelle sein.
- localStorage darf höchstens für unkritische UI-Einstellungen verwendet werden.
- Finanzdaten müssen über eine JSON-Datei geöffnet, gespeichert, exportiert und importiert werden können.
- Wenn direktes Dateispeichern im Browser nicht unterstützt wird, muss ein Download- und Import-Fallback funktionieren.
- Die Anwendung muss nach Löschen des Browser-Caches mit der vorhandenen JSON-Datei vollständig wiederherstellbar sein.
- Keine Bankzugänge, Passwörter, API-Schlüssel oder vollständigen Zahlungsdaten speichern.
- Keine externen Finanz- oder Banking-APIs in Version 1.

## Persönliche Finanzregeln

- Tagesgeld und Depot werden getrennt betrachtet.
- Gesamtvermögen besteht aus Tagesgeld plus Depot.
- Tagesgeld ist keine Depotposition.
- Die Depotgewichtung verwendet nur den Depotwert als Nenner.
- Sparen ist keine Konsumausgabe.
- Investments sind keine Konsumausgabe.
- Umbuchungen zwischen eigenen Konten sind weder Einnahmen noch Ausgaben.
- Rückerstattungen reduzieren die betreffende Ausgabenkategorie.
- Telekom-Eigenbeitrag und Telekom-Mitarbeitervorteil werden getrennt gespeichert.
- Der gesamte Telekom-Vermögenszufluss darf zusätzlich ausgewiesen werden.
- MSCI World VL, MSCI World thesaurierend und MSCI World ausschüttend werden einzeln und gemeinsam als „MSCI World gesamt“ ausgewertet.
- Saveback und Round-up dürfen nicht doppelt gezählt werden.
- Keine Finanzwerte erfinden.
- Unsichere Daten als „zu prüfen“ kennzeichnen.
- Berechnete Werte müssen aus Quelldaten und klar definierten Formeln entstehen.

## Rebalancing-Grundsätze

Rebalancing wird in dieser Reihenfolge bevorzugt:

1. laufende Sparraten anpassen
2. zusätzliches Geld oder Ausschüttungen verwenden
3. flexible Sparpläne reduzieren
4. flexible Sparpläne pausieren
5. Verkäufe erst als letzte Möglichkeit prüfen

Weitere Regeln:

- Keine vorgeschlagene Sparrate darf negativ sein.
- Nicht flexible Mindestbeträge müssen eingehalten werden.
- Tagesgeld wird zuerst auf Gesamtvermögensebene geprüft.
- Danach werden Depotpositionen innerhalb des Depotwertes geprüft.
- Projektionen ohne Kursentwicklung müssen ausdrücklich gekennzeichnet werden.
- Berechnungen sind keine verbindliche Anlage- oder Steuerberatung.

## Entwicklungsregeln

- Vor einer größeren Änderung zuerst einen kurzen Plan erstellen.
- Immer nur ein klar abgegrenztes Modul gleichzeitig bearbeiten.
- Keine unnötig komplexe Architektur.
- Finanzlogik und UI-Logik getrennt halten.
- Rechenfunktionen müssen unabhängig von React-Komponenten testbar sein.
- Änderungen an Finanzberechnungen benötigen automatisierte Tests.
- Bestehende Daten nicht ohne ausdrückliche Anweisung löschen.
- Datenformatänderungen benötigen eine Versionsnummer und eine Migrationsstrategie.
- Keine Funktion als fertig bezeichnen, bevor die relevanten Tests erfolgreich sind.
- Fehler nicht durch das Entfernen sinnvoller Tests verdecken.
- Nach jeder abgeschlossenen Phase progress.md aktualisieren.
- README.md muss die tatsächliche Bedienung beschreiben.

## Agentenworkflow

Bei fachlichen Finanzfragen:

1. finance-analyst einsetzen
2. Ergebnisse dokumentieren
3. erst danach implementieren

Bei Änderungen am Datenmodell:

1. data-architect einsetzen
2. Rückwärtskompatibilität prüfen
3. Tests für Laden und Speichern definieren

Bei UI-Implementierung:

1. frontend-developer einsetzen
2. vorhandene Finanzfunktionen verwenden
3. Finanzformeln nicht in Komponenten duplizieren

Nach Änderungen an Berechnungen:

1. calculation-tester einsetzen
2. Tests ausführen
3. Fehler nachvollziehbar melden

Nach Abschluss einer Phase:

1. reviewer einsetzen
2. bestätigte Probleme korrigieren
3. progress.md aktualisieren

## Standardarbeitsablauf

1. CLAUDE.md und progress.md lesen.
2. relevante Dokumente und Referenzdateien lesen.
3. Aufgabe abgrenzen.
4. passenden Skill und Agenten einsetzen.
5. Implementierungsplan erstellen.
6. kleine Änderung umsetzen.
7. Tests ausführen.
8. unabhängigen Review durchführen.
9. Dokumentation aktualisieren.
10. Ergebnis und offene Punkte zusammenfassen.