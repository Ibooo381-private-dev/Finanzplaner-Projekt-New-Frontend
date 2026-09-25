/**
 * ST4 (Mapping DM4/DM12): schemaVersion-Prüfung und leere Datei.
 * fehlend / "1" als String / 1.5 → E_SCHEMA_VERSION; 2 → Text „neueren Version";
 * 0 → Ablehnung; 1 → ok; Serialisat enthält "schemaVersion": 1;
 * createEmptyFinanceData besteht die Vollvalidierung.
 */

import { describe, expect, it } from 'vitest'
import { validateFinanceData } from '../../src/validation/validateFinanceData'
import { serializeFinanceData } from '../../src/storage/serializer'
import { createEmptyFinanceData } from '../../src/storage/emptyFile'
import { SUPPORTED_SCHEMA_VERSION } from '../../src/types/finance'
import { mutateExample } from './fixtures'

const NOW_ISO = '2026-07-19T10:30:00.000Z'

function expectSchemaVersionError(raw: unknown): string {
  const result = validateFinanceData(raw)
  expect(result.ok).toBe(false)
  expect(result.data).toBeNull()
  const issue = result.errors.find((entry) => entry.code === 'E_SCHEMA_VERSION')
  expect(
    issue,
    `Erwartet: E_SCHEMA_VERSION. Erhalten: ${JSON.stringify(result.errors)}`,
  ).toBeDefined()
  expect(issue!.path).toBe('schemaVersion')
  return issue!.message
}

describe('ST4 – schemaVersion (DM4/DM12)', () => {
  it('SUPPORTED_SCHEMA_VERSION ist 1', () => {
    expect(SUPPORTED_SCHEMA_VERSION).toBe(1)
  })

  it('fehlende schemaVersion → E_SCHEMA_VERSION', () => {
    const draft = mutateExample((data) => {
      delete data.schemaVersion
    })
    expectSchemaVersionError(draft)
  })

  it('schemaVersion "1" als String → E_SCHEMA_VERSION', () => {
    const draft = mutateExample((data) => {
      data.schemaVersion = '1'
    })
    expectSchemaVersionError(draft)
  })

  it('schemaVersion 1.5 (kein Integer) → E_SCHEMA_VERSION', () => {
    const draft = mutateExample((data) => {
      data.schemaVersion = 1.5
    })
    expectSchemaVersionError(draft)
  })

  it('schemaVersion 2 → Ablehnungstext enthält „neueren Version" und „nicht verändert"', () => {
    const draft = mutateExample((data) => {
      data.schemaVersion = 2
    })
    const message = expectSchemaVersionError(draft)
    expect(message).toContain('neueren Version')
    expect(message).toContain('Deine Datei wurde nicht verändert')
  })

  it('schemaVersion 0 → Ablehnung', () => {
    const draft = mutateExample((data) => {
      data.schemaVersion = 0
    })
    expectSchemaVersionError(draft)
  })

  it('schemaVersion 1 → ok', () => {
    const draft = mutateExample(() => {})
    const result = validateFinanceData(draft)
    expect(result.ok).toBe(true)
    expect(result.data!.schemaVersion).toBe(1)
  })

  it('das Serialisat enthält "schemaVersion": 1', () => {
    const draft = mutateExample(() => {})
    const result = validateFinanceData(draft)
    expect(result.ok).toBe(true)
    expect(serializeFinanceData(result.data!)).toContain('"schemaVersion": 1')
  })

  it('createEmptyFinanceData besteht die Vollvalidierung (ohne Fehler und ohne Warnungen)', () => {
    const empty = createEmptyFinanceData(NOW_ISO)
    const result = validateFinanceData(empty, { todayIso: '2026-07-19' })
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.warnings).toEqual([])
    expect(empty.schemaVersion).toBe(1)
    expect(empty.metadata.createdAt).toBe(NOW_ISO)
    expect(empty.metadata.updatedAt).toBe(NOW_ISO)
    // Dokumentierte Standardwerte (requirements.md M14): Faktor 4, Netto 1.170 EUR.
    expect(empty.settings.emergencyFund.factor).toBe(4)
    expect(empty.settings.emergencyFund.netIncomeMonthly).toBe(1170)
  })
})
