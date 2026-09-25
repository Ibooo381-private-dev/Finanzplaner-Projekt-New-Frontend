# Berechnungsregeln (calculation-rules)

**Version 2** – Stand: 2026-07-19. Formelkatalog (Abschnitt 12) erstellt unter Anwendung der Skills `finance-rules` (S1) und `rebalancing` (S2) sowie mit numerischer Gegenprüfung durch den Subagenten `finance-analyst`.
Quellen: direkte Nutzerbestätigungen vom 2026-07-19 (**U1/U2**, ranghöchste Quellen), Skill `quality-check` (S3), `docs/investment-source-map.md` (Version 3), `docs/data-model.md` (Schema, Feldnamen), `docs/requirements.md` (M1–M14, G1–G12).

**Aufbau:** Die Abschnitte 0–10 definieren Grundprinzip, Zuflussarten, Kennzahlen und die Testbeispiele T1–T9 (werden aus requirements.md und data-model.md referenziert – Nummerierung stabil). **Abschnitt 12 ist der vollständige Formelkatalog F1–F22** mit Eingaben, Formel, Ausgabe, Randfällen und erwartetem Testergebnis je Formel.

Alle Beträge in EUR. Interne Speicherung gemäß S1: Geldbeträge als Zahlen (nicht als formatierte Texte), Prozentwerte als Dezimalzahlen (0,15 = 15 %), Datumswerte als ISO-Datum `YYYY-MM-DD`, Währung zentral festgelegt (EUR).

---

## 0. Grundprinzip: Striktes Verbot automatischer Änderungen (verbindlich, U1)

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

Eine Empfehlung darf nur nach **ausdrücklicher Bestätigung** als geplante Einstellung innerhalb von Finance OS übernommen werden. Auch danach erfolgt keine Änderung bei Banken, Brokern oder externen Diensten. In Version 1 gibt es keine Bank-, Broker- oder Handels-API.

**Jede Formel in diesem Dokument ist eine reine Berechnungs- und Anzeigeregel.** Kein Ergebnis einer Formel löst eine Aktion aus.

---

## 1. Zuflussarten (Taxonomie)

Jede Geldbewegung erhält genau **eine** Zuflussart. Doppelzählungen sind verboten (C1/S1).

| Zuflussart | Definition | Beispiele (verbindlich zugeordnet per U1) |
|------------|------------|-------------------------------------------|
| **Eigene feste Sparleistung** | Regelmäßiges eigenes Geld mit festem Betrag | VL-Eigenanteil 33,50 €; feste TR-Sparrate 60 €; Tagesgeld-Rate 25 €; jährlicher Telekom-Eigenbeitrag 1.000 € |
| **Eigene variable Sparleistung** | Eigenes Geld ohne festen Betrag | **Round-up** (eigenes aufgerundetes Geld); unregelmäßige eigene Zusatzkäufe (zählen erst bei tatsächlicher Depotbuchung) |
| **Arbeitgeberleistung** | Echtes Geld vom Arbeitgeber | Shares2you-Bonus 500 €/Jahr; VL-Zuschuss 6,50 €/Monat |
| **Anbieterleistung** | Echtes Geld von Bank/Broker/Anbieter | **Saveback** (1 %-Gutschrift von Trade Republic); Zinsen |
| **Rücklagenübertragung** | Umbuchung eigenen Geldes zwischen eigenen Konten zur Zweckbindung | 75 €/Monat auf das ING-Konto (Shares2you-Rücklage) |
| **Liquiditätsübertragung** | Umbuchung ohne Anlagezweck | Restbetrag-Überweisung auf das TR-Ausgabenkonto |

Verbindliche Abgrenzungen (U1):

- **Round-up ist eigenes Geld** → eigene variable Sparleistung, niemals Anbieterleistung.
- **Saveback ist Anbieterleistung** → niemals eigene Sparleistung.
- Saveback und Round-up fließen beide in den Physical Gold ETC, dürfen aber **niemals als dieselbe Zuflussart gespeichert** werden.
- Umbuchungen (Rücklagen-/Liquiditätsübertragungen) sind **weder Einnahmen noch Ausgaben** (S1) und **keine** (zusätzliche) Sparleistung.
- Geld auf dem TR-Ausgabenkonto ist **nicht automatisch Depotvermögen**; erst eine **tatsächliche Depotbuchung** zählt als Investment.

---

## 2. Kennzahlen: eigene Sparleistung und Gesamtvermögenszufluss

### 2.1 Eigene feste monatliche Sparleistung (real)

```
EFS_real(Monat) = VL_Eigenanteil + TR_feste_Sparrate + Tagesgeld_Rate
               = 33,50 + 60,00 + 25,00 = 118,50 EUR/Monat
```

Im Monat der jährlichen Equatex-Einzahlung zusätzlich: `+ 1.000 EUR` (Telekom-Eigenbeitrag, real).

### 2.2 Eigene feste monatliche Sparleistung (geglättet, Analysewert)

```
EFS_geglättet = EFS_real_monatlich + Telekom_Eigenbeitrag_geglättet
             = 118,50 + 83,33 = 201,83 EUR/Monat
```

### 2.3 Eigene variable Sparleistung

```
EVS(Monat) = Round-up(Monat) + tatsächlich gebuchte unregelmäßige eigene Depotkäufe(Monat)
```

Variabel, nicht garantiert; wird nur aus tatsächlichen Buchungen berechnet, nie geschätzt.

### 2.4 Arbeitgeber- und Anbieterleistungen

```
AAL_real(Monat) = VL_Zuschuss + Saveback(Monat) + Zinsen(Monat) + sonstige echte Leistungen(Monat)
               = 6,50 + variabel + variabel + variabel
```

Im Monat der Equatex-Einzahlung zusätzlich: `+ 500 EUR` (Shares2you-Bonus, real).
Geglättet: `AAL_geglättet = 6,50 + 41,67 + Saveback + Zinsen + … = 48,17 EUR/Monat + variable Anteile`.

### 2.5 Gesamter Vermögenszufluss

```
Gesamtzufluss = eigene Sparleistung (fest + variabel) + Arbeitgeber- und Anbieterleistungen
```

Gilt je Betrachtung (real oder geglättet, aber niemals gemischt in einer Kennzahl).

### 2.6 Tatsächlicher Cashflow vs. geglätteter Cashflow

- **Tatsächlicher Cashflow:** Geldbewegung mit Buchungsdatum, so wie sie real stattfindet (z. B. 1.000 € Equatex einmal jährlich; 129 € Office-Jahresrechnung im April).
- **Geglätteter Cashflow (Analysewert):** rechnerische Verteilung eines jährlichen Betrags auf Monate (`Jahresbetrag / 12`). Geglättete Werte sind **reine Analysewerte**, erscheinen nie als reale Buchung und werden in der UI als geglättet gekennzeichnet (Pflicht analog S2-Kennzeichnungsregel für Projektionen).

Beide Sichten müssen getrennt abrufbar sein; eine Kennzahl mischt niemals reale und geglättete Beträge unmarkiert.

---

## 3. Telekom / Shares2you (verbindlicher Ablauf, U1)

Für das Datenmodell sind **fünf getrennte Konzepte** definiert:

| Konzept | Definition | Wert |
|---------|------------|------|
| **Rücklagenübertragung** | Monatliche Umbuchung auf das ING-Rücklagenkonto; Zweckbindung Shares2you; **keine** Sparleistung im Sinne einer Investition | 75 EUR/Monat |
| **Jährlicher Eigenbeitrag** | Reale jährliche Equatex-Einzahlung aus eigenem Geld; zählt als eigene Sparleistung **genau einmal**, im Zeitpunkt der Einzahlung | 1.000 EUR/Jahr |
| **Arbeitgeberbonus** | Reale jährliche Telekom-Zuzahlung; Arbeitgeberleistung | 500 EUR/Jahr |
| **Geglätteter Analysewert** | Jahresbetrag / 12; nur Anzeige/Analyse | Eigenbeitrag 83,33; Bonus 41,67; gesamt 125 EUR/Monat |
| **Tatsächlicher Cashflow** | Die realen Buchungen (12 × 75 Rücklage; 1 × 1.000 Einzahlung; 1 × 500 Bonus; 1 × 100 Sparergänzung) | siehe links |

### 3.1 ING-Shares2you-Rücklage

```
Rücklage(Monat m) = Rücklage(m−1) + 75
Bei jährlicher Equatex-Einzahlung: Rücklage = Rücklage − 900
Jährlicher Eigenbeitrag = 900 (aus Rücklage) + 100 (Shares2you-Sparergänzung) = 1.000 EUR
```

**Doppelzählungsregel (verbindlich, U1):** Die 75-€-Rücklagenübertragungen und die 1.000-€-Equatex-Einzahlung sind **dieselben Gelder**. Als eigene Sparleistung (Investition) zählt der Betrag **genau einmal**: bei der Equatex-Einzahlung. Die monatlichen 75 € erscheinen als Rücklagenaufbau (Umbuchung/Liquiditätsbindung), nie als Investment-Sparleistung. In der geglätteten Sicht entspricht das 83,33 €/Monat.

### 3.2 Telekom-Eigenbeitrag

```
Telekom_Eigenbeitrag_real = 1.000 EUR/Jahr (einmal jährlich)
Telekom_Eigenbeitrag_geglättet = 1.000 / 12 = 83,33 EUR/Monat
```

Eine UI darf den geglätteten Eigenbeitrag optional gerundet als „etwa 84 €“ **anzeigen**; Rechenbasis bleibt immer 83,33 bzw. 1.000/Jahr.

### 3.3 Telekom-Bonus

```
Telekom_Bonus_real = 500 EUR/Jahr (einmal jährlich)
Telekom_Bonus_geglättet = 500 / 12 = 41,67 EUR/Monat
Telekom_Gesamtzufluss_real = 1.000 + 500 = 1.500 EUR/Jahr
Telekom_Gesamtzufluss_geglättet = 83,33 + 41,67 = 125 EUR/Monat
```

Die App löst keine Bank- oder Brokertransaktion aus (Abschnitt 0).

---

## 4. VL (vermögenswirksame Leistungen)

```
VL_gesamt      = 40,00 EUR/Monat
VL_Eigenanteil = 33,50 EUR/Monat   → eigene feste Sparleistung
VL_Zuschuss    =  6,50 EUR/Monat   → Arbeitgeberleistung
Prüfung: 33,50 + 6,50 = 40,00 ✓
```

Für die eigene Sparleistung zählen nur 33,50 €; für den Gesamtvermögenszufluss die vollen 40 €.

---

## 5. Trade Republic

### 5.1 Feste TR-Sparrate (eigenes Geld)

```
TR_fest = SPDR World thes. + Xtrackers World aussch. + EM IMI + Gold-Sparplan
        = 23 + 22 + 10 + 5 = 60 EUR/Monat
```

### 5.2 Variable TR-Zuflüsse

```
TR_variabel(Monat) = Saveback(Monat) + Round-up(Monat)
```

- **Saveback:** Anbieterleistung, wird variabel in den Physical Gold ETC investiert.
- **Round-up:** eigene variable Sparleistung, wird ebenfalls variabel in den Physical Gold ETC investiert.
- Zusammen typischerweise ca. 10–15 €/Monat (U1) – **keine garantierte feste Sparrate**, wird nur aus tatsächlichen Buchungen berechnet.
- Beide Arten werden **immer getrennt** gespeichert, auch wenn sie in dieselbe Position fließen.

### 5.3 TR-Kontenmodell

TR-Cash (Ausgabenkonto) und TR-Depotpositionen werden **getrennt** modelliert. Überweisungen auf das TR-Ausgabenkonto sind Liquiditätsübertragungen; sie zählen **nicht** als Depotinvestment. Erst eine tatsächliche Depotbuchung zählt als Investment.

### 5.4 Gold-Zufluss (zusammengesetzt)

```
Gold_Zufluss(Monat) = 5 (eigener fester Sparplan)
                    + Round-up(Monat)   [eigene variable Sparleistung]
                    + Saveback(Monat)   [Anbieterleistung]
```

Die historische Angabe „20 € mit Saveback“ ist ein ungefährer Gesamtzufluss und **kein** fester Eigenbeitrag (U1, Konflikt K2).

---

## 6. Vermögenskennzahlen

Getrennt berechenbar und darstellbar (U1). Basisregel S1 bleibt bestehen: `Gesamtvermögen = Tagesgeld + Depot` (Kernkennzahl der Vermögensebene; Tagesgeld nie im Depotnenner).

### 6.1 Anlagevermögen (Definition verbindlich, U1)

```
Anlagevermögen = Depotwert + Tagesgeld + Anlagegold(physisch) + [optional] Kryptowährungen
```

Auto und Alltagsgegenstände zählen **nicht** als Anlagevermögen. Derzeit: Anlagegold = 0 (existiert nicht, U1); Krypto: Aufnahme zurückgestellt.

### 6.2 Finanzvermögen

```
Finanzvermögen = Summe aller Girokonten (inkl. TR-Cash) + ING-Rücklage + Anlagevermögen
```

Girokonten gehören zum Finanzvermögen (U1). *Hinweis: Die exakte Kontenliste je Summand legt der data-architect im Datenmodell fest; die Zugehörigkeit von Girokonten und die Trennung TR-Cash/TR-Depot sind verbindlich (U1).*

### 6.3 Frei verfügbare Liquidität

```
Frei verfügbare Liquidität = Girokonten + TR-Cash
                           − zweckgebundene Rücklagen (ING-Shares2you-Rücklage, Fixkosten-Rückstellung)
```

*Entwurfsdefinition:* Die Abgrenzung „zweckgebunden“ (z. B. ob die Fixkosten-Rückstellung abgezogen wird) ist vom Nutzer bzw. data-architect zu bestätigen; verbindlich ist nur, dass die Kennzahl getrennt existiert und die ING-Rücklage nicht als frei verfügbar gilt (Zweckbindung Shares2you, U1).

---

## 7. Notgroschen

```
Notgroschen_Ziel = n × Netto_monatlich,   n ∈ [3; 5], Standard n = 4
Aktuell: 4 × 1.170 = 4.680 EUR
```

Regeln (U1):

- `n` ist konfigurierbar (3–5), Standard 4.
- Bei Änderung des Netto **kann** der Zielbetrag automatisch neu berechnet werden (reine Berechnung, keine Aktion).
- Der Nutzer kann den errechneten Zielbetrag manuell überschreiben; ein manueller Wert wird durch Neuberechnung nicht ungefragt ersetzt.
- Nach Erreichen des Ziels zeigt die App **nur Vorschläge** an (z. B. Auto-Rücklage, Urlaub, andere größere geplante Ausgaben); sie ändert die Tagesgeld-Sparrate **niemals automatisch**.

---

## 8. Fixkosten

### 8.1 Modell

Fixkosten werden als **einzelne Verträge mit echten Fälligkeiten** erfasst (monatlich / vierteljährlich / jährlich, mit Fälligkeitsdatum). Reale Zahlungen buchen zum echten Termin.

### 8.2 Geglättete Fixkosten-Pauschale (Planungswert)

```
Pauschale = Σ(monatliche Verträge)
          + Σ(vierteljährliche Verträge) / 3
          + Σ(jährliche Verträge) / 12
```

- Zweck: monatlich ausreichend Geld für unregelmäßig oder jährlich fällige Fixkosten zurückzulegen.
- Die Pauschale ist ein **Planungswert** und wird **nicht zusätzlich** zu den echten Zahlungen als Ausgabe gezählt (Doppelzählungsverbot, siehe Testfall T6).
- Die historische Pauschale von 492 € darf anhand der erfassten Verträge automatisch neu berechnet und dadurch erhöht oder gesenkt werden.
- Der ungeklärte historische Wert von 672 € bleibt als **veraltet/ungeklärt** markiert und darf nicht als aktuelle Fixkostensumme verwendet werden.
- Die Mietposition 250 €/Monat ist derzeit **pausiert** (U1) und fließt im pausierten Zustand nicht in die Pauschale ein.

---

## 9. Rebalancing (Formeln S2, Schwellen U1)

Grundformeln (S2, Nenner je Ebene beachten – Tagesgeld nie im Depotnenner):

```
Ist-Anteil            = Positionswert / Depotwert
Sollwert              = Zielanteil × Depotwert
Abweichung (EUR)      = Positionswert − Sollwert
Abweichung (Pp)       = (Ist-Anteil − Zielanteil) × 100   [Prozentpunkte, absolut; Anteile sind Dezimalzahlen – ohne die Skalierung ×100 greifen die 5/10-Pp-Schwellen nicht; Details F14]
Kaufbedarf            = MAX(0, Sollwert − Positionswert)
Verkaufsbedarf        = MAX(0, Positionswert − Sollwert)
```

Verbindliche Regeln (U1):

- Abweichungen werden **jederzeit angezeigt**.
- Formale Rebalancing-Prüfung **mindestens einmal jährlich**.
- **Handlungsempfehlung ab |Abweichung| ≥ 5 Prozentpunkte** (absolut, nicht relativ).
- **Verkäufe werden erst ab |Abweichung| ≥ 10 Prozentpunkten** als mögliche Option **erwähnt**.
- Vor Verkäufen werden immer zuerst geprüft: Sparratenanpassungen, zusätzliche Einzahlungen, Ausschüttungen (Reihenfolge S2).
- Keine vorgeschlagene Sparrate darf negativ sein; Budgetgrenze und nicht flexible Mindestbeträge einhalten (S2).
- **Die Prozentwerte eines Zielprofils sind normativ.** Euro-Beträge werden daraus jeweils neu berechnet und sinnvoll gerundet; **Rundungsdifferenzen werden sichtbar ausgewiesen** (historische Beispielbeträge des Job-Profils sind nur Illustration).
- Profil „Eigene Aufteilung“: leer und frei editierbar.
- Telekom wird während des Studiums **nicht automatisch** als „nicht flexibel“ verdrahtet (Kann-Option des Nutzers, U1); die sachliche Anzeige einer Übergewichtung gegenüber dem Job-Profil ist erlaubt.
- Jede Empfehlung ist unverbindlich (Abschnitt 0); Aktivierung des Job-Profils nur per ausdrücklicher Nutzerbestätigung nach dem 30.09.2027.

Pflichtprüfungen (S2/S3): Zielgewichte summieren zu 100 % je Ebene; World-Unterpositionen summieren zu World gesamt; keine Division durch 0 (Depotwert 0 → Anteile undefiniert, als „nicht berechenbar“ anzeigen, nie NaN/Infinity); Tagesgeld + Depot = 100 % auf Vermögensebene.

---

## 10. Testbeispiele gegen Doppelzählung

Alle mit „(fiktiv)“ gekennzeichneten Zahlen sind reine Testwerte, keine Nutzerdaten.

**T1 – Shares2you-Jahreszyklus (keine Doppelzählung ING/Equatex):**
Eingaben: 12 × 75 € Rücklagenübertragung an ING; 100 € Sparergänzung; 1 × 1.000 € Equatex-Einzahlung; 1 × 500 € Bonus.
Erwartet: eigene Sparleistung aus Telekom im Jahr = **1.000 €** (nicht 1.900 €, nicht 2.000 €); Arbeitgeberleistung = 500 €; Telekom-Gesamtzufluss = 1.500 €; ING-Rücklage nach Zyklus = Startwert + 900 − 900 = Startwert.
Fehlerfall, der abgefangen werden muss: Zählung der 75-€-Übertragungen **und** der 1.000-€-Einzahlung als Sparleistung im selben Jahr.

**T2 – VL-Monat:**
Eingabe: 40 € VL-Buchung.
Erwartet: eigene Sparleistung +33,50 €; Arbeitgeberleistung +6,50 €; Gesamtzufluss +40 €. Fehlerfall: 40 € vollständig als eigene Sparleistung.

**T3 – Gold-Monat (fiktiv):**
Eingaben: 5 € fester Sparplan; 4 € Round-up (fiktiv); 7 € Saveback (fiktiv).
Erwartet: Gold-Zufluss = 16 €; eigene Sparleistung = 9 € (5 fest + 4 variabel); Anbieterleistung = 7 €; Saveback und Round-up als **zwei getrennte Buchungen** unterschiedlicher Zuflussart.
Fehlerfall: Saveback und Round-up in einer Sammelbuchung derselben Zuflussart.

**T4 – TR-Ausgabenkonto (fiktiv):**
Eingabe: 100 € (fiktiv) Restbetrag-Überweisung auf das TR-Ausgabenkonto, keine Depotbuchung.
Erwartet: Liquiditätsübertragung; eigene Sparleistung +0 €; Depotwert unverändert; Kennzahl „frei verfügbare Liquidität“ +100 €.
Fehlerfall: automatische Zählung als Depotinvestment.

**T5 – Real vs. geglättet:**
Betrachtet werden hier nur die eigenen Festraten plus Telekom-Zuflüsse (ohne VL-Zuschuss 6,50 € und ohne variable Anteile – diese kommen in beiden Sichten identisch hinzu).
Monat ohne Equatex-Einzahlung: realer Investment-Cashflow aus eigenen festen Raten = 118,50 €; geglättete Sicht (eigen) = 201,83 €. Equatex-Monat: real = 118,50 + 1.000 (eigen) + 500 (Arbeitgeber); geglättet unverändert 201,83 (eigen) + 41,67 (Arbeitgeber).
Erwartet: beide Sichten getrennt; keine Kennzahl addiert 125 € geglättet **und** 1.500 € real im selben Jahr (sonst Doppelzählung 3.000 € statt 1.500 €).

**T6 – Fixkosten-Pauschale (realer Vertrag):**
Eingabe: Office-Jahresvertrag 129 €/Jahr (R5/R6), Zahlung im April.
Erwartet: Pauschalanteil 129 / 12 = 10,75 €/Monat als Rückstellungs-Planungswert; im April echte Ausgabe 129 €; Jahresausgaben aus diesem Vertrag = **129 €** (nicht 129 + 12 × 10,75 = 258 €).
Fehlerfall: Pauschale zusätzlich zur echten Zahlung als Ausgabe gebucht.

**T7 – Notgroschen:**
Eingabe: Netto 1.170 €, n = 4 → Ziel 4.680 €. Netto-Änderung auf 3.000 € (fiktiv, Job-Szenario) → neu berechenbar 12.000 €.
Erwartet: Neuberechnung nur als Berechnung/Vorschlag; ein manuell überschriebener Zielwert bleibt bestehen, bis der Nutzer ihn ändert; die Tagesgeld-Sparrate wird nie automatisch angepasst.

**T8 – Snapshot-Schutz:**
Eingabe: Import frischer Kontostände nach Snapshot 2026-07-17.
Erwartet: neuer Datenpunkt mit neuem Datum; der historische Snapshot (Depot 2.522,47 €; Tagesgeld 627,59 €; Gesamt 3.150,06 €) bleibt unverändert erhalten.
Fehlerfall: Überschreiben historischer Werte.

**T9 – Rebalancing-Schwellen (fiktive Abweichungen):**
|Abweichung| = 3 Pp → nur Anzeige, keine Empfehlung. 6 Pp → Handlungsempfehlung (Sparraten/Einzahlungen/Ausschüttungen zuerst), keine Verkaufsoption. 12 Pp → Empfehlung inkl. Erwähnung der Verkaufsoption als letzte Möglichkeit. In keinem Fall eine automatische Aktion.

---

## 11. Offene Punkte dieses Dokuments (aufgelöst)

Die früheren offenen Punkte sind durch das Datenmodell (`docs/data-model.md`, Abschnitt 4) aufgelöst: Kontenzuordnung der Kennzahlen über Konto-Typ und Flags (`countsAsFreeLiquidity`, `includeInInvestedWealth`); Begriffshierarchie `totalWealth ⊆ investedWealth ⊆ financialWealth`; Krypto zählt immer genau einmal zum Finanzvermögen, das Flag steuert nur das Anlagevermögen. Weiterhin zurückgestellt (kein Formelbedarf in V1): Telekom-Pensionsfonds; Fixkosten-Rückstellungsanteil der Liquiditätsformel (ab schemaVersion ≥ 2).

---

## 12. Formelkatalog F1–F22

**Datengrundlage aller Testbeispiele** (bestätigter Seed-Snapshot 2026-07-17 und Sparplan-Stand aus `finance-data.example.json`; alle Beträge EUR):

| Symbol | Wert | Symbol | Wert |
|--------|------|--------|------|
| Tagesgeld `TG` | 627,59 | VL World `P_vl` | 577,99 |
| Depotwert `D` | 2.522,47 | SPDR World (Acc) `P_spdr` | 237,45 |
| Gesamtvermögen `GV` | 3.150,06 | Xtrackers World (Dist) `P_xtr` | 204,86 |
| World gesamt `W` | 1.020,30 | EM IMI `P_em` | 99,11 |
| Feste Raten: VL 40 (33,50 eigen + 6,50 AG), TR 60 (23 + 22 + 10 + 5), TG 25 | – | Gold ETC `P_gold` | 33,92 |
| Telekom jährlich: 1.000 eigen + 500 Bonus (Juli) | – | Telekom `P_tel` | 1.369,14 |

Interne Rechnung immer ungerundet; Rundung nur bei Anzeige (F19). Division durch 0 ist überall verboten → Ergebnis „nicht berechenbar“ (F20).

---

### F1 – Gesamtvermögen

- **Eingaben:** Summe aktueller Salden aller Konten mit `type: "tagesgeld"` (`TG`); Summe aktueller Werte aller Depotpositionen (`D`).
- **Formel:** `GV = TG + D`
- **Ausgabe:** Betrag in EUR.
- **Randfälle:** Beide 0 → GV = 0 (gültig). Konto mit leerer Saldo-Historie → zählt nicht als 0; GV wird mit Hinweis „enthält Konten ohne erfassten Saldo“ angezeigt (G11). ING-Rücklage, Girokonten, TR-Cash gehören **nicht** zu GV (S1).
- **Erwartetes Testergebnis:** `627,59 + 2.522,47 = 3.150,06` ✓.

### F2 – Depotwert

- **Eingaben:** Aktuelle Werte aller **aktiven** `portfolioPositions` (`isActive !== false`; jüngster `valueHistory`-Eintrag je Position; der Aufrufer filtert – Nachtrag Modul Depot 2026-07-19).
- **Formel:** `D = Σ Positionswerte`
- **Ausgabe:** Betrag in EUR.
- **Randfälle:** Keine Positionen → D = 0. Tagesgeld und TR-Cash fließen nie ein (G6, S1). Depot-Konten haben keine eigene Saldo-Historie (kein Doppelzählen).
- **Erwartetes Testergebnis:** `577,99 + 237,45 + 204,86 + 99,11 + 33,92 + 1.369,14 = 2.522,47` ✓.

### F3 – Tagesgeldanteil (am Gesamtvermögen)

- **Eingaben:** `TG`, `GV`.
- **Formel:** `anteil_tg = TG / GV`
- **Ausgabe:** Dezimalzahl (Anzeige in %).
- **Randfälle:** GV = 0 → „nicht berechenbar“. Tagesgeld geht **nie** in den Depotnenner ein (S1/S2).
- **Erwartetes Testergebnis:** `627,59 / 3.150,06 = 0,1992311` → 19,92311 % (deckungsgleich mit Source Map/R2) ✓.

### F4 – Depotanteil (am Gesamtvermögen)

- **Eingaben:** `D`, `GV`.
- **Formel:** `anteil_depot = D / GV`
- **Ausgabe:** Dezimalzahl (Anzeige in %).
- **Randfälle:** GV = 0 → „nicht berechenbar“. Pflichtprüfung: `anteil_tg + anteil_depot = 1,0` (Vermögensebene = 100 %, S2).
- **Erwartetes Testergebnis:** `2.522,47 / 3.150,06 = 0,8007689` → 80,07689 %; Prüfung: 0,1992311 + 0,8007689 = 1,0 ✓.

### F5 – Positionsanteil am Depot

- **Eingaben:** Positionswert `P`, Depotwert `D`.
- **Formel:** `anteil_pos_depot = P / D`
- **Ausgabe:** Dezimalzahl (Anzeige in %).
- **Randfälle:** D = 0 → „nicht berechenbar“ (nie NaN/Infinity). P = 0 → 0 % (gültig). Summe über alle Positionen = 1,0 (± sichtbarer Rundung, S2).
- **Erwartetes Testergebnis:** Telekom `1.369,14 / 2.522,47 = 0,5427775` → 54,27775 %; Gold `33,92 / 2.522,47 = 0,0134471` → 1,34471 %; Summe aller sechs Anteile = 1,0 ✓.

### F6 – Positionsanteil am Gesamtvermögen

- **Eingaben:** Positionswert `P`, Gesamtvermögen `GV`.
- **Formel:** `anteil_pos_gv = P / GV`
- **Ausgabe:** Dezimalzahl (Anzeige in %).
- **Randfälle:** GV = 0 → „nicht berechenbar“. Diese Kennzahl ist Zusatzinformation – Rebalancing der Depotpositionen rechnet **immer** auf Depotebene (F5), nie auf GV-Ebene (S2).
- **Erwartetes Testergebnis:** Telekom `1.369,14 / 3.150,06 = 0,4346393` → 43,46393 % (nachgerechnet; deckungsgleich mit der Referenzdatei R2 – der Wert steht nicht in der Source Map selbst) ✓.

### F7 – MSCI World gesamt

- **Eingaben:** Werte aller **aktiven** Positionen mit `group: "world"` (Aufrufer filtert; Nachtrag Modul Depot 2026-07-19).
- **Formel:** `W = P_vl + P_spdr + P_xtr` (allgemein: Σ world-Positionen)
- **Ausgabe:** Betrag in EUR; zusätzlich Anteil `W / D` (Dezimalzahl).
- **Randfälle:** Wird **immer berechnet, nie gespeichert**. Pflichtprüfung S2: Unterpositionen ergeben exakt World gesamt; Anteile innerhalb World summieren zu 100 % (± sichtbarer Rundung).
- **Erwartetes Testergebnis:** `577,99 + 237,45 + 204,86 = 1.020,30`; Anteil `1.020,30 / 2.522,47 = 0,4044845` → 40,44845 %; innerhalb World: 56,64902 % + 23,27257 % + 20,0784 % ≈ 100 % (Rundungsdifferenz 0,00001 Pp sichtbar) ✓.
- **Anmerkung (Modul Depot, 2026-07-19):** Verallgemeinerung: `groupTotal(positions, group)` = Σ aktive (vom Aufrufer gefilterte) Positionen der Gruppe; `worldTotal = groupTotal(…, 'world')`. Seed: world 1.020,30; gold 33,92; telekom 1.369,14; em 99,11.

### F8 – Eigene monatliche Sparleistung

- **Eingaben (U4-Fassung, 2026-07-20):** Aktive `savingsPlans` mit `flowType` ∈ {`own_fixed`, `own_variable`} und gültigem POSITIVEN festen Betrag, monatlich; Telekom-Eigenbeitrag (jährlich) je nach Sicht; `own_variable` OHNE festen Betrag (`amount: null`) zählt nicht – dessen Ist-Werte kommen nur aus tatsächlichen Buchungen.
- **Formel (real, Monat ohne Equatex):** `EFS_real = VL_eigen + TR_fest + TG_rate = 33,50 + 60,00 + 25,00`; im Equatex-Monat zusätzlich `+ 1.000`.
- **Formel (geglättet):** `EFS_geglättet = EFS_real_monatlich + 1.000/12 = 118,50 + 83,33`.
- **Ausgabe:** Betrag in EUR/Monat, getrennt als „real“ oder „geglättet“ gekennzeichnet (G9); variable eigene Zuflüsse (Round-up) kommen nur aus tatsächlichen Buchungen hinzu.
- **Randfälle:** Rücklagenübertragungen (ING 75) zählen **nie** (G7); Round-up ist eigen, Saveback nie (G8); reale und geglättete Sicht nie mischen.
- **Erwartetes Testergebnis:** real 118,50 €/Monat; geglättet 201,83 €/Monat; Jahr: 12 × 118,50 + 1.000 = 2.422,00 = 12 × 201,83 + Rundungsdifferenz 0,04 (sichtbar ausweisen; exakt: 12 × (118,50 + 1.000/12) = 2.422,00) ✓.

### F9 – Gesamter Vermögenszufluss inklusive Arbeitgebervorteil

- **Eingaben:** F8 plus `employer`- und `provider`-Zuflüsse (VL-Zuschuss 6,50; Shares2you-Bonus 500/Jahr; Saveback/Zinsen variabel).
- **Formel (real, Monat ohne Equatex):** `GZ_real = EFS_real + 6,50 = 125,00`; im Equatex-Monat zusätzlich `+ 1.000 + 500`.
- **Formel (geglättet, fest):** `GZ_geglättet = 40 + 22 + 23 + 10 + 5 + 125 + 25 = 250,00`.
- **Ausgabe:** Betrag in EUR/Monat (real oder geglättet gekennzeichnet); variable Zuflüsse nur aus tatsächlichen Buchungen.
- **Randfälle:** Achtung Verwechslungsgefahr: die realen 125,00 €/Monat (fest) und der geglättete Telekom-Gesamtzufluss 125 €/Monat sind **verschiedene Kennzahlen**, die zufällig denselben Zahlwert haben – immer beschriften. Mit typischen variablen Zuflüssen ≈ 260–265 €/Monat (nur als „ungefähr“ anzeigen).
- **Erwartetes Testergebnis:** real 125,00 €/Monat (ohne Equatex-Monat); geglättet 250,00 €/Monat; Jahr: 12 × 125 + 1.500 = 3.000,00 = 12 × 250 ✓; Anteil eigen geglättet 201,83 + Arbeitgeber 48,17 = 250,00 ✓.

### F10 – Zielwerte Student (Profil „Student“, Ebene A – Sparraten-Referenz)

- **Eingaben:** Aktive feste/geglättete Depot-Sparzuflüsse (World 85 = 40 + 23 + 22; EM 10; Gold 5; Telekom geglättet 125); optional Vermögensebene inkl. TG 25.
- **Formel:** `referenzanteil_i = zufluss_i / Σ zuflüsse` (berechnet aus `savingsPlans`, nie gespeichert)
- **Ausgabe:** Referenzverteilung als Dezimalzahlen; dient als Ist-Referenz der Studienphase (kein Bestandsziel).
- **Randfälle:** Ebene B (Bestands-Zielallokation) ist leer → „nicht befüllt“, es wird nicht gerechnet (M11-AK 4). Variable Zuflüsse (Saveback/Round-up) sind **nicht** Teil der Referenz (nicht garantiert). Keine Profilprozente gespeichert.
- **Erwartetes Testergebnis:** Depotebene (Σ = 225): World 85/225 = 0,3777778; EM 10/225 = 0,0444444; Gold 5/225 = 0,0222222; Telekom 125/225 = 0,5555556; Summe = 1,0 ✓. Vermögensebene (Σ = 250): World 0,34; EM 0,04; Gold 0,02; Telekom 0,50; Tagesgeld 0,10; Summe = 1,0 ✓.

### F11 – Zielwerte Job (Profil „Job“, Bestandsebene)

- **Eingaben:** Normative Gewichte (VL 0,048; Xtrackers 0,31; SPDR 0,342; EM 0,15; Gold 0,05; Telekom 0,10), Depotwert `D`; Ebene 1: Sparquote `S` mit 0,85/0,15.
- **Formel:** `soll_i = gewicht_i × D`; Ebene 1: `depot_sparbetrag = 0,85 × S`, `tg_sparbetrag = 0,15 × S`
- **Ausgabe:** Sollwerte in EUR je Position (kaufmännisch gerundet, Differenz sichtbar); World gesamt = Σ der drei World-Sollwerte (0,70 × D, berechnet).
- **Randfälle:** Aktivierung nur manuell nach Bestätigung, frühestens sinnvoll nach 2027-09-30 – die Berechnung ist jederzeit als Vorschau zulässig (G1/G5). Prozentwerte sind normativ; historische Beispielbeträge (260,04 usw.) sind keine Rechenbasis.
- **Erwartetes Testergebnis (D = 2.522,47):** VL 121,08; Xtrackers 781,97; SPDR 862,68; EM 378,37; Gold 126,12; Telekom 252,25; Summe (ungerundet) = 2.522,47 ✓; World gesamt Soll = 0,70 × 2.522,47 = 1.765,73.

### F12 – Eigene Zielwerte (Profil „Eigene Aufteilung“)

- **Eingaben:** Vom Nutzer editierbare Gewichte (Start: leer), Depotwert `D`.
- **Formel:** identisch zu F11: `soll_i = gewicht_i × D`
- **Ausgabe:** Sollwerte in EUR.
- **Randfälle:** Leeres Profil → gültig, aber „nicht befüllt“, keine Berechnung, verständlicher Leerzustand. Befüllte Gewichte müssen F21 bestehen (Σ = 1,0 ± 0,001).
- **Erwartetes Testergebnis:** Leeres Profil → keine Sollwerte, Anzeige „Profil nicht befüllt“; nach Befüllung mit z. B. den Job-Gewichten identische Ergebnisse wie F11.

### F13 – Abweichung in Euro

- **Eingaben:** Positionswert `P` (Ist), Sollwert `soll` (F11/F12).
- **Formel:** `abw_eur = P − soll` (positiv = übergewichtet, negativ = untergewichtet)
- **Ausgabe:** Betrag in EUR mit Vorzeichen.
- **Randfälle:** Ohne befülltes Profil „nicht berechenbar“. Vorzeichen immer mit ausgeben (Farbe nie einziges Signal, S5).
- **Erwartetes Testergebnis (Job-Profil, Seed):** Telekom `1.369,14 − 252,25 = +1.116,89`; Gold `33,92 − 126,12 = −92,20`; EM `99,11 − 378,37 = −279,26` ✓.

### F14 – Abweichung in Prozentpunkten

- **Eingaben:** Ist-Anteil (F5), Zielanteil (Profilgewicht), jeweils als Dezimalzahl.
- **Formel:** `abw_pp = (ist_anteil − ziel_anteil) × 100` – **absolut in Prozentpunkten, nie relativ** (U1)
- **Ausgabe:** Prozentpunkte mit Vorzeichen. Schwellen (U1/K12): |abw_pp| ≥ 5 → Handlungsempfehlung; |abw_pp| ≥ 10 → Verkaufsoption der übergewichteten Position wird als letzte Möglichkeit erwähnt.
- **Randfälle:** D = 0 → „nicht berechenbar“; Empfehlungen sind immer unverbindlich (G2); unterhalb 5 Pp nur Anzeige.
- **Erwartetes Testergebnis (Job-Profil, Seed):** Telekom `54,27775 − 10 = +44,27775 Pp` → Empfehlung inkl. Verkaufsoption; EM `3,92909 − 15 = −11,07091 Pp` → Empfehlung; Gold `1,34471 − 5 = −3,65529 Pp` → nur Anzeige; World gesamt `40,44845 − 70 = −29,55155 Pp` ✓.

### F15 – Kaufbedarf

- **Eingaben:** `P`, `soll`.
- **Formel:** `kauf = MAX(0, soll − P)`
- **Ausgabe:** Betrag in EUR ≥ 0.
- **Randfälle:** Nie negativ (MAX-Klammer); Pflichtprüfung S2: Σ Kaufbedarf = Σ Verkaufsbedarf (bis auf ausgewiesene Rundung), da Gewichte zu 1,0 summieren.
- **Erwartetes Testergebnis (Job-Profil, Seed, auf Cent gerundet):** Xtrackers 577,11; SPDR 625,23; EM 279,26; Gold 92,20; VL 0 (übergewichtet); Telekom 0; Σ Kauf = 1.573,80 ✓.

### F16 – Verkaufsbedarf

- **Eingaben:** `P`, `soll`.
- **Formel:** `verkauf = MAX(0, P − soll)`
- **Ausgabe:** Betrag in EUR ≥ 0 – **reine Information/Empfehlung**; Verkäufe werden erst ab |abw_pp| ≥ 10 überhaupt als Option erwähnt und stehen in der Maßnahmen-Reihenfolge an letzter Stelle (S2/U1).
- **Randfälle:** Nie negativ; keine automatische Ausführung (G1); VL-Verkauf zusätzlich real durch Vertragsbindung eingeschränkt → nur Hinweis.
- **Erwartetes Testergebnis (Job-Profil, Seed):** Telekom 1.116,89; VL 456,91; übrige 0; Σ Verkauf = 1.573,80 = Σ Kauf (F15) ✓ – Konsistenzprüfung bestanden.

### F17 – Sparraten-Rebalancing (Empfehlungsberechnung)

- **Eingaben:** Flexibles monatliches Budget (V1-Standard: die feste eigene TR-Rate 60,00 €), Kaufbedarfe je Position (F15, ungerundet), nicht-flexible Raten (bleiben unverändert).
- **Formel (definierte V1-Standardmethode):** proportional zur Lücke: `rate_i = budget × kauf_i / Σ kauf` – nur über Positionen mit Kaufbedarf > 0; übergewichtete flexible Positionen erhalten 0.
- **Ausgabe:** Vorgeschlagene Monatsraten je Position (Empfehlung; Übernahme nur als bestätigte geplante Einstellung, G5).
- **Randfälle:** Keine Rate < 0; Σ Raten ≤ Budget; Budget 0 → keine Empfehlung; nur eine untergewichtete Position → erhält das gesamte flexible Budget; nicht-flexible Mindestbeträge unangetastet (F18); Rundungsdifferenz sichtbar ausgleichen (F19).
- **Erwartetes Testergebnis (Budget 60 €, Kaufbedarfe aus F15, ungerundet):** SPDR `60 × 625,23474 / 1.573,80444 = 23,84`; Xtrackers `22,00`; EM `10,65`; Gold `3,52`; Telekom/VL `0`. Rohsumme gerundet 60,01 → Ausgleich −0,01 an der größten Rate (SPDR 23,83), Differenz sichtbar ausgewiesen; Endsumme exakt 60,00 ✓.

### F18 – Behandlung fixer und flexibler Raten

- **Eingaben:** `savingsPlans` mit `isFlexible` und `minAmount`.
- **Formel/Regel:** Nicht-flexible Pläne (`isFlexible: false`) werden von F17 nie verändert und mit `minAmount` als Untergrenze geführt (VL-Eigenanteil 33,50; VL-Zuschuss 6,50; Telekom-Bonus 500/Jahr). Flexible Pläne dürfen zwischen 0 und Budget vorgeschlagen werden. Arbeitgeber-/Anbieterflüsse (`employer`/`provider`) sind grundsätzlich nicht umlenkbar.
- **Ausgabe:** Partition der Pläne in „fix“ (unverändert) und „flexibel“ (empfehlbar).
- **Randfälle:** Telekom-Eigenbeitrag steht auf `isFlexible: true`, wird aber nur nach ausdrücklicher Nutzerentscheidung verändert – die Empfehlung darf ihn vorschlagen, nie automatisch umsetzen (U1/G5); jede weitere `false`-Markierung nur durch den Nutzer.
- **Erwartetes Testergebnis:** Bei F17 bleiben VL 40 (33,50 + 6,50) und Telekom-Jahrespläne unverändert; nur die 60 € TR-Raten werden neu verteilt; Gesamtzufluss fest/geglättet bleibt 250,00 €/Monat ✓.

### F19 – Rundung

- **Eingaben:** Ungerundete Rechenwerte.
- **Formel/Regel:** Intern ungerundet rechnen; EUR-Anzeige kaufmännisch auf 2 Nachkommastellen; Prozent-Anzeige gemäß `settings.display.percentDecimals` (Standard 2). Rundungsdifferenzen zwischen Summen aus gerundeten Einzelwerten und dem gerundeten Gesamtwert werden **sichtbar ausgewiesen** und bei Ratenvorschlägen an der betragsgrößten Position ausgeglichen (S2).
- **Ausgabe:** Anzeigewerte plus ausgewiesene Differenz (falls ≠ 0).
- **Randfälle:** Rundung darf Gesamtsparraten nie unbemerkt verändern; gespeichert werden nur Quellwerte (nie gerundete Zwischenergebnisse).
- **Erwartetes Testergebnis:** F17-Beispiel: Einzelrundungen 23,84 + 22,00 + 10,65 + 3,52 = 60,01 ≠ 60,00 → Differenz +0,01 ausgewiesen und ausgeglichen ✓; F7: World-Prozentsumme 99,99999 % mit ausgewiesener Differenz 0,00001 Pp ✓.

### F20 – Nullwerte

- **Eingaben:** Beliebige Kennzahl mit Nenner 0 oder leeren Datenreihen.
- **Formel/Regel:** Division durch 0 ist verboten → Ergebnis ist der definierte Zustand „nicht berechenbar“ (UI: verständlicher Hinweis, kein Zahlwert). 0 im Zähler ist gültig (Anteil 0 %). Leere Historie bedeutet **unbekannt**, nie 0 (G11).
- **Ausgabe:** Zahl, 0 oder Zustand „nicht berechenbar“ – niemals NaN, Infinity oder leere Rechenergebnisse (S3).
- **Randfälle:** D = 0 → F5/F7/F11–F17 „nicht berechenbar“; GV = 0 → F3/F4/F6 „nicht berechenbar“; leerer Datenbestand → Leerzustände statt Berechnungen.
- **Erwartetes Testergebnis:** Datenbestand ohne Positionen: Depotgewichtung „nicht berechenbar“, keine Exception, kein NaN (DM11) ✓; Position mit Wert 0 → Anteil 0,00 % ✓.

### F21 – Ungültige Zielgewichte

- **Eingaben:** Profil-`weights` und `level1`.
- **Formel/Regel:** Gültig nur, wenn jedes Gewicht ∈ [0; 1] und `Σ gewichte = 1,0 ± 0,001` (Toleranzdifferenz sichtbar ausweisen); `level1.depotShare + cashShare = 1,0 ± 0,001`. Ungültige Profile werden mit Fehlermeldung am Profil abgelehnt; es wird nicht gerechnet. Leere Profile sind gültig, aber „nicht befüllt“.
- **Ausgabe:** Validierungsurteil (gültig / gültig mit ausgewiesener Differenz / ungültig) + Fehlermeldung.
- **Randfälle:** Negative Gewichte → ungültig; Summe 0 → ungültig (kein „alles 0“-Profil); genau 1,0 → gültig ohne Differenzausweis.
- **Erwartetes Testergebnis:** Job-Gewichte Σ = 0,048 + 0,31 + 0,342 + 0,15 + 0,05 + 0,10 = 1,000 → gültig ✓; Σ 0,9 → ungültig, Ablehnung mit Meldung (DM4/DM10) ✓; Σ 0,9995 → gültig, Differenz −0,0005 sichtbar (DM10) ✓.

### F22 – Projektionen nach 6 und 12 Monaten ohne Kursentwicklung

- **Eingaben:** Startwerte (`TG`, `D`), feste Zuflüsse je Monat (real oder geglättet, gekennzeichnet), Horizont `n` ∈ {6, 12}; Jahresereignisse (Telekom-Zufluss im Juli) in der realen Sicht zum Fälligkeitsmonat.
- **Formel (geglättet):** `GV(n) = GV + n × 250`; `TG(n) = TG + n × 25`; `D(n) = D + n × 225`.
- **Formel (real, Start August 2026):** `TG(n) = TG + n × 25`; `D(n) = D + n × 100 + (1.500 falls Juli im Horizont)`; `GV(n) = TG(n) + D(n)` (monatlicher realer Depot-Zufluss fest = 33,50 + 6,50 + 60 = 100).
- **Ausgabe:** Projizierte Beträge in EUR, **immer gekennzeichnet als „Projektion ohne Kursentwicklung“** (S2/C1); keine Anlageberatung; variable Zuflüsse (Saveback/Round-up) sind nicht enthalten (nicht garantiert); die ING-Rücklage liegt außerhalb des Gesamtvermögens und erscheint nicht.
- **Randfälle:** n = 0 → Startwerte; reale und geglättete Sicht nie mischen (G9); nach 12 Monaten müssen beide Sichten identisch enden (der geglättete Telekom-Wert 125 × 12 = 1.500 = realer Jahreszufluss).
- **Erwartetes Testergebnis:**
  - Geglättet: n = 6 → TG 777,59; D 3.872,47; GV 3.150,06 + 6 × 250 = **4.650,06** (Kontrolle: 777,59 + 3.872,47 ✓). n = 12 → TG 927,59; D 5.222,47; GV = **6.150,06** ✓.
  - Real (Start August 2026, Telekom-Juli im 12er-Horizont): n = 6 → TG 777,59; D 3.122,47; GV = **3.900,06**. n = 12 → TG 927,59; D 2.522,47 + 1.200 + 1.500 = 5.222,47; GV = **6.150,06**.
  - Konsistenzprüfung: reale und geglättete 12-Monats-Projektion sind identisch (6.150,06 = 6.150,06) ✓; die 6-Monats-Werte unterscheiden sich planmäßig um 750,00 (= 6 × 125 geglätteter Telekom-Anteil) ✓.

---

### Dashboard-Bausteine (M7, 2026-07-19) – additiv

- `accountsValue(konten, typen)` (§4-Baustein zu F1/F2): Summe der jüngsten Salden aller Konten mit `type` in der Typenliste; Aufrufer filtert vorab auf aktive Konten; leere Historien → `missingIds` („unbekannt“, nie 0, G11). Dashboard-Verwendung: „sonstiges aktives Kontovermögen“ = giro + cash + ruecklage + bargeld + sonstiges + krypto (pension NIE – Merkposten ohne Wert).
- `effectiveEmergencyFundTarget(emergencyFund)` (§7/T7): wirksames Notgroschen-Ziel = `manualOverrideAmount ?? factor × netIncomeMonthly` (Seed: 4 × 1.170 = 4.680); ein manueller Wert wird nie ungefragt ersetzt.
- `goalProgress(ist, ziel)` (§7/T7/F20): `rest = MAX(0, ziel − ist)`; `anteil = ist / ziel` (Ziel ≤ 0 → „nicht berechenbar“); `erreicht = ist ≥ ziel` – reine Anzeige, keine automatische Aktion (Abschnitt 0).
- Snapshot-Helfer (W4-Ableitungen, `src/data/snapshot.ts`): `isSnapshotComplete(datum)` = alle AKTIVEN Positionen und AKTIVEN Tagesgeldkonten haben am Datum einen Eintrag; gibt es KEINEN einzigen aktiven Eintrag, ist nichts zu bewerten → NICHT vollständig (keine vakuumwahre Vollständigkeit über leere Listen); `latestCompleteSnapshotDate` = jüngstes vollständig bewertetes Snapshot-Datum (null ohne Treffer); `hasEntriesAfter(datum)` = Historien-Einträge (Positionen/Tagesgeldkonten) nach dem Datum – bewusst OHNE Aktiv-Filter: auch ein späterer Eintrag an einer inzwischen deaktivierten Position ist eine Wertänderung nach dem Stichtag (anders als bei der W4-Vollständigkeit); `latestValuationDate` = jüngstes Bewertungsdatum über aktive Positionen + aktive Tagesgeldkonten (null ohne Einträge).
- Anzeige vollständig unbekannter Summen (G11-Präzisierung): Hat KEINER der relevanten Einträge einer Kennzahl einen erfassten Wert, zeigt die Kachel „unbekannt“ – nie eine leere 0-Summe. Teilsummen (mindestens ein bekannter Wert) erscheinen als Betrag plus Hinweis „enthält unbekannte Werte“.
- Hinweis Krypto-Konten: Die Typenliste des „sonstigen aktiven Kontovermögens“ enthält `krypto` unabhängig vom Flag `includeInInvestedWealth`. Sobald eine eigene Anlagevermögen-Kennzahl eingeführt wird, ist die Zuordnung je Flag neu zu entscheiden (keine Doppelzählung desselben Kontos in zwei Kacheln).
- ~~Offen dokumentiert: Für das Ziel `monthlySavingsRate` ist die Bezugsgröße nicht festgelegt.~~ **AUFGELÖST durch die verbindliche Nutzerentscheidung U3 (M10, 2026-07-19)** – siehe „Sparplan-Bausteine (M10)“ unten: primärer Fortschritt = eigene REALE monatliche Sparleistung (F8 realMonthly) / Zielbetrag; zusätzlich der geglättete Analysewert (gekennzeichnet). Das Dashboard zeigt den Fortschritt entsprechend an.

---

### Sparplan-Bausteine (M10, 2026-07-19) – additiv

**U3 – Bezugsgröße des Ziels „Monatlich 1.000 € Sparrate“ (verbindliche Nutzerentscheidung):**
- Primärer Fortschritt = **eigene reale monatliche Sparleistung / Zielbetrag** – nur regelmäßig monatlich gespartes EIGENES Geld; exakt F8 realMonthly = `ownMonthlySavings(aktive Pläne, 'realMonthly')`. Seed: 118,50 / 1.000 = **11,85 %**.
- Zusätzlicher Analysewert = eigene geglättete Sparleistung / Zielbetrag, IMMER gekennzeichnet als „Geglätteter Analysewert – nicht der primäre Zielfortschritt“. Seed: 201,83 / 1.000 = **20,18 %**.
- NICHT im primären Fortschritt: `employer` (VL-Zuschuss, Boni), `provider` (Saveback), `own_variable`-**Buchungs-Istwerte** (siehe aber U4 unten: own_variable-PLÄNE mit festem Betrag zählen), `reserve_transfer`/`liquidity_transfer`. Der Gesamtzufluss (F9) wird separat informativ gezeigt, NIE als Zielfortschritt.
- Folge (Risiko d, ausdrücklich dokumentiert): vierteljährliche/halbjährliche EIGENE Pläne zählen NICHT in den primären Fortschritt (nur monatliche Raten sind „regelmäßig monatlich“), wohl aber in den geglätteten Analysewert.

**U4 – own_variable mit festem Betrag (verbindliche Nutzerentscheidung, 2026-07-20 – ersetzt die frühere M10-Grauzone „variabler Plan mit festem Planbetrag“):**
- `own_fixed` UND `own_variable` zählen mit gültigem POSITIVEN festen Betrag vollständig zur eigenen Sparleistung (F8) und damit zum primären U3-Fortschritt. Ohne Betrag (`amount: null`), mit 0, negativ, NaN oder nicht endlich → zählt NICHT.
- `employer`/`provider` bleiben extern (nie U3-primär); Umbuchungen zählen nie (G7). Die M10-Status-/Termin-/Rhythmusregeln gelten unverändert (pausiert/beendet/abgeschlossen/geplant/außerhalb des Fensters → 0).
- Einmalige eigene variable Zuflüsse mit festem Betrag zählen real NUR im Ausführungsmonat (Monats-Realsicht `realAmountInMonth`), werden NIE geglättet und zählen NICHT in die monatliche F8-Rate (nur monthly zählt real-monatlich – U3 unverändert). KEIN neues Klassifikationsfeld.
- Defensivguard (doppelte Verteidigungslinie, Auflage A): `monthlyAmount` und `realAmountInMonth` behandeln nicht endliche oder ≤ 0-Beträge als 0 („zählt nicht“ statt Absturz). Präzisierung (finance-analyst M12): Validierung und Datenlayer lehnen NEGATIVE und nicht endliche Beträge beim Laden/Speichern ab; `amount: 0` ist gemäß §3.6 („Zahl ≥ 0“) speicherbar und zählt ausschließlich per Guard 0. Bewusste Guard-Asymmetrie: `wealth.ts` behält `assertFinite` (NaN-als-0 wäre ein ERFUNDENER Vermögenswert, G11); `annualAmount` behält `assertFinite` (reiner Anzeigewert je Plan, nicht U3-relevant).
- Seed unverändert: 118,50/201,83 eigen und 125,00/250,00 gesamt (Round-up bleibt `amount: null` und zählt weiterhin 0 – Ist-Werte nur aus Buchungen).

**Rhythmus- und Kalenderregeln (`src/finance/savings.ts` + `src/finance/schedule.ts`):**
- `paymentsPerYear`: monthly 12, quarterly 4, halfyearly 2, yearly 1, once 1 (Einmalbetrag des Ausführungsjahres, gekennzeichnet).
- `annualAmount = amount × paymentsPerYear`; `amount` null → null („variabel/unbekannt“, G11 – nie 0).
- Glättungsfaktoren (`monthlyAmount`, Sicht smoothed): monthly = amount; quarterly = amount/3; halfyearly = amount/6; yearly = amount/12; **once → 0** (nicht wiederkehrend – konservative Regel: Einmalzuflüsse gehen weder in die geglättete Monats-KPI noch in den primären 1.000-€-Fortschritt; sie erscheinen in der Monats-Realsicht und getrennt in der Jahressicht). Sicht realMonthly: NUR monthly zählt.
- 12×-Konsistenz: 12 × geglättete Monatsrate = Jahresbetrag der regelmäßigen Pläne (Seed eigen: 12 × 201,8333 = 2.422,00); Anzeige-Rundungsdifferenzen (12 × 201,83 = 2.421,96, Differenz 0,04) werden sichtbar ausgewiesen (F19). Gilt NICHT für once (2h) – Einmalbeträge werden in der Jahressicht GETRENNT ausgewiesen. **Jahressicht der Einmalzuflüsse (Präzisierung, finance-analyst-Befund F1):** Die getrennte Zeile zählt alle nicht pausierten Einmalzuflüsse mit Ausführungsdatum im LAUFENDEN Kalenderjahr – unabhängig vom Aktivfenster (auch geplante und bereits abgeschlossene Einmalzuflüsse des Jahres).
- `realAmountInMonth(plan, 'JJJJ-MM')` (Monats-Realsicht): monthly = amount in jedem Monat des Gültigkeitsfensters (validFrom-Monat ≤ Monat ≤ validUntil-Monat); quarterly/halfyearly = amount nur in Zyklusmonaten ab dem validFrom-Monat (+3/+6); yearly = amount nur im `dueMonth` (`dueMonth` null → 0, Erkennung über `hasUnknownSchedule`); once = amount nur im validFrom-Monat; pausiert/`amount` null → 0. **Im validUntil-Monat gilt TAGGENAU:** liegt der geklemmte Zahltag des Monats NACH validUntil, findet die Zahlung nicht mehr statt (konsistent mit `nextDueDate`; calculation-tester-Befund M10-1). **isPaused-Grenze (2c): nur für Monate ≥ Stichtagsmonat einsetzen – die Vergangenheit kommt aus `transactions`.**
- Intervallwechsel-Normalisierung in `updateSavingsPlan` (Befunde M10-2/M10-3): Wechsel WEG von yearly verwirft einen nicht ausdrücklich mitgegebenen `dueMonth`; Wechsel WEG von once setzt das automatisch normalisierte `validUntil` (= altes Ausführungsdatum) zurück auf null, sofern kein neues Enddatum ausdrücklich mitgegeben wird – ein ausdrückliches Enddatum bleibt erhalten.
- `nextDueDate(plan, stichtag)`: nächster Termin ≥ Stichtag oder null; Zahltag = validFrom-Tag mit **Monatsende-Klemmung** (31. → 30./28./29., Schaltjahr korrekt, kein Datumsüberlauf); pausiert/beendet → null; once vergangen → null (abgeschlossen); yearly ohne dueMonth → null (unbekannt); Termine nach validUntil → null; yearly-Kandidatenjahre starten beim SPÄTEREN aus Stichtagsjahr und validFrom-Jahr (auch weit vorausgeplante Jahres-Pläne haben einen ableitbaren ersten Termin, Befund F2).
- **Verwechslungsschutz:** Die „Monats-Realsicht“ (Σ `realAmountInMonth` des Kalendermonats, Seed Juli 2026: 1.625,00 inkl. Telekom-Jahresfälligkeiten) ist NICHT die monatliche reale Sparrate F8 (118,50, nur monatliche Raten) – beide Kennzahlen sind immer getrennt beschriftet.

**Statusmodell und isPaused-Wirkung:**
- Abgeleiteter Status (Rangfolge 2b): abgeschlossen (once, validFrom < Stichtag) → beendet (validUntil < Stichtag) → pausiert (`isPaused === true`) → geplant (validFrom > Stichtag) → aktiv.
- `isPlanActiveOn` liefert für pausierte Pläne false → F8/F9 und alle Dashboard-Kennzahlen schließen pausierte Pläne automatisch aus. isPaused ist ein Momentzustand ohne Pausenhistorie; reale Monatssichten werden nur ab dem Stichtagsmonat angezeigt, keine rückwirkende Umdeutung.

**F10-Datenbasis (Klarstellung):** Die Referenzverteilung rechnet auf den **geglätteten festen Zuflüssen je Depot-Ziel inkl. Arbeitgeberanteilen, ohne variable Zuflüsse, ohne Umbuchungen** (Seed Depotebene Σ 225: World 85 = VL 40 + SPDR 23 + Xtrackers 22; EM 10; Gold 5; Telekom 125). Σ ≤ 0 → „nicht berechenbar“ (F20). **Granularität (Befund F3):** Die Anzeige erfolgt je Depot-Ziel (Einzelpositionen) PLUS einer aggregierten Zeile „MSCI World gesamt“ (F7-Analogie; Seed: 85/225 = 0,3777778 → 37,78 %) – beide Sichten gehören zum dokumentierten F10-Testergebnis. Die Referenzverteilung dient nur zur Orientierung und ändert keine Sparpläne automatisch. Ein Abweichungsvergleich (Ist-% vs. Soll-%) erscheint NUR, wenn das aktive Zielprofil `basis: "savingsRate"` UND gespeicherte Gewichte hat; im Seed (tp-student-sparplan ohne Gewichte) IST die Referenz die aktuelle Verteilung (Ebene A).

---

### Ziel-Bausteine (M12, 2026-07-20) – additiv

Alle Bausteine sind reine Funktionen in `src/finance/goals.ts` (kein React, kein Systemdatum – der Stichtag wird IMMER injiziert). Die Zielarten-Verzweigung existiert NUR dort, nie doppelt in Komponenten. Kein Ergebnis löst eine Aktion aus (Abschnitt 0).

**Zielarten und Bezugswerte (`goalActualValue`):** tagesgeld → Σ aktueller Salden der AKTIVEN Tagesgeld-Konten; depotValue → Σ aktueller Werte der AKTIVEN Positionen (F2); totalWealth → Tagesgeld + Depot (F1); accountBalance/positionValue → jüngster erfasster Wert der REFERENZIERTEN Referenz (`latestEntry`; Referenz fehlt → null „nicht berechenbar“; ohne Historieneintrag → „unbekannt“; deaktivierte Referenz wird BERECHNET – das Ziel referenziert sie ausdrücklich – plus Warn-Flag); manual → `manualCurrentAmount` (null → „offen“); monthlySavingsRate → eigene REALE monatliche Sparleistung der am Stichtag aktiven Pläne (U3-Basis, keine Vermischung mit Vermögenswerten).

**Wirksames Ziel (`effectiveGoalTarget`):** Notgroschen-Doppel-Guard (`isAutoCalculated: true` UND `metric` tagesgeld/null) → berechnetes Notgroschen-Ziel (§7, Override-Vorrang); sonst `targetAmount` > 0 oder null („offen“ – nichts erfinden, G11).

**G11-Normalisierung vor der Statuskaskade:** Ein VOLLSTÄNDIG unbekannter Ist-Wert (alle relevanten Einträge ohne erfassten Wert) geht als `null` in die Statusableitung → „nicht berechenbar“; NIE als erfundene 0 („0 % / überfällig“). Teilsummen rechnen mit Betrag plus Hinweis „enthält unbekannte Werte“.

**Fortschritt:** unverändert `goalProgress` (Rest = MAX(0, Ziel − Ist); Anteil ehrlich, ggf. > 1 – Anzeige-Cap nur am Balken); zusätzlich `goalSurplus` = MAX(0, Ist − Ziel) als rein informativer Überschuss.

**Monatszählregel (`remainingFullMonths`, verbindlich, konservativ):** Verbleibende Zeit = Anzahl VOLLER Kalendermonatswechsel = Monatsindex(Zieldatum) − Monatsindex(Stichtag); ≤ 0 (Zieldatum im aktuellen Monat oder Vergangenheit) → 0; ungültiges/fehlendes Datum → null. Der angebrochene aktuelle Monat zählt NICHT als Sparmonat – die benötigte Rate fällt eher höher aus (keine Schein-Präzision nach unten). Rein string-/UTC-basiert.

**Benötigte Monatsrate (`requiredMonthlyRate`):** Rest ÷ volle Monate (intern ungerundet, Anzeige F19); 0 Monate/kein Datum → null („nicht berechenbar – diesen Monat fällig oder überfällig“); Rest ≤ 0 → 0 (erreicht).

**Prognose OHNE Rendite (`forecastMonthsToTarget`):** CEIL(Rest ÷ eigene reale Monatsrate) – reine Division, KEINE Rendite-/Zins-/Kursannahme (Pflicht-Kennzeichnung „ohne Rendite-/Kursannahme – keine Prognosegarantie“ in jeder Anzeige). Rest ≤ 0 → 0; Rate ≤ 0/nicht endlich → null („keine Prognose möglich“) – nie NaN/Infinity. `rateGap` = benötigte − vorhandene Rate. **Ausschluss (Auflage F):** Für `monthlySavingsRate`-Ziele werden Monatsrate/Prognose/verbleibende Sparmonate NICHT berechnet oder angezeigt (dimensional sinnlos: ein €/Monat-Ziel hat keinen ansparbaren Restbetrag); solche Ziele fließen auch nicht in die Zielbetrags-Summen der Übersicht ein.

**Statusrangfolge (`deriveGoalStatus`, verbindlich):** (1) archived (gespeichert) → (2) completed (gespeichertes `reached` = MANUELL abgeschlossen; schlägt auch einen sinkenden Ist-Wert) → (3) paused (deferred; gespeicherter Nutzerwille vor Zeitfenster) → (4) planned (`startDate` > Stichtag; = Stichtag ist NICHT geplant) → (5) notComputable (kein wirksames Ziel > 0 ODER Ist unbekannt/offen) → (6) reachedNow (rechnerisch Ist ≥ Ziel – wird NIE gespeichert, fällt bei sinkendem Ist zurück; gilt auch bei überschrittenem Termin) → (7) overdue (`targetDate` < Stichtag; = Stichtag ist NICHT überfällig) → (8) active. Manuell vs. rechnerisch erreicht sind strikt getrennt: gespeichert wird nur der Nutzerwille.

**Zuordnungs- und Doppelzählungsregel (`assignedOwnPlans`/`assignedOwnSavings`):** Die zielbezogene EIGENE Sparleistung ist über die vorhandene Zielreferenz ABLEITBAR (kein `goalId`-Feld): accountBalance/positionValue → eigene Pläne (own_fixed/own_variable MIT Betrag, am Stichtag aktiv) auf dieselbe Referenz; tagesgeld/Notgroschen → eigene Pläne auf AKTIVE Tagesgeld-Konten; depotValue → eigene Pläne auf AKTIVE Positionen (das Ziel-Ist F2 zählt nur aktive Positionen – Pläne auf deaktivierte Positionen blähen die Zuordnung/Prognosebasis nicht auf; finance-analyst-Befund M12); accountBalance/positionValue dagegen bewusst OHNE Aktiv-Filter (das Ziel referenziert die Referenz AUSDRÜCKLICH, das Ist wird trotz Deaktivierung mit sichtbarer Warnung berechnet); totalWealth/monthlySavingsRate/manual/ohne Kennzahl → null (keine eindeutige Zuordnung – die UI zeigt stattdessen die klar gekennzeichnete ALLGEMEINE eigene Sparleistung und behauptet nie, dass sie vollständig dem Ziel zufließt). **Doppelzählungs-Schutz:** Zielbezogene Werte werden NIE über Ziele summiert – dieselbe Rate kann mehreren Zielen zuordenbar sein (z. B. Positionsziel UND Depotziel).

**Übersichts-Kennzeichnungen (Pflicht):** Die Summen „Zielbeträge“/„verbleibend“ tragen immer den Hinweis „Bezugswerte können sich überschneiden (z. B. Depot ⊂ Gesamtvermögen) – keine addierbare Vermögensgröße“; eine Summe der IST-Werte wird bewusst NICHT angezeigt (irreführend bei Überschneidung). Bewusste Entscheidung (dokumentiert): Pausierte und manuell abgeschlossene Ziele bleiben in den Zielbetrags-/Rest-Summen enthalten (sie sind weiterhin Ziele; nur `archived` ist ausgeschlossen). Geglättete Sparleistungen sind immer als „geglättet (Analysewert)“ gekennzeichnet.

---

### Rebalancing-Bausteine (M11, 2026-07-20) – additiv

Alle Bausteine sind reine Funktionen in `src/finance/rebalancing.ts` (kein React, kein Systemdatum – wo ein Stichtag nötig ist, wird er injiziert). Sie sind **dünne Kompositionen ÜBER den bestehenden Formelkatalog-Funktionen** – keine Formel wird doppelt implementiert. Kein Ergebnis löst eine Aktion aus (Abschnitt 0/G1/G2).

**Keine Duplikat-Funktionsnamen (bewusste Entscheidung):** Die im Auftrag genannten Namen `calculateCurrentAllocation`/`calculateTargetAllocation`/`calculateDeviation`/`calculateDeviationEuro`/`calculateActionLevel` werden NICHT als eigene Funktionen angelegt – sie sind Bestandteile von `calculateRebalancingAnalysis`, das F5 (`share`), F11/F12 (`targetValues`), F13 (`deviationEur`), F14 (`deviationPp`), F15/F16 (`buy-`/`sellRequirement`) und `actionLevel` AUFRUFT. Gruppen-Gewichte (`refKind: "group"`) werden wie im Depot-Zielvergleich über `groupTotal` aufgelöst.

**Statuslabel-Mapping (A4, verbindlich – KEINE neue Schwelle):** Die vier Statusbegriffe des M11-Auftrags werden auf die DREI bestehenden `actionLevel`-Stufen abgebildet: `none` → „OK (nur Anzeige)“; `recommendation` → „Empfehlung – prüfen“; `recommendation-with-sale-option` → „Empfehlung – Rebalancing sinnvoll (inkl. Verkaufsoption als LETZTE Möglichkeit)“. **„beobachten“ erhält KEINE eigene Stufe** – eine vierte Schwelle wäre quellenlos (U1 definiert nur 5/10 Pp). Die T9-Regressionsfälle 3/6/12 Pp bleiben exakt gültig; die Verkaufsoption wird NUR bei Übergewichtung ≥ +10 Pp erwähnt und steht in jeder Formulierung an letzter Stelle der S2-Reihenfolge.

**Konjunktiv-Regel (verbindlich):** Jeder Empfehlungssatz beginnt mit „Wenn du deine Zielallokation annähern möchtest, könntest du …“ – nie „du solltest“, nie Imperative (Tests prüfen das wörtlich).

**Gesamtabweichung (M11-Definition):** `Gesamtabweichung = Σ Kaufbedarf (F15) = Σ Verkaufsbedarf (F16)` bei vollständiger Abdeckung; daneben wird immer die größte |Pp|-Abweichung ausgewiesen. Σ Kauf = Σ Verkauf ist S2-Pflichtprüfung; Differenzen (Rundung oder Abdeckungslücke) werden sichtbar ausgewiesen (F19), nie stillschweigend ausgeglichen. **A6:** Aktive bewertete Positionen OHNE Gewichtseintrag erhalten KEIN erfundenes Soll 0 – sie erscheinen namentlich als Abdeckungslücke; unbewertete Positionen fallen nach G11 („unbekannt“, nie 0) namentlich aus der Rechnung. Seed × Job-Profil: Gesamtabweichung 1.573,80444 €; größte Abweichung Telekom +44,27775 Pp.

**A1 – abgeleitetes flexibles Monatsbudget (`deriveFlexibleMonthlyBudget`):** Budget = Summe der Pläne mit **aktiv** (`isPlanActiveOn` am injizierten Stichtag), **`isFlexible !== false`**, **`flowType` ∈ {`own_fixed`, `own_variable`}**, **`interval === "monthly"`**, **`targetKind === "position"`** und **endlichem `amount` > 0**. Seed: 23 + 22 + 10 + 5 = **60,00** (Tagesgeld-/Konto-Pläne, ING-Umbuchung, Saveback/Round-up ohne Betrag und Telekom-Jahrespläne fallen korrekt heraus); mit pausiertem `sp-tr-gold` **55,00**. Budget 0 ist der definierte „keine Empfehlung“-Zustand. Die UI zeigt das Budget SAMT Herleitung (beitragende Pläne mit Beträgen).

**Sparraten-Vorschlag (`calculateSavingsOnlyRebalancing`):** Wrapper um F17/F18 (`proposeSavingsRates`): je Plan wird die Kaufbedarfslücke seiner Zielposition aus der Analyse gemappt; bei Gruppen-Gewichten wird die Gruppen-Lücke GLEICHMÄSSIG auf die empfangsberechtigten flexiblen Pläne der Gruppe verteilt (keine Doppelzählung in der proportionalen Verteilung – dokumentierte V1-Regel). `employer`/`provider` werden wie feste Pläne behandelt (F18: extern, nicht umlenkbar); variable Pläne (`amount: null`) sind nicht Teil des Vorschlags (Ist-Werte nur aus Buchungen). Zusätzlich `remainingAfterSavings`: die Verkaufsbedarfe der übergewichteten Positionen bleiben bestehen – **„Übergewichtungen sind ohne Verkäufe nicht abbaubar“ ist Pflicht-Kennzeichnung**. Seed-Pin: 23,84/22,00/10,65/3,52 → Ausgleich −0,01 an der größten Rate (SPDR 23,83), Endsumme exakt 60,00 (F19).

**Dauer-Schätzung (`estimateSavingsDuration`):** `CEIL(Σ Kaufbedarf ÷ Monatsbudget)` – reine Division, KEINE Rendite-/Kurs-/Zinsannahme (F22-Analogie); jede Anzeige trägt die Pflicht-Kennzeichnung **„ungefähr, ohne Kursentwicklung“** und den Zusatz, dass parallele feste Zuflüsse in übergewichtete Positionen (VL, Telekom-Jahresbeitrag) die tatsächliche Dauer verlängern können (finance-analyst M11 – die Schätzung ist bewusst eine Untergrenze). Budget ≤ 0 oder nicht endlich → null („keine Schätzung möglich“, F20 – nie NaN/Infinity); Kaufbedarf ≤ 0 → 0. Auch je Position: `CEIL(kauf_i ÷ rate_i)` bei Rate > 0. Seed: CEIL(1.573,80444 / 60) = **27 Monate**.

**VL-Vertragsbindungs-Hinweis (F16-Randfall, `isContractBoundPosition`):** Wird eine Position von einem NICHT-flexiblen EIGENEN Plan bespart (`isFlexible: false` + own_fixed/own_variable, z. B. der VL-Eigenanteil), ergänzt der Verkaufsoption-Satz den dokumentierten Hinweis „Verkauf real durch Vertragsbindung eingeschränkt – nur Hinweis". employer/provider-Pläne lösen den Hinweis nicht aus (sie binden den Zufluss, nicht den Bestand; Seed: VL ja, Telekom nein).

**V1-Randregeln des Sparraten-Vorschlags (dokumentiert):** Mehrere flexible monatliche Pläne auf DIESELBE Position würden deren Kaufbedarfslücke im F17-Nenner mehrfach gewichten – im Seed unerreichbar (variable Pläne haben amount null); die Gleichverteilung ist nur für Gruppen-Gewichte definiert. Die Vorfilterung (aktiv/monthly/amount > 0) ist Aufgabe des Aufrufers (API-Vertrag von `calculateSavingsOnlyRebalancing`, im Docstring ausgewiesen).

**Voll-Simulation (`calculateFullRebalancing`, A7):** hypothetisch – je bewerteter Position Kauf (F15) bzw. Verkauf (F16); die neue Verteilung IST die Zielverteilung (Restabweichung 0 per Definition); unbewertete/nicht abgedeckte Positionen bleiben als Rest ausgewiesen. **Reine Anzeige mit Pflicht-Kennzeichnung „Simulation – wird nie automatisch übernommen“; es wird NIE ein `simulations[]`-Eintrag erzeugt** (das ist M13-Territorium) und kein Übernahme-Button für Verkäufe angeboten.

**Profil-Leerzustände (M11-AK 4):** `savingsRate`-Profil ohne Gewichte (Ebene A, Seed-Standard) = „Die Referenz IST die aktuelle Verteilung – kein Bestands-Soll, kein Rebalancing-Bedarf berechenbar“; leere `holdings`-Profile (Ebene B/Eigene Aufteilung) = „nicht befüllt – es wird nicht gerechnet“; ungültige Gewichte (F21) = Fehlermeldung am Profil, KEINE Rechnung; Depotwert 0 = „nicht berechenbar“ (F20). Die Profilauswahl der Seite ist LOKAL und ändert nie `settings.activeTargetProfileId` (G5); Job-Profil-Hinweis: Aktivierung nur manuell, frühestens nach dem 30.09.2027 sinnvoll.

**Gespeicherte Planungen (G5, §3.10):** `addPlannedChange` nur nach ausdrücklicher Bestätigung inkl. Beträgen; `createdAt` = injiziertes ISO-Kalenderdatum (A2, ohne Uhrzeitanteil); Status `planned` („geplant, nicht ausgeführt“) bzw. additiv **`discarded`** („verworfen“ – `discardPlannedChange`, kein Löschen, keine Rücknahme in V1, A3). Gespeicherte Planungen ändern NIE Ist-Daten oder Sparpläne (M11-AK 2).

**Restpunkt (dokumentiert):** Der Depot-Zielvergleich (`DepotPage`) rechnet weiterhin über die Einzel-F-Funktionen – eine Konsolidierung auf `calculateRebalancingAnalysis` ist ein offener Verbesserungspunkt (keine fachliche Abweichung, identische Formeln).

---

### Simulations-Bausteine (M13, 2026-07-20) – additiv

Alle Bausteine sind reine Funktionen in `src/finance/projection.ts` (kein React, kein Systemdatum – der Stichtag wird IMMER injiziert). Sie sind Projektionen im Sinne von F22: **berechnen, vergleichen, anzeigen – kein Ergebnis löst eine Aktion aus** (Abschnitt 0). Simulationen speichern nur Parameter (§3.11), nie Ergebnisse, und ändern NIE Ist-Daten (einzige Schreib-Collection: `simulations[]`).

**Keine Duplikat-Funktionsnamen (M11-Präzedenz, dokumentiert):** Die Auftragsnamen `simulateNoGrowth`/`simulateConstantGrowth`/`projectSavings`/`projectTargets`/`projectWealth`/`projectLiquidity` werden NICHT als eigene Funktionen angelegt – sie sind Bestandteile von `simulateScenario`/`summarizeSimulation`; `projectNoGrowth` (F22) bleibt die 0-%-Referenz (Konsistenz-Pin: bei r = 0 ist die Reihe exakt der projectNoGrowth-Pfad, Endwert = Start + Σ Zuflüsse).

**startMonth-Konvention (KORREKTUR 2.1, verbindlich):** `startMonth` ist der Kalendermonat des ERSTEN PROJIZIERTEN Monats = **FOLGEMONAT des Stichtags** (F22: „Real (Start August 2026)“ bei Juli-Stichtag; `firstProjectionStartMonth(todayIso)`). Reihen-Index 0 ist der Startbestand im Stichtagsmonat, Index k der Stand nach k projizierten Monaten (`projectionMonthIso`). **Pflicht-Pin real 6 Monate: 777,59 / 3.122,47 / 3.900,06** (OHNE Juli-Ereignis – pinnt die Konvention; der 12-Monats-Pin 927,59 / 5.222,47 / 6.150,06 allein würde einen Off-by-one maskieren).

**Rechenregeln (`simulateScenario(params, startMonth)`):**

- **Monatsfaktor (geometrisch, dokumentiert):** `faktor = (1 + r)^(1/12)`; 12 Monate ergeben exakt (1 + r). Growth-Pin: 1.000 € Start, 12 Monate, 12 % p. a., keine Beiträge → **exakt 1.120,00**.
- **Nur-Depot-Verzinsung:** Verzinst wird AUSSCHLIESSLICH das Depot – es gibt keine Tagesgeld-Zinsannahme (dokumentierte V1-Regel; Tagesgeld wächst nur um seine Beiträge).
- **Monatsende-Beitragsregel (konservativ, dokumentiert):** je Monat wird erst der Bestand verzinst, DANN kommen die Beiträge dazu – Beiträge des Zuführungsmonats werden in diesem Monat nicht verzinst.
- **`target`-Feld je Beitrag:** `'depot'` (Default; fehlendes Feld in Altdateien = Depot – F22-kompatibel dokumentiert) oder `'cash'` (Tagesgeld). Umbuchungs-Zuflussarten (`reserve_transfer`/`liquidity_transfer`) sind in Simulations-Beiträgen UNZULÄSSIG (G7 – Umbuchungen sind kein Vermögenszufluss; Validierung lehnt ab).
- **Telekom-Jahresereignis (Konstante, 2.3):** `telekomMode 'real'` → implizites Jahresereignis Juli über **1.500 = 1.000 eigener Beitrag + 500 Arbeitgeberbonus** (T1/G7-Zählpunkt Equatex; `TELEKOM_ANNUAL_EVENT`). Die G8-Partition der Einzahlungssummen MUSS so aufteilen (eigen +1.000, gesamt +1.500). Bei `'smoothed'` gibt es das Ereignis NIE – die geglätteten 125 €/Monat (83,33 eigen + 41,67 Arbeitgeber) gehören als gekennzeichnete Analysewerte in die Beiträge (sonst Doppelzählung, G9/T5). **Restpunkt (dokumentiert):** die 1.500/1.000/500 sind eine benannte Konstante des Rechenkerns, kein konfigurierbares Feld – eine Parametrisierung wäre eine spätere Fachentscheidung.
- **G8-Partition:** eigene Sparleistung = Beiträge mit `own_fixed`/`own_variable` (+ 1.000-Anteil des Ereignisses); Gesamtzufluss = alle Beiträge (+ 1.500-Ereignis). Beide Summen werden getrennt geführt und nie vermischt. Seed-Pin real 12 Monate: eigen 2.422,00 (12 × 118,50 + 1.000), gesamt 3.000,00 (12 × 125 + 1.500).
- **Grenzen (Validierung Datenlayer + Ladeprüfung + UI):** `months` Ganzzahl 1–1200 (harte Obergrenze 100 Jahre gegen UI-Sprengung); `annualReturnRate` ∈ [0; 0,15] (Eingabe 0–15 %; **negative Renditeannahmen sind in V1 bewusst NICHT zulässig** – Bereich laut Auftrag, dokumentierter Konflikt-Ausweis); Startwerte/Beiträge ≥ 0 und endlich; NaN/Infinity → Ablehnung. **Warnung ab > 8 % („sehr optimistische Annahme“) ist WARNUNG, nie Fehler** (requirements „Warnung bei Extremwerten“; Ladeprüfung `W_RETURN_ASSUMPTION`).

**Vorbelegungen (Auflage 2.4, flowType-getrennt – nur Formular-Befüllung, nie automatisch gespeichert):** real: 93,50 eigen + 6,50 Arbeitgeber (Depot) + 25 eigen (Tagesgeld) + Ereignis über `telekomMode 'real'`; geglättet ZEILENWEISE 33,50 eigen (VL) + 6,50 Arbeitgeber + 60 eigen (ohne VL) + 83,33 eigen + 41,67 Arbeitgeber (beide „geglättet (Analysewert)“, G9) + 25 eigen (Tagesgeld) – **KEINE Sammelzeile „225 eigen“** (sie würde Arbeitgeberanteile als eigen ausweisen, G8-Verfälschung). Variable Zuflüsse ohne festen Betrag (Saveback/Round-up) sind nie enthalten (nicht garantiert, F22).

**`summarizeSimulation(result)`:** Endwerte (Depot/Tagesgeld/Gesamt), eingezahlt gesamt vs. eigen (G8-getrennt) und der **rechnerische Wertzuwachs aus der Annahme** = Endwert − Start − Einzahlungen, NUR bei r > 0 (bei r = 0 null – als „rechnerischer Wertzuwachs aus der Annahme“ gekennzeichnet, keine Prognose).

**Zielanalyse (`goalReachMonthInSeries`/`analyzeGoalsInSimulation`):** Projizierbar sind NUR die Aggregat-Kennzahlen `tagesgeld`/`depotValue`/`totalWealth`; `accountBalance`/`positionValue`/`manual`/`monthlySavingsRate` → **„keine Aussage möglich“** mit Begründung „nicht Teil des Aggregatmodells“. Notgroschen über `effectiveGoalTarget` (Override-Vorrang). Status je Ziel (IMMER mit Begründungssatz „weil …“ inkl. Erreichungsmonat, Zieltermin, Horizont bzw. Kennzahl): **erreichbar** (Erreichungsmonat ≤ Horizont und ≤ Zieltermin auf Monatsebene, falls gesetzt) / **voraussichtlich verspätet** (im Horizont, aber nach dem Zieltermin) / **im Horizont nicht erreicht** / **keine Aussage möglich**. Archivierte und pausierte Ziele sind ausgenommen (dokumentiert). Pflicht-Kennzeichnung in jeder Anzeige: „Projektion mit Annahme – keine Prognose“.

**Vergleich (`compareSimulations`):** ab 2 Simulationen (sonst null, definierter Zustand): Endvermögen/Depot/Liquidität, eingezahlt gesamt + eigen, Annahmen (Monate, Rendite, Telekom-Sicht); `viewsMixed` = reale und geglättete Sicht gemischt → **Pflicht-Hinweis in der Anzeige** (G9 – Sichten bleiben getrennte Betrachtungen); der Zielerreichungs-Kurzstatus je Simulation kommt aus `analyzeGoalsInSimulation`.

**Kennzeichnungstexte (2.6, exakt nach requirements):** r = 0 → „Projektion ohne Kursentwicklung“; r > 0 → „Projektion mit Annahme X % p. a. – keine Prognose, keine Anlageberatung“.

**Konflikt-Ausweise (Spezifikation §1, bewusste Entscheidungen):**

- **Inflationsannahme: NICHT implementiert** – requirements M13 („keine Inflationsmodellierung in V1“) ist die ranghöhere Projektquelle; kein stilles Feld.
- **Rebalancing an/aus + Zielprofil: NICHT simuliert** – das Modell ist ein Aggregatmodell (Depot + Tagesgeld); Rebalancing verschiebt nur INNERHALB des Depots und ändert die projizierten Aggregate nicht (ein Schalter ohne Rechenwirkung wäre Scheinfunktion; Zielprofil-Vergleiche liefert M11; Annahmen gehören ins `note`-Feld).
- **Negative Rendite: NICHT zulässig** – Bereich 0–15 % laut Auftrag; dokumentiert statt still erweitert.
- **Kein Start-/Enddatum-Feld** – der Zeitraum bleibt `months` ab dem injizierten Stichtag; die Anzeige „ab <Monat>, n Monate (bis <Endmonat>)“ wird berechnet, nie gespeichert.
- **DM9/G9-Ausnahme (2.5, ausdrücklicher Ausweis):** gespeicherte smoothed-PARAMETER (z. B. Beiträge 83,33/41,67 in einer Simulation) sind zulässig, WEIL `telekomMode 'smoothed'` die G9-Kennzeichnung strukturell im Datensatz trägt – die DM9-Regel (keine geglätteten Werte in Ist-Datenfeldern) bleibt für alle Ist-Collections unverändert streng; ohne diesen Ausweis wäre das ein stiller Regelbruch.
- **G9-Grauzone (dokumentierte Nutzerverantwortung):** Wer bei `telekomMode 'real'` ZUSÄTZLICH von Hand geglättete Telekom-Zeilen (83,33/41,67/125) in die Beiträge einträgt, erzeugt eine Doppelzählung (Ereignis + Glättung im selben Szenario). Eine harte Prüfung ist nicht möglich – Beiträge sind freie Beträge, und 83,33 € kann auch eine echte Rate sein. Der Schutz liegt in den Vorbelegungen (setzen Modus und Zeilen immer konsistent) und den Formular-/Modus-Hinweisen („125 €/Monat gehören in die Beiträge, KEIN Jahresereignis“ bzw. umgekehrt).

**Dokumentierte Grenzen der Schreibseite/UI (Prüfkette M13 N3/N4):**

- **Bearbeiten normalisiert auf 2 Nachkommastellen:** Das Formular zeigt Beträge und die Rendite-Prozenteingabe im de-DE-Format mit maximal 2 Dezimalstellen (`parseGermanAmount`-Grenze aus M8). Von Hand in die JSON-Datei geschriebene Werte mit mehr Dezimalen (z. B. `annualReturnRate: 0.0833`, Beitrag `83.333`) bleiben beim LADEN und Anzeigen exakt erhalten, werden aber beim BEARBEITEN über das Formular auf 2 Nachkommastellen gerundet gespeichert.
- **Bearbeiten ersetzt die Beitragsliste vollständig:** Unbekannte Zusatzfelder INNERHALB einzelner `monthlyContributions`-Einträge überleben Laden/Speichern (Rundreise) und Kopieren, gehen aber beim Bearbeiten über das Formular verloren (die Liste wird aus den Formularzeilen neu aufgebaut). Zusatzfelder auf Simulations-Ebene bleiben in allen Fällen erhalten (Regel 16).
- **Namens-Trim auch bei reinen params-Patches:** `updateSimulation` speichert den Namen immer getrimmt – ein handeditierter Name mit umgebenden Leerzeichen wird auch dann normalisiert, wenn nur Parameter geändert werden (gleiche Normalisierungslinie wie die 2-Dezimal-Rundung; Reviewer M13 K-1).

---

### Einstellungs-Bausteine (M14, 2026-07-20) – additiv

Alle Einstellungs-Regeln sind reine Funktionen ohne React (`src/data/settings.ts`, `src/storage/autoBackup.ts`); die Seite zeigt ausschließlich berechnete Werte an und speichert NIE Berechnungsergebnisse (Abschnitt 0).

**Keine Duplikat-Funktionsnamen (M11/M13-Präzedenz, dokumentiert):** Die Auftragsnamen `calculateEmergencyFund`/`effectiveEmergencyFund` SIND `effectiveEmergencyFundTarget` (§7, M12 – die einzige Notgroschen-Formel; „berechnet“ = Aufruf mit entfernter Übersteuerung, nie eine zweite Formel); `validateBackup`/`validateImport` SIND `parseFinanceJson`/`validateFinanceData` (eine Sicherungsdatei IST eine vollständige Finanzdatei); `createBackup`/`restoreBackup` = vorhandener `backupDownload` + Import-Flow (Wiederherstellung = Import einer Sicherung mit Vorschau und Bestätigung, G10 – kein neuer Kanal). Neu ist NUR `updateSettings` (K2-Teil-Patch) und `shouldAutoBackup`.

**Override-/Reset-Regeln (§7/T7, M12-konsistent):**

- Wirksames Notgroschen-Ziel = `manualOverrideAmount ?? factor × netIncomeMonthly` (unverändert §7; Seed 4 × 1.170 = 4.680).
- Übersteuerung setzen (nur > 0, G12-Bestätigung mit BEIDEM: manuellem und berechnetem Wert) und Rücksetzen (= `null`; G12-Bestätigung mit beiden Werten) sind ausdrückliche Nutzeraktionen; eine Faktor-/Netto-Änderung ändert NIE einen gesetzten manuellen Wert (T7 – die Seite zeigt nur den neuen berechneten Wert als Vorschau).
- Warnhinweis (reine Anzeige): Übersteuerung < berechnetem Wert → „liegt unter der Empfehlung Faktor × Netto“; Faktor-Randwerte 3/5 → Rand-Hinweis.
- K2/A7: Rücksetzen materialisiert den optionalen Schlüssel nie neu; ein vorhandener Schlüssel bleibt als `null` erhalten (Byte-identisches Speichern).

**Budget-Warnung (M10-Restpunkt eingelöst, S2):** Auf der Seite „Sparpläne“ erscheint eine WARNUNG (Text + Symbol, NIE blockierend), wenn die eigene feste monatliche Sparleistung **F8 real** (`ownMonthlySavings(aktive Pläne, 'realMonthly')` – exakt die bestehende Kennzahl, keine zweite Summe) das in den Einstellungen hinterlegte `monthlySavingsBudget` **strikt überschreitet** (`ownReal > budget`; Budget exakt erreicht ⇒ keine Warnung). `null` = „offen“ ⇒ keine Prüfung. Die Warnung ändert nichts und blockiert nichts (G1/G2).

**Auto-Backup-Regel (M5, Auflagen A2–A5):** `shouldAutoBackup(mode, lastBackupDayIso, todayIso)`: `'everySave'` und **fehlender Modus (Default `everySave`, KORREKTUR Nr. 3)** → immer true; `'dailyFirstSave'` → nur wenn `lastBackupDayIso ≠ todayIso` (Tagesmerker = localStorage-Gerätemarke, Tagesgranularität). Ausgelöst NUR nach erfolgreichem direktem Speichern; das Backup ist Byte-identisch zum geschriebenen Serialisat (A2); Fehler erzeugen nur einen Hinweis (A3); Download-Fallback/Abbruch/Schreibfehler lösen kein Backup aus (A4); `retentionCount` ist reine Empfehlungs-Anzeige (Downloads nicht durchsetzbar).

**percentDecimals (F19-Bezug):** Ganzzahl 0–4 (schreibseitig UND Ladeverschärfung mit §6-Ausweis, A6) – alle `formatShare`-Anzeigen nutzen den Wert; die Einstellungs-Seite zeigt eine reine Format-Vorschau (Beispielwert 0,8008 – kein Finanzwert).

**Konflikt-Ausweise (bewusste Entscheidungen, dokumentiert):**

- **Profilbearbeitung: NICHT in V1.** Der Nutzerauftrag §6 („nur Auswahl“) schlägt das requirements-„bearbeiten“ – Zielprofile werden in M14 ausschließlich AUSGEWÄHLT (G12-Bestätigung; Job-Profil vor 2027-10-01 zusätzlich sichtbar UND im Bestätigungsdialog gewarnt, injizierter Stichtag, A8). Profilbearbeitung/„Eigene Aufteilung befüllen“ = Restpunkt für V1.x. Die Rebalancing-Seite behält ihre LOKALE Analyse-Auswahl – die globale Aktivierung ändert dort nichts automatisch.
- **CSV: NICHT in V1** (requirements „optional“ – bewusst nicht eingelöst); PDF/Cloud: nie (Nicht-Ziele).
- **i18n: NICHT in V1.** „Sprache/Datumsformat/Währungsformat vorbereiten“ = das VORHANDENE `display.numberLocale` wird als feste read-only-Zeile gezeigt („de-DE/EUR/TT.MM.JJJJ – fest in V1“); es gibt KEINEN Schreibpfad (A7), und ein abweichend gespeicherter Wert hätte keine Wirkung (die Anzeige sagt das ausdrücklich).
- **Keine „aus“-Option für Auto-Backups** (das Enum kennt keinen Aus-Zustand – bewusste V1-Grenze, Default `everySave`).
