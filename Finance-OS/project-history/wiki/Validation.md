# Validation

[Home](Home.md) · Verwandt: [Data-Model](Data-Model.md), [Import](Import.md) · Verbindlich: `docs/data-model.md` §5

## Vier Stufen (Laden/Import)

| Stufe | Prüft | Beispiele |
|---|---|---|
| A Format | JSON, schemaVersion, Typen, Endlichkeit, ISO-Daten, ID-Eindeutigkeit | E_PARSE, E_SCHEMA_VERSION, E_NOT_FINITE |
| B Referenzen | accountId/targetId/ref existieren passend | E_REF_ACCOUNT, E_REF_TARGET |
| C Fachregeln | Beträge ≥ 0, flowType-Kopplungen, Gewichtssummen, Wertebereiche | E_FLOWTYPE, E_WEIGHT_SUM, E_SETTINGS_RANGE |
| D Schutz | unbekannte Felder durchreichen; Warnungen statt Fehler | W_EMPTY_HISTORY, W_NEEDS_REVIEW |

Harte Fehler ⇒ verständliche deutsche Ablehnung mit Pfad und Ist-Wert; der geladene Bestand bleibt referenzidentisch unverändert (G10).

## DM21 – gesperrte Snapshot-Daten

`src/validation/lockedDates.ts` sperrt **Schreiboperationen** auf Daten gesperrter Snapshots (ändern, löschen, nachträglich anlegen). Bewusst keine Ladeprüfung – Altbestände laden, Manipulation wird am Schreibpfad verhindert.

## Verschärfungs-Muster

Jede nachträgliche Prüfungs-Verschärfung braucht: (1) Nachweis, dass regelkonforme Altdateien unverändert laden, (2) §6-Protokoll-Ausweis. Beispiele: percentDecimals-Ganzzahl (M14), plannedChanges-Referenzen (M11), simulations-Wertebereiche (M13).

## Warum ein reiner Type-Guard?

`validateFinanceData` kopiert nicht um (einzige dokumentierte Ausnahme: fehlende optionale Arrays → `[]`) – so bleibt die Rundreise byte-treu und unbekannte Felder unversehrt.
