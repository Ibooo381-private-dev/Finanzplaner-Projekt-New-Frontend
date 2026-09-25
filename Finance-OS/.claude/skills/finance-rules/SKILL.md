---
name: finance-rules
description: Verwende diesen Skill bei Finanzberechnungen, Buchungskategorien, Vermögensauswertungen und der Modellierung von Tagesgeld, Depot und Sparplänen.
---

# Persönliche Finanzlogik

## Vermögensebenen

Es gibt zwei getrennte Ebenen.

### Gesamtvermögen

- Tagesgeld
- Depot

Formel:

Gesamtvermögen = Tagesgeld + Depot

### Depot

Das Depot besteht insbesondere aus:

- MSCI World VL
- MSCI World thesaurierend
- MSCI World ausschüttend
- Emerging Markets IMI
- Physical Gold ETC
- Deutsche Telekom

Die drei World-Positionen werden zusätzlich zu „MSCI World gesamt“ addiert.

Tagesgeld darf niemals in die Depotgewichtung einfließen.

## Buchungsarten

Erlaubte Arten:

- Einnahme
- Konsumausgabe
- Sparen
- Investment
- Rückerstattung
- Umbuchung

Regeln:

- Sparen darf nicht als Konsumausgabe gezählt werden.
- Investments dürfen nicht als Konsumausgabe gezählt werden.
- Umbuchungen verändern weder Einnahmen noch Ausgaben.
- Rückerstattungen reduzieren die zugehörige Ausgabenkategorie.
- Stornierte Buchungen fließen nicht in Ist-Auswertungen ein.
- Geplante und bezahlte Buchungen müssen getrennt ausgewertet werden.

## Telekom

Speichere getrennt:

- eigener Beitrag
- Arbeitgeberbonus oder Mitarbeitervorteil
- gesamter Vermögenszufluss

Für die eigene Sparleistung wird der Eigenbeitrag verwendet.

Für die Vermögensentwicklung kann der gesamte Vermögenszufluss verwendet werden.

## Datenqualität

- Keine Werte erfinden.
- Fehlende Werte als unbekannt speichern.
- Unsichere Zuordnungen mit „zu prüfen“ markieren.
- Geldbeträge intern als Zahlen und nicht als formatierte Texte speichern.
- Währung separat oder zentral festlegen.
- Datumswerte im Datenmodell als ISO-Datum YYYY-MM-DD speichern.
- Prozentwerte intern einheitlich als Dezimalzahlen speichern, beispielsweise 0.15 für 15 Prozent.