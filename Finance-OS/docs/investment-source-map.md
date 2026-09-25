# Investment Source Map – Quellenübersicht

**Version 3** – Stand: 2026-07-19, nach Entscheidungsrunde 2 (direkte Nutzerbestätigungen, Quellen **U1** und **U2**).
Erstellt und aktualisiert unter Anwendung der Skills `finance-rules`, `rebalancing` und `quality-check` sowie des Subagenten `finance-analyst`.

> **Grundprinzip (verbindlich, U1):** Finance OS ist ausschließlich ein Analyse-, Planungs- und Dokumentationssystem. Die Anwendung ändert **niemals automatisch** reale Sparpläne, Anlagen, Konten oder Zielprofile und löst **keine** Bank- oder Brokertransaktionen aus. Details: Abschnitt 15 und `docs/calculation-rules.md`.

**Datenstand:** Der Referenz-Snapshot (bisher „Snapshot B“) datiert per Nutzerbestätigung auf den **17.07.2026**. Er wird als **historischer Snapshot** gespeichert und darf nie überschrieben werden; Finance OS soll beim späteren Start zusätzlich die Eingabe frischer aktueller Werte ermöglichen. Snapshot A (älterer Stand aus R1/R7) bleibt undatiert (vor dem 17.07.2026).

---

## 1. Quellenverzeichnis

| ID | Datei / Quelle | Art | Verwertbarkeit |
|----|----------------|-----|----------------|
| **U1** | **Direkte Nutzerbestätigung vom 2026-07-19** | Entscheidungsrunde 1 | **Ranghöchste Quelle** (gemeinsam mit U2). Verbindlich und aktuell; überschreibt widersprüchliche Referenzdateien |
| **U2** | **Direkte Nutzerbestätigung vom 2026-07-19** | Entscheidungsrunde 2 | **Ranghöchste Quelle** (gemeinsam mit U1). Bestätigt: Sparauftrag 160 € (25 + 75 + 60), World-ISINs, keine PDF-/HEIC-Auswertung in Version 1 |
| R1 | `reference/Aktien chatty gefragt.md` | Chat-Protokoll (ChatGPT) mit Ist-Zahlen | Älterer Ist-Stand (Snapshot A), Sparplan-Altstand, persönliche Rahmendaten |
| R2 | `reference/Aktualisierte investment aufteilung (bis studienende).md` | Eigene Aufstellung, ausdrücklich „Aktualisierte“ | Ist-Stand **Snapshot B vom 17.07.2026** (Datum per U1) für Positionen und Sparraten |
| R3 | `reference/Finanzen fragen.md` | Offene Fragenliste | Keine Zahlenwerte; belegt offene Themen |
| R4 | `reference/Finanzielle Investment und spar Ziele.md` | Ziel-Vorlage | Leer – Ziele sind seit U1 in Abschnitt 14 dieser Map dokumentiert |
| R5 | `reference/GELD 2 (…).md` | Monatsfinanzen, Beträge monatlich pauschalisiert | Einnahmen, Fixkosten, Sparaufträge |
| R6 | `reference/GELD.md` | Monatsfinanzen, Beträge je Gehaltsmonat exakt | Einnahmen, Fixkosten, Sparaufträge |
| R7 | `reference/Investments aufteilung.md` | Zielaufteilung Job + alter Ist-Stand | Job-Ziel (identisch mit R8/R9); Ist-Teil = Snapshot A (veraltet) |
| R8 | `reference/Meine Bankkonten und sparanlagen.md` | Kontenstruktur + Job-Ziel | Kontenzwecke, VL-Aufteilung, Telekom-Mechanik, TR-Saveback |
| R9 | `reference/Neue geplante depotaufteilung.md` | Chat-Protokoll zur Zielfindung | Verworfene Entwürfe + „Endstand“ (= Job-Ziel R7/R8) |
| R10 | `reference/Notizen zu finanzen und investments.md` | Wissens-/Regelnotizen | Rebalancing-Regeln, Notgroschen-Regel; Bilder (.heic) nicht verfügbar |
| R11 | `reference/Notizen zu finanzen und investments.pdf` | PDF-Export (94 MB) | **Wird für Version 1 nicht weiter ausgewertet (entschieden, U2)**; mutmaßlich Export von R10; bleibt als nicht ausgewertete historische Quelle dokumentiert |
| C1 | `CLAUDE.md` | Projektregeln | Normative Regeln (keine Beträge) |
| S1 | Skill `finance-rules` | Regeln | Positionsliste des Depots, Buchungsregeln, Telekom-Trennung |
| S2 | Skill `rebalancing` | Regeln | Formeln, Zielprofile (Student/Job/Eigene), Pflichtprüfungen |
| S3 | Skill `quality-check` | Regeln | Prüfkatalog für Finanzlogik, Datenspeicherung, Oberfläche |

### Aktualitätslogik (Quellen-Rangfolge)

0. **U1 und U2 (Nutzerbestätigungen vom 2026-07-19) sind die ranghöchsten Quellen.** Bei Widerspruch zwischen U1/U2 und einer Referenzdatei gilt die Nutzerbestätigung; der historische Widerspruch bleibt im Konfliktregister (Abschnitt 12) dokumentiert und wird dort mit seiner verbindlichen Auflösung gekennzeichnet.
1. **R2 = Snapshot B vom 17.07.2026** (Datum per U1) ist die aktuellste Referenz-Ist-Quelle: Titel „Aktualisierte…“, höherer Depotwert als Snapshot A (2.522,47 € vs. 2.122,34 €), drei World-Unterpositionen statt zwei.
2. **R1 und R7 enthalten denselben älteren Snapshot A** (Depot 2.122,34 €, undatiert, vor dem 17.07.2026) und gelten für Ist-Werte als **veraltet**.
3. **Job-Zielaufteilung:** R7, R8 und der „Endstand“ in R9 sind inhaltsgleich → dreifach bestätigt, **eindeutig**.
4. **R5 vs. R6:** R5 ist die pauschalisierte Ableitung von R6; Abweichungen sind im Konfliktregister ausgewiesen und per U1 aufgelöst (K7).
5. **Zeitliche Eckdaten (U1):** Referenz-Snapshot 17.07.2026; **Studienende 30.09.2027**; das Job-Profil wird **erst nach ausdrücklicher Nutzerbestätigung** zu einem Zeitpunkt nach dem Studienende aktiviert – niemals automatisch (genauer Zeitpunkt bewusst zurückgestellt).

---

## 2. Historischer Snapshot 2026-07-17: Depotpositionen und Positionswerte

Verbindlich per U1: Diese Werte sind der **historische Snapshot vom 17.07.2026**. Sie werden als Historie gespeichert und **nie überschrieben**; frische Werte werden später zusätzlich erfasst. Veraltete Vergleichswerte aus Snapshot A: Abschnitt 12.

| Name | Betrag | Einheit | Quelle | Abschnitt/Kontext | Gültigkeit | Status | Begründung Aktualität |
|------|--------|---------|--------|-------------------|------------|--------|----------------------|
| MSCI World gesamt | 1.020,30 | EUR | R2, bestätigt durch U1 | „Depot allocation“ | Snapshot 2026-07-17 | eindeutig | U1-bestätigt; Summe der Unterpositionen exakt (577,99 + 237,45 + 204,86 = 1.020,30) |
| – VL iShares Core MSCI World | 577,99 | EUR | R2 | Unterposition | Snapshot 2026-07-17 | eindeutig | Teil des bestätigten Snapshots |
| – SPDR MSCI World thesaurierend (Trade Republic) | 237,45 | EUR | R2 | Unterposition | Snapshot 2026-07-17 | eindeutig | dito; Position existiert in Snapshot A noch nicht |
| – Xtrackers MSCI World ausschüttend (Trade Republic) | 204,86 | EUR | R2 | Unterposition | Snapshot 2026-07-17 | eindeutig | dito |
| iShares MSCI Emerging Markets **IMI** | 99,11 | EUR | R2, Produktidentität per U1 | „Depot allocation“ | Snapshot 2026-07-17 | eindeutig | U1: Die Position **ist bereits der EM IMI**; keine Umschichtung erforderlich (löst die frühere Produktfrage, siehe Abschnitt 9) |
| iShares Physical Gold USD (Acc) ETC | 33,92 | EUR | R2, bestätigt durch U1 | „Depot allocation“ | Snapshot 2026-07-17 | eindeutig | Wert korrekt; der Rückgang gegenüber Snapshot A entstand durch **bewusstes Rebalancing** (U1, löst K5) |
| Deutsche Telekom Aktien | 1.369,14 | EUR | R2 | „Depot allocation“ | Snapshot 2026-07-17 | eindeutig | Teil des bestätigten Snapshots |
| **Depotwert gesamt** | **2.522,47** | EUR | R2, bestätigt durch U1 | „Gesamtwert“ | Snapshot 2026-07-17 | eindeutig | Summe exakt (1.020,30 + 99,11 + 33,92 + 1.369,14 = 2.522,47) |
| Tagesgeld (vollständig Volkswagen Bank) | 627,59 | EUR | R2, bestätigt durch U1 | „Vermögensaufteilung“ | Snapshot 2026-07-17 | eindeutig | U1: Wert ist **korrekt und nicht veraltet**; liegt vollständig auf dem VW-Bank-Tagesgeldkonto (löst K11) |
| **Gesamtvermögen des Snapshots** | **3.150,06** | EUR | R2, bestätigt durch U1 | „Gesamtwert“ | Snapshot 2026-07-17 | eindeutig | 2.522,47 + 627,59 = 3.150,06 ✓ (Formel S1: Gesamtvermögen = Tagesgeld + Depot) |

**Depot-Gewichtung im Snapshot 2026-07-17** (Nenner = Depotwert, konform S1/S2 – ohne Tagesgeld):

| Position | Anteil | Einheit | Quelle | Status | Prüfung |
|----------|--------|---------|--------|--------|---------|
| MSCI World gesamt | 40,44845 | % vom Depot | R2 | eindeutig | 1.020,30 / 2.522,47 ✓ |
| MSCI EM IMI | 3,92909 | % vom Depot | R2 | eindeutig | 99,11 / 2.522,47 ✓ |
| Physical Gold | 1,34471 | % vom Depot | R2 | eindeutig | 33,92 / 2.522,47 ✓ |
| Telekom | 54,27775 | % vom Depot | R2 | eindeutig | 1.369,14 / 2.522,47 ✓ |
| Summe | 100,0 | % | – | eindeutig | Pflichtprüfung S2 bestanden ✓ |

---

## 3. World-Unterpositionen (Detail)

| Name | Wert (Snapshot 2026-07-17) | Anteil innerhalb World | Anteil am Depot | ISIN | Quelle Wert | Quelle ISIN | Status |
|------|------|------------------------|-----------------|------|-------------|-------------|--------|
| VL iShares Core MSCI World | 577,99 EUR | 56,64902 % | 22,91365 % | IE00B4L5Y983 | R2 | R7/R8/R9, **bestätigt durch U2** | eindeutig (Wert und ISIN) |
| SPDR MSCI World thesaurierend (Acc) | 237,45 EUR | 23,27257 % | **9,41339 %** (neu berechnet: 237,45 / 2.522,47; R2 nennt fälschlich „9,14339 %“ – Zahlendreher, siehe K16) | IE00BFY0GT14 | R2 (Anteil korrigiert) | R7/R8/R9, **bestätigt durch U2** | eindeutig (Wert und ISIN) |
| Xtrackers MSCI World ausschüttend (Dist) | 204,86 EUR | 20,0784 % | 8,1214 % | IE00BK1PV551 | R2 | R7/R8/R9, **bestätigt durch U2** | eindeutig (Wert und ISIN) |

Regel aus C1/S1: Die drei Positionen werden einzeln **und** als „MSCI World gesamt“ ausgewertet. Pflichtprüfung S2: 56,64902 % + 23,27257 % + 20,0784 % = 99,99999 % ≈ 100 % innerhalb World ✓ (Rundungsdifferenz 0,00001 Pp, sichtbar ausgewiesen gemäß S2).

**Hinweis (Rechenfehler in R2, K16):** R2-Prozentwerte sind abgeleitete Werte und werden grundsätzlich nachgerechnet statt übernommen. Beim SPDR-Depotanteil enthält R2 einen Zahlendreher (9,14339 % statt korrekt 9,41339 %); die Euro-Beträge in R2 sind davon nicht betroffen.

Hinweis (Beschriftungsfehler in R2): Im Abschnitt „Vermögensaufteilung“ sind die World-Unteranteile mit „Msci Prozente von gesamtdepot“ überschrieben, tatsächlich sind sie dort auf das **Gesamtvermögen** (3.150,06 €) gerechnet (z. B. VL 18,34854 % = 577,99 / 3.150,06). Kein Zahlenfehler, nur falsche Überschrift → im Datenmodell korrekt benennen.

---

## 4. Tagesgeld und Notgroschen

| Name | Betrag / Regel | Einheit | Quelle | Gültigkeit | Status | Begründung |
|------|----------------|---------|--------|------------|--------|------------|
| Tagesgeld gesamt (Snapshot) | 627,59 | EUR | R2, bestätigt durch U1 | Snapshot 2026-07-17 | eindeutig | U1: korrekt und nicht veraltet (löst K11) |
| Kontozuordnung | vollständig **Volkswagen Bank Tagesgeldkonto** | – | U1 | ab 2026-07-19 verbindlich | eindeutig | U1-Kontenabgrenzung; ING ist ausschließlich Shares2you-Rücklagenkonto, TR-Cash ist Liquidität (Abschnitt 13) |
| Gesamtvermögen (Tagesgeld + Depot) | 3.150,06 | EUR | R2, bestätigt durch U1 | Snapshot 2026-07-17 | eindeutig | 2.522,47 + 627,59 ✓; Formel S1 |
| Tagesgeld-Anteil am Gesamtvermögen | 19,92311 | % | R2 | Snapshot 2026-07-17 | eindeutig | 627,59 / 3.150,06 ✓; Tagesgeld korrekt **nicht** im Depotnenner (S1/S2) |
| Tagesgeld-Sparrate | 25 | EUR/Monat | R2, R5, R6, R8 (Dauerauftrag VW Bank) | laufend | eindeutig | Konsistent über alle Quellen |
| **Notgroschen-Ziel (verbindlich)** | konfigurierbar **3–5 Nettogehälter**, Standard **4**; bei Netto ~1.170 € → Standardziel **4.680 €** (berechnet: 4 × 1.170) | Nettogehälter / EUR | **U1** | ab 2026-07-19 | **entschieden** | Ersetzt die drei historischen Richtwerte (mind. 3 Monatsgehälter R10; 2.000–3.000 € R9; 3–6 Monatsausgaben R1 – bleiben als Historie dokumentiert). Automatische Neuberechnung bei Netto-Änderung möglich; Zielbetrag manuell überschreibbar; nach Zielerreichung zeigt die App **nur Vorschläge** an und ändert die Tagesgeld-Sparrate **niemals automatisch**. Mögliche Folgeziele: Auto-Rücklage, Urlaub, andere größere geplante Ausgaben |

---

## 5. Aktuelle Sparraten (verbindlich per U1)

Verbindliche Struktur ab 2026-07-19. Die historischen R2-Angaben (u. a. „Gold 20 € mit Saveback“, Summen 240/265 €) sind als Beispieldarstellungen gekennzeichnet – siehe unten und Konflikte K1/K2.

**Feste bzw. geglättete Zuflüsse (Studentensparplan, Ebene A – Details Abschnitt 8):**

| Name | Betrag | Einheit | Zuflussart | Quelle | Status |
|------|--------|---------|------------|--------|--------|
| VL MSCI World gesamt | 40 | EUR/Monat | 33,50 € eigene feste Sparleistung + 6,50 € Arbeitgeberzuschuss | U1 (auch R8; Betrag auch R1/R2/R5/R6) | eindeutig |
| SPDR MSCI World thesaurierend (TR) | 23 | EUR/Monat | eigene feste Sparleistung | U1 (auch R2) | eindeutig |
| Xtrackers MSCI World ausschüttend (TR) | 22 | EUR/Monat | eigene feste Sparleistung | U1 (auch R2) | eindeutig |
| iShares MSCI EM IMI (TR) | 10 | EUR/Monat | eigene feste Sparleistung | U1 (auch R2) | eindeutig (löst K3) |
| Physical Gold ETC (TR) – fester Sparplan | **5** | EUR/Monat | eigene feste Sparleistung | **U1** | eindeutig (löst K2: „20 € mit Saveback“ war ungefährer Gesamtzufluss, kein fester Eigenbeitrag) |
| **Feste TR-Sparrate gesamt** | **60** | EUR/Monat | eigene feste Sparleistung | **U1** | eindeutig (23 + 22 + 10 + 5 = 60 ✓; löst K1) |
| Telekom – geglätteter Eigenbeitrag | 83,33 | EUR/Monat (Analysewert) | eigene Sparleistung (geglättet; real 1.000 €/Jahr) | U1 | eindeutig (UI darf optional gerundet „~84 €“ anzeigen, Rechenbasis bleibt 83,33 bzw. 1.000/Jahr) |
| Telekom – geglätteter Arbeitgeberbonus | 41,67 | EUR/Monat (Analysewert) | Arbeitgeberleistung (geglättet; real 500 €/Jahr) | U1 | eindeutig |
| Telekom – geglätteter Gesamtzufluss | 125 | EUR/Monat (Analysewert) | Gesamtzufluss (geglättet; real 1.500 €/Jahr) | U1 (auch R1/R2/R7) | eindeutig – **nur geglätteter Analysewert, kein realer monatlicher Cashflow** |
| Tagesgeld Volkswagen Bank | 25 | EUR/Monat | eigene feste Sparleistung | U1 (auch R2/R5/R6/R8) | eindeutig |
| **Summe fest/geglättet (ohne variable Zuflüsse)** | **250** | EUR/Monat | – | **U1** | eindeutig (40 + 22 + 23 + 10 + 5 + 125 + 25 = 250 ✓) |

**Variable Zuflüsse (nicht garantiert, keine feste Sparrate):**

| Name | Betrag | Einheit | Zuflussart | Quelle | Status |
|------|--------|---------|------------|--------|--------|
| Saveback (TR) → Physical Gold ETC | variabel | EUR/Monat | **Anbieterleistung** | U1 (Mechanik: R8) | eindeutig als Kategorie; Höhe variabel |
| Round-up (TR) → Physical Gold ETC | variabel | EUR/Monat | **eigene variable Sparleistung** (eigenes Geld) | U1 (Mechanik: R8) | eindeutig als Kategorie; Höhe variabel |
| Saveback + Round-up zusammen | typischerweise ca. 10–15 | EUR/Monat | gemischt, **zwingend getrennt zu speichern** | U1 | eindeutig als Größenordnung; **keine garantierte feste Sparrate** |

Mit typischen variablen Gold-Zuflüssen ergibt sich ein **ungefährer Gesamtzufluss von ca. 260–265 €/Monat** (U1). Die historisch dokumentierten Prozentsätze mit Nenner 265 € (R2: World 32,07547 % usw.) sind daher **nur eine beispielhafte Darstellung bei ungefähr 15 € variablem Gold-Zufluss und keine festen Zielgewichte** (U1).

**Rücklagen- und Liquiditätsvorgänge (keine zusätzliche Sparleistung):**

| Name | Betrag | Einheit | Einordnung (U1) | Quelle | Status |
|------|--------|---------|-----------------|--------|--------|
| Dauerauftrag ING | 75 | EUR/Monat | **Rücklagenübertragung** (Umbuchung) für die jährliche Shares2you-Einzahlung; dieselben Gelder wie die spätere 1.000-€-Equatex-Einzahlung → **keine Doppelzählung** | U1 (auch R5/R6/R8) | eindeutig (löst Entscheidung 5) |
| Dauerauftrag Volkswagen Bank | 25 | EUR/Monat | Tagesgeld-Sparrate (siehe oben) | R5/R6/R8, U1 | eindeutig |
| Überweisung Restbetrag an TR-Ausgabenkonto | variabel | EUR/Monat | **Liquidität**, keine feste Sparquote, zählt **nicht** automatisch als Depotinvestment; erst eine tatsächliche Depotbuchung zählt als Investment | U1 | eindeutig |
| Historischer Dauerauftrag „50 € an TR“ | 50 | EUR/Monat | **veraltet** (U1) | R5/R6 | veraltet – ersetzt durch 60 € feste TR-Sparrate |

---

## 6. Eigene Einzahlungen (eigene Sparleistung, getrennt vom Gesamtzufluss)

| Name | Betrag | Einheit | Quelle | Gültigkeit | Status | Begründung |
|------|--------|---------|--------|------------|--------|------------|
| Telekom-Eigenbeitrag (Shares2you) | 1.000 | EUR/Jahr (real, 1× jährlich) | U1 (auch R1, R2, R7, R8) | solange bei Telekom | eindeutig | Setzt sich zusammen aus 12 × 75 € ING-Rücklage (= 900 €) + 100 € „Shares2you Sparergänzung“ (U1, löst K13) |
| „Shares2you Sparergänzung“ | 100 | EUR/Jahr (Abbuchung am 17.07.) | U1 (auch R5, R6) | solange bei Telekom | eindeutig | **Ergänzt die 900 € ING-Rücklage auf den jährlichen Eigenbeitrag von 1.000 €** (U1) – Teil des Eigenbeitrags, keine zusätzliche Zahlung darüber hinaus |
| VL-Eigenanteil | 33,50 | EUR/Monat | U1 (auch R8: 40 − 6,50) | laufend | eindeutig | Nur dieser Anteil zählt zur eigenen Sparleistung (löst K9) |
| Feste TR-Sparrate | 60 | EUR/Monat | U1 | laufend | eindeutig | 23 + 22 + 10 + 5 (löst K1) |
| Round-up (TR) | variabel | EUR/Monat | U1 | laufend | eindeutig als Kategorie | **Eigenes Geld** → eigene variable Sparleistung, nicht Anbieterleistung |
| Tagesgeld-Sparrate VW Bank | 25 | EUR/Monat | U1 (auch R2/R5/R6/R8) | laufend | eindeutig | – |
| Sparauftrag gesamt am 17. | **160 = 25 € VW-Tagesgeld + 75 € ING-Rücklage + 60 € TR-Depot-Sparrate** | EUR/Monat | **U2** (Gesamtsumme historisch auch R5/R6) | laufend | eindeutig | Per U2 bestätigt (löst K15). 75 € ING sind Rücklagenübertragung (**keine** Sparleistung); die historische Aufschlüsselung „50 € TR“ (R5/R6) ist veraltet |
| Gehalt (netto) | ~1.170 | EUR/Monat (am 16.) | U1 (auch R5/R6-Kopf) | aktuell | eindeutig | U1 bestätigt ~1.170 €; 1.160 € (R1, R5/R6-Rechnungen) veraltet (löst K6) |
| Halbwaisenrente | – | – | U1 | – | entschieden: **wird nicht in Finance OS erfasst** | Geht an die Mutter und wird für Ausgaben des Nutzers verwendet (U1); Betrag bleibt unbeziffert |
| Krypto (Bitget) | unbeziffert | EUR | R8 | – | zurückgestellt | Optional Teil des Anlagevermögens (U1, Abschnitt 13); Bestand und Aufnahme bewusst zurückgestellt |

---

## 7. Telekom-Mechanik (Eigenbeitrag und Mitarbeitervorteil getrennt, Pflicht C1/S1)

**Verbindlicher realer Ablauf (U1):** Der Nutzer spart monatlich 75 € auf dem ING-Konto an (12 × 75 = 900 €). Einmal jährlich kommen 100 € „Shares2you Sparergänzung“ hinzu (900 + 100 = 1.000 €). Der Nutzer investiert einmal jährlich real 1.000 € über Equatex; Telekom ergänzt 500 € Bonus. Gesamter jährlicher Vermögenszufluss: 1.500 €. Die ING-Rücklage und die Equatex-Einzahlung sind **dieselben Gelder** (keine Doppelzählung). Die App löst **keine** Bank- oder Brokertransaktion aus.

| Name | Betrag | Einheit | Zuflussart | Quelle | Status |
|------|--------|---------|------------|--------|--------|
| Telekom-Eigenbeitrag (real) | 1.000 | EUR/Jahr, 1× jährlich | eigene Sparleistung (tatsächlicher Cashflow) | U1 | eindeutig |
| Shares2you-Bonus (real) | 500 | EUR/Jahr, 1× jährlich | Arbeitgeberleistung (tatsächlicher Cashflow) | U1 (auch R1, R8, R9) | eindeutig |
| Gesamter Telekom-Zufluss (real) | 1.500 | EUR/Jahr | Gesamtzufluss | U1 (auch R1, R2, R8) | eindeutig |
| Geglätteter Eigenbeitrag | 83,33 | EUR/Monat | **geglätteter Analysewert** (UI optional „~84 €“) | U1 | eindeutig |
| Geglätteter Bonus | 41,67 | EUR/Monat | geglätteter Analysewert | U1 | eindeutig (83,33 + 41,67 = 125 ✓) |
| Geglätteter Gesamtzufluss | 125 | EUR/Monat | geglätteter Analysewert, **kein realer Cashflow** | U1 (auch R1, R2, R7) | eindeutig |
| VL-Zuschuss Telekom | 6,50 | EUR/Monat | Arbeitgeberleistung (real, monatlich) | U1 (auch R8) | eindeutig |
| Telekom Pensionsfonds | – | – | Arbeitgeberleistung außerhalb des Depots | R8 | **zurückgestellt** (Behandlung bewusst offen, U1) |

**Für das Datenmodell sind getrennte Konzepte zu definieren (U1):** (1) Rücklagenübertragung, (2) jährlicher Eigenbeitrag, (3) Arbeitgeberbonus, (4) geglätteter Analysewert, (5) tatsächlicher Cashflow. Formale Definitionen: `docs/calculation-rules.md`.

---

## 8. Studentenprofil (Profil „Student“, S2) – zwei getrennte Ebenen (U1)

### Ebene A – Tatsächlicher Studentensparplan (verbindlich, entschieden)

Feste bzw. geglättete Zuflüsse (Details und Zuflussarten: Abschnitt 5):

| Position | Betrag (EUR/Monat) | davon eigen | davon Arbeitgeber/Anbieter |
|----------|--------------------|-------------|----------------------------|
| VL MSCI World gesamt | 40 | 33,50 | 6,50 (Telekom-Zuschuss) |
| MSCI World ausschüttend (TR) | 22 | 22 | – |
| MSCI World thesaurierend (TR) | 23 | 23 | – |
| MSCI EM IMI (TR) | 10 | 10 | – |
| Gold-Sparplan (TR) | 5 | 5 | – |
| Telekom (geglättet) | 125 | 83,33 | 41,67 |
| Tagesgeld Volkswagen Bank | 25 | 25 | – |
| **Summe fest/geglättet** | **250** | 201,83 (berechnet) | 48,17 (berechnet) |
| Saveback → Gold | variabel | – | variabel (Anbieterleistung) |
| Round-up → Gold | variabel | variabel (eigen) | – |

Mit typischen variablen Gold-Zuflüssen von ca. 10–15 €/Monat: ungefährer Gesamtzufluss **ca. 260–265 €/Monat** (U1). Die historischen Prozentwerte mit Nenner 265 € sind nur eine beispielhafte Darstellung, keine festen Zielgewichte (U1).

### Ebene B – Strategische Studenten-Bestandszielallokation (offen, nutzereditierbar)

**Eine strategische Bestands-Zielallokation für die Studienphase ist noch nicht endgültig festgelegt (U1).** Sie ist als offene, vom Nutzer editierbare Entscheidung angelegt (bewusst zurückgestellt, Abschnitt 16).

Verbindliche Regeln dazu (U1):

- Die App unterstützt später **getrennt**: (1) tatsächlicher aktueller Sparplan (Ebene A), (2) strategische Zielallokation des Bestands (Ebene B).
- Telekom wird während des Studiums **nicht automatisch** als „nicht flexibel“ oder als Sonderausnahme fest verdrahtet, solange der Nutzer dies nicht ausdrücklich bestätigt (die S2-Regel „Telekom kann als nicht flexibel markiert werden“ bleibt eine **Kann**-Option des Nutzers).
- Das System **darf sachlich anzeigen**, dass Telekom gegenüber dem langfristigen Job-Profil (10 % Ziel) übergewichtet ist (Snapshot 2026-07-17: 54,27775 % vom Depot).
- Die historische Chat-Empfehlung einer Telekom-Obergrenze („nicht dauerhaft über 20–30 %“, R1) bleibt unbestätigt und ist **kein** verbindliches Ziel.

---

## 9. Emerging Markets

| Name | Wert | Einheit | Quelle | Gültigkeit | Status | Begründung |
|------|------|---------|--------|------------|--------|------------|
| Ist-Position: **iShares MSCI EM IMI** | 99,11 | EUR | R2, Produktidentität per U1 | Snapshot 2026-07-17 | eindeutig | U1: aktuelle Position **ist bereits der EM IMI**; keine Umstellung erforderlich (löst die frühere Produktfrage aus R3) |
| Ist-Anteil am Depot | 3,92909 | % | R2 | Snapshot 2026-07-17 | eindeutig | 99,11 / 2.522,47 ✓ |
| Sparrate während des Studiums | 10 | EUR/Monat | U1 (auch R2) | laufend | eindeutig | U1 bestätigt (löst K3; 15 € aus R1/R7 veraltet) |
| Ziel-Anteil (Job-Profil) | 15 | % vom Depot | R7, R8, R9 | ab Job-Profil-Aktivierung | eindeutig | Dreifach konsistent; ISIN IE00BKM4GZ66 |
| Verworfener Zielwert | 25 | % vom Depot | R9 (Entwürfe) | – | veraltet | Im Chatverlauf verworfen zugunsten 15 % |

---

## 10. Gold

| Name | Wert / Regel | Einheit | Quelle | Gültigkeit | Status | Begründung |
|------|--------------|---------|--------|------------|--------|------------|
| Ist-Position (iShares Physical Gold USD (Acc) ETC) | 33,92 | EUR | R2, bestätigt durch U1 | Snapshot 2026-07-17 | eindeutig | Rückgang von 72,05 € auf 33,92 € entstand durch **bewusstes Rebalancing** (U1, löst K5); kein Erfassungsfehler |
| Ist-Anteil am Depot | 1,34471 | % | R2 | Snapshot 2026-07-17 | eindeutig | 33,92 / 2.522,47 ✓ |
| Fester eigener Gold-Sparplan | **5** | EUR/Monat | **U1** | laufend | eindeutig | Löst K2; „20 € mit Saveback“ (R2) war ungefährer Gesamtzufluss, kein fester Eigenbeitrag |
| Variable Gold-Zuflüsse | Saveback (Anbieterleistung) + Round-up (eigene Sparleistung), zusammen typisch ca. 10–15 | EUR/Monat | U1 | laufend | eindeutig als Kategorie | Zwingend als getrennte Zuflussarten zu speichern (U1); keine garantierte Rate |
| Physisches Anlagegold | **existiert derzeit nicht** | – | U1 | Stand 2026-07-19 | eindeutig | – |
| Umwandlung ETC → physisches Gold | als Ziel oder Erinnerung modellierbar, **niemals automatisch ausführen** | – | U1 (Absicht auch R7/R8/R9: „alle 1–3k“) | – | entschieden (Modellierung) / zurückgestellt (konkrete Schwelle) | Konkrete Umwandlungsschwelle bewusst offen (Abschnitt 16) |
| Ziel-Anteil (Job-Profil) | 5 | % vom Depot | R7, R8, R9 | ab Job-Profil-Aktivierung | eindeutig | ISIN IE00B4ND3602 |

---

## 11. Job-Zielaufteilung (Profil „Job“, S2)

Maßgebliche Quellen: **R7 = R8 = R9-„Endstand“** (dreifach bestätigt). **Aktivierung (U1): erst ab einem vom Nutzer ausdrücklich bestätigten Zeitpunkt nach dem Studienende (30.09.2027) – niemals automatisch.** Der genaue Zeitpunkt ist bewusst zurückgestellt.

**Ebene 1 – Sparquoten-Split (Gesamtvermögensebene):**

| Name | Wert | Einheit | Quelle | Prüfung |
|------|------|---------|--------|---------|
| Depot-Anteil der Sparquote | 85 | % der Sparquote | R7/R8/R9 | – |
| Tagesgeld-Anteil der Sparquote | 15 | % der Sparquote | R7/R8/R9 | 85 + 15 = 100 ✓ (Pflichtprüfung S2) |
| Beispiel-Sparquote | 988 | EUR/Monat | R7/R8 | 839,80 (Depot) + 148,20 (Tagesgeld) = 988,00 ✓ |

**Ebene 2 – Depot-Zielaufteilung (Nenner = Depot-Sparbetrag). Die Prozentwerte sind normativ (U1); Euro-Beträge werden daraus jeweils neu berechnet und sinnvoll gerundet, Rundungsdifferenzen sichtbar ausgewiesen:**

| Position | Ziel-Anteil (normativ) | Historischer Beispielbetrag (bei 988 € Sparquote) | ISIN | Status |
|----------|------------------------|---------------------------------------------------|------|--------|
| MSCI World gesamt | 70,0 % | 587,86 € | – | eindeutig |
| – VL iShares Core MSCI World | 4,8 % | 40,00 € | IE00B4L5Y983 | eindeutig (VL-Betrag vertraglich fix 40 €) |
| – Xtrackers MSCI World ausschüttend | 31,0 % | 260,04 € | IE00BK1PV551 | eindeutig (Prozentwert normativ) |
| – SPDR MSCI World thesaurierend | 34,2 % | 287,82 € | IE00BFY0GT14 | eindeutig (Prozentwert normativ) |
| iShares MSCI EM IMI (mit Small Caps) | 15,0 % | 125,97 € | IE00BKM4GZ66 | eindeutig |
| iShares Physical Gold USD (Acc) ETC | 5,0 % | 41,99 € | IE00B4ND3602 | eindeutig |
| Deutsche Telekom | 10,0 % | 83,98 € | – | eindeutig |
| **Summe** | **100,0 %** | 839,80 € | – | Pflichtprüfungen S2: 4,8 + 31 + 34,2 = 70 ✓; 70 + 15 + 5 + 10 = 100 ✓ |

**Auflösung der historischen Betrags-Inkonsistenz (entschieden, U1):** Die dokumentierten Beispielbeträge weichen von den Prozentwerten ab (31 % von 839,80 € = 260,34 € statt 260,04 €; 34,2 % = 287,21 € statt 287,82 €; 4,8 % = 40,31 € statt fix 40,00 €). **Verbindlich gilt: Die Prozentwerte sind normativ; Finance OS berechnet Euro-Beträge daraus selbst und weist Rundungsdifferenzen sichtbar aus.** Die historischen Beispielbeträge sind nur Illustration (löst Entscheidung 23).

**Ergänzende Zielregeln (R7/R8, unter U1-Vorbehalt der Nicht-Automatisierung):** 15 %-Tagesgeld-Topf für Notgroschen/Autozahlungen; jährliches Rebalancing (Regeln: Abschnitt 12, K12); Umwandlung in physisches Gold nur als Ziel/Erinnerung (Abschnitt 10).

**Zielgewichtung innerhalb Trade Republic (ohne VL; TR-Anteil am Depot = 31 + 34,2 + 15 + 5 = 85,2 %):** Die historischen R7/R8-Werte (ausschüttend 36,33 %, thesaurierend 40,21 %, EM IMI 17,6 %, Gold 5,87 %; Summe 100,01 %) sind aus den nur illustrativen Beispielbeträgen abgeleitet und gelten als **historisch/illustrativ**. Normativ aus den verbindlichen Prozentwerten berechnet (U1, Entscheidung 23): ausschüttend 31/85,2 = **36,38 %**, thesaurierend 34,2/85,2 = **40,14 %**, EM IMI 15/85,2 = **17,61 %**, Gold 5/85,2 = **5,87 %** (gerundet auf 2 Nachkommastellen; Summe 100,00 %).

**Profil „Eigene Aufteilung“ (S2): entschieden (U1)** – wird als **leeres, frei editierbares Profil** angelegt.

---

## 12. Konfliktregister (historische Widersprüche mit verbindlicher Auflösung)

Kein historischer Konflikt wurde entfernt. Jeder Eintrag enthält: historischen Konflikt, verbindliche Auflösung, verwendeten aktuellen Wert, Begründung und Quelle der Auflösung.

### K1 – Trade-Republic-Sparbetrag pro Monat: 50 vs. 60 vs. 75 €

- **Historischer Konflikt:** 50 €/Monat (R5/R6, „Sparen 160 €“); 60 €/Monat (R8, R1-Einleitung); 75 €/Monat (Summe der TR-Einzelraten in R2: 23 + 22 + 10 + 20 „mit saveback“).
- **Verbindliche Auflösung:** 60 € sind die feste eigene monatliche Depot-Sparrate bei TR (23 + 22 + 10 + 5). Zusätzliche variable Beträge stammen aus Saveback (Anbieterleistung) und Round-up (eigene Sparleistung). Sonstige Überweisungen auf das TR-Ausgabenkonto sind Liquidität und keine automatische Depotanlage. Die alte Angabe von 50 € ist veraltet.
- **Verwendeter aktueller Wert:** 60 €/Monat fest eigen; variable Zuflüsse getrennt.
- **Begründung:** Direkte Klärung des realen Ablaufs durch den Nutzer; die 75 € aus R2 vermischten festen Eigenbeitrag und variablen Saveback.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K2 – Gold-Sparrate: 10 vs. 25 vs. 20 €

- **Historischer Konflikt:** 10 € (R1-Einleitung); 25 € (R1/R7-Aufstellungen); 20 € „mit saveback“ (R2).
- **Verbindliche Auflösung:** Fester eigener Gold-Sparplan = **5 €/Monat**. Saveback und Round-up fließen zusätzlich variabel in Gold (zusammen typisch ca. 10–15 €/Monat, nicht garantiert). „20 € mit Saveback“ war ein ungefährer Gesamtzufluss, kein fester Eigenbeitrag.
- **Verwendeter aktueller Wert:** 5 €/Monat fest eigen + variable Zuflüsse (getrennt nach Saveback/Round-up).
- **Begründung:** Nutzer hat die tatsächliche Sparplanstruktur offengelegt; alle historischen Angaben vermischten Zuflussarten.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K3 – EM-Sparrate: 15 vs. 10 €

- **Historischer Konflikt:** 15 €/Monat (R1/R7) vs. 10 €/Monat (R2).
- **Verbindliche Auflösung:** 10 €/Monat während des Studiums.
- **Verwendeter aktueller Wert:** 10 €/Monat.
- **Begründung:** U1 bestätigt die R2-Angabe ausdrücklich.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K4 – World-TR-Sparrate: 35 € (eine Position) vs. 23 + 22 € (zwei Positionen)

- **Historischer Konflikt:** R1/R7: eine TR-World-Position, 35 €/Monat; R2: zwei TR-World-Positionen (23 € thesaurierend + 22 € ausschüttend).
- **Verbindliche Auflösung:** R2-Struktur gilt; U1 bestätigt 23 € und 22 € als aktuelle feste Sparpläne.
- **Verwendeter aktueller Wert:** 23 € SPDR thesaurierend + 22 € Xtrackers ausschüttend.
- **Begründung:** Snapshot-B-Struktur, durch U1 bestätigt.
- **Quelle der Auflösung:** U1, 2026-07-19 (zuvor bereits Aktualitätslogik). Status: **historischer Konflikt – verbindlich aufgelöst**.

### K5 – Gold-Positionswert gesunken trotz Sparrate: 72,05 → 33,92 €

- **Historischer Konflikt:** Rückgang um 38,13 € zwischen Snapshot A und B trotz laufender Besparung; Ursache in keiner Referenzdatei dokumentiert.
- **Verbindliche Auflösung:** Der Rückgang entstand durch ein **bewusstes Rebalancing**. Es existiert derzeit **kein physisches Anlagegold**.
- **Verwendeter aktueller Wert:** 33,92 € (Snapshot 2026-07-17, korrekt).
- **Begründung:** Direkte Nutzerklärung des Vorgangs.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K6 – Netto-Gehalt: ~1.170 vs. 1.160 €

- **Historischer Konflikt:** ~1.170 € (R5/R6-Kopf) vs. 1.160 € (R1, R5-Anfangsgeld-Rechnung, R6-Anfangsgeld-Rechnung „1160 € + 92 € − 513 + 36 € = 775,00 €“ – die Beträge 92 / 513 / 36 € dort weiterhin unerklärt, historisch).
- **Verbindliche Auflösung:** Aktuelles monatliches Netto ≈ **1.170 €**.
- **Verwendeter aktueller Wert:** ~1.170 €/Monat (Basis u. a. für Notgroschen-Standardziel 4 × 1.170 = 4.680 €).
- **Begründung:** U1 nennt ~1.170 € als aktuellen Wert; 1.160 € gilt als veraltet.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K7 – Monatliche Fixkosten: 492 € pauschal vs. 412,66–527,72 € variabel vs. 672 € in der Rechnung

- **Historischer Konflikt:** R5 pauschal 492 €; R6 monatsgenau 412,66–527,72 €; R5-Rechnung nutzt 672 € ohne Herleitung.
- **Verbindliche Auflösung:** Fixkosten werden anhand der **einzelnen Verträge und ihrer echten Fälligkeiten** modelliert. Zusätzlich wird eine **geglättete monatliche Fixkosten-Pauschale berechnet** (Planungswert für Rücklagenbildung, zählt nicht zusätzlich zu den echten Zahlungen als Ausgabe). Die historische Pauschale von 492 € darf aus den erfassten Verträgen automatisch neu berechnet werden. Der Wert 672 € bleibt als **veraltet/ungeklärt** markiert und darf nicht als aktuelle Fixkostensumme verwendet werden.
- **Verwendeter aktueller Wert:** berechnete Pauschale aus Vertragsdaten (Formel: `docs/calculation-rules.md`); bis zur Neuberechnung dient 492 € nur als historischer Anhaltswert.
- **Begründung:** U1 legt das Fixkosten-Modell fest.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst** (672 € bleibt dauerhaft als ungeklärt markiert).

### K8 – Miete: 250 €/Monat „AUF EIS“

- **Historischer Konflikt:** Unklar, ob die Zahlung an die Mutter läuft.
- **Verbindliche Auflösung:** Die Mietzahlung von 250 € ist **derzeit pausiert**.
- **Verwendeter aktueller Wert:** 0 €/Monat (pausiert); Vertrag/Position bleibt als pausiert erfasst.
- **Begründung:** Direkte Nutzerbestätigung.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K9 – VL als „eigene“ Sparleistung: 40 € vs. 33,50 € eigen + 6,50 € Telekom

- **Historischer Konflikt:** R1 behandelt die vollen 40 € als eigene Rate; R8 schlüsselt den Arbeitgeberanteil auf.
- **Verbindliche Auflösung:** 33,50 € Eigenanteil + 6,50 € Arbeitgeberzuschuss. Eigene Sparleistung: nur 33,50 €. Gesamtvermögenszufluss: 40 €.
- **Verwendeter aktueller Wert:** 33,50 € / 6,50 € getrennt.
- **Begründung:** U1 bestätigt die R8-Aufschlüsselung als verbindlich.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K10 – Verworfene Ziel-Entwürfe (R9)

- **Historischer Konflikt:** Entwurf 1 (30 % World / 30 % Amundi Global / 25 % Amundi EM / 5 % Gold / 10 % Telekom) und Entwurf 2 (70 % World mit 15/30/25-Unterteilung, 15 % EM, 5 % Gold, 10 % Telekom).
- **Verbindliche Auflösung:** Nur der R9-„Endstand“ (= Abschnitt 11) gilt; beide Entwürfe sind verworfen.
- **Verwendeter aktueller Wert:** Job-Profil aus Abschnitt 11.
- **Begründung:** Chatverlauf endet nachvollziehbar beim Endstand; keine Nutzerentscheidung nötig.
- **Quelle der Auflösung:** Aktualitätslogik (bereits Version 1); konsistent mit U1. Status: **historisch – veraltet**.

### K11 – Tagesgeldwert in beiden Snapshots identisch (627,59 €)

- **Historischer Konflikt:** Verdacht, der Wert sei in R2 ungeprüft übernommen und veraltet.
- **Verbindliche Auflösung:** Der Wert **627,59 € ist korrekt und nicht veraltet**; er liegt vollständig auf dem Volkswagen-Bank-Tagesgeldkonto.
- **Verwendeter aktueller Wert:** 627,59 € (Snapshot 2026-07-17, Konto: Volkswagen Bank).
- **Begründung:** Direkte Nutzerbestätigung; der frühere Verdacht war unbegründet.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K12 – Rebalancing-Frequenz/-Schwelle

- **Historischer Konflikt:** „einmal pro jahr aber nur bei 5 % abweichung“ (R10); „jedes jahr und 3 jahre nach start invest“ (R10); „jedes jahr wenn rendite kommen aufs konto“ (R7/R8); unklar, ob 5 % absolut oder relativ.
- **Verbindliche Auflösung (U1):** Das System zeigt Abweichungen jederzeit an. Formale Rebalancing-Prüfung mindestens einmal jährlich. Handlungsempfehlung ab einer Abweichung von **5 Prozentpunkten (absolut)**. Verkäufe werden erst ab mindestens **10 Prozentpunkten** Abweichung als mögliche Option erwähnt. Vor Verkäufen werden immer zuerst Sparratenanpassungen, zusätzliche Einzahlungen und Ausschüttungen geprüft. Die Prozentwerte eines Zielprofils sind normativ; Euro-Beträge werden daraus berechnet und sinnvoll gerundet; Rundungsdifferenzen sichtbar ausweisen.
- **Verwendeter aktueller Wert:** Schwellen 5 Pp (Empfehlung) / 10 Pp (Verkaufsoption), absolut; Prüfung mind. jährlich.
- **Begründung:** U1 legt das vollständige Regelwerk fest; die historische Zusatzregel „3 Jahre nach Start“ (R10) wurde nicht in die verbindlichen Regeln übernommen und bleibt nur historische Notiz.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K13 – „Telekom Shares2you sparergänzung“ 100 €/Jahr

- **Historischer Konflikt:** Verhältnis der 100 € zur 1.000-€-Einzahlung unerklärt; der vermutete Zusammenhang (900 + 100 = 1.000) war unbelegt.
- **Verbindliche Auflösung:** Die 100 € **ergänzen die 12 × 75 € = 900 € ING-Rücklage auf den jährlichen Eigenbeitrag von 1.000 €**. Der vermutete Zusammenhang ist bestätigt.
- **Verwendeter aktueller Wert:** 100 €/Jahr als Bestandteil des 1.000-€-Eigenbeitrags (keine zusätzliche Zahlung darüber hinaus).
- **Begründung:** Direkte Nutzerbestätigung des realen Ablaufs.
- **Quelle der Auflösung:** U1, 2026-07-19. Status: **historischer Konflikt – verbindlich aufgelöst**.

### K14 – PDF-Quelle nicht ausgewertet

- **Historischer Konflikt/Lücke:** R11 (94 MB) konnte nicht gerendert werden; mutmaßlich Export von R10 inkl. Bilder (u. a. fotografierte Rebalancing-Formeln).
- **Verbindliche Auflösung:** Die PDF- und HEIC-Quellen werden **für Version 1 nicht weiter ausgewertet**. R11 bleibt als nicht ausgewertete historische Quelle dokumentiert; die verbindlichen Rebalancing-Regeln stammen aus U1 (K12).
- **Verwendeter aktueller Wert:** – (keine Auswertung in Version 1).
- **Begründung:** Nutzerentscheidung; praktische Relevanz seit den U1-Rebalancing-Regeln gering.
- **Quelle der Auflösung:** U2, 2026-07-19. Status: **entschieden für Version 1** (die historische Auswertungslücke bleibt dokumentiert).

### K15 – Sparauftrag „160 €“ vs. Summe der Teile (150 €) – neu erkannt in der Abschlussprüfung

- **Historischer Konflikt:** R5 und R6 nennen „Sparen – Ibrahim Swaid: 160,00 €“ mit der Aufschlüsselung 25 € VW + 75 € ING + 50 € TR – deren Summe ist jedoch **150 €**, nicht 160 €.
- **Verbindliche Auflösung:** Der monatliche Sparauftrag beträgt insgesamt **160 €** und besteht aus **25 € Volkswagen-Bank-Tagesgeld + 75 € ING-Rücklage für Shares2you + 60 € Trade-Republic-Depot-Sparrate** (25 + 75 + 60 = 160 ✓). Die frühere Angabe „50 € TR“ ist veraltet; die in der Abschlussprüfung formulierte Hypothese ist damit bestätigt.
- **Verwendeter aktueller Wert:** 160 €/Monat gesamt (25 / 75 / 60).
- **Begründung:** Direkte Nutzerbestätigung.
- **Quelle der Auflösung:** U2, 2026-07-19 (Konflikt erkannt durch Abschlussprüfung finance-analyst). Status: **historischer Konflikt – verbindlich aufgelöst**.

### K16 – Rechenfehler in R2: SPDR-Depotanteil 9,14339 % statt 9,41339 % – neu erkannt in der Abschlussprüfung

- **Historischer Konflikt:** R2 („Msci Prozente von gesamtdepot“) nennt für den SPDR World 9,14339 %; korrekt sind 237,45 / 2.522,47 = **9,41339 %** (Zahlendreher 14↔41). Beleg: Nur mit 9,41339 % ergeben die drei World-Unteranteile die 40,44845 % World gesamt.
- **Verbindliche Auflösung:** Neu berechneter Wert 9,41339 % gilt (Abschnitt 3 korrigiert). Grundsatz: R2-Prozentwerte sind abgeleitete Werte und werden nachgerechnet statt übernommen; die R2-Euro-Beträge sind konsistent und bleiben maßgeblich.
- **Verwendeter aktueller Wert:** 9,41339 %.
- **Begründung:** Rechnerischer Nachweis; kein Nutzereingriff erforderlich.
- **Quelle der Auflösung:** Abschlussprüfung finance-analyst, 2026-07-19. Status: **aufgelöst (rechnerisch)**.

---

## 13. Kontenabgrenzung und Vermögenskennzahlen (verbindlich, U1)

**Kontenzwecke:**

| Konto | Zweck (verbindlich) |
|-------|---------------------|
| Volkswagen Bank Tagesgeld | Trägt das gesamte Tagesgeld (Snapshot: 627,59 €); Notgroschen-Konto; 25 €/Monat Sparrate |
| ING | **Ausschließlich Rücklagenkonto** für die jährliche Shares2you-Einzahlung (75 €/Monat Rücklagenübertragung) |
| Trade Republic | **Depot und Ausgabenkonto.** TR-Cash und TR-Depotpositionen werden **getrennt modelliert**; Geld auf dem Ausgabenkonto ist **nicht automatisch Depotvermögen** – erst eine tatsächliche Depotbuchung zählt als Investment |
| Sparkasse (Giro) | Gehaltseingang, Abos/Fixkosten (R8; von U1 unberührt) |
| FNZ Bank | VL-Depot (40 €/Monat: 33,50 eigen + 6,50 Telekom) |
| Equatex | Telekom-Aktien (jährliche Shares2you-Einzahlung) |
| Bitget (Krypto) | Optional Teil des Anlagevermögens; Bestand/Aufnahme zurückgestellt |
| Telekom Pensionsfonds | Behandlung zurückgestellt |

**Vermögenskennzahlen – die Darstellung muss mindestens diese drei Kennzahlen getrennt ermöglichen (U1):**

1. **Finanzvermögen** – Girokonten gehören zum Finanzvermögen.
2. **Anlagevermögen** – umfasst: Depot, Tagesgeld, Anlagegold, optional Kryptowährungen. **Auto und Alltagsgegenstände zählen nicht als Anlagevermögen.**
3. **Frei verfügbare Liquidität**.

Formale Definitionen und Formeln: `docs/calculation-rules.md`. Hinweis für den data-architect: Die S1-Kennzahl „Gesamtvermögen = Tagesgeld + Depot“ bleibt bestehen; ihr Verhältnis zur umfassenderen U1-Begriffshierarchie (Finanzvermögen/Anlagevermögen) ist im Datenmodell sauber zu benennen.

---

## 14. Finanzielle Ziele (verbindlich angelegt per U1; Beträge/Termine teils offen)

| Ziel | Betrag | Termin | Status |
|------|--------|--------|--------|
| Notgroschen | Standard 4.680 € (4 × 1.170 €; konfigurierbar 3–5 Nettogehälter, manuell überschreibbar) | offen | entschieden (Regel), Zielbetrag berechnet |
| 10.000 € Depot | 10.000 € | offen (nutzerdefinierbar) | angelegt |
| 50.000 € Gesamtvermögen | 50.000 € | offen (nutzerdefinierbar) | angelegt |
| Physisches Gold | Betrag/Schwelle offen | offen | angelegt; Umwandlung nur als Ziel/Erinnerung, nie automatisch |
| Auto-Rücklage | offen (nutzerdefinierbar) | offen | angelegt; bewusst zurückgestellt |
| Urlaub | offen (nutzerdefinierbar) | offen | angelegt; bewusst zurückgestellt |
| Berufseinstieg | – | nach Studienende 30.09.2027; genauer Zeitpunkt offen | angelegt |
| Monatlich 1.000 € Sparrate | 1.000 €/Monat | offen (nutzerdefinierbar) | angelegt |

Fehlende Beträge und Termine sind bewusst als offen/nutzerdefinierbar gekennzeichnet – **keine Werte erfunden**. Die leere Referenz-Zieldatei (R4) bleibt unverändert; diese Tabelle ist die maßgebliche Dokumentation.

---

## 15. Striktes Verbot automatischer Änderungen (verbindlich, U1)

**Finance OS ist ausschließlich ein Analyse-, Planungs- und Dokumentationssystem.**

Die Anwendung darf **niemals automatisch**:

- einen realen Sparplan ändern
- eine Bank- oder Brokertransaktion auslösen
- eine Position kaufen oder verkaufen
- Geld zwischen Konten verschieben
- ein Zielprofil aktivieren
- eine Sparrate umleiten
- eine Empfehlung als bestätigte Nutzereinstellung speichern
- einen Notgroschen nach Zielerreichung automatisch umwidmen
- bestehende Finanzdaten aufgrund einer Empfehlung überschreiben

Die App darf **ausschließlich**: berechnen, vergleichen, visualisieren, Empfehlungen anzeigen, Szenarien simulieren und geplante Änderungen als unverbindlichen Entwurf darstellen.

Eine Empfehlung darf nur nach einer **ausdrücklichen Bestätigung** als geplante Einstellung innerhalb von Finance OS übernommen werden. Auch danach erfolgt **keine** Änderung bei Banken, Brokern oder externen Diensten. Es gibt in Version 1 **keine** Bank-, Broker- oder Handels-API (konform C1).

---

## 16. Entscheidungsregister (Stand nach Entscheidungsrunde 1)

**Prüfvermerke:**
- Version 1 (2026-07-19): finance-analyst prüfte die Source Map stichprobenartig gegen R1–R10; Werte korrekt, vier Anmerkungen eingearbeitet.
- Version 2 (2026-07-19): Entscheidungsrunde 1 (U1) eingearbeitet; Abschlussprüfung durch finance-analyst siehe progress.md.
- Version 3 (2026-07-19): Entscheidungsrunde 2 (U2) eingearbeitet – Entscheidungen 18-Rest, 24 und 25 geschlossen; keine offenen Entscheidungen mehr.

Die Nummerierung 1–24 entspricht der ursprünglichen Entscheidungsliste (Version 1); Entscheidung 25 kam in der Abschlussprüfung hinzu. Die Nummerierung bleibt zur Nachverfolgbarkeit erhalten.

### 16.1 Gelöste Entscheidungen

Alle: **entschieden**, Datum der Entscheidung: **2026-07-19**, Quelle: **direkte Nutzerbestätigung** (U1 = Entscheidungsrunde 1; U2 = Entscheidungsrunde 2, bei den betreffenden Zeilen vermerkt).

| Nr. | Titel | Entscheidung |
|-----|-------|--------------|
| 1 (teilweise) | Stichtage und Gültigkeitszeiträume | Referenz-Snapshot = 17.07.2026; Studienende = 30.09.2027. (Job-Profil-Aktivierungszeitpunkt → zurückgestellt, 16.3) |
| 2 | Eröffnungsbestand | Snapshot-Werte werden als historischer Snapshot gespeichert und nie überschrieben; beim Start können zusätzlich frische Werte eingegeben werden |
| 3 | Eigene Sparleistung vs. Gesamtzufluss | Zwei getrennte Kennzahlen; Round-up ist **eigenes Geld** (eigene Sparleistung); Saveback, Shares2you-Bonus, VL-Zuschuss, Zinsen und sonstige echte Arbeitgeber-/Anbieterleistungen zählen nur zum Gesamtzufluss |
| 4 | Telekom-Jahreseinzahlung | Realer Jahres-Cashflow (1.000 € eigen + 500 € Bonus); 125 €/83,33 €/41,67 € sind nur geglättete Analysewerte |
| 5 | ING-Ansparung | 75 €/Monat = Rücklagenübertragung für die Equatex-Einzahlung; dieselben Gelder, keine Doppelzählung; Differenz von 100 € wird durch die Shares2you-Sparergänzung gedeckt |
| 6 | Saveback/Round-up | Getrennte Zuflussarten (Anbieterleistung vs. eigene Sparleistung), niemals als dieselbe Zuflussart speichern; Gold-Eigenrate = 5 €/Monat fest |
| 7 | TR-Cashflow (K1) | 60 € feste eigene TR-Sparrate (23+22+10+5); 50 € veraltet; variable Zuflüsse getrennt; TR-Ausgabenkonto = Liquidität |
| 8 | Tagesgeld (K11) | 627,59 € korrekt, vollständig Volkswagen Bank |
| 9 (teilweise) | Studentenprofil | Ebene A (tatsächlicher Sparplan) verbindlich definiert (Summe fest/geglättet 250 €/Monat); Telekom wird nicht automatisch fest verdrahtet; Übergewichtung darf sachlich angezeigt werden. (Ebene B → zurückgestellt, 16.3) |
| 10 | Gold-Rückgang (K5) | Bewusstes Rebalancing; kein physisches Anlagegold vorhanden |
| 11 | Notgroschen | 3–5 Nettogehälter konfigurierbar, Standard 4 (= 4.680 € bei 1.170 €); automatische Neuberechnung möglich, manuell überschreibbar; nach Zielerreichung nur Vorschläge, nie automatische Ratenänderung |
| 12 (teilweise) | Sparziele | Zielliste verbindlich angelegt (Abschnitt 14). (Beträge/Termine für Auto und Urlaub → zurückgestellt, 16.3) |
| 13 | Netto-Gehalt (K6) | ~1.170 €/Monat |
| 14 | Fixkosten-Modell (K7) | Einzelverträge mit echten Fälligkeiten + berechnete geglättete Pauschale (Planungswert, keine Doppelzählung); 492 € neu berechenbar; 672 € bleibt veraltet/ungeklärt |
| 15 | Miete (K8) | 250 €/Monat derzeit pausiert |
| 16 | Rebalancing-Regeln (K12) | Anzeige jederzeit; Prüfung mind. jährlich; Empfehlung ab 5 Pp (absolut); Verkaufsoption erst ab 10 Pp; vor Verkäufen zuerst Sparraten/Einzahlungen/Ausschüttungen; Profilprozente normativ; Rundungsdifferenzen sichtbar |
| 17 | Shares2you-Sparergänzung (K13) | 100 €/Jahr ergänzen die 900 € ING-Rücklage auf 1.000 € Eigenbeitrag |
| 18 | EM-Produktidentität und World-ISINs | Ist-Position ist bereits der iShares MSCI EM IMI; keine Umstellung nötig; Sparrate 10 € (U1). World-ISINs bestätigt (U2): iShares Core MSCI World VL IE00B4L5Y983, SPDR MSCI World Acc IE00BFY0GT14, Xtrackers MSCI World Dist IE00BK1PV551 |
| 19 (teilweise) | Halbwaisenrente | Wird nicht in Finance OS erfasst (geht an die Mutter). (Pensionsfonds, Krypto → zurückgestellt, 16.3) |
| 20 | Profil „Eigene Aufteilung“ | Wird leer und frei editierbar angelegt |
| 21 | EM-Sparrate (K3) | 10 €/Monat bestätigt |
| 22 (teilweise) | Physisches Gold | Umwandlung als Ziel/Erinnerung modellierbar, niemals automatisch; derzeit kein physisches Gold. (Konkrete Schwelle → zurückgestellt, 16.3) |
| 23 | Rundungsregeln Job-Profil | Prozentwerte normativ; Beträge werden berechnet und sinnvoll gerundet; Differenzen sichtbar |
| 24 | PDF-/Bildquellen (K14) | Werden für Version 1 nicht weiter ausgewertet (U2); R11 bleibt als nicht ausgewertete historische Quelle dokumentiert |
| 25 | Dauerauftrag-Gesamtsumme (K15) | Monatlicher Sparauftrag insgesamt 160 € = 25 € VW-Tagesgeld + 75 € ING-Rücklage + 60 € TR-Depot-Sparrate; „50 € TR“ veraltet (U2) |

### 16.2 Noch offene Entscheidungen

**Keine.** Alle zuvor offenen Entscheidungen (18-Rest, 24, 25) wurden in Entscheidungsrunde 2 (U2, 2026-07-19) gelöst. Die bewusst zurückgestellten Themen stehen in 16.3.

### 16.3 Bewusst für später zurückgestellte Entscheidungen (U1)

| Thema | Zusammenhang | Hinweis |
|-------|--------------|---------|
| Endgültige strategische Studenten-Bestandszielallokation (Ebene B) | Entscheidung 9, Abschnitt 8 | Als offene, vom Nutzer editierbare Entscheidung angelegt |
| Konkrete Beträge und Termine für Auto-Rücklage und Urlaub | Entscheidung 12, Abschnitt 14 | Nutzerdefinierbar |
| Behandlung des Telekom-Pensionsfonds | Entscheidung 19, Abschnitt 7 | Kein Wert dokumentiert |
| Genauer Krypto-Bestand und dessen Aufnahme | Entscheidung 19, Abschnitt 13 | Optional Teil des Anlagevermögens |
| Exakter Zeitpunkt der Job-Profil-Aktivierung | Entscheidung 1, Abschnitt 11 | Nach 30.09.2027, nur per ausdrücklicher Nutzerbestätigung, nie automatisch |
| Konkrete Schwelle für Umwandlung ETC-Gold → physisches Gold | Entscheidung 22, Abschnitt 10 | Historische Absicht „alle 1.000–3.000 €“ bleibt unverbindlich |

---

## 17. Personen- und Rahmendaten (Kontext)

| Name | Wert | Quelle | Status | Anmerkung |
|------|------|--------|--------|-----------|
| Alter | 21 Jahre | R1 | wahrscheinlich | Chat ohne Datum; kann inzwischen abweichen |
| Beschäftigung | Dualer Student bei Deutsche Telekom | R1, R8 | eindeutig | Mehrfach belegt |
| Netto-Einkommen | ~1.170 €/Monat | **U1** (auch R5/R6) | eindeutig | Löst K6; 1.160 € veraltet |
| Studienende | 30.09.2027 | **U1** | eindeutig | Danach Job-Profil nur per ausdrücklicher Bestätigung |
| Erwartetes Netto nach Studium | ~3.000 €/Monat | R7, R8, R9 | eindeutig (als Planannahme) | Grundlage des Job-Profils |
| Erwarteter Beruf nach Studium | Softwareentwickler | R9 (Chat-Erwähnung) | wahrscheinlich | Ohne Rechenrelevanz |
| Kontenstruktur | Sparkasse (Giro), ING (Shares2you-Rücklage), FNZ (VL-Depot), Volkswagen Bank (Tagesgeld), Trade Republic (Depot + Ausgabenkonto, getrennt), Equatex (Telekom-Aktien), Bitget (Krypto), Telekom Pensionsfonds | R8, präzisiert durch U1 | eindeutig | Kontenzwecke: Abschnitt 13 |
| Währung | EUR (alle Beträge) | alle | eindeutig | Im Datenmodell zentral festlegen (S1) |
