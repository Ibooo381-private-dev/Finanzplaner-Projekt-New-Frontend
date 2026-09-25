# Finance OS – AI Onboarding

**Zielgruppe: ausschließlich zukünftige KI-Assistenten.** Lies dieses Dokument zuerst – es macht dich in Minuten arbeitsfähig und bewahrt dich vor den bekannten Fallen.

## Projekt in drei Sätzen

Finance OS ist eine fertige (v1.0.0, lokal final freigegeben), vollständig lokale persönliche Finanzanwendung: React 19 + TypeScript + Vite, eine JSON-Datei als einzige dauerhafte Datenquelle, keinerlei Netzwerkzugriffe. Sie bildet die realen Finanzen des Projektinhabers ab (Depot, Tagesgeld, Sparpläne, Telekom-Aktienprogramm) mit strikten Ehrlichkeitsregeln. Es ist ein **privates** Projekt: nichts pushen, nichts veröffentlichen, keine Cloud.

## Zuerst lesen (Reihenfolge)

1. `CLAUDE.md` – die dauerhaften Projektregeln (bindend).
2. `progress.md` – Kopf (Phase 20 + V1.x-Liste); bei Modularbeit den jeweiligen Phaseneintrag.
3. `docs/requirements.md` §3 (G1–G12) + das betroffene Modul (inkl. Nachträge!).
4. `docs/calculation-rules.md` – den Bausteine-Abschnitt des betroffenen Moduls.
5. `docs/data-model.md` §3 (Struktur) / §5 (Fehlerkatalog) / §6 (Erweiterungs-Protokoll).
6. Dieses Archiv: [Quick Reference](Finance_OS_Quick_Reference.md) für Orte, [Decision Log](Finance_OS_Decision_Log.md) für das Warum.

## Architektur (ein Blick)

Storage → Provider (`FinanceDataProvider`, Reducer, `todayIso`) → reine Funktionen (`src/finance`, `src/data`) → React-Seiten. **Keine Finanzlogik in Komponenten. Kein `new Date()` in Fachcode. Jede Datenänderung durch `applyDataChange`.**

## Die wichtigsten Regeln (nicht verhandelbar)

1. **G1:** Die App ändert nie reale Sparpläne/Konten/Orders – sie rechnet und empfiehlt nur (Empfehlungen im Konjunktiv).
2. **G10:** Fehlgeschlagenes Laden/Importieren verändert nie den Bestand; keine NaN/Infinity; Division durch 0 → „nicht berechenbar“.
3. **G11:** Unbekannt ≠ 0. Nie Werte erfinden – auch nicht als „plausible Beispiele“.
4. **G7/G8/G9:** Umbuchungen zählen nie; eigene Sparleistung ≠ Gesamtzufluss; real ≠ geglättet (geglättete Werte nie speichern).
5. **G3/G4/DM21:** Gesperrte Snapshots sind unantastbar; Historie wird angehängt, nie editiert.
6. **G12:** Destruktives nur mit Bestätigung, die die konkreten Werte nennt.
7. **K2:** Teil-Patches materialisieren nie Defaults; No-Op ⇒ Byte-identisches Serialisat.
8. **Schema:** Nur additive Erweiterungen; jede regelkonforme Altdatei muss unverändert laden; §6-Protokolleintrag ist Pflicht.
9. **Privat:** Kein Push, kein Upload, keine Veröffentlichung, keine Remote-Schreibaktion – niemals ohne ausdrückliche Nutzeranweisung.

## Konventionen

- Deutsch in UI, Fehlermeldungen, Doku, Commit-Kontext; keine technischen IDs in Endnutzertexten (kurze Regel-Codes wie „(F19)“ in Erklärtexten sind die dokumentierte Ausnahme).
- Tests: Verhalten statt Implementation; Seed-Sollwerte aus calculation-rules pinnen; Seitentests mit festem `FIXED_NOW`; Storage via `vi.mock`.
- Prozess: Für Fachänderungen die Prüfkette benutzen (data-architect → frontend-developer → finance-analyst/accessibility → calculation-tester → reviewer; Rollen unter `.claude/agents/` – sie sind ggf. nicht registriert → als general-purpose mit hineinkopierter Rolle starten). `progress.md` nach jeder Phase aktualisieren.
- Formulare kopieren das SettingsPage-/SimulatorPage-Muster (B1/B2/B3, aria-Verdrahtung, Pflichtfeld-Legende).

## Häufige Fehler / bekannte Stolperfallen

| Falle | Schutz |
|---|---|
| Seed-Datei „verbessern“ | `user-data/finance-data.example.json` NIE ändern – Dutzende Pins hängen daran |
| Default materialisieren (`?? 0`, `mode: 'everySave'` beim Patchen) | K2 verletzt → falscher Dirty-Status; Byte-Identitäts-Tests schlagen an |
| 0 statt „unbekannt“ | G11; `AggregatedAmount.missingIds` benutzen |
| Verkaufsoption bei Untergewichtung erwähnen | Historischer echter Bug; actionLevel nur bei ≥ +10 Pp |
| Stichtagsmonat mitprojizieren | startMonth = FOLGEMONAT; 6-Monats-Pin 777,59/3.122,47/3.900,06 fängt dich |
| Geglättete Werte speichern oder mit real mischen | DM9/G9; Grep 83,33/125 über Dateien muss leer bleiben |
| Texte ändern ohne Test-Grep | Viele UI-Texte sind gepinnt |
| `taskkill /IM node.exe`, pauschales Löschen, `git push` | Skript-/Projektverbote; stop-dev nutzt validierte PID |
| PowerShell 5.1 | kein `&&`, kein ternary; hier-strings mit `'@` in Spalte 0; `2>&1` auf native exes meiden |
| Repo-Wurzel ≠ Projekt | git-Repo liegt EIN Verzeichnis über Finance-OS; dort liegen private Ordner – gezielt stagen, nie `git add -A` von der Wurzel |

## Nur mit besonderer Vorsicht ändern

- `src/validation/validateFinanceData.ts` (jede Verschärfung braucht Altdatei-Nachweis + §6-Ausweis)
- `src/finance/savings.ts` / `projection.ts` (U3/U4-, T1-, startMonth-Pins)
- `src/state/FinanceDataProvider.tsx` (Save-/Backup-Pfade A2–A4; isSaving-Sperre)
- `src/validation/lockedDates.ts` (DM21-Schutz)
- `scripts/backup-project.ps1` / `release.ps1` (Vertraulichkeits- und Dirty-Zusagen sind reviewgeprüft)
- `user-data/finance-data.example.json`, `tests/**` mit Seed-Pins

## Kontext, den dir niemand sonst sagt

- Doku/Tests/Beispieldatei basieren auf den **realen** Finanzwerten des Inhabers → Quellcode-Backups sind vertraulich; `reference/` enthält echte private Notizen (bewusst getrackt, privates Remote).
- Offene Arbeit ist ausschließlich die V1.x-Liste (progress.md, 26 Punkte) + `docs/V1_X_ROADMAP.md`; nichts davon ist zugesagt.
- „FEATURE COMPLETE“ heißt: Für neue Funktionen zuerst eine ausdrückliche Nutzerentscheidung einholen.
