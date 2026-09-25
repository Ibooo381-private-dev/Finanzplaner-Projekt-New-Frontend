/**
 * Datenlayer-Tests des Moduls „Einstellungen & Datenverwaltung“ (M14):
 * updateSettings (alle Feld-Validierungen, Override setzen/Rücksetzen,
 * K2-No-Op-Byte-Identität, keine Default-Materialisierung, Mutationsfreiheit,
 * Fehlertexte ohne IDs, Stop-Test „nur settings ersetzt“),
 * shouldAutoBackup-Unit-Tests (beide Modi, Tageswechsel, KORRIGIERT:
 * undefined-mode → TRUE = everySave-Default, KORREKTUR Nr. 3) sowie die
 * additive Ladeverschärfung percentDecimals Ganzzahl 0–4 (A6, §6-Ausweis).
 */

import { describe, expect, it } from 'vitest'
import type { BackupMode, FinanceData } from '../../src/types/finance'
import { updateSettings } from '../../src/data/settings'
import { shouldAutoBackup } from '../../src/storage/autoBackup'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { loadExample, mutateExample } from '../storage/fixtures'

function json(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/** Beispieldaten mit gezielt angepasstem settings-Block (immer frisch geladen). */
function exampleWithSettings(mutator: (settings: Record<string, unknown>) => void): FinanceData {
  const data = loadExample()
  mutator(data.settings as unknown as Record<string, unknown>)
  return data
}

describe('updateSettings – Feld-Validierungen', () => {
  const data = loadExample()

  it.each([
    [2.9, false],
    [5.1, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [3, true],
    [4.5, true],
    [5, true],
  ])('Faktor %s → ok=%s', (factor, ok) => {
    const result = updateSettings(data, { factor: factor as number })
    expect(result.ok).toBe(ok)
    if (!result.ok) expect(result.error).toMatch(/^Faktor:/)
  })

  it.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'Netto %s wird abgelehnt',
    (net) => {
      const result = updateSettings(data, { netIncomeMonthly: net as number })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/^Netto:/)
    },
  )

  it.each([[0], [-100], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'manueller Zielbetrag %s wird abgelehnt (nur > 0 oder null)',
    (amount) => {
      const result = updateSettings(data, { manualOverrideAmount: amount as number })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/^Manueller Zielbetrag:/)
    },
  )

  it('Sparbudget: negativ abgelehnt; 0 und null zulässig', () => {
    const negative = updateSettings(data, { monthlySavingsBudget: -1 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.error).toMatch(/^Sparbudget:/)
    expect(updateSettings(data, { monthlySavingsBudget: 0 }).ok).toBe(true)
    expect(updateSettings(data, { monthlySavingsBudget: null }).ok).toBe(true)
  })

  it.each([[5], [-1], [1.5], [2.5]])('percentDecimals %s wird abgelehnt', (decimals) => {
    const result = updateSettings(data, { percentDecimals: decimals as number })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Prozent-Dezimalstellen:/)
  })

  it.each([[0], [1], [2], [3], [4]])('percentDecimals %s ist zulässig', (decimals) => {
    expect(updateSettings(data, { percentDecimals: decimals as number }).ok).toBe(true)
  })

  it('Sicherungsmodus: unbekannter Wert abgelehnt, beide Enum-Werte zulässig', () => {
    const result = updateSettings(data, { backupMode: 'foo' as BackupMode })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Sicherungsmodus:/)
    expect(updateSettings(data, { backupMode: 'everySave' }).ok).toBe(true)
    expect(updateSettings(data, { backupMode: 'dailyFirstSave' }).ok).toBe(true)
  })

  it.each([[0], [-1], [1.5]])('Aufbewahrungsanzahl %s wird abgelehnt', (retention) => {
    const result = updateSettings(data, { retentionCount: retention as number })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Aufbewahrungsanzahl:/)
  })

  it('Zielprofil: tote Profil-Referenz abgelehnt – Fehlertext ohne technische ID', () => {
    const result = updateSettings(data, { activeTargetProfileId: 'tp-gibt-es-nicht' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/^Zielprofil:/)
      expect(result.error).not.toContain('tp-')
    }
    expect(updateSettings(data, { activeTargetProfileId: 'tp-job' }).ok).toBe(true)
    expect(updateSettings(data, { activeTargetProfileId: null }).ok).toBe(true)
  })

  it('alle Fehlertexte sind deutsch, feldnah und ohne technische IDs', () => {
    const failures = [
      updateSettings(data, { factor: 2 }),
      updateSettings(data, { netIncomeMonthly: 0 }),
      updateSettings(data, { manualOverrideAmount: -5 }),
      updateSettings(data, { monthlySavingsBudget: -1 }),
      updateSettings(data, { percentDecimals: 9 }),
      updateSettings(data, { backupMode: 'aus' as BackupMode }),
      updateSettings(data, { retentionCount: 0 }),
      updateSettings(data, { activeTargetProfileId: 'tp-tot' }),
    ]
    for (const result of failures) {
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).not.toMatch(/\b(?:acc|pos|goal|plan|tp|sim)-[a-z0-9-]+/)
        expect(result.error).toMatch(/^[A-ZÄÖÜ][^:]*: /)
      }
    }
  })
})

describe('updateSettings – Override setzen und zurücksetzen (M12-Regel)', () => {
  it('setzt den manuellen Zielbetrag; Faktor und Netto bleiben unverändert', () => {
    const data = loadExample()
    const result = updateSettings(data, { manualOverrideAmount: 5000 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.settings.emergencyFund.manualOverrideAmount).toBe(5000)
      expect(result.data.settings.emergencyFund.factor).toBe(4)
      expect(result.data.settings.emergencyFund.netIncomeMonthly).toBe(1170)
    }
  })

  it('Rücksetzen = null: der VORHANDENE Schlüssel bleibt als null erhalten (A7)', () => {
    const data = loadExample()
    const set = updateSettings(data, { manualOverrideAmount: 5000 })
    expect(set.ok).toBe(true)
    if (!set.ok) return
    const reset = updateSettings(set.data, { manualOverrideAmount: null })
    expect(reset.ok).toBe(true)
    if (reset.ok) {
      expect(reset.data.settings.emergencyFund.manualOverrideAmount).toBeNull()
      expect('manualOverrideAmount' in reset.data.settings.emergencyFund).toBe(true)
    }
  })

  it('K2: Rücksetzen ohne vorhandenen Schlüssel materialisiert nichts (Byte-identisch)', () => {
    const data = loadExample()
    delete data.settings.emergencyFund.manualOverrideAmount
    const before = json(data)
    const result = updateSettings(data, { manualOverrideAmount: null })
    expect(result.ok).toBe(true)
    if (result.ok) expect(json(result.data)).toBe(before)
  })

  it('ein gesetzter Override bleibt bei Netto-Änderung bestehen (T7 – nie ungefragt ersetzt)', () => {
    const data = exampleWithSettings((settings) => {
      ;(settings['emergencyFund'] as Record<string, unknown>)['manualOverrideAmount'] = 5000
    })
    const result = updateSettings(data, { netIncomeMonthly: 2000 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.settings.emergencyFund.manualOverrideAmount).toBe(5000)
      expect(result.data.settings.emergencyFund.netIncomeMonthly).toBe(2000)
    }
  })
})

describe('updateSettings – K2-Byte-Identität und keine Default-Materialisierung', () => {
  it('leerer Patch und wertgleicher Patch sind Byte-identisch', () => {
    const data = loadExample()
    const before = json(data)
    const noop = updateSettings(data, {})
    expect(noop.ok).toBe(true)
    if (noop.ok) expect(json(noop.data)).toBe(before)
    const sameValues = updateSettings(data, {
      factor: 4,
      netIncomeMonthly: 1170,
      manualOverrideAmount: null,
      monthlySavingsBudget: null,
      percentDecimals: 2,
      backupMode: 'everySave',
      retentionCount: 10,
      activeTargetProfileId: 'tp-student-sparplan',
    })
    expect(sameValues.ok).toBe(true)
    if (sameValues.ok) expect(json(sameValues.data)).toBe(before)
  })

  it('fehlende optionale Blöcke (backup/display/Budget/Profil) werden bei fremden Patches nie materialisiert', () => {
    const data = exampleWithSettings((settings) => {
      delete settings['backup']
      delete settings['display']
      delete settings['monthlySavingsBudget']
      delete settings['activeTargetProfileId']
    })
    const before = json(data)
    const result = updateSettings(data, { factor: 3 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('backup' in result.data.settings).toBe(false)
      expect('display' in result.data.settings).toBe(false)
      expect('monthlySavingsBudget' in result.data.settings).toBe(false)
      expect('activeTargetProfileId' in result.data.settings).toBe(false)
      expect(result.data.settings.emergencyFund.factor).toBe(3)
    }
    // Die Eingabe selbst blieb unverändert (Mutationsfreiheit).
    expect(json(data)).toBe(before)
  })

  it('setzt der Patch einen Wert im fehlenden backup-Block, entsteht NUR der gesetzte Schlüssel', () => {
    const data = exampleWithSettings((settings) => {
      delete settings['backup']
    })
    const result = updateSettings(data, { backupMode: 'dailyFirstSave' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.settings.backup).toEqual({ mode: 'dailyFirstSave' })
      expect('retentionCount' in (result.data.settings.backup ?? {})).toBe(false)
    }
  })

  it('unbekannte Zusatzfelder in settings/emergencyFund/backup überleben den Patch (Regel 16)', () => {
    const data = loadExample()
    ;(data.settings as Record<string, unknown>)['zukunftsfeld'] = 'bleibt'
    ;(data.settings.emergencyFund as Record<string, unknown>)['notiz'] = 'bleibt auch'
    const result = updateSettings(data, { factor: 5, backupMode: 'dailyFirstSave' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.data.settings as Record<string, unknown>)['zukunftsfeld']).toBe('bleibt')
      expect((result.data.settings.emergencyFund as Record<string, unknown>)['notiz']).toBe(
        'bleibt auch',
      )
      expect(result.data.settings.backup?.retentionCount).toBe(10)
    }
  })
})

describe('updateSettings – Mutationsfreiheit und Stop-Test (nur settings ersetzt)', () => {
  it('mutiert die Eingabe nie', () => {
    const data = loadExample()
    const before = json(data)
    updateSettings(data, {
      factor: 5,
      netIncomeMonthly: 2000,
      manualOverrideAmount: 9000,
      monthlySavingsBudget: 500,
      percentDecimals: 0,
      backupMode: 'dailyFirstSave',
      retentionCount: 3,
      activeTargetProfileId: 'tp-job',
    })
    expect(json(data)).toBe(before)
  })

  it('AK-Stop-Bedingung: ausschließlich settings wird ersetzt – alle übrigen Bereiche referenzidentisch', () => {
    const data = loadExample()
    const result = updateSettings(data, { monthlySavingsBudget: 250 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.settings).not.toBe(data.settings)
    expect(result.data.metadata).toBe(data.metadata)
    expect(result.data.accounts).toBe(data.accounts)
    expect(result.data.portfolioPositions).toBe(data.portfolioPositions)
    expect(result.data.snapshots).toBe(data.snapshots)
    expect(result.data.savingsPlans).toBe(data.savingsPlans)
    expect(result.data.targetProfiles).toBe(data.targetProfiles)
    expect(result.data.goals).toBe(data.goals)
    expect(result.data.transactions).toBe(data.transactions)
    expect(result.data.plannedChanges).toBe(data.plannedChanges)
    expect(result.data.simulations).toBe(data.simulations)
    expect(result.data.importHistory).toBe(data.importHistory)
  })
})

describe('shouldAutoBackup (reine Funktion, KORREKTUR Nr. 3)', () => {
  const TODAY = '2026-07-20'
  const YESTERDAY = '2026-07-19'

  it('everySave: immer true (unabhängig vom Tagesmerker)', () => {
    expect(shouldAutoBackup('everySave', null, TODAY)).toBe(true)
    expect(shouldAutoBackup('everySave', TODAY, TODAY)).toBe(true)
    expect(shouldAutoBackup('everySave', YESTERDAY, TODAY)).toBe(true)
  })

  it('KORRIGIERT: fehlender Modus (undefined) WIRKT als everySave → true', () => {
    expect(shouldAutoBackup(undefined, null, TODAY)).toBe(true)
    expect(shouldAutoBackup(undefined, TODAY, TODAY)).toBe(true)
  })

  it('dailyFirstSave: nur beim ersten Speichern des Kalendertags', () => {
    expect(shouldAutoBackup('dailyFirstSave', null, TODAY)).toBe(true)
    expect(shouldAutoBackup('dailyFirstSave', YESTERDAY, TODAY)).toBe(true)
    expect(shouldAutoBackup('dailyFirstSave', TODAY, TODAY)).toBe(false)
  })

  it('dailyFirstSave: Tageswechsel gibt den nächsten Backup-Lauf wieder frei', () => {
    expect(shouldAutoBackup('dailyFirstSave', TODAY, '2026-07-21')).toBe(true)
  })
})

describe('Ladevalidierung – percentDecimals Ganzzahl 0–4 (A6, §6-Ausweis)', () => {
  function withDecimals(value: unknown): string {
    const draft = mutateExample((data) => {
      ;(data.settings['display'] as Record<string, unknown>)['percentDecimals'] = value
    })
    return JSON.stringify(draft)
  }

  it.each([[0], [4]])('percentDecimals %s lädt', (value) => {
    const result = parseFinanceJson(withDecimals(value))
    expect(result.ok).toBe(true)
  })

  it.each([[5], [-1], [2.5]])('percentDecimals %s → E_SETTINGS_RANGE', (value) => {
    const result = parseFinanceJson(withDecimals(value))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (issue) =>
          issue.code === 'E_SETTINGS_RANGE' && issue.path === 'settings.display.percentDecimals',
      ),
    ).toBe(true)
  })

  it('Beispieldatei (2) lädt unverändert – kein bestehender Bestand wird neu abgelehnt', () => {
    expect(parseFinanceJson(JSON.stringify(loadExample(), null, 2)).ok).toBe(true)
  })
})
