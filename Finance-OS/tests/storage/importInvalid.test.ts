/**
 * ST2 (Mapping DM4): Ungültige Dateien werden mit korrektem Fehlercode,
 * deutschem Text und path abgelehnt (ok: false, data: null).
 * Alle ungültigen Fälle entstehen programmatisch aus dem Klon der Beispieldatei.
 *
 * Index-Anker in der Beispieldatei (user-data/finance-data.example.json):
 *   accounts[2] = acc-vw-tagesgeld, accounts[4] = acc-tr-depot
 *   savingsPlans[2] = sp-tr-spdr (own_fixed), savingsPlans[7] = sp-ing-ruecklage (reserve_transfer)
 *   targetProfiles[2] = tp-job (6 Gewichte, Summe 1,0)
 */

import { describe, expect, it } from 'vitest'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { validateFinanceData } from '../../src/validation/validateFinanceData'
import type { ValidationResult } from '../../src/validation/issues'
import { mutateExample } from './fixtures'

function expectRejectedWith(result: ValidationResult, code: string, path: string): void {
  expect(result.ok).toBe(false)
  expect(result.data).toBeNull()
  const match = result.errors.find((issue) => issue.code === code && issue.path === path)
  expect(
    match,
    `Erwartet: Fehler ${code} unter "${path}". Erhalten: ${JSON.stringify(result.errors)}`,
  ).toBeDefined()
  // Deutsche, nicht-leere Meldung.
  expect(match!.message.length).toBeGreaterThan(10)
}

describe('ST2 – ungültige Dateien werden verständlich abgelehnt (DM4)', () => {
  it('kaputtes JSON → E_PARSE mit deutscher Meldung', () => {
    const result = parseFinanceJson('{ "schemaVersion": 1, ')
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('E_PARSE')
    expect(result.errors[0].message).toContain('kein gültiges JSON')
  })

  it('komplett leeres Objekt {} → genau ein E_SCHEMA_VERSION, kein Absturz', () => {
    const result = validateFinanceData({})
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    // Versionsprüfung bricht sofort ab: genau EIN Fehler, keine Folgefehler.
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('E_SCHEMA_VERSION')
    expect(result.errors[0].path).toBe('schemaVersion')
    expect(result.warnings).toEqual([])
  })

  it('nur { schemaVersion: 1 } → E_MISSING_KEY für alle 9 Pflicht-Top-Level-Schlüssel, kein Absturz', () => {
    const result = validateFinanceData({ schemaVersion: 1 })
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
    const missingPaths = result.errors
      .filter((issue) => issue.code === 'E_MISSING_KEY')
      .map((issue) => issue.path)
      .sort()
    expect(missingPaths).toEqual([
      'accounts',
      'goals',
      'importHistory',
      'metadata',
      'portfolioPositions',
      'savingsPlans',
      'settings',
      'snapshots',
      'targetProfiles',
    ])
  })

  it('fehlende schemaVersion → E_SCHEMA_VERSION', () => {
    const draft = mutateExample((data) => {
      delete data.schemaVersion
    })
    expectRejectedWith(validateFinanceData(draft), 'E_SCHEMA_VERSION', 'schemaVersion')
  })

  it('Betrag als String → E_MONEY_TYPE (accounts[2].balanceHistory[0].amount)', () => {
    const draft = mutateExample((data) => {
      data.accounts[2].balanceHistory[0].amount = '627,59'
    })
    const result = validateFinanceData(draft)
    expectRejectedWith(result, 'E_MONEY_TYPE', 'accounts[2].balanceHistory[0].amount')
    const issue = result.errors.find((entry) => entry.code === 'E_MONEY_TYPE')!
    expect(issue.message).toContain('627,59') // Ist-Wert wird genannt
  })

  it('negativer Sparplan-Betrag → E_NEGATIVE_AMOUNT (erste U4-Verteidigungslinie, L1)', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans[0].amount = -5
    })
    expectRejectedWith(validateFinanceData(draft), 'E_NEGATIVE_AMOUNT', 'savingsPlans[0].amount')
  })

  it('Zielbetrag 0 → E_SETTINGS_RANGE (targetAmount muss > 0 oder null sein, L1)', () => {
    const draft = mutateExample((data) => {
      data.goals[1].targetAmount = 0
    })
    expectRejectedWith(validateFinanceData(draft), 'E_SETTINGS_RANGE', 'goals[1].targetAmount')
  })

  it('doppelte ID → E_DUPLICATE_ID', () => {
    const draft = mutateExample((data) => {
      data.accounts[1].id = 'acc-sparkasse-giro' // Duplikat von accounts[0]
    })
    expectRejectedWith(validateFinanceData(draft), 'E_DUPLICATE_ID', 'accounts[1].id')
  })

  it('tote Konto-Referenz einer Position → E_REF_ACCOUNT', () => {
    const draft = mutateExample((data) => {
      data.portfolioPositions[0].accountId = 'acc-gibt-es-nicht'
    })
    expectRejectedWith(
      validateFinanceData(draft),
      'E_REF_ACCOUNT',
      'portfolioPositions[0].accountId',
    )
  })

  it('tote Ziel-Referenz eines Sparplans → E_REF_TARGET', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans[2].targetId = 'pos-gibt-es-nicht'
    })
    expectRejectedWith(validateFinanceData(draft), 'E_REF_TARGET', 'savingsPlans[2].targetId')
  })

  it('Gewichtssumme 0,9 → E_WEIGHT_SUM mit Ist-Summe in der Meldung (DM10)', () => {
    const draft = mutateExample((data) => {
      // tp-job: letztes Gewicht (Telekom 0.1) auf 0 → Summe 0.9.
      data.targetProfiles[2].weights![5].weight = 0
    })
    const result = validateFinanceData(draft)
    expectRejectedWith(result, 'E_WEIGHT_SUM', 'targetProfiles[2].weights')
    const issue = result.errors.find((entry) => entry.code === 'E_WEIGHT_SUM')!
    expect(issue.message).toMatch(/0[.,]9/) // Meldung nennt die Ist-Summe 0,9
  })

  it('reserve_transfer auf Position → E_FLOWTYPE (DM17)', () => {
    const draft = mutateExample((data) => {
      // sp-ing-ruecklage (reserve_transfer) auf eine Position umbiegen.
      data.savingsPlans[7].targetKind = 'position'
      data.savingsPlans[7].targetId = 'pos-ishares-gold-etc'
    })
    expectRejectedWith(validateFinanceData(draft), 'E_FLOWTYPE', 'savingsPlans[7].flowType')
  })

  it('amount null bei own_fixed → E_AMOUNT_NULL (DM18)', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans[2].amount = null // sp-tr-spdr hat flowType own_fixed
    })
    expectRejectedWith(validateFinanceData(draft), 'E_AMOUNT_NULL', 'savingsPlans[2].amount')
  })

  it('Depot-Konto mit Saldo-Historie → E_DEPOT_BALANCE (DM19)', () => {
    const draft = mutateExample((data) => {
      data.accounts[4].balanceHistory = [{ date: '2026-07-18', amount: 100 }] // acc-tr-depot
    })
    expectRejectedWith(validateFinanceData(draft), 'E_DEPOT_BALANCE', 'accounts[4].balanceHistory')
  })

  it('negativer Saldo ohne allowNegativeBalance → E_NEGATIVE_AMOUNT (DM20)', () => {
    const draft = mutateExample((data) => {
      data.accounts[2].balanceHistory[0].amount = -5 // VW-Tagesgeld erlaubt keine negativen Salden
    })
    expectRejectedWith(
      validateFinanceData(draft),
      'E_NEGATIVE_AMOUNT',
      'accounts[2].balanceHistory[0].amount',
    )
  })

  it('negativer Saldo MIT allowNegativeBalance bleibt gültig (Gegenprobe DM20)', () => {
    const draft = mutateExample((data) => {
      data.accounts[0].balanceHistory = [{ date: '2026-07-18', amount: -50 }] // Girokonto: allowNegativeBalance true
    })
    expect(validateFinanceData(draft).ok).toBe(true)
  })

  it('doppeltes Datum in einer Historie → E_DUPLICATE_DATE (DM23)', () => {
    const draft = mutateExample((data) => {
      data.accounts[2].balanceHistory = [
        { date: '2026-07-17', amount: 627.59 },
        { date: '2026-07-17', amount: 630 },
      ]
    })
    expectRejectedWith(
      validateFinanceData(draft),
      'E_DUPLICATE_DATE',
      'accounts[2].balanceHistory[1].date',
    )
  })

  it('importHistory mit 51 Einträgen in der DATEI → E_IMPORT_HISTORY mit Ist-Anzahl (DM22)', () => {
    const draft = mutateExample((data) => {
      data.importHistory = Array.from({ length: 51 }, (_, index) => ({
        id: `imp-${String(index).padStart(3, '0')}`,
        timestamp: '2026-07-19T10:30:00.000Z',
        action: 'import',
        fileName: null,
        fileSchemaVersion: 1,
        outcome: 'applied',
        note: null,
      }))
    })
    const result = validateFinanceData(draft)
    expectRejectedWith(result, 'E_IMPORT_HISTORY', 'importHistory')
    const issue = result.errors.find((entry) => entry.code === 'E_IMPORT_HISTORY')!
    expect(issue.message).toContain('51') // Ist-Anzahl wird genannt
    expect(issue.message).toContain('50') // Obergrenze wird genannt
  })

  it('Gegenprobe DM22: importHistory mit genau 50 Einträgen bleibt gültig', () => {
    const draft = mutateExample((data) => {
      data.importHistory = Array.from({ length: 50 }, (_, index) => ({
        id: `imp-${String(index).padStart(3, '0')}`,
        timestamp: '2026-07-19T10:30:00.000Z',
        action: 'import',
        fileName: null,
        fileSchemaVersion: 1,
        outcome: 'applied',
        note: null,
      }))
    })
    expect(validateFinanceData(draft).ok).toBe(true)
  })

  it('deutsches Datumsformat "17.07.2026" → E_DATE_FORMAT (DM14)', () => {
    const draft = mutateExample((data) => {
      data.accounts[2].balanceHistory[0].date = '17.07.2026'
    })
    const result = validateFinanceData(draft)
    expectRejectedWith(result, 'E_DATE_FORMAT', 'accounts[2].balanceHistory[0].date')
    const issue = result.errors.find((entry) => entry.code === 'E_DATE_FORMAT')!
    expect(issue.message).toContain('17.07.2026') // Ist-Wert wird genannt
  })

  // --- Regressionstests zu Review-Befund 3.4 (geschlossene Validierungslücken) ---

  it('level1-Anteile außerhalb [0;1] trotz korrekter Summe → abgelehnt (Review 3.4)', () => {
    const draft = mutateExample((data) => {
      // Summe 1,5 + (−0,5) = 1,0 – die reine Summenprüfung würde das akzeptieren.
      data.targetProfiles[2]['level1'] = { depotShare: 1.5, cashShare: -0.5 }
    })
    const result = validateFinanceData(draft)
    expectRejectedWith(result, 'E_NOT_FINITE', 'targetProfiles[2].level1.depotShare')
    expectRejectedWith(result, 'E_NOT_FINITE', 'targetProfiles[2].level1.cashShare')
  })

  it('negativer minAmount → E_NEGATIVE_AMOUNT (Review 3.4)', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans[0]['minAmount'] = -5
    })
    expectRejectedWith(validateFinanceData(draft), 'E_NEGATIVE_AMOUNT', 'savingsPlans[0].minAmount')
  })

  it('negativer plannedMonthlyAmount → E_NEGATIVE_AMOUNT (Review 3.4; M11: keine Rate < 0)', () => {
    const draft = mutateExample((data) => {
      data.plannedChanges = [
        {
          id: 'plan-test-negativ',
          createdAt: '2026-07-19T10:30:00.000Z',
          basedOnProfileId: 'tp-job',
          status: 'planned',
          items: [{ refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: -12.5 }],
          note: null,
        },
      ]
    })
    expectRejectedWith(
      validateFinanceData(draft),
      'E_NEGATIVE_AMOUNT',
      'plannedChanges[0].items[0].plannedMonthlyAmount',
    )
  })
})
