---
name: rebalancing
description: Verwende diesen Skill für Zielallokationen, Depotgewichtungen, Kauf- und Verkaufsbedarf sowie Rebalancing über angepasste Sparraten.
---

# Rebalancing-Regeln

## Bezugsgrößen

Tagesgeld wird auf Gesamtvermögensebene berechnet.

Depotpositionen werden innerhalb des Depotwerts berechnet.

Tagesgeld darf nicht in den Nenner der Depotgewichtung eingehen.

## Grundformeln

Aktueller Depotanteil:

Positionswert / gesamter Depotwert

Aktueller Gesamtvermögensanteil:

Positionswert / Gesamtvermögen

Sollwert einer Depotposition:

Zielanteil innerhalb des Depots × relevanter Depotwert

Abweichung:

Aktueller Wert - Sollwert

Kaufbedarf:

MAX(0, Sollwert - aktueller Wert)

Verkaufsbedarf:

MAX(0, aktueller Wert - Sollwert)

Prozentpunktabweichung:

Aktueller Anteil - Zielanteil

## Rebalancing-Reihenfolge

1. Laufende Sparraten auf untergewichtete Positionen lenken.
2. Zusätzliches Geld und Ausschüttungen verwenden.
3. Flexible Sparpläne übergewichteter Positionen reduzieren.
4. Flexible Sparpläne vorübergehend pausieren.
5. Verkäufe erst als letzte Möglichkeit prüfen.

## Sparratenregeln

- Keine vorgeschlagene Sparrate darf negativ sein.
- Die Summe der vorgeschlagenen Raten darf das verfügbare Budget nicht überschreiten.
- Nicht flexible Mindestbeträge müssen eingehalten werden.
- VL kann als nicht flexibel markiert werden.
- Telekom kann als nicht flexibel markiert werden.
- Übergewichtete flexible Positionen dürfen 0 Euro erhalten.
- Rundungen dürfen die Gesamtsparrate nicht unbemerkt verändern.
- Rundungsdifferenzen müssen sichtbar ausgeglichen werden.
- Projektionen ohne Kursentwicklung müssen ausdrücklich gekennzeichnet werden.

## Zielprofile

Unterstütze mindestens:

- Student
- Job
- Eigene Aufteilung

Die konkreten Gewichtungen stammen aus den Referenzdateien und dürfen nicht geraten werden.

## Pflichtprüfungen

- Tagesgeld plus Depot ergeben auf Gesamtvermögensebene 100 Prozent.
- Alle Depot-Zielpositionen ergeben innerhalb des Depots 100 Prozent.
- World-Unterpositionen ergeben gemeinsam den World-Gesamtanteil.
- Keine NaN- oder Infinity-Ergebnisse.
- Keine Division durch null.
- Käufe und Verkäufe müssen bis auf ausgewiesene Rundungsdifferenzen konsistent sein.