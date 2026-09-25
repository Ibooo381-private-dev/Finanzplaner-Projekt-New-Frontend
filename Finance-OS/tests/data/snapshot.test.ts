/**
 * Unit-Tests der Snapshot-Vollerfassung (Modul M9, DM27–DM33):
 * Erfolgsfall inkl. Registry (locked/user) und anschließender Sperrung,
 * Ablehnungen (Seed-/vorhandenes Datum, fehlende/überzählige/inaktive IDs,
 * Zukunft, negative Werte), Ersetzen vorerfasster Einzelwerte, ID-Kollision,
 * Reinheit und Rundreise ohne W4-Warnung.
 */

import { describe, expect, it } from 'vitest'
import {
  captureSnapshot,
  hasEntriesAfter,
  isBackdatedBeforeLatestSnapshot,
  isSnapshotComplete,
  latestCompleteSnapshotDate,
  latestValuationDate,
} from '../../src/data/snapshot'
import type { CaptureSnapshotInput } from '../../src/data/snapshot'
import { setAccountBalance } from '../../src/data/accounts'
import { setPositionActive, setPositionValue } from '../../src/data/positions'
import { isDateLocked } from '../../src/validation/lockedDates'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import type { FinanceData } from '../../src/types/finance'
import { deepFreeze } from '../finance/deepFreeze'
import { loadExample } from '../storage/fixtures'

const TODAY = '2026-07-19'
const NEW_DATE = '2026-07-18'

/** Vollständige Eingabe für alle aktiven Positionen + aktiven Tagesgeldkonten der Beispieldatei. */
function fullInput(overrides: Partial<CaptureSnapshotInput> = {}): CaptureSnapshotInput {
  return {
    dateIso: NEW_DATE,
    todayIso: TODAY,
    positionValues: new Map([
      ['pos-vl-ishares-world', 580],
      ['pos-spdr-world-acc', 240],
      ['pos-xtrackers-world-dist', 206],
      ['pos-ishares-em-imi', 100],
      ['pos-ishares-gold-etc', 34.5],
      ['pos-telekom-aktien', 1370.25],
    ]),
    accountBalances: new Map([['acc-vw-tagesgeld', 650.75]]),
    ...overrides,
  }
}

function expectOk(result: ReturnType<typeof captureSnapshot>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof captureSnapshot>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

describe('captureSnapshot – Erfolgsfall (DM27)', () => {
  it('erfasst alle Werte am Datum, legt den Registry-Eintrag locked/user an und sperrt das Datum', () => {
    const data = loadExample()
    const next = expectOk(captureSnapshot(data, fullInput({ label: 'Monatsstand Juli' })))

    // Registry: "snap-" + Datum, locked: true ab Speicherung, source "user", Label übernommen.
    expect(next.snapshots).toHaveLength(2)
    const snapshot = next.snapshots[1]
    expect(snapshot).toMatchObject({
      id: 'snap-2026-07-18',
      date: NEW_DATE,
      locked: true,
      source: 'user',
      label: 'Monatsstand Juli',
    })

    // Werte je Historie am Datum angehängt; bestehende Einträge unangetastet.
    const gold = next.portfolioPositions.find((entry) => entry.id === 'pos-ishares-gold-etc')!
    expect(gold.valueHistory).toEqual([
      { date: '2026-07-17', value: 33.92 },
      { date: NEW_DATE, value: 34.5 },
    ])
    const vw = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
    expect(vw.balanceHistory).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: NEW_DATE, amount: 650.75 },
    ])

    // Danach ist das Datum dauerhaft gesperrt (G3/DM21).
    expect(isDateLocked(next, NEW_DATE)).toBe(true)
    const blocked = setPositionValue(next, 'pos-ishares-gold-etc', 35, NEW_DATE)
    expect(blocked.ok).toBe(false)
  })

  it('ohne Label wird kein label-Feld geschrieben (nichts erfinden)', () => {
    const next = expectOk(captureSnapshot(loadExample(), fullInput()))
    expect('label' in next.snapshots[1]).toBe(false)
  })

  it('ersetzt einen am Tag X bereits einzeln vorerfassten Wert statt ihn zu doppeln (DM23/DM31)', () => {
    const data = loadExample()
    const preRecorded = setAccountBalance(data, 'acc-vw-tagesgeld', 700, NEW_DATE)
    if (!preRecorded.ok) throw new Error(preRecorded.error)
    const next = expectOk(captureSnapshot(preRecorded.data, fullInput()))
    const vw = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
    // Länge konstant gegenüber der Vorerfassung: ersetzt, nicht angehängt.
    expect(vw.balanceHistory).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: NEW_DATE, amount: 650.75 },
    ])
  })

  it('löst ID-Kollisionen dateiweit mit -2 auf (DM32)', () => {
    const data = loadExample()
    const withCollidingId: FinanceData = {
      ...data,
      snapshots: [
        ...data.snapshots,
        { id: 'snap-2026-07-18', date: '2026-07-15', locked: false },
      ],
    }
    const next = expectOk(captureSnapshot(withCollidingId, fullInput()))
    expect(next.snapshots[next.snapshots.length - 1].id).toBe('snap-2026-07-18-2')
  })
})

describe('captureSnapshot – Ablehnungen (ganz oder gar nicht, DM28–DM30)', () => {
  it('lehnt das gesperrte Seed-Datum ab; der Bestand bleibt unverändert', () => {
    const data = loadExample()
    const before = JSON.parse(JSON.stringify(data))
    const error = expectError(captureSnapshot(data, fullInput({ dateIso: '2026-07-17' })))
    expect(error).toContain('gesperrten Snapshot')
    expect(JSON.parse(JSON.stringify(data))).toEqual(before)
  })

  it('lehnt ein Datum mit vorhandenem (auch UNGESPERRTEM) Snapshot ohne Ersetzen-Option ab', () => {
    const data = loadExample()
    const withUnlocked: FinanceData = {
      ...data,
      snapshots: [
        ...data.snapshots,
        { id: 'snap-2026-07-15', date: '2026-07-15', locked: false },
      ],
    }
    const error = expectError(captureSnapshot(withUnlocked, fullInput({ dateIso: '2026-07-15' })))
    expect(error).toContain('bereits ein Snapshot')
    expect(error).toContain('neuer Snapshot mit neuem Datum')
  })

  it('lehnt Zukunftsdaten und ungültige Kalenderdaten ab', () => {
    const data = loadExample()
    const futureError = expectError(captureSnapshot(data, fullInput({ dateIso: '2026-07-20' })))
    expect(futureError).toContain('Zukunft')
    expect(futureError).toContain(TODAY)
    expect(
      expectError(captureSnapshot(data, fullInput({ dateIso: '2026-02-30' }))),
    ).toContain('kein gültiges Kalenderdatum')
  })

  it('lehnt fehlende Werte ab (Vollständigkeit, NIE stille 0) und nennt die Namen', () => {
    const data = loadExample()
    const input = fullInput()
    const incomplete = new Map(input.positionValues)
    incomplete.delete('pos-telekom-aktien')
    const error = expectError(
      captureSnapshot(data, { ...input, positionValues: incomplete }),
    )
    expect(error).toContain('unvollständig')
    expect(error).toContain('Deutsche Telekom Aktien')
    expect(error).toContain('nie stillschweigend als 0')
    // Bestand unverändert: keine Teil-Erfassung.
    expect(data.snapshots).toHaveLength(1)
  })

  it('lehnt fehlende Tagesgeld-Salden ab und nennt das Konto', () => {
    const error = expectError(
      captureSnapshot(loadExample(), fullInput({ accountBalances: new Map() })),
    )
    expect(error).toContain('Volkswagen Bank Tagesgeld')
  })

  it('lehnt überzählige Einträge ab: unbekannte, inaktive und typfremde IDs (DM29)', () => {
    const data = loadExample()
    const input = fullInput()

    // Unbekannte Positions-ID.
    const unknown = new Map(input.positionValues)
    unknown.set('pos-fremd', 10)
    expect(
      expectError(captureSnapshot(data, { ...input, positionValues: unknown })),
    ).toContain('pos-fremd')

    // Inaktive Position: ihr Eintrag ist überzählig (nur AKTIVE werden erfasst).
    const deactivated = setPositionActive(data, 'pos-ishares-gold-etc', false)
    if (!deactivated.ok) throw new Error(deactivated.error)
    const inactiveError = expectError(captureSnapshot(deactivated.data, input))
    expect(inactiveError).toContain('pos-ishares-gold-etc')

    // Typfremdes Konto (giro statt tagesgeld).
    const wrongType = new Map(input.accountBalances)
    wrongType.set('acc-sparkasse-giro', 100)
    expect(
      expectError(captureSnapshot(data, { ...input, accountBalances: wrongType })),
    ).toContain('acc-sparkasse-giro')
  })

  it('eine INAKTIVE Position wird ohne Eintrag gar nicht erwartet (Vollständigkeit nur für aktive)', () => {
    const data = loadExample()
    const deactivated = setPositionActive(data, 'pos-ishares-gold-etc', false)
    if (!deactivated.ok) throw new Error(deactivated.error)
    const input = fullInput()
    const withoutInactive = new Map(input.positionValues)
    withoutInactive.delete('pos-ishares-gold-etc')
    const next = expectOk(
      captureSnapshot(deactivated.data, { ...input, positionValues: withoutInactive }),
    )
    // Die inaktive Position erhält KEINEN neuen Eintrag; ihre Historie bleibt unverändert.
    const gold = next.portfolioPositions.find((entry) => entry.id === 'pos-ishares-gold-etc')!
    expect(gold.valueHistory).toEqual([{ date: '2026-07-17', value: 33.92 }])
  })

  it('lehnt nicht endliche und negative Positionswerte immer ab (DM20)', () => {
    const data = loadExample()
    const input = fullInput()
    const withNaN = new Map(input.positionValues)
    withNaN.set('pos-ishares-gold-etc', Number.NaN)
    expect(
      expectError(captureSnapshot(data, { ...input, positionValues: withNaN })),
    ).toContain('endliche Zahl')
    const withNegative = new Map(input.positionValues)
    withNegative.set('pos-ishares-gold-etc', -1)
    expect(
      expectError(captureSnapshot(data, { ...input, positionValues: withNegative })),
    ).toContain('nicht negativ')
  })

  it('lehnt negative Kontosalden ohne allowNegativeBalance ab, erlaubt sie mit Flag (DM20/DM33)', () => {
    const data = loadExample()
    const input = fullInput({ accountBalances: new Map([['acc-vw-tagesgeld', -1]]) })
    expect(expectError(captureSnapshot(data, input))).toContain('nicht negativ')

    const withFlag: FinanceData = {
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld' ? { ...account, allowNegativeBalance: true } : account,
      ),
    }
    const next = expectOk(captureSnapshot(withFlag, input))
    const vw = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
    expect(vw.balanceHistory[vw.balanceHistory.length - 1]).toEqual({
      date: NEW_DATE,
      amount: -1,
    })
  })

  it('lehnt einen Snapshot ohne aktive Positionen und ohne aktive Tagesgeldkonten ab', () => {
    const data = loadExample()
    const emptied: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) => ({
        ...position,
        isActive: false,
      })),
      accounts: data.accounts.map((account) =>
        account.type === 'tagesgeld' ? { ...account, isActive: false } : account,
      ),
    }
    const error = expectError(
      captureSnapshot(emptied, fullInput({ positionValues: new Map(), accountBalances: new Map() })),
    )
    expect(error).toContain('keine aktiven')
  })
})

describe('captureSnapshot – Reinheit und Rundreise', () => {
  it('mutiert die Eingabe nie (deepFreeze + Snapshot-Vergleich)', () => {
    const data = loadExample()
    const snapshot = JSON.parse(JSON.stringify(data))
    deepFreeze(data)
    expectOk(captureSnapshot(data, fullInput()))
    expectError(captureSnapshot(data, fullInput({ dateIso: '2026-07-17' })))
    expect(JSON.parse(JSON.stringify(data))).toEqual(snapshot)
  })

  it('Rundreise: nach captureSnapshot serialisieren + neu laden → gültig, KEINE W4-Warnung', () => {
    const next = expectOk(captureSnapshot(loadExample(), fullInput()))
    const result = parseFinanceJson(serializeFinanceData(next))
    expect(result.ok).toBe(true)
    expect(result.data!.snapshots).toHaveLength(2)
    const w4 = result.warnings.filter((warning) => warning.code === 'W_SNAPSHOT_INCOMPLETE')
    expect(w4).toEqual([])
  })

  it('Rundreise „gespeicherte Datei erneut öffnen“ mit INAKTIVER Position: Registry locked, identische Datumswerte, keine W4-Warnung, kein Ersetzen', () => {
    // Gold deaktivieren und den Snapshot OHNE Gold-Wert erfassen (nur aktive Einträge).
    const deactivated = setPositionActive(loadExample(), 'pos-ishares-gold-etc', false)
    if (!deactivated.ok) throw new Error(deactivated.error)
    const input = fullInput()
    const withoutInactive = new Map(input.positionValues)
    withoutInactive.delete('pos-ishares-gold-etc')
    const captured = expectOk(
      captureSnapshot(deactivated.data, { ...input, positionValues: withoutInactive }),
    )

    // Speichern + erneut öffnen: serializeFinanceData → parseFinanceJson.
    const result = parseFinanceJson(serializeFinanceData(captured))
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
    // KEINE W4-Warnung: die inaktive Gold-Position ohne Eintrag am 2026-07-18 ist
    // legitime Historie (W4-Neufassung zählt nur AKTIVE Positionen/Konten).
    expect(
      result.warnings.filter((warning) => warning.code === 'W_SNAPSHOT_INCOMPLETE'),
    ).toEqual([])

    const reloaded = result.data!
    // Registry überlebt die Rundreise: locked: true, source "user", Datum gesperrt.
    expect(reloaded.snapshots).toHaveLength(2)
    expect(reloaded.snapshots[1]).toMatchObject({
      id: 'snap-2026-07-18',
      date: NEW_DATE,
      locked: true,
      source: 'user',
    })
    expect(isDateLocked(reloaded, NEW_DATE)).toBe(true)

    // Identische Datumswerte nach dem erneuten Öffnen (exakt die erfassten Beträge).
    const entryAt = (positionId: string) =>
      reloaded.portfolioPositions
        .find((position) => position.id === positionId)!
        .valueHistory.find((entry) => entry.date === NEW_DATE)
    expect(entryAt('pos-vl-ishares-world')).toEqual({ date: NEW_DATE, value: 580 })
    expect(entryAt('pos-spdr-world-acc')).toEqual({ date: NEW_DATE, value: 240 })
    expect(entryAt('pos-xtrackers-world-dist')).toEqual({ date: NEW_DATE, value: 206 })
    expect(entryAt('pos-ishares-em-imi')).toEqual({ date: NEW_DATE, value: 100 })
    expect(entryAt('pos-telekom-aktien')).toEqual({ date: NEW_DATE, value: 1370.25 })
    const vw = reloaded.accounts.find((account) => account.id === 'acc-vw-tagesgeld')!
    expect(vw.balanceHistory.find((entry) => entry.date === NEW_DATE)).toEqual({
      date: NEW_DATE,
      amount: 650.75,
    })

    // Die inaktive Position bleibt außen vor: kein Eintrag am Snapshot-Datum,
    // Historie und Status unverändert.
    const gold = reloaded.portfolioPositions.find(
      (position) => position.id === 'pos-ishares-gold-etc',
    )!
    expect(gold.isActive).toBe(false)
    expect(gold.valueHistory).toEqual([{ date: '2026-07-17', value: 33.92 }])

    // Nach dem erneuten Öffnen gilt weiterhin: kein Ersetzen am gesperrten Datum (G3/G4).
    const again = captureSnapshot(reloaded, { ...input, positionValues: withoutInactive })
    expect(again.ok).toBe(false)
    expect(expectError(again)).toContain('Snapshot')
  })
})

describe('isBackdatedBeforeLatestSnapshot – Warnhelfer für die UI', () => {
  it('true, wenn das Datum vor dem jüngsten Snapshot liegt; sonst false', () => {
    const data = loadExample()
    expect(isBackdatedBeforeLatestSnapshot(data, '2026-07-01')).toBe(true)
    expect(isBackdatedBeforeLatestSnapshot(data, '2026-07-17')).toBe(false)
    expect(isBackdatedBeforeLatestSnapshot(data, '2026-08-01')).toBe(false)
  })
})

describe('M7 – Snapshot-Auswertungs-Helfer (W4-Ableitungen, Dashboard)', () => {
  it('Seed: Snapshot 2026-07-17 ist vollständig; latestCompleteSnapshotDate = 2026-07-17', () => {
    // Alle 6 aktiven Positionen und das aktive VW-Tagesgeldkonto haben am
    // Seed-Datum einen Eintrag; Giro/TR-Cash/ING/Bitget sind KEINE
    // Tagesgeldkonten und zählen für die W4-Vollständigkeit nicht.
    const data = deepFreeze(loadExample())
    expect(isSnapshotComplete(data, '2026-07-17')).toBe(true)
    expect(latestCompleteSnapshotDate(data)).toBe('2026-07-17')
  })

  it('neue aktive Position ohne Eintrag am Snapshot-Datum → unvollständig, Datum fällt heraus', () => {
    const data = loadExample()
    const newPosition = {
      id: 'pos-neu',
      name: 'Neue Position',
      accountId: 'acc-tr-depot',
      group: 'world',
      valueHistory: [],
    } as unknown as FinanceData['portfolioPositions'][number]
    const withNew: FinanceData = {
      ...data,
      portfolioPositions: [...data.portfolioPositions, newPosition],
    }
    expect(isSnapshotComplete(withNew, '2026-07-17')).toBe(false)
    expect(latestCompleteSnapshotDate(withNew)).toBeNull()
  })

  it('inaktive Positionen zählen für die Vollständigkeit nicht (W4 gilt nur für AKTIVE)', () => {
    const data = loadExample()
    const withInactiveEmpty: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) =>
        position.id === 'pos-ishares-gold-etc'
          ? { ...position, isActive: false, valueHistory: [] }
          : position,
      ),
    }
    expect(isSnapshotComplete(withInactiveEmpty, '2026-07-17')).toBe(true)
    expect(latestCompleteSnapshotDate(withInactiveEmpty)).toBe('2026-07-17')
  })

  it('hasEntriesAfter: Seed hat keine Einträge nach 2026-07-17; nach setPositionValue mit späterem Datum true', () => {
    const data = loadExample()
    expect(hasEntriesAfter(data, '2026-07-17')).toBe(false)
    const result = setPositionValue(data, 'pos-ishares-gold-etc', 40, NEW_DATE)
    if (!result.ok) throw new Error(result.error)
    expect(hasEntriesAfter(result.data, '2026-07-17')).toBe(true)
    // Einträge exakt AM Stichtag zählen nicht als „danach“.
    expect(hasEntriesAfter(result.data, NEW_DATE)).toBe(false)
  })

  it('hasEntriesAfter zählt bewusst AUCH Einträge inaktiver Positionen als Wertänderung', () => {
    // Dokumentierte Entscheidung (M7): ein späterer Eintrag an einer inzwischen
    // deaktivierten Position ist eine Änderung nach dem Stichtag – anders als
    // bei der W4-Vollständigkeit gibt es hier KEINEN Aktiv-Filter.
    const data = loadExample()
    const withInactiveLaterEntry: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) =>
        position.id === 'pos-ishares-gold-etc'
          ? {
              ...position,
              isActive: false,
              valueHistory: [...position.valueHistory, { date: NEW_DATE, value: 34.5 }],
            }
          : position,
      ),
    }
    expect(hasEntriesAfter(withInactiveLaterEntry, '2026-07-17')).toBe(true)
  })

  it('latestValuationDate: Seed 2026-07-17; komplett leere Historien → null', () => {
    const data = loadExample()
    expect(latestValuationDate(data)).toBe('2026-07-17')
    const empty: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) => ({
        ...position,
        valueHistory: [],
      })),
      accounts: data.accounts.map((account) => ({ ...account, balanceHistory: [] })),
    }
    expect(latestValuationDate(empty)).toBeNull()
  })

  it('leere Snapshot-Registry → latestCompleteSnapshotDate null', () => {
    const data = loadExample()
    expect(latestCompleteSnapshotDate({ ...data, snapshots: [] })).toBeNull()
  })

  it('ALLE Positionen und Tagesgeldkonten inaktiv → nichts zu bewerten, KEINE vakuumwahre Vollständigkeit', () => {
    const data = loadExample()
    const allInactive: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) => ({
        ...position,
        isActive: false,
      })),
      accounts: data.accounts.map((account) =>
        account.type === 'tagesgeld' ? { ...account, isActive: false } : account,
      ),
    }
    expect(isSnapshotComplete(allInactive, '2026-07-17')).toBe(false)
    expect(latestCompleteSnapshotDate(allInactive)).toBeNull()
  })
})
