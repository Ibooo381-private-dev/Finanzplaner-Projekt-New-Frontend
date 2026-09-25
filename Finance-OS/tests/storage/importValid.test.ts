/**
 * ST1 (Mapping DM1): Gültige Beispieldatei laden – über parseFinanceJson
 * und über importFromFile(File). Zählungen und Datenanker stammen aus
 * user-data/finance-data.example.json (Source Map Version 3).
 */

import { describe, expect, it } from 'vitest'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { importFromFile } from '../../src/storage/importFlow'
import { cloneExample, exampleText, makeJsonFile, mutateExample } from './fixtures'

// Erwartungswerte – sichtbar dokumentiert (Quelle: user-data/finance-data.example.json):
const EXPECTED_ACCOUNTS = 9 // Sparkasse, ING, VW-Tagesgeld, TR-Cash, TR-Depot, FNZ, Equatex, Bitget, Telekom-Pension
const EXPECTED_POSITIONS = 6 // VL iShares World, SPDR Acc, Xtrackers Dist, EM IMI, Gold ETC, Telekom
const EXPECTED_SNAPSHOTS = 1 // snap-2026-07-17 (Seed)
const EXPECTED_SAVINGS_PLANS = 12
const EXPECTED_PROFILES = 4 // tp-student-sparplan, tp-student-bestand, tp-job, tp-custom
const EXPECTED_GOALS = 8

// Datenanker zum Seed-Snapshot 2026-07-17 (DM1):
const SNAPSHOT_DATE = '2026-07-17'
// 577.99 + 237.45 + 204.86 + 99.11 + 33.92 + 1369.14 = 2522.47
const EXPECTED_DEPOT_SUM = 2522.47
const EXPECTED_VW_TAGESGELD = 627.59
// 2522.47 + 627.59 = 3150.06 (Gesamtvermögen S1)
const EXPECTED_TOTAL = 3150.06

describe('ST1 – Beispieldatei laden (DM1)', () => {
  it('parseFinanceJson lädt die Beispieldatei ohne Fehler mit korrekten Zählungen und Datenankern', () => {
    const result = parseFinanceJson(exampleText())

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.data).not.toBeNull()
    const data = result.data!

    expect(data.accounts).toHaveLength(EXPECTED_ACCOUNTS)
    expect(data.portfolioPositions).toHaveLength(EXPECTED_POSITIONS)
    expect(data.snapshots).toHaveLength(EXPECTED_SNAPSHOTS)
    expect(data.savingsPlans).toHaveLength(EXPECTED_SAVINGS_PLANS)
    expect(data.targetProfiles).toHaveLength(EXPECTED_PROFILES)
    expect(data.goals).toHaveLength(EXPECTED_GOALS)

    // Datenanker: Summe der Positionswerte zum 2026-07-17.
    const depotSum = data.portfolioPositions.reduce((sum, position) => {
      const entry = position.valueHistory.find((valueEntry) => valueEntry.date === SNAPSHOT_DATE)
      return sum + (entry ? entry.value : 0)
    }, 0)
    expect(depotSum).toBeCloseTo(EXPECTED_DEPOT_SUM, 2)

    const vwAccount = data.accounts.find((account) => account.id === 'acc-vw-tagesgeld')
    expect(vwAccount).toBeDefined()
    const vwEntry = vwAccount!.balanceHistory.find(
      (balanceEntry) => balanceEntry.date === SNAPSHOT_DATE,
    )
    expect(vwEntry?.amount).toBe(EXPECTED_VW_TAGESGELD)

    expect(depotSum + EXPECTED_VW_TAGESGELD).toBeCloseTo(EXPECTED_TOTAL, 2)
  })

  it('meldet W_EMPTY_HISTORY und W_NEEDS_REVIEW als Warnungen, ohne das Laden zu blockieren', () => {
    const result = parseFinanceJson(exampleText())

    expect(result.ok).toBe(true)
    const codes = result.warnings.map((warning) => warning.code)
    expect(codes).toContain('W_EMPTY_HISTORY') // z. B. Girokonto ohne erfassten Saldo (G11)
    expect(codes).toContain('W_NEEDS_REVIEW') // z. B. Bitget Krypto, Telekom Pensionsfonds
    // Warnungen haben deutsche Meldung und path.
    for (const warning of result.warnings) {
      expect(warning.path).not.toBe('')
      expect(warning.message.length).toBeGreaterThan(0)
    }
  })

  it('importFromFile liest die Datei, validiert und baut die Vorschau-Zusammenfassung', async () => {
    const file = makeJsonFile(cloneExample(), 'finance-data.example.json')
    const candidate = await importFromFile(file)

    expect(candidate.fileName).toBe('finance-data.example.json')
    expect(candidate.result.ok).toBe(true)
    expect(candidate.result.errors).toEqual([])
    expect(candidate.summary).not.toBeNull()
    const summary = candidate.summary!
    expect(summary.schemaVersion).toBe(1)
    expect(summary.isExampleData).toBe(true)
    expect(summary.counts).toEqual({
      accounts: EXPECTED_ACCOUNTS,
      portfolioPositions: EXPECTED_POSITIONS,
      snapshots: EXPECTED_SNAPSHOTS,
      savingsPlans: EXPECTED_SAVINGS_PLANS,
      goals: EXPECTED_GOALS,
      transactions: 0,
    })
    expect(summary.latestDate).toBe(SNAPSHOT_DATE)
  })
})

describe('DM26 – W4-Neufassung: Snapshot-Vollständigkeit nur für AKTIVE Positionen/Tagesgeldkonten', () => {
  function w4Warnings(draft: unknown) {
    const result = parseFinanceJson(JSON.stringify(draft))
    expect(result.ok).toBe(true)
    return result.warnings.filter((warning) => warning.code === 'W_SNAPSHOT_INCOMPLETE')
  }

  it('eine AKTIVE Position ohne Eintrag am Snapshot-Datum erzeugt die W4-Warnung', () => {
    const draft = mutateExample((data) => {
      // Gold verliert seinen 2026-07-17-Eintrag, bleibt aber aktiv.
      data.portfolioPositions.find((position) => position.id === 'pos-ishares-gold-etc')!
        .valueHistory = []
    })
    const warnings = w4Warnings(draft)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('iShares Physical Gold ETC')
  })

  it('eine INAKTIVE Position ohne Eintrag am Snapshot-Datum erzeugt KEINE Warnung (legitime Historie)', () => {
    const draft = mutateExample((data) => {
      const gold = data.portfolioPositions.find(
        (position) => position.id === 'pos-ishares-gold-etc',
      )!
      gold.valueHistory = []
      gold.isActive = false
    })
    expect(w4Warnings(draft)).toEqual([])
  })

  it('ein INAKTIVES Tagesgeldkonto ohne Eintrag am Snapshot-Datum erzeugt KEINE Warnung', () => {
    const draft = mutateExample((data) => {
      const vw = data.accounts.find((account) => account.id === 'acc-vw-tagesgeld')!
      vw.balanceHistory = []
      vw.isActive = false
    })
    expect(w4Warnings(draft)).toEqual([])
  })

  it('ein AKTIVES Tagesgeldkonto ohne Eintrag am Snapshot-Datum erzeugt weiterhin die W4-Warnung', () => {
    const draft = mutateExample((data) => {
      data.accounts.find((account) => account.id === 'acc-vw-tagesgeld')!.balanceHistory = []
    })
    const warnings = w4Warnings(draft)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('Volkswagen Bank Tagesgeld')
  })

  it('Einträge INAKTIVER Positionen am Snapshot-Datum bleiben erlaubt (weder Fehler noch Warnung)', () => {
    const draft = mutateExample((data) => {
      // Historie bleibt (Eintrag am gesperrten Snapshot-Datum), Position wird deaktiviert.
      data.portfolioPositions.find(
        (position) => position.id === 'pos-ishares-gold-etc',
      )!.isActive = false
    })
    const result = parseFinanceJson(JSON.stringify(draft))
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    expect(
      result.warnings.filter((warning) => warning.code === 'W_SNAPSHOT_INCOMPLETE'),
    ).toEqual([])
  })
})
