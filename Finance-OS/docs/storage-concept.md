# Finance OS – Speicherkonzept (Version 1)

Stand: 2026-07-19. Gilt zusammen mit `docs/data-model.md` (Schema, Validierungsregeln, Migrationen) und `docs/requirements.md` (M1–M6, G-Anforderungen).

## 1. Grundprinzipien

- Die **JSON-Datei ist die einzige dauerhafte Datenquelle** (C1). Der Arbeitsspeicher der App hält genau einen geladenen Bestand; localStorage speichert ausschließlich unkritische UI-Einstellungen/Gerätemarken und niemals Finanzdaten. In V1 existiert genau EIN localStorage-Schlüssel (Allowlist `src/state/localStoragePolicy.ts`): der Auto-Backup-Tagesmerker `financeos.lastAutoBackupDay` (M5/M14 – Kalendertag JJJJ-MM-TT des letzten automatischen Sicherungs-Downloads DIESES Geräts; Verlust kostet höchstens ein zusätzliches Backup, nie Daten).
- Nach Löschen des Browser-Caches ist der vollständige Zustand durch erneutes Öffnen der JSON-Datei wiederherstellbar (DM16).
- Jede Schreiboperation nach außen (Datei, Download) geschieht nur im Rahmen einer Nutzeraktion; die App löst nie selbstständig Dateizugriffe ohne Nutzergeste bzw. zuvor erteilte Freigabe aus.
- Ein fehlgeschlagener Lade-, Import-, Speicher- oder Migrationsvorgang lässt den aktuellen Bestand unverändert (G10).

## 2. JSON-Validierung

Vierstufig gemäß `data-model.md` Abschnitt 5, immer in dieser Reihenfolge und immer vollständig vor jeder Übernahme in den Arbeitsspeicher:

1. **Parsen:** JSON syntaktisch gültig? Sonst Ablehnung „Datei ist kein gültiges JSON“ (mit Position, falls verfügbar).
2. **Format (A):** `schemaVersion`, Pflichtschlüssel, Typen, Zahlen-/Datumsformate, ID-Eindeutigkeit.
3. **Referenzen (B):** alle IDs-Verweise auflösbar und typkorrekt.
4. **Fachregeln (C) und Schutzregeln (D):** Beträge, Zuflussarten, Gewichtssummen, Snapshot-Schutz; Warnungen (leere Historien, Zukunftsdaten, `needsReview`) blockieren das Laden nicht, werden aber angezeigt.

Fehlermeldungen sind verständlich formuliert und benennen den betroffenen Bereich (S3/S5); unbekannte Zusatzfelder sind nie ein Fehler (Regel 16).

## 3. Lokales Öffnen und direkte Dateispeicherung (M1/M2)

- **Öffnen:** Bevorzugt File System Access API (`showOpenFilePicker`); das erhaltene Datei-Handle wird für die Sitzung gehalten. Fallback ohne API-Unterstützung: `<input type="file">` (dann ist nur der Download-Weg zum Speichern möglich).
- **Direktes Speichern:** Über das gehaltene Handle (`createWritable`), erst nach der vom Browser eingeholten Benutzerfreigabe. Ablauf: Serialisieren → Validieren des Serialisats → Schreiben → Erfolgsanzeige („gespeichert um …“) → Ungespeichert-Status zurücksetzen. `metadata.updatedAt` wird beim Speichern gesetzt.
- Schreibfehler (entzogene Berechtigung, gesperrte Datei, volles Medium) werden abgefangen und gemeldet; der Bestand im Arbeitsspeicher bleibt vollständig erhalten, und der Download-Fallback wird als Alternative angeboten.
- Berechtigungen können vom Browser jederzeit widerrufen werden; der Berechtigungsstatus ist in den Einstellungen (M14) sichtbar.

## 4. Export als Download und Import als Fallback (M3/M4)

- **Export:** Jederzeit möglich, auch mit ungespeicherten Änderungen. Erzeugt `finance-data-YYYY-MM-DD.json` mit dem kompletten Bestand (inkl. aller Snapshots, `schemaVersion`, unbekannter Felder). Export verändert nichts.
- **Import:** Datei wählen → vollständige Validierung (Abschnitt 2) → **Vorschau** (Pflicht, S4-Prinzip): `schemaVersion`, `metadata.description`/`isExampleData`, Anzahl Konten/Positionen/Snapshots/Sparpläne/Ziele/Buchungen, jüngstes Datum, Vergleich mit dem aktuell geladenen Bestand; Warnung, wenn der geladene Bestand jüngere Änderungen enthält. → Sicherungsexport des bisherigen Bestands wird angeboten (Abschnitt 5) → **ausdrückliche Bestätigung** → atomare Übernahme als neuer Arbeitsbestand → Eintrag in `importHistory` (`applied`). Abbruch oder Fehler: **Alle fachlichen Daten bleiben unverändert**; einzige zulässige Änderung ist der technische Protokolleintrag `cancelled`/`rejected` in `importHistory` (löst keinen Ungespeichert-Status aus und benötigt keine Bestätigung, siehe `data-model.md` 3.12 und Regel 17).
- Import ersetzt den Bestand vollständig; ein Merge findet in V1 nicht statt.

## 5. Automatische Sicherungsexporte (M5)

Die folgenden Punkte beschreiben das ZIELKONZEPT; die verbindliche **V1-Umsetzung** steht im letzten Punkt dieses Abschnitts und übersteuert sie überall dort, wo sie abweichen (insbesondere Ablageort/Verzeichnis-Freigabe und Aufbewahrungs-Durchsetzung).

- Konfiguration in `settings.backup` (`mode: "everySave"`, `retentionCount`, Standard 10).
- **Auslöser:** jede erfolgreiche Speicheraktion (gemäß Modus), vor jedem Import und vor jeder Migration (dort verpflichtend angeboten); zusätzlich manuell „Sicherung jetzt erstellen“.
- **Ablageort:** bevorzugt ein einmal je Sitzung freigegebenes Sicherungsverzeichnis (z. B. `backups/`, File System Access `showDirectoryPicker`); ohne Freigabe als Download. Namensschema `finance-data-backup-YYYY-MM-DD-HHmm.json`; Sicherungen überschreiben einander nie.
- Aufbewahrung: Bei Überschreiten von `retentionCount` wird die älteste Sicherung nur im freigegebenen Verzeichnis und nur gemäß der in den Einstellungen bestätigten Regel entfernt; Downloads werden nie automatisch gelöscht.
- Die letzte Sicherung (Zeitpunkt, Weg) ist in der Übersicht/den Einstellungen sichtbar.
- **V1-Umsetzung (M14, data-architect-ratifiziert, Auflagen A2–A5):** Der Ablageort ist in V1 ausschließlich der **Download-Weg** (kein Verzeichnis-Picker – spätere Ausbaustufe); `retentionCount` ist deshalb eine reine **Empfehlungs-Anzeige** („bewahre die letzten N Sicherungen auf“, nicht durchsetzbar). Auslöser ist ausschließlich ein ERFOLGREICHES direktes Speichern (`SAVE_SUCCEEDED` in saveDirect/„Speichern unter“): Das Backup lädt EXAKT den bereits geschriebenen json-String herunter (Byte-identisch, A2), läuft NACH dem Erfolgs-Dispatch in try/catch (ein Backup-Fehler erzeugt nur einen Hinweis und lässt das Speichern nie scheitern, A3) und entfällt beim Download-Fallback („Exportieren und als gespeichert markieren“ IST bereits die datierte Kopie), bei Dialog-Abbruch und bei Schreibfehlern (A4). Fehlender `settings.backup.mode` WIRKT als `everySave` (Default, K2 – nie materialisiert); `dailyFirstSave` nutzt den **localStorage-Tagesmerker** `financeos.lastAutoBackupDay` (Gerätemarke, Abschnitt 1): Er wird nach jedem erfolgten Auto-Backup auf den lokalen Kalendertag gesetzt, speist die Statuszeile „letzte automatische Sicherung dieses Geräts“ (Tagesgranularität) und gated NIE die manuelle Sicherung; alle Zugriffe try/catch (Privatmodus degradiert sicher zu everySave-Verhalten, A5). Entscheidungsfunktion: `shouldAutoBackup(mode, lastBackupDayIso, todayIso)` in `src/storage/autoBackup.ts` (rein, testbar).

## 6. Ungespeicherte Änderungen (M6)

- Jede Datenänderung markiert den Bestand als „ungespeichert“ (Indikator in der Kopfzeile, Text + Symbol, nicht nur Farbe).
- `beforeunload`-Warnung beim Schließen/Verlassen mit ungespeicherten Änderungen.
- Der Status wird ausschließlich durch erfolgreiches direktes Speichern (M2) oder durch Export mit ausdrücklicher Bestätigung „als gespeichert markieren“ zurückgesetzt.
- Es gibt kein verstecktes Autosave in Browser-Speicher; geht der Tab verloren, sind ungespeicherte Änderungen verloren – genau darum ist der Indikator prominent (Regel „Browser-Speicher nie einzige Datenquelle“).

## 7. Umgang mit beschädigten Dateien

- **Syntaktisch beschädigt (Parse-Fehler):** Ablehnung mit verständlicher Meldung; die Datei wird nie „teilrepariert“ oder teilgeladen; Hinweis auf die Wiederherstellung über die letzte Sicherung (M5 → Import M4).
- **Strukturell ungültig (Validierungsfehler A–C):** Ablehnung mit Benennung der fehlerhaften Stelle(n); keine Übernahme.
- **Fachlich auffällig (Warnstufe D):** Laden erlaubt; auffällige Einträge werden mit `needsReview`/Warnhinweisen angezeigt (G11).
- Die App schreibt **nie** in eine Datei, die sie nicht vollständig valide geladen hat (kein „Reparieren durch Überschreiben“).
- Empfohlener Wiederherstellungsweg bei Beschädigung: jüngste Sicherung aus `backups/` bzw. Downloads über M4 importieren; `importHistory` dokumentiert den Vorgang.

## 8. Künftige Migrationen

- Versionsstrategie und Migrationskette sind in `data-model.md` Abschnitt 6 definiert (SUPPORTED_SCHEMA_VERSION = 1; ältere Dateien: Migrationsangebot mit Pflicht-Sicherung, Migration auf Kopie, atomare Übernahme, `importHistory`-Eintrag; neuere Dateien: Ablehnung ohne jede Änderung).
- Migrationen laufen vollständig lokal, ohne Netzwerk, und persistieren erst durch die normale Nutzer-Speicheraktion.
- Rollback = Wiederherstellung der vor der Migration erzwungenen/angebotenen Sicherung über M4.

## 9. Tests

Maßgeblich: DM1–DM16 (`data-model.md` Abschnitt 7) plus der Datenspeicherungs-Katalog des Skills `quality-check` (gültige/ungültige Datei, Roundtrip identisch, `schemaVersion` vorhanden, unbekannte Felder erhalten, fehlgeschlagener Import zerstört nichts, Ungespeichert-Anzeige, Cache-Löschung überlebbar). Rechenlogik-Tests: T1–T9 (`calculation-rules.md`).
