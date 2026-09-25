# project-history/ – Das Finance-OS-Wissensarchiv

Dauerhaftes Archiv über die Entstehung von **Finance OS v1.0.0** (Feature Complete, lokal final freigegeben, privates persönliches Projekt). Erstellt am 2026-07-21 nach Projektabschluss. Dieses Verzeichnis ist rein additiv – am Projekt selbst wurde für die Archivierung nichts verändert.

## Dateistruktur

```
project-history/
├── README.md                            ← dieser Einstieg
├── Finance_OS_Development_History.md    ← Artefakt 1: das vollständige Entwicklungstagebuch
├── Finance_OS_Book.md                   ← Artefakt 3: druckfertige Buchfassung
├── Finance_OS_Book.pdf                  ← PDF-Ausgabe des Buchs (falls Erzeugung erfolgreich – siehe unten)
├── Finance_OS_Quick_Reference.md        ← Artefakt 4: kompaktes Nachschlagewerk
├── Finance_OS_Knowledge_Base.md         ← Artefakt 5: thematische Wissensbasis
├── Finance_OS_Decision_Log.md           ← Artefakt 6: 30 Schlüsselentscheidungen (D1–D30)
├── Finance_OS_AI_Onboarding.md          ← Artefakt 7: Schnellstart für zukünftige KI-Assistenten
└── wiki/                                ← Artefakt 2: 22 verlinkte Themenseiten
    ├── Home.md  (Einstieg ins Wiki)
    ├── Architecture / Data-Model / Storage / Validation / Import / Export / Backup
    ├── Dashboard / Accounts / Depot / Savings-Plans / Goals / Rebalancing / Simulator / Settings
    └── Testing / Reviews / Lessons-Learned / Roadmap / FAQ / Glossary
```

## Zweck der Dokumente

| Dokument | Zweck | Typische Frage |
|---|---|---|
| [Development History](Finance_OS_Development_History.md) | Chronologie + Module M1–M17 in maximaler Tiefe (Probleme, Lösungen, Reviews, Lessons) | „Wie und warum ist X entstanden?“ |
| [Decision Log](Finance_OS_Decision_Log.md) | Jede wichtige Entscheidung mit Alternativen und Begründung | „Warum wurde X so entschieden – und was wäre die Alternative gewesen?“ |
| [Knowledge Base](Finance_OS_Knowledge_Base.md) | Thematisch (Entscheidung → Implementierung → Tests → Reviews) | „Ich muss Thema X ändern – was gehört alles dazu?“ |
| [Quick Reference](Finance_OS_Quick_Reference.md) | Orte, Funktionen, Rezepte, Debugging | „Wo finde ich …? Wie ändere ich üblicherweise …?“ |
| [AI Onboarding](Finance_OS_AI_Onboarding.md) | Regeln, Konventionen, Stolperfallen – für KI-Assistenten | „Ich bin neu – was darf ich auf keinen Fall falsch machen?“ |
| [Buch](Finance_OS_Book.md) | Erzählende Gesamtfassung, druckfertig | „Erklär mir das Projekt am Stück.“ |
| [wiki/Home](wiki/Home.md) | 22 kompakte, querverlinkte Themenseiten | „Nur schnell Thema X nachschlagen.“ |

## Empfohlene Lesereihenfolge

- **KI-Assistent, soll arbeiten:** [AI Onboarding](Finance_OS_AI_Onboarding.md) → [Quick Reference](Finance_OS_Quick_Reference.md) → themenbezogen [Knowledge Base](Finance_OS_Knowledge_Base.md)/[wiki](wiki/Home.md).
- **Entwickler:in, neu im Projekt:** [Buch](Finance_OS_Book.md) → [wiki/Architecture](wiki/Architecture.md) + [wiki/Data-Model](wiki/Data-Model.md) → [Quick Reference](Finance_OS_Quick_Reference.md) → bei Änderungen [Decision Log](Finance_OS_Decision_Log.md).
- **„Warum ist das so?“-Recherche:** [Decision Log](Finance_OS_Decision_Log.md) → [Development History](Finance_OS_Development_History.md) (Modulkapitel).
- **Historiker:in / Vollbild:** [Development History](Finance_OS_Development_History.md) von vorn.

## Verhältnis zur Projekt-Dokumentation

Dieses Archiv **ersetzt nichts**: Verbindlich für die Arbeit am Code bleiben `CLAUDE.md`, `docs/` (requirements, data-model, calculation-rules, storage-concept, design-system, testing-strategy), `progress.md` (inkl. V1.x-Liste), README/CHANGELOG/RELEASE_NOTES. Das Archiv erklärt Entstehung, Zusammenhänge und Gründe – bei Widerspruch gewinnt die Projekt-Doku (und ein Widerspruch wäre ein zu behebender Archiv-Fehler).

## Quellenlage und Ehrlichkeit

Erstellt aus progress.md (Phasen 0–20), der gesamten Projekt-Doku, der Implementierung, der Git-Historie und dem Sitzungswissen der Entwicklungs-Sitzungen (M10–M17 im Detail). Die wörtlichen Diskussionen der Phasen 0–12 und die vollständigen Einzel-Reviewberichte vor M10 waren zum Archivierungszeitpunkt nicht mehr verfügbar – wo das relevant ist, steht es im jeweiligen Dokument. Nichts wurde erfunden.

**Vertraulichkeit:** Wie die übrige Projekt-Doku referenziert auch dieses Archiv die realen (bestätigten) Finanzwerte des Projektinhabers. Es ist Teil des privaten Projekts und nicht zur Weitergabe bestimmt.
