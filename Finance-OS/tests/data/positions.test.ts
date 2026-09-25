/**
 * Unit-Tests der reinen Depot-Datenfunktionen (Modul M9):
 * add/update/setActive/setPositionValue inkl. Sperrprüfung DM21, Ersetzen
 * statt DM23-Duplikat, Reinheit (deepFreeze + Snapshot) und Rundreise der
 * additiven isActive-Erweiterung (DM24/DM25).
 */

import { describe, expect, it } from 'vitest'
import {
  addPosition,
  generatePositionId,
  isPositionActive,
  setPositionActive,
  setPositionValue,
  updatePosition,
} from '../../src/data/positions'
import type { FinanceData, PositionGroup } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { cloneExampleDraft, loadExample, mutateExample } from '../storage/fixtures'

function expectOk(result: ReturnType<typeof addPosition>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof addPosition>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

describe('generatePositionId – ID-Konvention (data-model.md §2)', () => {
  it('bildet "pos-" + kebab(name) inkl. Umlaut-Transliteration', () => {
    expect(generatePositionId('Neuer World ETF', new Set())).toBe('pos-neuer-world-etf')
    expect(generatePositionId('Gold für Später', new Set())).toBe('pos-gold-fuer-spaeter')
  })

  it('löst Kollisionen mit den Suffixen -2, -3 auf', () => {
    const ids = new Set(['pos-gold'])
    expect(generatePositionId('Gold', ids)).toBe('pos-gold-2')
    ids.add('pos-gold-2')
    expect(generatePositionId('Gold', ids)).toBe('pos-gold-3')
  })
})

describe('addPosition', () => {
  it('legt eine Position mit isActive true, leerer Historie und ID-Schema an', () => {
    const data = loadExample()
    const next = expectOk(
      addPosition(data, { name: 'Neuer World ETF', group: 'world', accountId: 'acc-tr-depot' }),
    )
    const position = next.portfolioPositions[next.portfolioPositions.length - 1]
    expect(position.id).toBe('pos-neuer-world-etf')
    expect(position.name).toBe('Neuer World ETF')
    expect(position.group).toBe('world')
    expect(position.accountId).toBe('acc-tr-depot')
    expect(position.isActive).toBe(true)
    expect(position.valueHistory).toEqual([])
    expect(position.isin).toBeNull()
    // Kein Asset-Typ gewählt → Feld bleibt weg (§3.4: optional ohne null).
    expect('assetClass' in position).toBe(false)
    // Eingabe unverändert (neue Datenstruktur, alter Bestand + 1).
    expect(data.portfolioPositions).toHaveLength(6)
    expect(next.portfolioPositions).toHaveLength(7)
  })

  it('übernimmt Asset-Typ und getrimmte ISIN (leer → null)', () => {
    const data = loadExample()
    const withIsin = expectOk(
      addPosition(data, {
        name: 'ETC Test',
        group: 'gold',
        accountId: 'acc-tr-depot',
        assetClass: 'etc',
        isin: '  IE00B4ND3602  ',
      }),
    )
    const position = withIsin.portfolioPositions[withIsin.portfolioPositions.length - 1]
    expect(position.assetClass).toBe('etc')
    expect(position.isin).toBe('IE00B4ND3602')

    const emptyIsin = expectOk(
      addPosition(data, { name: 'Ohne ISIN', group: 'gold', accountId: 'acc-tr-depot', isin: '   ' }),
    )
    expect(emptyIsin.portfolioPositions[emptyIsin.portfolioPositions.length - 1].isin).toBeNull()
  })

  it('löst ID-Kollisionen beim wiederholten Anlegen mit -2/-3 auf', () => {
    const first = expectOk(
      addPosition(loadExample(), { name: 'Gold', group: 'gold', accountId: 'acc-tr-depot' }),
    )
    const second = expectOk(
      addPosition(first, { name: 'Gold', group: 'gold', accountId: 'acc-tr-depot' }),
    )
    const third = expectOk(
      addPosition(second, { name: 'Gold', group: 'gold', accountId: 'acc-tr-depot' }),
    )
    const ids = third.portfolioPositions.slice(-3).map((position) => position.id)
    expect(ids).toEqual(['pos-gold', 'pos-gold-2', 'pos-gold-3'])
  })

  it('lehnt leeren Namen und ungültige Gruppen feldbezogen ab', () => {
    const data = loadExample()
    expect(
      expectError(addPosition(data, { name: '  ', group: 'world', accountId: 'acc-tr-depot' })),
    ).toContain('Name')
    const groupError = expectError(
      addPosition(data, {
        name: 'Krypto-Position',
        group: 'krypto' as PositionGroup,
        accountId: 'acc-tr-depot',
      }),
    )
    expect(groupError).toContain('Gruppe')
    expect(groupError).toContain('World, Emerging Markets, Gold, Telekom')
  })

  it('lehnt fehlende und typfremde Konten ab (B1)', () => {
    const data = loadExample()
    expect(
      expectError(addPosition(data, { name: 'X', group: 'world', accountId: 'acc-fehlt' })),
    ).toContain('existiert nicht')
    const typeError = expectError(
      addPosition(data, { name: 'X', group: 'world', accountId: 'acc-vw-tagesgeld' }),
    )
    expect(typeError).toContain('kein Depot-Konto')
    expect(typeError).toContain('tagesgeld')
  })

  it('erlaubt das Anlegen auf einem INAKTIVEN Depot-Konto (die UI warnt, keine Ablehnung)', () => {
    const data = loadExample()
    const withInactiveAccount: FinanceData = {
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === 'acc-tr-depot' ? { ...account, isActive: false } : account,
      ),
    }
    const next = expectOk(
      addPosition(withInactiveAccount, { name: 'X', group: 'world', accountId: 'acc-tr-depot' }),
    )
    expect(next.portfolioPositions).toHaveLength(7)
  })
})

describe('updatePosition', () => {
  it('ändert Name, ISIN, Asset-Typ und Notiz, aber nie die Gruppe', () => {
    const data = loadExample()
    const updated = expectOk(
      updatePosition(data, 'pos-ishares-gold-etc', {
        name: 'iShares Gold ETC (neu)',
        isin: ' IE00B4ND3602 ',
        note: 'umbenannt',
      }),
    )
    const position = updated.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!
    expect(position.name).toBe('iShares Gold ETC (neu)')
    expect(position.isin).toBe('IE00B4ND3602')
    expect(position.note).toBe('umbenannt')
    expect(position.group).toBe('gold')

    const error = expectError(updatePosition(data, 'pos-ishares-gold-etc', { group: 'world' }))
    expect(error).toContain('Gruppe')
    expect(error).toContain('nicht geändert')
    // Die Meldung erklärt den Grund (Gewichts-/Profilreferenzen).
    expect(error).toContain('referenzieren')
  })

  it('erlaubt den Konto-Umzug nur auf ein existierendes AKTIVES Depot-Konto', () => {
    const data = loadExample()
    // Umzug auf ein anderes aktives Depot-Konto: erlaubt.
    const moved = expectOk(
      updatePosition(data, 'pos-ishares-gold-etc', { accountId: 'acc-fnz-vl-depot' }),
    )
    expect(
      moved.portfolioPositions.find((entry) => entry.id === 'pos-ishares-gold-etc')!.accountId,
    ).toBe('acc-fnz-vl-depot')

    // Nicht-Depot-Konto: abgelehnt.
    expect(
      expectError(updatePosition(data, 'pos-ishares-gold-etc', { accountId: 'acc-vw-tagesgeld' })),
    ).toContain('kein Depot-Konto')

    // Unbekanntes Konto: abgelehnt.
    expect(
      expectError(updatePosition(data, 'pos-ishares-gold-etc', { accountId: 'acc-fehlt' })),
    ).toContain('existiert nicht')

    // Inaktives Depot-Konto: abgelehnt (Konto-Umzug nur auf aktives Ziel).
    const withInactiveTarget: FinanceData = {
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === 'acc-fnz-vl-depot' ? { ...account, isActive: false } : account,
      ),
    }
    const inactiveError = expectError(
      updatePosition(withInactiveTarget, 'pos-ishares-gold-etc', { accountId: 'acc-fnz-vl-depot' }),
    )
    expect(inactiveError).toContain('deaktiviert')
    expect(inactiveError).toContain('aktives Depot-Konto')
  })

  it('lässt unbekannte Felder der Position überleben (Roundtrip-Vergleich, Regel 16)', () => {
    const base = loadExample()
    const withUnknown: FinanceData = {
      ...base,
      portfolioPositions: base.portfolioPositions.map((position) =>
        position.id === 'pos-ishares-gold-etc'
          ? { ...position, zukunftsFeld: { quelle: 'test', stufe: 2 } }
          : position,
      ),
    }
    const updated = expectOk(
      updatePosition(withUnknown, 'pos-ishares-gold-etc', { note: 'Notiz neu' }),
    )
    const reparsed = parseFinanceJson(serializeFinanceData(updated))
    expect(reparsed.ok).toBe(true)
    const position = reparsed.data!.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!
    expect(position['zukunftsFeld']).toEqual({ quelle: 'test', stufe: 2 })
    expect(position.note).toBe('Notiz neu')
  })

  it('lehnt unbekannte Positions-IDs und leere Namen ab', () => {
    const data = loadExample()
    expect(expectError(updatePosition(data, 'pos-fehlt', { name: 'X' }))).toContain(
      'existiert nicht',
    )
    expect(expectError(updatePosition(data, 'pos-ishares-gold-etc', { name: ' ' }))).toContain(
      'Name',
    )
  })
})

describe('setPositionActive', () => {
  it('deaktiviert und reaktiviert; die Position bleibt gelistet', () => {
    const data = loadExample()
    const deactivated = expectOk(setPositionActive(data, 'pos-telekom-aktien', false))
    const position = deactivated.portfolioPositions.find(
      (entry) => entry.id === 'pos-telekom-aktien',
    )!
    expect(position.isActive).toBe(false)
    expect(isPositionActive(position)).toBe(false)
    expect(deactivated.portfolioPositions).toHaveLength(data.portfolioPositions.length)
    // valueHistory bleibt vollständig erhalten.
    expect(position.valueHistory).toEqual([{ date: '2026-07-17', value: 1369.14 }])

    const reactivated = expectOk(setPositionActive(deactivated, 'pos-telekom-aktien', true))
    expect(
      reactivated.portfolioPositions.find((entry) => entry.id === 'pos-telekom-aktien')!.isActive,
    ).toBe(true)
  })

  it('lehnt unbekannte Positions-IDs ab', () => {
    expect(expectError(setPositionActive(loadExample(), 'pos-fehlt', false))).toContain(
      'existiert nicht',
    )
  })
})

describe('setPositionValue', () => {
  it('hängt einen Eintrag mit neuem Datum an, ohne die Historie zu verändern', () => {
    const data = loadExample()
    const next = expectOk(setPositionValue(data, 'pos-ishares-gold-etc', 40.5, '2026-08-01'))
    const history = next.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!.valueHistory
    expect(history).toEqual([
      { date: '2026-07-17', value: 33.92 },
      { date: '2026-08-01', value: 40.5 },
    ])
  })

  it('ersetzt einen bestehenden Eintrag mit exakt gleichem (nicht gesperrtem) Datum (DM23)', () => {
    const data = loadExample()
    const first = expectOk(setPositionValue(data, 'pos-ishares-gold-etc', 40.5, '2026-08-01'))
    const second = expectOk(setPositionValue(first, 'pos-ishares-gold-etc', 41.75, '2026-08-01'))
    const history = second.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!.valueHistory
    // Länge konstant: ersetzt, nicht angehängt.
    expect(history).toHaveLength(2)
    expect(history).toEqual([
      { date: '2026-07-17', value: 33.92 },
      { date: '2026-08-01', value: 41.75 },
    ])
  })

  it('lehnt negative Werte immer ab (valueHistory kennt kein Negativ, DM20)', () => {
    const error = expectError(
      setPositionValue(loadExample(), 'pos-ishares-gold-etc', -0.01, '2026-08-01'),
    )
    expect(error).toContain('Betrag')
    expect(error).toContain('nicht negativ')
  })

  it('erlaubt den Wert 0 (0 ist kein negativer Wert)', () => {
    const next = expectOk(setPositionValue(loadExample(), 'pos-ishares-gold-etc', 0, '2026-08-01'))
    const history = next.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!.valueHistory
    expect(history[history.length - 1]).toEqual({ date: '2026-08-01', value: 0 })
  })

  it('lehnt das gesperrte Snapshot-Datum 2026-07-17 der Beispieldatei ab (DM21)', () => {
    const error = expectError(
      setPositionValue(loadExample(), 'pos-ishares-gold-etc', 40, '2026-07-17'),
    )
    expect(error).toContain('Datum')
    expect(error).toContain('gesperrten Snapshot')
    expect(error).toContain('2026-07-17')
  })

  it('erlaubt die Wert-Erfassung auch auf INAKTIVEN Positionen (Historienpflege)', () => {
    const data = loadExample()
    const deactivated = expectOk(setPositionActive(data, 'pos-ishares-gold-etc', false))
    const next = expectOk(setPositionValue(deactivated, 'pos-ishares-gold-etc', 35, '2026-08-01'))
    const position = next.portfolioPositions.find(
      (entry) => entry.id === 'pos-ishares-gold-etc',
    )!
    expect(position.isActive).toBe(false)
    expect(position.valueHistory[position.valueHistory.length - 1]).toEqual({
      date: '2026-08-01',
      value: 35,
    })
  })

  it('lehnt nicht endliche Werte und ungültige Datumswerte ab', () => {
    const data = loadExample()
    expect(
      expectError(setPositionValue(data, 'pos-ishares-gold-etc', Number.NaN, '2026-08-01')),
    ).toContain('endliche Zahl')
    expect(
      expectError(setPositionValue(data, 'pos-ishares-gold-etc', 40, '01.08.2026')),
    ).toContain('JJJJ-MM-TT')
    expect(
      expectError(setPositionValue(data, 'pos-ishares-gold-etc', 40, '2026-02-30')),
    ).toContain('kein gültiges Kalenderdatum')
  })
})

describe('Reinheit – Eingaben werden nie mutiert', () => {
  it('alle Funktionen arbeiten auf tiefgefrorenen Daten und lassen den Snapshot unverändert', () => {
    const data = loadExample()
    const snapshot = JSON.parse(JSON.stringify(data))
    deepFreeze(data)

    expectOk(addPosition(data, { name: 'Neu', group: 'world', accountId: 'acc-tr-depot' }))
    expectOk(updatePosition(data, 'pos-ishares-gold-etc', { note: 'x' }))
    expectOk(setPositionActive(data, 'pos-ishares-gold-etc', false))
    expectOk(setPositionValue(data, 'pos-ishares-gold-etc', 40, '2026-08-01'))
    expectError(setPositionValue(data, 'pos-ishares-gold-etc', -1, '2026-08-01'))

    expect(JSON.parse(JSON.stringify(data))).toEqual(snapshot)
  })
})

describe('DM24/DM25 – Rundreise der additiven isActive-Erweiterung (schemaVersion 1)', () => {
  it('DM24: eine Datei mit isActive false auf einer Position besteht die Vollvalidierung und überlebt die Serialisierung deep-equal', () => {
    const draft = cloneExampleDraft()
    draft.portfolioPositions[0].isActive = false
    const text = JSON.stringify(draft, null, 2)
    const result = parseFinanceJson(text)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)

    const serialized = serializeFinanceData(result.data!)
    const reparsed = parseFinanceJson(serialized)
    expect(reparsed.ok).toBe(true)
    expect(JSON.parse(serialized)).toEqual(JSON.parse(text))
  })

  it('DM25: ohne isActive wird das Feld nie stillschweigend hinzugefügt (Laden + Ändern + Speichern)', () => {
    const data = loadExample()
    // Bestandspositionen der Beispieldatei haben kein isActive; eine
    // Stammdaten-Änderung darf das Feld nicht einschleppen.
    const updated = expectOk(updatePosition(data, 'pos-ishares-gold-etc', { note: 'x' }))
    const serialized = JSON.parse(serializeFinanceData(updated)) as {
      portfolioPositions: Record<string, unknown>[]
    }
    serialized.portfolioPositions.forEach((position) => {
      expect('isActive' in position).toBe(false)
    })
  })

  it('lehnt falsche Typen des neuen Feldes verständlich ab', () => {
    const bad = mutateExample((draft) => {
      draft.portfolioPositions[0].isActive = 'ja'
    })
    const result = parseFinanceJson(JSON.stringify(bad))
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.path === 'portfolioPositions[0].isActive')).toBe(
      true,
    )
  })

  it('die unveränderte Beispieldatei bleibt gültig', () => {
    expect(() => loadExample()).not.toThrow()
  })
})
