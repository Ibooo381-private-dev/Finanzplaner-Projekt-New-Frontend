# Settings (M14 – Einstellungen & Datenverwaltung)

[Home](Home.md) · Verwandt: [Backup](Backup.md), [Goals](Goals.md), [Import](Import.md)

**Zweck:** Alle globalen Einstellungen + Sicherungs-/Datenverwaltung – ohne ein einziges neues Datenfeld (das Modell war vollständig vorbereitet).

**Inhalte:** Netto, Notgroschen-Faktor (3–5) mit Live-Vorschau, manuelle Übersteuerung (setzen/zurücksetzen nur mit Bestätigung, die beide Werte nennt), Sparbudget (Warn-Grenzwert für [Savings-Plans](Savings-Plans.md)), Prozent-Dezimalstellen (0–4), globale Zielprofil-**Auswahl** (Job-Warnung vor 2027-10-01 via todayIso), Sicherungsmodus + Aufbewahrungsempfehlung, „Sicherung jetzt erstellen“, Speicherort-Transparenz.

**Prägende Entscheidungen:**
- Notgroschen ausschließlich über `effectiveEmergencyFundTarget` – „berechnet“ = derselbe Aufruf ohne Override, keine zweite Formel.
- **Auto-Backup-Auflagen A2–A8** ([Backup](Backup.md)); Default `everySave` wirkt bei fehlendem Modus, ohne materialisiert zu werden (data-architect-Korrektur Nr. 3 gegen die eigene Spezifikation).
- Zielprofil-**Bearbeitung** bewusst nicht in V1 (abnahme-relevanter Konflikt-Ausweis, V1.x-2).
- percentDecimals-Ganzzahl 0–4 als einzige Ladeverschärfung (§6-Ausweis; verhindert Intl-Crash).
- Globaler Escape-Handler nach A11y-Review wieder **entfernt** (kein Dialog → Escape gehört nicht global); Test als gewollte Musterangleichung umgeschrieben.

**Dateien:** `src/data/settings.ts` (51 Tests), `src/storage/autoBackup.ts`, `src/pages/SettingsPage.tsx` (30 Seitentests), `src/state/localStoragePolicy.ts`.
