/**
 * Reine Datenfunktionen für das Modul „Einstellungen & Datenverwaltung“ (M14)
 * – ohne React, unabhängig testbar (Muster src/data/goals.ts). `updateSettings`
 * ist pur, mutiert nie die Eingabe (Top-Level-Shallow-Klon) und gibt entweder
 * neues FinanceData oder ein Fehlerobjekt mit deutscher, feldbezogener
 * Meldung zurück. Fehlertexte nennen NAMEN, nie technische IDs.
 *
 * Verbindliche Regeln (Spec M14, data-architect-ratifiziert, A6/A7):
 * - Teil-Patch: `undefined` im Patch bedeutet „nicht ändern“ (K2-Muster).
 * - Wertebereiche identisch zur Ladevalidierung (keine stillen Abweichungen):
 *   factor ∈ [3; 5]; netIncomeMonthly > 0 endlich; manualOverrideAmount > 0
 *   endlich oder null (null = Rücksetzen auf die automatische Berechnung);
 *   monthlySavingsBudget ≥ 0 endlich oder null („offen“ – keine Budgetprüfung);
 *   percentDecimals Ganzzahl 0–4 (A6); backup.mode nur Enum-Werte;
 *   retentionCount Ganzzahl ≥ 1; activeTargetProfileId existierendes Profil
 *   oder null.
 * - K2-Byte-Identität: optionale Schlüssel werden NIE als Default-Schlüssel
 *   neu materialisiert (ein Rücksetzen auf null legt keinen fehlenden
 *   Schlüssel an; ein vorhandener Schlüssel bleibt als null erhalten, A7);
 *   ein No-Op-Patch serialisiert Byte-identisch.
 * - display.numberLocale hat KEINEN Schreibpfad (A7) – V1 ist durchgehend
 *   deutsch (de-DE/EUR/TT.MM.JJJJ); die Seite zeigt das als read-only an.
 * - Es werden keine berechneten Werte gespeichert (Notgroschen-Vorschau,
 *   Budget-Auswertungen und Warnungen sind reine Anzeige).
 */

import type { BackupMode, FinanceData, Settings } from '../types/finance'

export interface SettingsInput {
  /** Notgroschen-Faktor n ∈ [3; 5]. */
  factor?: number
  /** Monatliches Netto > 0 (reine Bezugsgröße – es wird nichts daraus gebucht). */
  netIncomeMonthly?: number
  /** Manueller Notgroschen-Zielbetrag > 0 oder null (= automatische Berechnung). */
  manualOverrideAmount?: number | null
  /** Monatliches Sparbudget ≥ 0 oder null (= „offen“, keine Budgetwarnung). */
  monthlySavingsBudget?: number | null
  /** Dezimalstellen der Prozentanzeige, Ganzzahl 0–4 (A6). */
  percentDecimals?: number
  /** Sicherungsmodus (kein „aus“-Zustand – bewusste V1-Grenze). */
  backupMode?: BackupMode
  /** Empfohlene Aufbewahrungsanzahl, Ganzzahl ≥ 1 (reine Empfehlung, M5). */
  retentionCount?: number
  /** Aktives Zielprofil (existierende Profil-ID) oder null. */
  activeTargetProfileId?: string | null
}

export type SettingsActionResult =
  | { ok: true; data: FinanceData }
  | { ok: false; error: string }

const BACKUP_MODES: readonly BackupMode[] = ['everySave', 'dailyFirstSave']

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Fachliche Prüfung des Patches. Liefert null bei Erfolg, sonst die deutsche,
 * feldbezogene Meldung (Feld-Präfix wie „Faktor:“ für die B3-Zuordnung).
 */
function checkSettingsInput(data: FinanceData, changes: SettingsInput): string | null {
  if (changes.factor !== undefined) {
    if (!isFiniteNumber(changes.factor)) {
      return 'Faktor: Der Notgroschen-Faktor muss eine endliche Zahl sein.'
    }
    if (changes.factor < 3 || changes.factor > 5) {
      return 'Faktor: Der Notgroschen-Faktor muss zwischen 3 und 5 liegen (Standard 4).'
    }
  }
  if (changes.netIncomeMonthly !== undefined) {
    if (!isFiniteNumber(changes.netIncomeMonthly) || changes.netIncomeMonthly <= 0) {
      return 'Netto: Das monatliche Netto muss eine endliche Zahl größer als 0 sein.'
    }
  }
  if (changes.manualOverrideAmount !== undefined && changes.manualOverrideAmount !== null) {
    if (!isFiniteNumber(changes.manualOverrideAmount) || changes.manualOverrideAmount <= 0) {
      return 'Manueller Zielbetrag: Der manuelle Notgroschen-Zielbetrag muss größer als 0 sein – zum Rücksetzen auf die automatische Berechnung die Übersteuerung entfernen.'
    }
  }
  if (changes.monthlySavingsBudget !== undefined && changes.monthlySavingsBudget !== null) {
    if (!isFiniteNumber(changes.monthlySavingsBudget) || changes.monthlySavingsBudget < 0) {
      return 'Sparbudget: Das monatliche Sparbudget muss größer oder gleich 0 sein – ohne Grenzwert bleibt das Budget „offen“.'
    }
  }
  if (changes.percentDecimals !== undefined) {
    if (
      !isFiniteNumber(changes.percentDecimals) ||
      !Number.isInteger(changes.percentDecimals) ||
      changes.percentDecimals < 0 ||
      changes.percentDecimals > 4
    ) {
      return 'Prozent-Dezimalstellen: Bitte eine Ganzzahl zwischen 0 und 4 wählen.'
    }
  }
  if (changes.backupMode !== undefined && !BACKUP_MODES.includes(changes.backupMode)) {
    return 'Sicherungsmodus: Unbekannter Sicherungsmodus – zulässig sind „bei jedem Speichern“ und „täglich beim ersten Speichern“.'
  }
  if (changes.retentionCount !== undefined) {
    if (
      !isFiniteNumber(changes.retentionCount) ||
      !Number.isInteger(changes.retentionCount) ||
      changes.retentionCount < 1
    ) {
      return 'Aufbewahrungsanzahl: Die empfohlene Aufbewahrungsanzahl muss eine Ganzzahl größer oder gleich 1 sein.'
    }
  }
  if (
    changes.activeTargetProfileId !== undefined &&
    changes.activeTargetProfileId !== null &&
    !data.targetProfiles.some((profile) => profile.id === changes.activeTargetProfileId)
  ) {
    // Bewusste Ausnahme von der „Fehlertexte mit Profil-NAMEN“-Regel: ein
    // NICHT existentes Profil HAT keinen Namen im Bestand – jede Nennung wäre
    // entweder die technische ID (verboten) oder erfunden. Der Text bleibt
    // deshalb generisch; die UI verhindert den Fall ohnehin (Auswahl nur aus
    // vorhandenen Profilen), er deckt Race-Fälle nach Import/Neuladen ab.
    return 'Zielprofil: Das gewählte Zielprofil existiert nicht im geladenen Bestand. Bitte ein vorhandenes Profil wählen.'
  }
  return null
}

/**
 * Aktualisiert die Einstellungen als Teil-Patch (exakt das goals.ts-K2-Muster,
 * A7). Unbekannte Felder und die Schlüsselreihenfolge bleiben per Spread
 * erhalten (Regel 16); nur tatsächlich geänderte Unterobjekte werden flach
 * geklont. Optionale Schlüssel (manualOverrideAmount, monthlySavingsBudget,
 * activeTargetProfileId, backup, display) werden nie als Default-Schlüssel
 * NEU angelegt – unverändertes Speichern bleibt Byte-identisch.
 */
export function updateSettings(data: FinanceData, changes: SettingsInput): SettingsActionResult {
  const issue = checkSettingsInput(data, changes)
  if (issue !== null) return { ok: false, error: issue }

  const settings = data.settings
  const updated: Settings = { ...settings }

  // --- emergencyFund (Pflichtobjekt; manualOverrideAmount optionaler Schlüssel) ---
  if (
    changes.factor !== undefined ||
    changes.netIncomeMonthly !== undefined ||
    changes.manualOverrideAmount !== undefined
  ) {
    const fund = { ...settings.emergencyFund }
    if (changes.factor !== undefined) fund.factor = changes.factor
    if (changes.netIncomeMonthly !== undefined) fund.netIncomeMonthly = changes.netIncomeMonthly
    if (changes.manualOverrideAmount !== undefined) {
      // K2/A7: Rücksetzen (null) legt den Schlüssel nie NEU an; ein
      // vorhandener Schlüssel bleibt als null erhalten.
      if (
        changes.manualOverrideAmount !== null ||
        settings.emergencyFund.manualOverrideAmount !== undefined
      ) {
        fund.manualOverrideAmount = changes.manualOverrideAmount
      }
    }
    updated.emergencyFund = fund
  }

  // --- monthlySavingsBudget (optionaler Schlüssel) ---
  if (changes.monthlySavingsBudget !== undefined) {
    if (changes.monthlySavingsBudget !== null || settings.monthlySavingsBudget !== undefined) {
      updated.monthlySavingsBudget = changes.monthlySavingsBudget
    }
  }

  // --- backup (optionales Objekt; wird nur bei tatsächlicher Änderung materialisiert) ---
  if (changes.backupMode !== undefined || changes.retentionCount !== undefined) {
    const backup = { ...(settings.backup ?? {}) }
    if (changes.backupMode !== undefined) backup.mode = changes.backupMode
    if (changes.retentionCount !== undefined) backup.retentionCount = changes.retentionCount
    updated.backup = backup
  }

  // --- display (optionales Objekt; numberLocale hat KEINEN Schreibpfad, A7) ---
  if (changes.percentDecimals !== undefined) {
    const display = { ...(settings.display ?? {}) }
    display.percentDecimals = changes.percentDecimals
    updated.display = display
  }

  // --- activeTargetProfileId (optionaler Schlüssel) ---
  if (changes.activeTargetProfileId !== undefined) {
    if (changes.activeTargetProfileId !== null || settings.activeTargetProfileId !== undefined) {
      updated.activeTargetProfileId = changes.activeTargetProfileId
    }
  }

  return { ok: true, data: { ...data, settings: updated } }
}
