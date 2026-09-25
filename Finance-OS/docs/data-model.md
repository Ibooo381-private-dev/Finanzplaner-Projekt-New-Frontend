# Finance OS – JSON-Datenmodell (schemaVersion 1)

Stand: 2026-07-19. Entworfen durch den Subagenten **data-architect**, fachlich gegengeprüft durch den Subagenten **finance-analyst**, unter Anwendung der Skills `finance-rules`, `rebalancing` und `quality-check`.
Grundlagen: `docs/requirements.md` (M1–M14, G1–G12), `docs/calculation-rules.md` (Zuflussarten, Formeln, T1–T9), `docs/investment-source-map.md` Version 3 (U1/U2).

Grundsätze: Beträge als Zahlen in EUR (Währung zentral in `metadata.currency`), fachliche Datumswerte als ISO `YYYY-MM-DD`, technische Zeitstempel als volle ISO-8601-Zeit, Prozent-/Gewichtswerte als Dezimalzahlen (0,15 = 15 %), eindeutige stabile IDs, keine dauerhafte Speicherung zuverlässig berechenbarer Werte, keine unnötigen personenbezogenen Daten (keine IBANs, keine Zugangsdaten; Halbwaisenrente wird nicht modelliert).

---

## 1. Top-Level-Struktur

| Schlüssel | Pflicht | Inhalt |
|-----------|---------|--------|
| `schemaVersion` | ja | Ganzzahl, in Version 1 fest `1` |
| `metadata` | ja | Datei-Identität, zentrale Währung, Beispieldaten-Kennzeichnung |
| `settings` | ja | Fachliche Konfiguration (M14) |
| `accounts` | ja | Konten mit Saldo-Zeitreihe (M8) |
| `portfolioPositions` | ja | Depotpositionen mit Wert-Zeitreihe (M9) |
| `snapshots` | ja | Register kohärenter, datierter Erfassungen (G3/G4) |
| `savingsPlans` | ja | Normative Sparplan-Stammdaten (M10) |
| `targetProfiles` | ja | Zielprofile (M11) |
| `goals` | ja | Finanzielle Ziele (M12) |
| `transactions` | optional (Default `[]`) | Datierte Ist-Zuflüsse; startet leer, wird in V1 durch M10 befüllt |
| `plannedChanges` | optional (Default `[]`) | Per Bestätigung gespeicherte Empfehlungen (G5) |
| `simulations` | optional (Default `[]`) | Gespeicherte Simulator-Szenarien (M13), strikt getrennt von Ist-Daten |
| `fixedCosts` | optional (Default `[]`) | Reserviert; Struktur ab schemaVersion ≥ 2 |
| `monthlyClosings` | optional (Default `[]`) | Reserviert; Struktur ab schemaVersion ≥ 2 |
| `journalEntries` | optional (Default `[]`) | Reserviert; Struktur ab schemaVersion ≥ 2 |
| `importHistory` | ja | Technisches Protokoll von Import/Migration (max. 50 Einträge, ältester fällt weg) |

Fehlende optionale Arrays lädt der Loader als `[]`; der Writer schreibt sie immer als Arrays (stabile Rundreise). Inhalte der reservierten Arrays werden in V1 unverändert durchgereicht, nie interpretiert, nie gelöscht. **Unbekannte Zusatzfelder sind auf jeder Ebene erlaubt und überleben Laden + Speichern unverändert.**

## 2. ID-Konvention

- Kleinbuchstaben-Kebab-Case mit Entitätspräfix: `acc-`, `pos-`, `snap-`, `sp-`, `tp-`, `goal-`, `tx-`, `plan-`, `sim-`, `imp-`; sprechend aus dem Namen abgeleitet (`acc-vw-tagesgeld`, `pos-spdr-world-acc`), bei Kollision Suffix `-2`, `-3`.
- IDs werden genau einmal bei Anlage erzeugt und ändern sich danach **nie** – nicht bei Umbenennung, nicht bei Export/Import, nicht bei Migration. Referenzen zeigen ausschließlich auf IDs, nie auf Namen. Eindeutigkeit gilt dateiweit.

## 3. Entitäten

### 3.1 `metadata`

| Feld | Pflicht | Typ / Regel |
|------|---------|-------------|
| `appName` | ja | String, `"Finance OS"` |
| `createdAt`, `updatedAt` | ja | ISO-8601-Zeitstempel |
| `currency` | ja | In V1 fest `"EUR"` – zentrale Währungsfestlegung (S1) |
| `isExampleData` | nein (Default `false`) | `true` kennzeichnet Beispiel-/Startvorlagen eindeutig |
| `description` | nein | Freitext (z. B. Herkunft der Startvorlage) |

### 3.2 `settings`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `emergencyFund.factor` | ja | Zahl ∈ [3; 5], Standard 4 |
| `emergencyFund.netIncomeMonthly` | ja | Zahl > 0 (aktuell 1.170) |
| `emergencyFund.manualOverrideAmount` | nein | Zahl > 0 oder `null` (= berechneter Wert `factor × netIncomeMonthly` gilt); ein gesetzter Override wird durch Neuberechnung nie ungefragt ersetzt |
| `monthlySavingsBudget` | nein | Zahl ≥ 0 oder `null` (= keine Budgetwarnung in M10/M11) |
| `backup` | nein | `{ mode, retentionCount }`; `mode`: `"everySave"` \| `"dailyFirstSave"` (Default `"everySave"` – ein FEHLENDER `mode` WIRKT als `everySave`, wird aber nie materialisiert, K2; es gibt bewusst KEINEN „aus“-Zustand, V1-Grenze), `retentionCount` Ganzzahl ≥ 1, Default 10 (reine Empfehlungs-Anzeige, M5) |
| `display` | nein | Default `{ "numberLocale": "de-DE", "percentDecimals": 2 }`; `percentDecimals` **Ganzzahl 0–4** (M14-Verschärfung, §6); `numberLocale` hat in V1 KEINEN Schreibpfad – die App rendert unabhängig vom gespeicherten Wert durchgehend de-DE/EUR/TT.MM.JJJJ (Vorbereitung, M14) |
| `activeTargetProfileId` | nein | ID eines Zielprofils oder `null`. **Einwertiges Feld – garantiert strukturell höchstens ein aktives Profil.** Kein `isActive`-Flag am Profil (ein Zustand, ein Speicherort). Aktivierung nur manuell mit Bestätigung (G5); Job-Profil vor 2027-10-01 mit zusätzlichem Warnhinweis (M14) |

**localStorage-Gerätemarke (M14, KEIN Dateifeld):** Der Tagesmerker des letzten automatischen Sicherungs-Downloads eines Geräts (`financeos.lastAutoBackupDay`, Wert JJJJ-MM-TT) liegt bewusst NICHT in der JSON-Datei, sondern als unkritische Gerätemarke in localStorage (Allowlist `src/state/localStoragePolicy.ts`): Er ist geräte-/browserspezifisch (dieselbe Datei kann auf mehreren Geräten geöffnet werden) und sein Verlust kostet höchstens ein zusätzliches Backup – nie Daten. Er steuert nur den Modus `dailyFirstSave` und die Statuszeile der Einstellungen; alle Zugriffe laufen über try/catch (Privatmodus degradiert sicher zum everySave-Verhalten). Die manuelle Sicherung wird davon nie gegated.

### 3.3 `accounts[]`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `name` | ja | – |
| `institution` | nein | String |
| `type` | ja | `"giro"` \| `"tagesgeld"` \| `"depot"` \| `"cash"` \| `"bargeld"` \| `"sonstiges"` \| `"ruecklage"` \| `"krypto"` \| `"pension"` (Nachtrag 2026-07-19, siehe §6) |
| `earmark` | nein | `"shares2you"` \| `null` (Zweckbindung) |
| `countsAsFreeLiquidity` | nein | Default nach `type`: `giro`/`cash`/`bargeld` → `true`, sonst `false`. ING-Rücklage und VW-Tagesgeld: `false` |
| `includeInInvestedWealth` | nein | Nur für `type: "krypto"` relevant; Default `false` (Aufnahme zurückgestellt, U1) |
| `allowNegativeBalance` | nein | Default `false`; nur mit `true` sind negative Salden gültig (Girokonto) |
| `isActive` | nein (Default `true`) | Nachtrag 2026-07-19 (Modul Konten, §6): `false` = Konto deaktiviert – es fließt in **keine** Summe/Kennzahl ein, bleibt aber sichtbar gelistet (Status „inaktiv“) |
| `purpose` | nein (Default `null`) | Nachtrag 2026-07-19 (Modul Konten, §6): Freitext-Zweck des Kontos (z. B. „Notgroschen“) |
| `balanceHistory` | ja | Array `{ date: "YYYY-MM-DD", amount: Zahl }`, ggf. leer (Saldo unbekannt, G11 – zählt dann nicht als 0; die Kennzahl erhält den Hinweis „enthält Konten ohne erfassten Saldo“) |
| `needsReview`, `note` | nein | „zu prüfen“-Kennzeichen (G11) bzw. Freitext |

Kennzahlen-Zuordnung der 2026-07-19 ergänzten Typen: `bargeld` verhält sich wie `giro`/`cash` (`countsAsFreeLiquidity`-Default `true`; zählt zum Finanzvermögen); `sonstiges` hat `countsAsFreeLiquidity`-Default `false` und zählt zum Finanzvermögen (siehe §4).

Verbindliche Kontenabgrenzung: **Trade Republic ist zwei Konten** – `acc-tr-cash` (`type: "cash"`, Ausgabenkonto, nie Depotvermögen, G6) und `acc-tr-depot` (`type: "depot"`). **Tagesgeldkonten (`type: "tagesgeld"`) sind klar von Depotpositionen getrennt** und gehen nie in den Depotnenner ein (S1/S2). Depot-Konten haben **keine eigene Saldo-Historie** (leer): Der Depotwert ist immer die Summe der Positionswerte – eine parallele Historie wäre ein redundanter berechneter Wert. `pension`-Konten sind Merkposten und zählen in keine Kennzahl.

### 3.4 `portfolioPositions[]`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `name` | ja | – |
| `isin` | nein | String oder `null` (unbekannt – nie erfinden; Telekom: `null`, in den Quellen nicht bestätigt) |
| `accountId` | ja | Muss auf ein Konto mit `type: "depot"` zeigen |
| `assetClass` | nein | `"etf"` \| `"etc"` \| `"stock"` |
| `group` | ja | `"world"` \| `"em"` \| `"gold"` \| `"telekom"` – Grundlage für „MSCI World gesamt“ (berechnet, nie gespeichert) und Profil-Referenzen |
| `isVL` | nein | Default `false` |
| `isActive` | nein (Default `true`) | `false` = Position deaktiviert – fließt in keine aktive Summe/Kennzahl ein (F2/F5/F6/F7, W4-Erwartung); bleibt sichtbar (Status „inaktiv“); `valueHistory` bleibt erhalten und pflegbar. Kein Löschen von Positionen in V1 (stabile Referenzen). |
| `valueHistory` | ja | Array `{ date, value }` |
| `needsReview`, `note` | nein | – |

### 3.5 `snapshots[]` (Entscheidung: Top-Level-Registry)

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `date` | ja | `date` dateiweit eindeutig |
| `locked` | ja | `true` = unveränderlich (G3) |
| `label`, `source` | nein | `source`: `"seed"` \| `"user"` \| `"import"` (Default `"user"`) |

Ein Snapshot speichert **nur Metadaten**; die zugehörigen Werte sind alle `balanceHistory`-/`valueHistory`-Einträge mit exakt diesem Datum (keine Doppelspeicherung, „aktuelle Werte nicht mehrfach speichern“). Begründung gegen Einzel-`locked`-Flags: M4 braucht die Snapshot-Anzahl in der Importvorschau, M9 den Snapshot-Vergleich und den als Einheit geschützten Seed – die Registry macht den Snapshot zur adressierbaren Entität. G3/G4 werden zu einer Regel: Einträge, deren Datum einem `locked`-Snapshot entspricht, sind unveränderlich, **und an einem gesperrten Datum dürfen auch keine neuen Historien-Einträge nachträglich angelegt werden** (sonst ließe sich der Inhalt eines gesperrten Snapshots stillschweigend erweitern). Neue Werte sind immer neue datierte Einträge. Einzel-Saldoaktualisierungen (M8) bleiben ohne Snapshot möglich; die M9-Vollerfassung (`captureSnapshot`, `source: "user"`, `locked: true` ab Speicherung) erzeugt einen Registry-Eintrag. **Vollständigkeit (W4-Neufassung, Modul Depot):** Die M9-Vollerfassung und die Ladeprüfung W4 erwarten zum Snapshot-Datum Einträge für alle **aktiven** Positionen und alle **aktiven** Tagesgeldkonten; Einträge inaktiver Positionen/Konten am Snapshot-Datum sind legitime Historie und erzeugen weder Fehler noch Warnung. Unvollständige Snapshots erzeugen beim Laden eine Warnung (kein Fehler). **Bekannte, dokumentierte Folge (Reviewer-Befund M9):** W4 bewertet „aktiv“ zum Ladezeitpunkt – eine NACH einem Snapshot neu angelegte (oder reaktivierte) Position lässt ältere, gesperrte Snapshots dauerhaft als „unvollständig“ warnen, und die Warnung ist wegen der Datumssperre (Regel 15) nicht auflösbar. Das ist eine reine Warnebene ohne Datenrisiko; eine Präzisierung (Position nur erwarten, wenn ihr ältester Historieneintrag ≤ Snapshot-Datum) wäre eine spätere data-architect-Entscheidung. Seed: `snap-2026-07-17` (`locked: true`, `source: "seed"`).

### 3.6 `savingsPlans[]`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `name` | ja | – |
| `targetKind`, `targetId` | ja | `"position"` \| `"account"`; Referenz muss passend existieren |
| `amount` | ja* | Zahl ≥ 0; `null` **nur** bei `flowType` ∈ {`own_variable`, `provider`} (variabel, nicht garantiert) – **nie bei `interval: "once"`** (M10: ein einmaliger Zufluss braucht immer einen Betrag) |
| `interval` | ja | `"monthly"` \| `"yearly"` \| `"quarterly"` \| `"halfyearly"` \| `"once"` (additive Erweiterung M10, §6) |
| `dueMonth` | nein | Nur bei `interval: "yearly"`: Monat der realen Fälligkeit (1–12) oder `null`; Grundlage der realen Jahressicht (G9); Telekom: 7 (Juli, belegt über Sparergänzungs-Abbuchung 17.07.). **Verschärfung M10 (2f):** Ein NUMERISCHES `dueMonth` bei anderem Intervall ist ein Ladefehler; `null`/fehlend bleibt überall gültig |
| `flowType` | ja | Genau **eine** Zuflussart: `"own_fixed"` \| `"own_variable"` \| `"employer"` \| `"provider"` \| `"reserve_transfer"` \| `"liquidity_transfer"` (Taxonomie aus `calculation-rules.md` Abschnitt 1) |
| `isFlexible` | nein | Default `true`. Die U1-Regel „Telekom nicht automatisch als nicht flexibel verdrahten“ betrifft den **umlenkbaren Eigenbeitrag** (`sp-telekom-eigen`: `true`). Vertraglich fixe Pläne (VL) und nicht umlenkbare Arbeitgeber-/Anbieterflüsse dürfen als `false` vorbelegt werden; jede weitere `false`-Setzung nur durch ausdrückliche Nutzerentscheidung |
| `minAmount` | nein | `null`; bei `isFlexible: false` gesetzt (S2: Mindestbeträge einhalten) |
| `validFrom` | ja | ISO-Datum. **Konvention (M10, 2e): `validFrom` ist der ERSTE Ausführungstermin** – bei `quarterly`/`halfyearly` läuft der Fälligkeitszyklus ab dem `validFrom`-Monat (+3 bzw. +6 Monate), Zahltag = `validFrom`-Tag mit Monatsende-Klemmung (31. → 30./28./29., Schaltjahre korrekt); bei `once` ist `validFrom` das Ausführungsdatum selbst |
| `validUntil` | nein | ISO-Datum ≥ `validFrom` oder `null` (unbefristet). **`once`-Regel (M10, 2a):** `null` ODER = `validFrom` (tolerante Ladeprüfung); der Datenlayer normalisiert beim Anlegen immer auf `validFrom` und zieht bei `validFrom`-Änderungen ein gesetztes `validUntil` mit |
| `isPaused` | nein | Additiv (M10): `true` = pausiert – der Plan zählt in KEINE Kennzahl (`isPlanActiveOn` liefert `false`, F8/F9 schließen ihn automatisch aus), bleibt aber gelistet. Default `false` (fehlt in Altdateien = nicht pausiert). **Dokumentierte Grenze (2c):** Momentzustand OHNE Pausenhistorie – `realAmountInMonth` liefert für pausierte Pläne 0 unabhängig vom Monat und ist deshalb NUR für Monate ≥ Stichtagsmonat einzusetzen; die Vergangenheit kommt ausschließlich aus `transactions`. Strikte Prüfung `isPaused === true` |
| `needsReview`, `note` | nein | – |

**Abgeleiteter Status (M10, nie gespeichert; verbindliche Rangfolge 2b):** (1) abgeschlossen = `once` UND `validFrom` < Stichtag; (2) beendet = `validUntil` < Stichtag; (3) pausiert = `isPaused === true`; (4) geplant = `validFrom` > Stichtag; (5) aktiv. `validUntil` = Stichtag ist noch aktiv; `once` mit `validFrom` = Stichtag ist aktiv. Sparpläne werden NIE gelöscht (stabile Bezüge aus `transactions.savingsPlanId` und Historie) – nur beendet (`validUntil`) oder pausiert.

**Herkunfts-Mapping (M10, KEIN eigenes Feld):** eigenes Geld = `own_fixed`/`own_variable`; Arbeitgeberleistung/Bonus/Zuschuss = `employer`; Aktion/Cashback/sonstiger externer Zufluss = `provider`; Umbuchungen = `reserve_transfer`/`liquidity_transfer` (weder eigen noch extern, zählen NIE in Summen, G7). **`provider`-Abgrenzung (2d):** nur echtes Geld von Bank/Broker/Anbieter – andere Dritte (z. B. Geldgeschenke) werden in V1 NICHT in `provider` gepresst (nicht modelliert). Regelmäßigkeit ist abgeleitet: regelmäßig = `interval` ∈ {monthly, quarterly, halfyearly, yearly} mit `amount` ≠ null; variabel = `amount` null; einmalig = `interval` "once".

Verbindliche Modellierung (U1/U2): VL als **zwei** Einträge (33,50 `own_fixed` + 6,50 `employer`); Telekom als **zwei** Jahres-Einträge (1.000 `own_fixed` yearly + 500 `employer` yearly) – die geglätteten Werte 83,33 / 41,67 / 125 werden **nie gespeichert**, immer berechnet (G9); Saveback (`provider`) und Round-up (`own_variable`) als **getrennte** Einträge mit `amount: null` (G8); ING 75 €/Monat als `reserve_transfer` (Umbuchung, keine Sparleistung, G7). Feste TR-Sparrate: 23 + 22 + 10 + 5 = 60 €.

### 3.7 `transactions[]` (Entscheidung: Ist-Zuflüsse hier, nicht als `actuals[]` im Plan)

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `date` | ja | – |
| `amount` | ja | Zahl > 0 |
| `flowType` | ja | wie 3.6 – genau eine Zuflussart pro Buchung (erzwingt G8 strukturell) |
| `targetKind`, `targetId` | ja | wie 3.6 |
| `savingsPlanId` | nein | Referenz auf den auslösenden Plan oder `null` |
| `note` | nein | – |

Begründung: Die Projektdokumente nennen Ist-Zuflüsse durchgehend „Buchungen“ (T3: „zwei getrennte Buchungen“); unregelmäßige eigene Zusatzkäufe haben keinen Plan als Anker; das spätere Monatsfinanzen-Modul (V2+) braucht ohnehin eine Buchungsstruktur – so entsteht sie am richtigen Ort. `transactions` startet leer und wird bereits in V1 durch M10 befüllt (tatsächliche Saveback-/Round-up-Beträge, Telekom-Jahresbuchungen). Regel: `reserve_transfer`/`liquidity_transfer` nur auf Konten (`targetKind: "account"`), nie auf Positionen.

**Bewusste V1-Einschränkung (Abflüsse):** `transactions` bildet in V1 ausschließlich **Zuflüsse** ab (`amount > 0`, ein Ziel, kein Quellkonto). Entnahmen (z. B. die jährliche 900-€-Entnahme aus der ING-Rücklage), Verkäufe und Rebalancing-Umschichtungen werden in V1 über die Saldenpflege (M8, neuer `balanceHistory`-Eintrag) bzw. neue Snapshots (M9) abgebildet, nicht als Buchung. Eine vollständige Buchungsstruktur mit Quell-/Zielkonto kommt mit dem Monatsfinanzen-Modul (schemaVersion ≥ 2). Die T1-Erwartung „Rücklage nach Zyklus = Startwert“ wird in V1 deshalb über die Kontosalden geprüft, nicht aus Buchungen hergeleitet.

### 3.8 `targetProfiles[]`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `name` | ja | – |
| `kind` | ja | `"student-sparplan"` \| `"student-bestand"` \| `"job"` \| `"custom"` |
| `basis` | ja | `"savingsRate"` \| `"holdings"` |
| `level1` | nein | `{ depotShare, cashShare }` als Dezimalzahlen, Summe 1,0 ± 0,001; Job: 0.85/0.15 |
| `weights` | nein | Array `{ refKind: "position"\|"group", ref, weight ∈ [0;1] }` oder `null`; befüllt muss Σ = 1,0 ± 0,001 gelten (Differenz sichtbar ausweisen). `null`/leer = „nicht befüllt“ – gültig, aber es wird nicht gerechnet (M11-AK 4) |
| `note` | nein | – |

Seed-Profile: `tp-student-sparplan` (Ebene A; Referenz = aktive `savingsPlans`, Gewichte werden daraus berechnet, nicht gespeichert), `tp-student-bestand` (Ebene B; bewusst leer, nutzereditierbar), `tp-job` (normativ: VL 0.048, Xtrackers Dist 0.31, SPDR Acc 0.342, EM IMI 0.15, Gold 0.05, Telekom 0.10 → World gesamt 0.70 berechnet; Kontrolle 0.048 + 0.31 + 0.342 + 0.15 + 0.05 + 0.10 = 1.0 ✓), `tp-custom` („Eigene Aufteilung“, leer, frei editierbar).

### 3.9 `goals[]`

| Feld | Pflicht | Regel |
|------|---------|-------|
| `id`, `name`, `status` | ja | `status`: `"active"` \| `"deferred"` \| `"reached"` \| `"archived"` (M12-Nachtrag, §6) |
| `targetAmount` | nein | Zahl > 0 oder `null` (= offen, nichts erfinden) |
| `targetDate` | nein | ISO-Datum oder `null`; falls `startDate` gesetzt: `targetDate` ≥ `startDate` (Ladefehler sonst) |
| `metric` | nein | `"tagesgeld"` \| `"depotValue"` \| `"totalWealth"` \| `"monthlySavingsRate"` \| `"accountBalance"` \| `"positionValue"` \| `"manual"` \| `null` (ohne Metrik → Fortschritt „nicht berechenbar“; M12-Nachtrag, §6) |
| `isAutoCalculated` | nein | `true` nur beim Notgroschen. **Semantik:** Bei `isAutoCalculated: true` ist `targetAmount: null` nicht „offen“, sondern „wird berechnet“ – der wirksame Zielwert ist `settings.emergencyFund.manualOverrideAmount`, sonst `factor × netIncomeMonthly` (aktuell 4 × 1.170 = 4.680); das Ziel wird nie als „offen“ angezeigt. Doppel-Guard (verbindlich): Das Notgroschen-Verhalten greift NUR bei `isAutoCalculated: true` UND `metric` `"tagesgeld"` oder `null` – ein Auto-Ziel mit fremder Kennzahl läuft in seinen Kennzahl-Zweig |
| `refId` | nein | Additiv (M12, §6): NUR bei `metric` `"accountBalance"` (→ existierendes Konto) bzw. `"positionValue"` (→ existierende Position). Strikte Kopplung (harte Ladefehler): `refId` gesetzt bei anderer Kennzahl → Fehler; `refId` fehlt bei diesen Kennzahlen → Fehler; tote oder art-fremde Referenz → Fehler (`E_REF_TARGET`-Analogie). Eine DEAKTIVIERTE Referenz ist KEIN Ladefehler (nur UI-Warnung; das Ziel referenziert sie ausdrücklich, der Ist-Wert wird weiter berechnet). Default `null` |
| `manualCurrentAmount` | nein | Additiv (M12, §6): manuell gepflegter Ist-Wert – Zahl ≥ 0 oder `null` (= offen); fachlich NUR bei `metric` `"manual"` (non-null bei anderer Kennzahl → Ladefehler). Default `null` |
| `startDate` | nein | Additiv (M12, §6): ISO-Datum oder `null`; liegt es NACH dem Stichtag, ist das Ziel „geplant“ (abgeleitet). Default `null` |
| `note` | nein | – |

Seed: die 8 bestätigten Ziele aus Source Map Abschnitt 14; offene Beträge/Termine als `null`.

**Status-Semantik (M12, verbindlich):** Gespeichert wird ausschließlich der NUTZERWILLE –
`deferred` = pausiert/zurückgestellt, `reached` = **manuell abgeschlossen** (ab M12 verbindliche
Bedeutung; Altdateien mit `reached` gelten als abgeschlossen und fallen nie automatisch zurück),
`archived` = beendet/archiviert (endgültig; Ziele werden NIE gelöscht und erscheinen archiviert
nicht im Dashboard). **Rechnerisch erreicht wird NIE gespeichert** – nur abgeleitet
(`goalProgress.reached` bzw. abgeleiteter Status `reachedNow`), und fällt bei sinkendem Ist-Wert
wieder zurück. Abgeleitete Statuskaskade (Rangfolge in `src/finance/goals.ts`, `deriveGoalStatus`):
archived → completed (gespeichertes `reached`) → paused (deferred – der gespeicherte Nutzerwille
schlägt das Zeitfenster, d. h. pausiert + Zukunfts-`startDate` bleibt „pausiert“, nie „geplant“) →
planned (`startDate` > Stichtag) → notComputable (kein wirksames Ziel > 0 oder Ist unbekannt/offen)
→ reachedNow → overdue (`targetDate` < Stichtag) → active.

**Bewusst NICHT im Modell (dokumentierte M12-Entscheidungen):** kein `createdAt`; kein
`startAmount`/gespeicherter Bezugswert (kein definierter Abnehmer – Fortschritt bleibt Ist/Ziel);
kein gespeicherter Fortschritt/abgeleiteter Status/Monatsrate/Prozentwert (alles rein abgeleitet);
**kein `goalId` an Sparplänen** – die Ziel-Zuordnung eigener Sparleistung ist über die vorhandene
Zielreferenz ABLEITBAR (`assignedOwnPlans` in `src/finance/goals.ts`: Konto-/Positionsziel →
Pläne auf dieselbe Referenz; Tagesgeld → Pläne auf aktive Tagesgeld-Konten; Depot → Positions-Pläne).

### 3.10 `plannedChanges[]`

`{ id, createdAt, basedOnProfileId, status: "planned" | "discarded", items: [{ refKind, ref, plannedMonthlyAmount }], note }` – entsteht ausschließlich durch ausdrücklich bestätigte Empfehlungen (G5), ist als „geplant, nicht ausgeführt“ gekennzeichnet und ändert nie Ist-Daten (G1).

Präzisierungen (Modul Rebalancing M11, 2026-07-20, data-architect-ratifiziert):

- **`status`:** additiv +`"discarded"` („verworfen“) – gespeicherte Planungen werden NIE gelöscht (Historie bleibt); ein Zurücksetzen `discarded` → `planned` gibt es in V1 nicht (es würde die G5-Bestätigungskette umgehen – dokumentierter Restpunkt). VOR dem Speichern verworfene Vorschläge berühren die Datei gar nicht.
- **`createdAt`:** Schreibseite speichert das injizierte ISO-**Kalenderdatum** (`todayIso`, `JJJJ-MM-TT`) – **bewusst ohne Uhrzeitanteil** (kein `new Date()` in Seiten/Datenlayer); die Ladeprüfung akzeptiert tolerant auch volle ISO-Zeitstempel (Altbestände). Anzeige gespeicherter Planungen in Array-Reihenfolge (stabiler Tiebreak).
- **`items[].ref`:** wird beim Laden analog zu den Profil-Gewichten geprüft (`position` → existierende Depotposition, `group` → bekannte Gruppe; `E_REF_TARGET`, Regel 5). Die Schreibseite (`src/data/plannedChanges.ts`) prüft zusätzlich: `basedOnProfileId` existiert, `items` nicht leer, Beträge endlich ≥ 0; Fehlertexte nennen Namen, nie IDs.

### 3.11 `simulations[]`

`{ id, name, createdAt, params: { startDepotValue, startTagesgeldValue, months, annualReturnRate, monthlyContributions: [{ label, amount, flowType, target? }], telekomMode: "real"\|"smoothed" }, note }` – nur Parameter werden gespeichert; Ergebnisse sind reproduzierbar berechenbar und werden nie gespeichert.

Präzisierungen (Modul Simulator M13, 2026-07-20, data-architect-ratifiziert):

- **`target?` (additiv):** Zielseite eines Beitrags im Aggregatmodell: `"depot"` (Default – fehlendes Feld in Altdateien bedeutet Depot, F22-kompatibel) oder `"cash"` (Tagesgeld). Die Schreibseite materialisiert den Schlüssel nur bei `"cash"` (K2-Byte-Identität). Ein `cashPerMonth`-Feld gibt es bewusst NICHT – die Tagesgeld-Rate ist ein normaler Beitrag mit `target: "cash"`.
- **Umbuchungs-Verbot (Verschärfung, §6-Ausweis):** `monthlyContributions[].flowType` darf nie `reserve_transfer`/`liquidity_transfer` sein (G7 – Umbuchungen sind kein Vermögenszufluss); die G8-Partition (eigen vs. gesamt) rechnet über die verbleibenden Zuflussarten.
- **Wertebereiche (teils Verschärfungen, §6-Ausweis):** Startwerte ≥ 0 endlich; `months` Ganzzahl 1–1200 (100 Jahre); `annualReturnRate` Dezimalzahl ∈ [0; 0,15] (0–15 %; negative Annahmen in V1 nicht vorgesehen); Beiträge ≥ 0 endlich. Eine Annahme > 0,08 erzeugt beim Laden die WARNUNG `W_RETURN_ASSUMPTION` („sehr optimistische Annahme“) – nie einen Fehler.
- **`createdAt`:** wie §3.10 – die Schreibseite speichert das injizierte ISO-Kalenderdatum (`todayIso`, ohne Uhrzeitanteil); die Ladeprüfung akzeptiert tolerant auch volle Zeitstempel.
- **`name` (Schreibseite, Prüfkette M13 B3/N1):** nicht leer (trim) und unter Simulationen EINDEUTIG (trim-Vergleich; beim Bearbeiten ist die eigene Simulation ausgenommen; Kopien erhalten „(Kopie)“/„(Kopie 2)“-Namenssuffixe) – Karten, Vergleichs-Auswahl und Bestätigungsdialoge identifizieren über den Namen. Die LADEPRÜFUNG bleibt tolerant: Altdateien mit Doppelnamen laden unverändert (kein neuer Fehlercode); die Vergleichs-Auswahl ergänzt zur Unterscheidung das Anlagedatum.
- **Hartes Löschen ist ZULÄSSIG (ratifizierte Begründung):** Simulationen sind reine Szenario-Entwürfe OHNE Referenzen von/auf andere Entitäten (keine `refId`-/`targetId`-Abhängigkeiten) und keine historischen Finanzdaten – anders als Ziele (nie löschen) oder Planungen (nur verwerfen) gibt es keine Historien- oder Referenzintegrität zu schützen. Löschen erfordert die G12-Bestätigung der Seite (confirm inkl. Name); ein `isArchived`-Feld ist deshalb nicht nötig. Kopieren = neue Simulation mit Suffix „(Kopie)“ und neuem `createdAt`.
- **DM9-Abgrenzung (G9-Ausnahme, dokumentiert):** geglättete BETRÄGE (83,33/41,67/125) dürfen als Simulations-PARAMETER vorkommen, weil `telekomMode: "smoothed"` die Kennzeichnung strukturell im Datensatz trägt; DM9 prüft weiterhin streng, dass kein IST-Datenfeld geglättete Werte enthält (Details calculation-rules „Simulations-Bausteine (M13)“).

### 3.12 `importHistory[]`

`{ id, timestamp (ISO-8601), action: "import"\|"migration", fileName\|null, fileSchemaVersion\|null, outcome: "applied"\|"rejected"\|"cancelled", note\|null }` – technisches Protokoll, maximal 50 Einträge (ältester fällt beim Anfügen weg; kein Nutzer-Finanzdatum, daher ohne G12-Bestätigung zulässig).

## 4. Abgeleitete Kennzahlen (nie gespeichert)

„Aktueller Saldo/Wert“ = jüngster Eintrag der jeweiligen Zeitreihe.

| Kennzahl | Deutscher Begriff | Ableitung |
|----------|-------------------|-----------|
| `tagesgeld` | Tagesgeld | Σ Konten mit `type: "tagesgeld"` |
| `depotValue` | Depotwert | Σ aller **aktiven** `portfolioPositions` (`isActive !== false`; Nachtrag Modul Depot 2026-07-19, §6) |
| `worldTotal` | „MSCI World gesamt“ | Σ Positionen mit `group: "world"` |
| `totalWealth` | **Gesamtvermögen (S1)** | `tagesgeld + depotValue` (Seed: 627,59 + 2.522,47 = 3.150,06 ✓) |
| `investedWealth` | **Anlagevermögen (U1)** | `totalWealth` + physisches Anlagegold (V1: nicht vorhanden) + Krypto-Konten mit `includeInInvestedWealth: true` |
| `financialWealth` | **Finanzvermögen (U1)** | `investedWealth` + Σ Konten mit `type` ∈ {`giro`, `cash`, `ruecklage`, `bargeld`, `sonstiges`} (Nachtrag 2026-07-19, §6) + Σ Krypto-Konten mit `includeInInvestedWealth: false` (Krypto zählt damit **immer genau einmal** zum Finanzvermögen; das Flag steuert nur die Zugehörigkeit zum Anlagevermögen) |
| `freeLiquidity` | Frei verfügbare Liquidität | Σ Konten mit `countsAsFreeLiquidity: true` |

Damit ist die Begriffshierarchie aus `calculation-rules.md` Abschnitt 11 aufgelöst: `totalWealth ⊆ investedWealth ⊆ financialWealth`; `freeLiquidity` ist ein Flag-basierter Querschnitt (ING-Rücklage: `type: "ruecklage"` + `countsAsFreeLiquidity: false` – keine fest verdrahtete Kontenliste). Die Fixkosten-Rückstellung existiert in V1 nicht (Fixkosten-Modul kommt später); dieser Teil der Liquiditätsformel bleibt dokumentiert offen und wird mit schemaVersion ≥ 2 definiert.

## 5. Validierungsregeln

**A. Datei und Format (harte Fehler → Ablehnung; bestehender Bestand bleibt unverändert, G10):**
1. Parsebares JSON; `schemaVersion` vorhanden, Integer; `schemaVersion > 1` → verständliche Ablehnung; Pflicht-Top-Level-Schlüssel vorhanden und typkorrekt.
2. Geldwerte sind endliche JSON-Zahlen (nie Strings, nie NaN/Infinity); Gewichte Dezimalzahlen ∈ [0; 1]; fachliche Daten `^\d{4}-\d{2}-\d{2}$` und gültige Kalenderdaten; Zeitstempel gültiges ISO 8601.
3. Alle IDs dateiweit eindeutig und nicht leer.

**B. Referenzintegrität (harte Fehler):**
4. `portfolioPositions[].accountId` → existierendes Konto mit `type: "depot"`.
5. `savingsPlans[].targetId` / `transactions[].targetId` existieren passend zu `targetKind`; `transactions[].savingsPlanId`, `settings.activeTargetProfileId`, `plannedChanges[].basedOnProfileId`, `weights[].ref` existieren, falls gesetzt. **M11-Ergänzung (additive Verschärfung, §6-Ausweis):** `plannedChanges[].items[].ref` wird analog zu `weights[].ref` geprüft (`position` → existierende Depotposition, `group` → bekannte Gruppe).
6. `snapshots[].date` eindeutig; je Konto/Position sind Daten innerhalb einer Historie eindeutig.

**C. Fachliche Regeln:**
7. Beträge ≥ 0; Ausnahme: Kontosalden mit `allowNegativeBalance: true`; `transactions[].amount` > 0.
8. Depot-Konten haben leere `balanceHistory`; `pension`-Konten tragen keine Werte.
9. Genau eine `flowType` je Plan/Buchung (G8); `reserve_transfer`/`liquidity_transfer` nur mit `targetKind: "account"` (G7).
10. `amount: null` nur bei `own_variable`/`provider`; `validUntil` ≥ `validFrom`.
11. Befüllte Profil-`weights`: Σ = 1,0 ± 0,001 (Differenz sichtbar); `level1`-Summe 1,0 ± 0,001; leere Profile gültig, rechnen nicht.
12. Höchstens ein aktives Profil – strukturell durch `settings.activeTargetProfileId`.
13. `emergencyFund.factor` ∈ [3; 5]; `netIncomeMonthly` > 0; `monthlySavingsBudget` ≥ 0 oder `null`; `goals[].targetAmount` > 0 oder `null`.
14. Neue Historien-Einträge nicht in der Zukunft (Erfassungsfehler); beim Datei-Laden nur Warnung.

**D. Schutzregeln:**
15. Einträge mit Datum eines `locked`-Snapshots sind unveränderlich; Änderungs-/Löschversuch → erklärender Hinweis (G3, M9); **auch das nachträgliche Anlegen neuer Historien-Einträge mit dem Datum eines `locked`-Snapshots ist unzulässig** (verhindert stilles Erweitern des Snapshot-Inhalts); `locked`-Snapshots nicht löschbar; Korrekturen nur als neuer Snapshot (G4).
16. Unbekannte Felder: nie Validierungsfehler, immer unverändert zurückschreiben.
17. Import nur vollständig validiert + Vorschau + Bestätigung; Fehlschlag/Abbruch lässt **alle fachlichen Daten** unverändert (M4, G10, G12). Einzige zulässige Änderung ist der Protokolleintrag in `importHistory` (`rejected`/`cancelled`) – dieser ist ein technisches Protokoll, löst keinen Ungespeichert-Status aus und benötigt keine G12-Bestätigung (siehe 3.12).
18. Warnungen (Laden erlaubt): leere Saldo-Historien (G11), Zukunftsdaten in Importdateien, `needsReview: true`.

**Fehler- und Warnungscodes (verbindlicher Katalog; Nachtrag V1-Abschlussprüfung 2026-07-20).** `src/validation/issues.ts` verweist auf diese Liste; die Codes stehen im Code als String-Literale (`parseFinanceJson.ts`, `validateFinanceData.ts`, `lockedDates.ts`).

- Stufe A – Datei und Format (Regeln 1–3): `E_PARSE`, `E_SCHEMA_VERSION`, `E_MISSING_KEY`, `E_WRONG_TYPE`, `E_MONEY_TYPE`, `E_NOT_FINITE`, `E_DATE_FORMAT`, `E_EMPTY_ID`, `E_DUPLICATE_ID`.
- Stufe B – Referenzintegrität (Regeln 4–6): `E_REF_ACCOUNT`, `E_REF_TARGET`, `E_DUPLICATE_DATE`.
- Stufe C – fachliche Regeln (Regeln 7–14): `E_NEGATIVE_AMOUNT`, `E_DEPOT_BALANCE`, `E_FLOWTYPE`, `E_AMOUNT_NULL` (M10-Konvention: auch für dueMonth-/validUntil-Kopplungen wiederverwendet), `E_WEIGHT_SUM`, `E_SETTINGS_RANGE`, `E_GOAL_COUPLING` (M12-Kopplungsregeln §3.9), `E_IMPORT_HISTORY` (§3.12).
- Stufe D – Schutzregeln (Regel 15): `E_LOCKED_DATE` – bewusst NICHT Teil der Ladevalidierung, sondern der Schreiboperationen-Sperre in `src/validation/lockedDates.ts` (DM21).
- Warnungen (Regel 18, blockieren das Laden nie): `W_EMPTY_HISTORY`, `W_NEEDS_REVIEW`, `W_FUTURE_DATE`, `W_SNAPSHOT_INCOMPLETE`, `W_RETURN_ASSUMPTION` (Renditeannahme > 8 %, §3.11).

## 6. Versionsstrategie und Migrationen

- `SUPPORTED_SCHEMA_VERSION = 1`. Gleiche Version: laden. Neuere Version: Ablehnung mit verständlicher Meldung („Diese Datei stammt aus einer neueren Version von Finance OS … Deine Datei wurde nicht verändert.“), kein Teil-Laden. Ältere Version: Migrationsangebot, nie stille Migration – **das gilt ab der ersten echten Altversion, d. h. sobald `SUPPORTED_SCHEMA_VERSION` ≥ 2 ist.** In V1 existiert keine ältere Version; `schemaVersion` < 1 ist kein Altbestand, sondern ungültig und wird hart abgelehnt („kleinste gültige Version: 1“; Bestand bleibt unverändert, G10 – Präzisierung V1-Abschlussprüfung 2026-07-20).
- Migrationskette: je Schritt eine reine Funktion `migrateVtoV+1(data)`; stufenweise 1 → 2 → … → n. Ablauf: (1) Sicherungsexport erzwingen/anbieten (M5), (2) Migration auf Kopie im Arbeitsspeicher, (3) vollständige Validierung, (4) atomare Übernahme nur bei Erfolg, (5) `importHistory`-Eintrag `action: "migration"`, (6) Persistierung erst durch normale Nutzer-Speicheraktion (M2).
- Invarianten jeder Migration: IDs ändern sich nie; `locked`-Snapshots bleiben wertidentisch; unbekannte Felder werden durchgereicht; ganz-oder-gar-nicht.
- Versionserhöhung bei: Bedeutungs-/Typ-/Pflichtänderung eines Feldes, neuen Pflichtstrukturen, Aktivierung der reservierten Arrays. Rein additive optionale Felder mit Default sind innerhalb einer Version zulässig und werden hier protokolliert.

  **Protokoll additiver Erweiterungen innerhalb schemaVersion 1:**
  - 2026-07-19 (Modul Konten): `AccountType` +`bargeld` +`sonstiges` (additive Enum-Erweiterung vor Erstveröffentlichung – die App ist unveröffentlicht, außer der Beispieldatei existieren keine fremden Dateien mit schemaVersion 1); `Account` +`isActive` (Default `true`) +`purpose` (Default `null`); Kennzahlen-Zuordnung siehe §3.3/§4. Bestehende Dateien bleiben uneingeschränkt gültig, da nur MEHR akzeptiert wird.
  - 2026-07-19 (Modul Depot): `PortfolioPosition` +`isActive` (Default `true`); W4 erwartet nur aktive Positionen/Tagesgeldkonten; `captureSnapshot`-Vollerfassung (`source` `user`, `locked` ab Speicherung); `groupTotal` als F7-Verallgemeinerung.
  - 2026-07-19 (Modul Sparpläne, M10): `Interval` +`quarterly` +`halfyearly` +`once` (additive Enum-Erweiterung; alte Werte/Dateien unverändert gültig); `SavingsPlan` +`isPaused` (Default `false`). Neue additive Ladeprüfungen: `once` erfordert `amount` ≠ null und `validUntil` null oder = `validFrom`; **Verschärfung (dokumentierter Ausweis, 2f):** ein NUMERISCHES `dueMonth` bei `interval` ≠ "yearly" ist jetzt ein Ladefehler – `null`/fehlend bleibt überall gültig, die Beispieldatei und alle regelkonformen Altdateien laden unverändert (dueMonth war laut §3.6 schon immer nur bei yearly vorgesehen; die Prüfung erzwingt das nun). Atomare Kopplung (2g): Die INTERVALS-Erweiterung wurde im selben Schritt wie die `monthlyAmount`-Glättungsfaktoren (quarterly /3, halfyearly /6, once → 0) eingeführt. KEIN Migrationscode nötig (rein additiv, schemaVersion bleibt 1).
  - 2026-07-20 (Modul Ziele, M12): `GoalMetric` +`accountBalance` +`positionValue` +`manual`; `GoalStatus` +`archived`; `Goal` +`refId` (Default `null`) +`manualCurrentAmount` (Default `null`) +`startDate` (Default `null`) – Regeln siehe §3.9. Neue additive Ladeprüfungen (strikte Kopplung, harte Fehler): `refId` nur bei `accountBalance`/`positionValue` und dort Pflicht; tote/art-fremde Referenz → `E_REF_TARGET`-Analogie (deaktivierte Referenz: KEIN Fehler, nur UI-Warnung); `manualCurrentAmount` ≥ 0 und non-null nur bei `metric` "manual"; `targetDate` ≥ `startDate`. Bedeutungspräzisierung OHNE Formatänderung: gespeichertes `reached` = ab M12 verbindlich „manuell abgeschlossen“ (Altdateien gelten als abgeschlossen, fallen nie automatisch zurück). Atomare Kopplung (Auflage H): GOAL_METRICS/GOAL_STATUS-Erweiterung + konsumierende reine Funktionen (`goalActualValue`/`deriveGoalStatus`) + Dashboard-Label `archived` im selben Schritt. Beispieldatei UNVERÄNDERT; KEIN Migrationscode nötig (rein additiv, schemaVersion bleibt 1).
  - 2026-07-20 (Modul Rebalancing, M11): `PlannedChange.status` +`"discarded"` (additive Enum-Erweiterung; „verworfen“ – kein Löschen, keine Rücknahme in V1). `createdAt`-Präzisierung OHNE Formatänderung: Schreibseite speichert das injizierte ISO-Kalenderdatum ohne Uhrzeitanteil, die Ladeprüfung akzeptiert weiterhin tolerant volle Zeitstempel (Altbestände unverändert gültig). **Verschärfung (dokumentierter Ausweis, A5):** `plannedChanges[].items[].ref` wird jetzt beim Laden geprüft (`position` → existierende Depotposition, `group` → bekannte Gruppe, `E_REF_TARGET`) – analog zu `weights[].ref`; die Beispieldatei und alle regelkonformen Altdateien (leere oder referenzintakte `plannedChanges`) laden unverändert, nur Dateien mit TOTEN Planungs-Referenzen werden neu abgelehnt (zuvor stiller Datenfehler). Beispieldatei UNVERÄNDERT; KEIN Migrationscode nötig (rein additiv, schemaVersion bleibt 1).
  - 2026-07-20 (Modul Simulator, M13): `SimulationContribution` +`target?` (`"depot"` Default | `"cash"` – rein additiv, fehlendes Feld bedeutet Depot; Schreibseite materialisiert nur `"cash"`). **Verschärfungen des simulations-Blocks (dokumentierter Ausweis, A5-Muster):** `annualReturnRate` ∈ [0; 0,15], `months` Ganzzahl 1–1200, Transfer-flowType-Verbot in `monthlyContributions` (G7), Startwerte und Beiträge ≥ 0, `target`-Enum. **Entlastung:** es gab nie einen Schreibpfad für `simulations` – die Beispieldatei enthält `[]` und keine frühere App-Version schrieb Simulationen; regelkonforme Altdateien laden unverändert. NEU die WARNUNG `W_RETURN_ASSUMPTION` bei Annahmen > 0,08 (8 %; Warnung, nie Fehler). Rückwärtskompatibel für Beiträge ohne `target` (dueMonth-Präzedenz-Muster: Default genügt). Beispieldatei UNVERÄNDERT; KEIN Migrationscode nötig (rein additiv, schemaVersion bleibt 1). Lösch-Zulässigkeit siehe §3.11.
  - 2026-07-20 (Modul Einstellungen, M14): KEINE neuen Felder – alle Settings-Felder waren vollständig vorbereitet (§3.2). **EINZIGE Verschärfung (dokumentierter Ausweis, Auflage A6):** `settings.display.percentDecimals` muss jetzt beim Laden eine **Ganzzahl 0–4** sein (zuvor nur „endliche Zahl“; `E_SETTINGS_RANGE`) – Schreibseite (`src/data/settings.ts`) prüft identisch; die Beispieldatei (2) und der Seed (2) laden unverändert; die Prüfung verhindert einen Format-Crash der Prozentanzeige (Intl mit ungültigen fractionDigits). Alle übrigen Wertebereiche (factor 3–5, Netto > 0, Override > 0 | null, Budget ≥ 0 | null, mode-Enum, retentionCount ≥ 1, Profil-Existenz) prüfte die Ladevalidierung BEREITS – die neue Schreibseite übernimmt sie nur identisch (keine Verschärfung). Präzisierung OHNE Formatänderung: fehlender `backup.mode` WIRKT als `everySave` (Default, nur berechnet, nie materialisiert – K2). NEU die localStorage-**Gerätemarke** `financeos.lastAutoBackupDay` (kein Dateifeld, siehe §3.2). Beispieldatei UNVERÄNDERT; KEIN Migrationscode nötig (schemaVersion bleibt 1).
- Jede Migration wird in diesem Dokument dokumentiert: von/nach, Feldänderungen, Transformationsregel, Rollback-Weg (= Wiederherstellung der Sicherung über M4).

**Migrationsrisiken (Prüfliste je Migration):** ID-Drift (verboten; Test vergleicht ID-Mengen), Verfälschung gesperrter Snapshot-Werte (Test auf Wertidentität), Fremdinhalte in reservierten Arrays (validieren, `needsReview`, nie löschen), Redundanz-Einschleppung (keine berechneten Werte speichern), Enum-Erweiterungen (durch Versionsschranke abgesichert), Teilmigration (nur auf Kopie, atomar), Zahlendrift (nur Quellwerte, Deep-Equal-Roundtrip), Einstellungs-Duplikate („ein Zustand, ein Speicherort“).

## 7. Testfälle Laden/Speichern (DM1–DM16, ergänzend zu T1–T9 aus calculation-rules.md)

| Nr. | Test | Erwartung |
|-----|------|-----------|
| DM1 | Startvorlage laden | Berechnete Werte exakt: Depot 2.522,47; Tagesgeld 627,59; Gesamtvermögen 3.150,06; World gesamt 1.020,30; Telekom-Anteil 54,27775 % |
| DM2 | Laden → Speichern/Export → erneut Laden | Deep-Equal identisch; alle IDs unverändert |
| DM3 | Unbekannte Zusatzfelder (Top-Level, Konto, metadata) | Überleben Laden + Speichern vollständig |
| DM4 | Ungültige Dateien (kaputtes JSON; fehlende/zu hohe schemaVersion; tote Referenz; Betrag als String; doppelte ID; Gewichtssumme 0,9) | Verständliche Ablehnung mit Grund; Bestand unverändert |
| DM5 | Ungültiger Import bzw. Abbruch in der Vorschau | Alle fachlichen Daten unverändert; nur `importHistory` erhält einen `rejected`-/`cancelled`-Eintrag ohne Ungespeichert-Status |
| DM6 | Snapshot-Schutz (T8): Änderungsversuch am 2026-07-17-Eintrag; Neuerfassung 2026-08-01 | Ablehnung mit Hinweis; neuer Snapshot; Historie zeigt beide |
| DM7 | Kennzahlen-Flags: ING-Saldo (fiktiv) zählt in `financialWealth`, nicht in `freeLiquidity`; T4-Buchung 100 € `liquidity_transfer` auf TR-Cash → `freeLiquidity` +100, Sparleistung +0 | – |
| DM8 | Zuflussarten (T1–T3 auf Datenebene) | Telekom-Eigenleistung/Jahr = 1.000; VL +33,50 eigen / +40 gesamt; Gold-Monat: 16 Zufluss, 9 eigen, 7 Anbieter, zwei getrennte Buchungen |
| DM9 | Kein Dateifeld enthält 83,33 / 41,67 / 125 / 201,83 | Geglättete Werte entstehen nur in Rechenfunktionen (G9) |
| DM10 | Gewichts-Validierung: Σ 1,0 lädt; Σ 0,99 abgelehnt; Σ 0,9995 lädt mit ausgewiesener Differenz | Toleranz ± 0,001 |
| DM11 | Leere Profile und komplett leerer Datenbestand | Gültig; Leerzustände; Depotwert 0 → „nicht berechenbar“, nie NaN/Infinity |
| DM12 | schemaVersion 0 → Ablehnung „kleinste gültige Version: 1“, keine Änderung (in V1 existiert keine echte Altversion, §6-Präzisierung); schemaVersion 2 → Ablehnungstext, keine Änderung | Ablehnung beidseitig, Bestand unverändert (Test: tests/storage/schemaVersion.test.ts) |
| DM13 | `fixedCosts` mit fremdem Inhalt | Unverändert durchgereicht |
| DM14 | `"17.07.2026"` abgelehnt; `"2026-07-17"` akzeptiert; Zukunftsdatum: Erfassung abgelehnt, Import nur Warnung | Datumsregeln |
| DM15 | Notgroschen: 4 × 1.170 = 4.680, Fortschritt 627,59 / 4.680 ≈ 13,4 %; Override 5.000 bleibt bei Netto-Änderung bestehen | M12, T7 |
| DM16 | Arbeitsspeicher leeren („Cache-Löschung“) → Datei erneut öffnen | Vollständiger Zustand inkl. fachlicher Einstellungen wiederhergestellt |
| DM17 | `reserve_transfer`/`liquidity_transfer` mit `targetKind: "position"` | Ablehnung (Negativtest Regel 9, strukturelle G7-Absicherung) |
| DM18 | `amount: null` bei `flowType: "own_fixed"` oder `"employer"` | Ablehnung (Negativtest Regel 10) |
| DM19 | Depot-Konto mit nicht-leerer `balanceHistory` (z. B. via Import) | Ablehnung (Regel 8, verhindert redundanten Depotwert) |
| DM20 | Negativer Saldo ohne `allowNegativeBalance` → Ablehnung; auf `acc-sparkasse-giro` (`true`) → gültig | Regel 7 |
| DM21 | Neuer Historien-Eintrag mit Datum eines `locked`-Snapshots (z. B. Giro-Saldo „2026-07-17“) | Ablehnung mit Hinweis (Regel 15) |
| DM22 | 51. `importHistory`-Eintrag | Ältester entfällt; alle übrigen Einträge und alle Finanzdaten unverändert (Kappungsregel 3.12) |
| DM23 | Doppeltes Datum innerhalb einer `balanceHistory`/`valueHistory` | Ablehnung (Regel 6) |

**Präzisierung DM9:** Geprüft werden numerische Feldwerte (Betrags-/Zahlenfelder) auf 83,33 / 41,67 / 125 / 201,83 – Freitext-`note`-Felder der Startvorlage enthalten diese Zahlen bewusst nicht.

## 8. Startvorlage

`user-data/finance-data.example.json` enthält ausschließlich in der Source Map Version 3 bestätigte Werte (Seed-Snapshot 2026-07-17, Konten, Sparpläne, Profile, Ziele); Unbekanntes ist `null` bzw. leere Historie (nichts erfunden, G11). Die Datei ist über `metadata.isExampleData: true` und `metadata.description` eindeutig als Beispiel-/Startvorlage gekennzeichnet.

**Bewusste Seed-Vorbelegungen (keine Empfehlungen):**
- `settings.activeTargetProfileId: "tp-student-sparplan"` – dokumentiert den bestätigten Ist-Zustand (Ebene A ist der tatsächliche Sparplan, U1); das ist keine per G5 bestätigungspflichtige Empfehlung. Jede Profil-**Umschaltung** (insbesondere auf das Job-Profil) erfordert die manuelle Bestätigung.
- `isFlexible: false` nur bei vertraglich fixen bzw. nicht umlenkbaren Plänen (VL-Eigenanteil, VL-Zuschuss, Telekom-Bonus) mit gesetztem `minAmount`; der umlenkbare Telekom-Eigenbeitrag steht konform zu U1 auf `true`.
