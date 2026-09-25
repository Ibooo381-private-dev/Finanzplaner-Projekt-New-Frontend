# Simulator (M13 – Simulator & Projektionen)

[Home](Home.md) · Verwandt: [Goals](Goals.md), [Rebalancing](Rebalancing.md)

**Zweck:** Zukunftsszenarien aus Sparraten und optionaler konstanter Renditeannahme – als klar gekennzeichnete Projektion, strikt getrennt von Ist-Daten.

**Rechenmodell:** Aggregat (Tagesgeld + Depot), **nur das Depot** wird verzinst; geometrischer Monatsfaktor (1+r)^(1/12); je Monat erst Verzinsung, dann Beiträge (Monatsende-Regel); **startMonth = Folgemonat des Stichtags** (data-architect-Korrektur 2.1 gegen einen Off-by-one der Spezifikation – gepinnt mit 6 Monaten real: 777,59/3.122,47/3.900,06); Telekom-Jahresereignis (Juli 1.500 = 1.000 + 500) nur in der realen Sicht (G9).

**Bewusst nicht:** Inflation, negative Renditen, Rebalancing-Schalter (im Aggregatmodell eine Scheinfunktion), Monte-Carlo, historische Kurse – Konflikt-Ausweise in requirements M13.

**Grenzen/Validierung:** Monate 1–1200; Rendite 0–15 % mit Warnung > 8 % (W_RETURN_ASSUMPTION, nie Fehler); r=0 ≡ projectNoGrowth (Konsistenz-Pin); Growth-Pin 1.000 × 12 % → exakt 1.120,00.

**Besonderheiten:** Simulationen sind die **einzige** hart löschbare Entität (referenzlos; G12-Bestätigung); Kopieren erzeugt „(Kopie)“ mit neuem Datum; Vergleich mehrerer Szenarien; Diagramm = handgerolltes `aria-hidden`-SVG, die Tabelle ist Primärquelle.

**Dateien:** `src/finance/projection.ts`, `src/data/simulations.ts`, `src/pages/SimulatorPage.tsx`; Tests: `tests/finance/simulation.test.ts` (44), `tests/data/simulations.test.ts` (28), `tests/pages/simulatorPage.test.tsx`.
