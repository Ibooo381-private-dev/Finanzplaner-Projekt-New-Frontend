---
name: monthly-import
description: Verwende diesen Skill beim Import monatlicher Markdown-, CSV- oder strukturierter Finanznotizen in Finance OS.
---

# Monatsimport

## Ablauf

1. Zeitraum erkennen.
2. einzelne Transaktionen extrahieren
3. Datum normalisieren
4. Beschreibung normalisieren
5. Betrag normalisieren
6. Buchungsart bestimmen
7. Kategorie und Unterkategorie vorschlagen
8. Konto zuordnen
9. Dubletten prüfen
10. Importvorschau anzeigen
11. erst nach Bestätigung in den Datenbestand übernehmen

## Dublettenprüfung

Vergleiche mindestens:

- Datum
- normalisierte Beschreibung
- Betrag
- Konto
- Buchungsart

Ähnliche, aber nicht identische Einträge nicht automatisch löschen.

## Unsichere Einträge

Bei unsicherer Zuordnung:

- reviewStatus: needs_review
- Kategorie: Sonstiges, sofern keine bessere sichere Zuordnung möglich ist
- Notiz: Zuordnung prüfen

## Fixkosten

Neue wiederkehrende Kosten nur dann als Fixkosten anlegen, wenn ihre Wiederkehr eindeutig ist.

Andernfalls:

- nur als Buchung importieren
- Hinweis „Mögliche neue Fixkosten – prüfen“

## Sicherheit

- Keine vorhandenen Buchungen ohne Bestätigung überschreiben.
- Keine Beträge erfinden.
- Import immer zunächst als Vorschau behandeln.
- Der Benutzer muss sehen können, welche Datensätze neu, doppelt oder unklar sind.