# FAQ

[Home](Home.md) · Verwandt: [Glossary](Glossary.md), [Quick Reference](../Finance_OS_Quick_Reference.md)

**Warum zeigt die App „unbekannt“ statt 0 €?**
G11: Nicht erfasste Werte sind unbekannt, nicht null. 0 wäre eine erfundene Zahl. Mechanik: `AggregatedAmount.missingIds` ([Dashboard](Dashboard.md)).

**Warum kann ich Konten/Positionen/Ziele nicht löschen?**
Kein-Löschen-Linie: Referenzen (Sparpläne, Gewichte, Historie) müssen stabil bleiben – deaktivieren/archivieren stattdessen. Einzige Ausnahme: referenzlose Simulationen ([Simulator](Simulator.md)).

**Warum führt Rebalancing nichts aus?**
G1: Die App ändert nie reale Sparpläne oder Orders. Empfehlungen sind Konjunktiv; Planungen sind „geplant, nicht ausgeführt“ ([Rebalancing](Rebalancing.md)).

**Warum zählt der Telekom-Zufluss nur 1.000 €/Jahr, obwohl 75 €/Monat fließen?**
Die 75 € sind eine Umbuchung auf die eigene Rücklage; gezählt wird genau einmal bei der Equatex-Einzahlung – sonst wäre es Doppelzählung (G7, T1, [Savings-Plans](Savings-Plans.md)).

**Was ist der Unterschied „real“ vs. „geglättet“?**
Real = tatsächliche Monatszahlung; geglättet = rechnerischer Monatsdurchschnitt jährlicher Zuflüsse (Analysewert, klar gekennzeichnet, nie gespeichert, nie gemischt – G9).

**Warum bleibt schemaVersion 1, obwohl Felder dazukamen?**
Alle Erweiterungen sind additiv mit Default; jede Altdatei lädt unverändert. Protokoll: data-model §6 ([Data-Model](Data-Model.md)).

**Meine Datei wird beim Import abgelehnt – sind meine Daten weg?**
Nein, garantiert nicht: Ablehnung/Abbruch verändert den geladenen Bestand nie (G10, DM5-getestet). Die Meldung nennt Pfad und Grund ([Import](Import.md)).

**Warum gibt es kein Strg+S / keine Snapshot-Verlaufsansicht?**
Nie gebaut, in der V1-Abschlussprüfung als fehlend erkannt und als V1.x-Punkte 6/7 ausgewiesen ([Roadmap](Roadmap.md)).

**Ist die Beispieldatei erfunden?**
Nein – sie enthält die realen, bestätigten Werte des Projektinhabers (Start-Snapshot 2026-07-17). Deshalb sind auch Quellcode-Backups vertraulich ([Backup](Backup.md)).

**Darf das Projekt veröffentlicht/gepusht werden?**
Nein. Privates persönliches Projekt, alle Rechte vorbehalten; Remote-Schreibaktionen nur auf ausdrückliche Nutzerentscheidung (LICENSE, [Reviews](Reviews.md) M17).

**Wo sehe ich, was noch offen ist?**
progress.md „V1.x – Offene Punkte“ (26) + [Roadmap](Roadmap.md).
