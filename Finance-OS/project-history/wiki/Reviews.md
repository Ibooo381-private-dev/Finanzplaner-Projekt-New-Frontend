# Reviews – die Prüfkette

[Home](Home.md) · Verwandt: [Testing](Testing.md), [Lessons-Learned](Lessons-Learned.md)

## Die Kette (je Fachmodul)

Spezifikation → **data-architect** (Ratifizierung, verbindliche Auflagen) → **frontend-developer** → **finance-analyst** + **accessibility-review** (parallel) → Findings beheben → **calculation-tester** (unabhängige Nachrechnung, Testlücken) → **reviewer** (führt Tests/Build/Lint selbst aus; Freigabe ggf. mit Auflagen) → Auflagen + progress.md. Rollen: `.claude/agents/*.md`; organisatorisch liefen die Prüfungen als general-purpose-Agenten mit hineinkopierter Rollendefinition (dokumentierter Workaround).

## Was die Kette real gefangen hat (Auswahl)

| Fund | Stufe | Phase |
|---|---|---|
| actionLevel nannte die Verkaufsoption auch bei Untergewichtung – inkl. Test, der das Falsche pinnte | finance-analyst | 8 |
| Drei Handle-Fehler im Speicherweg (Feature-Check, „Speichern unter“, Fallback-UI) | gezielte Nachprüfung | 7a |
| startMonth-Off-by-one in der Orchestrator-Spezifikation | data-architect | 16 (M13) |
| Falscher Auto-Backup-Default in der Orchestrator-Spezifikation („kein Backup“ statt everySave) | data-architect | 17 (M14) |
| Fehlende G11-Behandlung der „World gesamt“-Zeile | reviewer | 12 (M7) |
| Kennzahlen-Trio dreifach versprochen, nie gebaut; irreführender UI-Hilfetext | reviewer | 18 (M15) |
| „Quellcode-Backup ohne echte Finanzdaten“ war eine falsche Zusicherung | data-architect | 19 (M16) |
| Bundle enthält doch Instituts-/Programmbegriffe (ING-Rücklage, Shares2you, Telekom) – Vorbefund korrigiert | Security/Privacy | 20 (M17) |

## Finalabnahmen

- **M15 (Phase 18):** data-architect „abnahmefähig: JA“ + reviewer „Feature Complete: JA“ (Auflagen umgesetzt).
- **M16 (Phase 19):** data-architect (Dateisicherheit, erst NEIN → H1/H2 behoben) + reviewer „JA ohne Auflagen“.
- **M17 (Phase 20):** vier Reviews – data-architect, Security/Privacy, Accessibility, reviewer – **alle JA**; alle mittleren+ Findings vor dem Tag behoben.

## Konventionen

Findings klassifiziert kritisch/hoch/mittel/niedrig mit Datei:Zeile; kritisch–mittel werden vor Freigabe behoben; niedrig behoben oder begründet dokumentiert (V1.x). Reviewer-Auflage fast jeder Phase: den progress.md-Eintrag mit den echten Endzahlen finalisieren.
