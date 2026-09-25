---
name: quality-check
description: Verwende diesen Skill nach Änderungen an Finanzberechnungen, Datenimporten, Datenspeicherung oder zentralen Komponenten.
---

# Qualitätsprüfung

## Finanzlogik

Prüfe:

- Gesamtvermögen = Tagesgeld + Depot
- Depotwert = Summe aller Depotpositionen
- Zielgewichte ergeben 100 Prozent
- World-Unterpositionen ergeben World gesamt
- Tagesgeld ist nicht Teil des Depotnenners
- Umbuchungen verändern Einnahmen und Ausgaben nicht
- Rückerstattungen werden nicht doppelt gezählt
- keine negativen Sparraten
- nicht flexible Mindestbeträge bleiben erhalten
- Rundungsdifferenzen werden sichtbar ausgewiesen
- keine NaN-, Infinity- oder leeren Rechenergebnisse

## Datenspeicherung

Prüfe:

- Laden einer gültigen JSON-Datei
- verständliche Ablehnung einer ungültigen JSON-Datei
- Daten bleiben nach Export und erneutem Import identisch
- schemaVersion ist vorhanden
- unbekannte zusätzliche Felder werden nicht unnötig zerstört
- ein fehlgeschlagener Import überschreibt nicht den aktuellen Datenbestand
- nicht gespeicherte Änderungen werden sichtbar angezeigt
- Cache-Löschung ist durch erneutes Laden der JSON-Datei überlebbar

## Oberfläche

Prüfe:

- leere Datenbestände
- große Beträge
- Nullwerte
- negative oder ungültige Eingaben
- mobile Breite
- Tastaturbedienung
- verständliche Fehlermeldungen
- Bestätigung vor destruktiven Aktionen

## Abschlussbericht

Berichte:

1. bestandene Prüfungen
2. fehlgeschlagene Prüfungen
3. konkrete Fehler
4. Schweregrad
5. empfohlene Korrektur
6. noch nicht getestete Risiken