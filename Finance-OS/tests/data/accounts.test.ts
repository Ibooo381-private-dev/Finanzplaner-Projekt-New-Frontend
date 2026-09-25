/**
 * Unit-Tests der reinen Konten-Datenfunktionen (Modul M8):
 * add/update/setActive/setBalance inkl. Sperrprüfung DM21, Ersetzen statt
 * DM23-Duplikat, Reinheit (deepFreeze + Snapshot), DATA_CHANGED-Reducer und
 * Rundreise der additiven Schema-Erweiterung (bargeld/sonstiges/isActive/purpose).
 */

import { describe, expect, it } from 'vitest'
import {
  ADDABLE_ACCOUNT_TYPES,
  addAccount,
  defaultCountsAsFreeLiquidity,
  generateAccountId,
  setAccountActive,
  setAccountBalance,
  updateAccount,
} from '../../src/data/accounts'
import { financeDataReducer, initialFinanceState } from '../../src/state/financeDataReducer'
import type { FinanceState } from '../../src/state/financeDataContext'
import type { FinanceData } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { cloneExampleDraft, loadExample, mutateExample } from '../storage/fixtures'

function expectOk(result: ReturnType<typeof addAccount>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof addAccount>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

describe('generateAccountId – ID-Konvention (data-model.md §2)', () => {
  it('bildet "acc-" + kebab(name) inkl. Umlaut-Transliteration', () => {
    expect(generateAccountId('Neues Girokonto', new Set())).toBe('acc-neues-girokonto')
    expect(generateAccountId('Rücklage für Möbel', new Set())).toBe('acc-ruecklage-fuer-moebel')
  })

  it('löst Kollisionen mit den Suffixen -2, -3 auf', () => {
    const ids = new Set(['acc-bargeld'])
    expect(generateAccountId('Bargeld', ids)).toBe('acc-bargeld-2')
    ids.add('acc-bargeld-2')
    expect(generateAccountId('Bargeld', ids)).toBe('acc-bargeld-3')
  })
})

describe('addAccount', () => {
  it('legt ein Konto mit isActive true, leerer Historie und ID-Schema an', () => {
    const data = loadExample()
    const next = expectOk(addAccount(data, { name: 'N26 Girokonto', type: 'giro' }))
    const account = next.accounts[next.accounts.length - 1]
    expect(account.id).toBe('acc-n26-girokonto')
    expect(account.name).toBe('N26 Girokonto')
    expect(account.type).toBe('giro')
    expect(account.isActive).toBe(true)
    expect(account.balanceHistory).toEqual([])
    // Eingabe unverändert (neue Datenstruktur, alter Bestand + 1).
    expect(data.accounts).toHaveLength(9)
    expect(next.accounts).toHaveLength(10)
  })

  it('setzt countsAsFreeLiquidity-Defaults nach Typ (giro/cash/bargeld true, sonst false)', () => {
    const data = loadExample()
    for (const type of ADDABLE_ACCOUNT_TYPES) {
      const next = expectOk(addAccount(data, { name: `Testkonto ${type}`, type }))
      const account = next.accounts[next.accounts.length - 1]
      expect(account.countsAsFreeLiquidity).toBe(defaultCountsAsFreeLiquidity(type))
    }
    expect(defaultCountsAsFreeLiquidity('giro')).toBe(true)
    expect(defaultCountsAsFreeLiquidity('cash')).toBe(true)
    expect(defaultCountsAsFreeLiquidity('bargeld')).toBe(true)
    expect(defaultCountsAsFreeLiquidity('tagesgeld')).toBe(false)
    expect(defaultCountsAsFreeLiquidity('sonstiges')).toBe(false)
  })

  it('respektiert eine explizite Liquiditäts-Entscheidung der Eingabe', () => {
    const data = loadExample()
    const next = expectOk(
      addAccount(data, { name: 'Bargeld Tresor', type: 'bargeld', countsAsFreeLiquidity: false }),
    )
    expect(next.accounts[next.accounts.length - 1].countsAsFreeLiquidity).toBe(false)
  })

  it('löst ID-Kollisionen beim wiederholten Anlegen mit -2/-3 auf', () => {
    const first = expectOk(addAccount(loadExample(), { name: 'Bargeld', type: 'bargeld' }))
    const second = expectOk(addAccount(first, { name: 'Bargeld', type: 'bargeld' }))
    const third = expectOk(addAccount(second, { name: 'Bargeld', type: 'bargeld' }))
    const ids = third.accounts.slice(-3).map((account) => account.id)
    expect(ids).toEqual(['acc-bargeld', 'acc-bargeld-2', 'acc-bargeld-3'])
  })

  it('lehnt leeren Namen und nicht wählbare Typen feldbezogen ab', () => {
    const data = loadExample()
    expect(expectError(addAccount(data, { name: '   ', type: 'giro' }))).toContain('Name')
    const typeError = expectError(addAccount(data, { name: 'Alt-Bestand', type: 'ruecklage' }))
    expect(typeError).toContain('Typ')
    expect(typeError).toContain('ruecklage')
  })

  it('lehnt auch die Bestandstypen krypto und pension beim Anlegen ab', () => {
    const data = loadExample()
    const kryptoError = expectError(addAccount(data, { name: 'Neues Kryptokonto', type: 'krypto' }))
    expect(kryptoError).toContain('Typ')
    expect(kryptoError).toContain('"krypto"')
    expect(kryptoError).toContain('Wählbar sind')
    const pensionError = expectError(
      addAccount(data, { name: 'Neues Pensionskonto', type: 'pension' }),
    )
    expect(pensionError).toContain('"pension"')
    // Kein Konto wurde angelegt: der Bestand bleibt bei 9 Konten.
    expect(data.accounts).toHaveLength(9)
  })
})

describe('updateAccount', () => {
  it('ändert Stammdaten, aber nie den Typ', () => {
    const data = loadExample()
    const updated = expectOk(
      updateAccount(data, 'acc-sparkasse-giro', {
        institution: 'Sparkasse Neu',
        purpose: 'Gehaltseingang',
      }),
    )
    const account = updated.accounts.find((entry) => entry.id === 'acc-sparkasse-giro')!
    expect(account.institution).toBe('Sparkasse Neu')
    expect(account.purpose).toBe('Gehaltseingang')
    expect(account.type).toBe('giro')

    const error = expectError(
      updateAccount(data, 'acc-sparkasse-giro', { type: 'tagesgeld' }),
    )
    expect(error).toContain('Typ')
    expect(error).toContain('nicht geändert')
  })

  it('lässt unbekannte Felder des Kontos überleben (Roundtrip-Vergleich)', () => {
    const base = loadExample()
    const withUnknown: FinanceData = {
      ...base,
      accounts: base.accounts.map((account) =>
        account.id === 'acc-sparkasse-giro'
          ? { ...account, zukunftsFeld: { quelle: 'test', stufe: 2 } }
          : account,
      ),
    }
    const updated = expectOk(
      updateAccount(withUnknown, 'acc-sparkasse-giro', { institution: 'Sparkasse Neu' }),
    )
    // Serialisieren + erneut validieren: das unbekannte Feld bleibt deep-equal erhalten.
    const reparsed = parseFinanceJson(serializeFinanceData(updated))
    expect(reparsed.ok).toBe(true)
    const account = reparsed.data!.accounts.find((entry) => entry.id === 'acc-sparkasse-giro')!
    expect(account['zukunftsFeld']).toEqual({ quelle: 'test', stufe: 2 })
    expect(account.institution).toBe('Sparkasse Neu')
    expect(account.earmark).toBeNull()
  })

  it('lehnt unbekannte Konto-IDs und leere Namen ab', () => {
    const data = loadExample()
    expect(expectError(updateAccount(data, 'acc-gibt-es-nicht', { name: 'X' }))).toContain(
      'existiert nicht',
    )
    expect(expectError(updateAccount(data, 'acc-sparkasse-giro', { name: ' ' }))).toContain('Name')
  })
})

describe('setAccountActive', () => {
  it('deaktiviert und reaktiviert; das Konto bleibt gelistet', () => {
    const data = loadExample()
    const deactivated = expectOk(setAccountActive(data, 'acc-vw-tagesgeld', false))
    const account = deactivated.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
    expect(account.isActive).toBe(false)
    expect(deactivated.accounts).toHaveLength(data.accounts.length)

    const reactivated = expectOk(setAccountActive(deactivated, 'acc-vw-tagesgeld', true))
    expect(reactivated.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!.isActive).toBe(
      true,
    )
  })

  it('lehnt unbekannte Konto-IDs ab', () => {
    expect(expectError(setAccountActive(loadExample(), 'acc-fehlt', false))).toContain(
      'existiert nicht',
    )
  })
})

describe('setAccountBalance', () => {
  it('hängt einen Eintrag mit neuem Datum an, ohne die Historie zu verändern', () => {
    const data = loadExample()
    const next = expectOk(setAccountBalance(data, 'acc-vw-tagesgeld', 700, '2026-08-01'))
    const history = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!.balanceHistory
    expect(history).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: '2026-08-01', amount: 700 },
    ])
  })

  it('ersetzt einen bestehenden Eintrag mit exakt gleichem (nicht gesperrtem) Datum (DM23)', () => {
    const data = loadExample()
    const first = expectOk(setAccountBalance(data, 'acc-vw-tagesgeld', 700, '2026-08-01'))
    const second = expectOk(setAccountBalance(first, 'acc-vw-tagesgeld', 710.5, '2026-08-01'))
    const history = second.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!.balanceHistory
    expect(history).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: '2026-08-01', amount: 710.5 },
    ])
  })

  it('lehnt depot- und pension-Konten ab (kein eigener Wert, C2/DM19)', () => {
    const data = loadExample()
    expect(expectError(setAccountBalance(data, 'acc-tr-depot', 100, '2026-08-01'))).toContain(
      'keinen eigenen Wert',
    )
    expect(expectError(setAccountBalance(data, 'acc-telekom-pension', 100, '2026-08-01'))).toContain(
      'Merkposten',
    )
  })

  it('lehnt das gesperrte Snapshot-Datum 2026-07-17 der Beispieldatei ab (DM21)', () => {
    const error = expectError(setAccountBalance(loadExample(), 'acc-sparkasse-giro', 100, '2026-07-17'))
    expect(error).toContain('Datum')
    expect(error).toContain('gesperrten Snapshot')
    // Die Meldung nennt Datum + Snapshot-Label und erklärt den Ausweg (neues Datum).
    expect(error).toContain('2026-07-17')
    expect(error).toContain('Start-Snapshot (Source Map Version 3)')
    expect(error).toContain('neuen Datum')
  })

  it('erlaubt Betrag 0 – 0 ist kein negativer Saldo, DM20 greift nicht', () => {
    const data = loadExample()
    // acc-vw-tagesgeld hat KEIN allowNegativeBalance; 0 muss trotzdem gültig sein.
    const next = expectOk(setAccountBalance(data, 'acc-vw-tagesgeld', 0, '2026-08-01'))
    const history = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!.balanceHistory
    expect(history).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: '2026-08-01', amount: 0 },
    ])
  })

  it('erlaubt die Saldo-Erfassung auch auf deaktivierten Konten (gepflegt, aber nicht summiert)', () => {
    // Dokumentiertes Verhalten: deaktivierte Konten bleiben gelistet und pflegbar;
    // sie fließen nur in keine Summen ein (die Filterung übernimmt der Aufrufer
    // über isActive, nicht die Datenfunktion – Doppelzählungs-Modell Regel 3).
    const data = loadExample()
    const deactivated = expectOk(setAccountActive(data, 'acc-vw-tagesgeld', false))
    const next = expectOk(setAccountBalance(deactivated, 'acc-vw-tagesgeld', 650.25, '2026-08-01'))
    const account = next.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
    expect(account.isActive).toBe(false)
    expect(account.balanceHistory).toEqual([
      { date: '2026-07-17', amount: 627.59 },
      { date: '2026-08-01', amount: 650.25 },
    ])
  })

  it('lehnt ein formal korrektes, aber unmögliches Kalenderdatum ab (2026-02-30)', () => {
    const error = expectError(setAccountBalance(loadExample(), 'acc-vw-tagesgeld', 1, '2026-02-30'))
    expect(error).toContain('Datum')
    expect(error).toContain('2026-02-30')
    expect(error).toContain('kein gültiges Kalenderdatum')
  })

  it('lehnt nicht endliche Beträge und ungültige Datumswerte ab', () => {
    const data = loadExample()
    expect(expectError(setAccountBalance(data, 'acc-vw-tagesgeld', Number.NaN, '2026-08-01'))).toContain(
      'endliche Zahl',
    )
    expect(
      expectError(setAccountBalance(data, 'acc-vw-tagesgeld', 1, '01.08.2026')),
    ).toContain('JJJJ-MM-TT')
  })

  it('lehnt negative Salden ohne allowNegativeBalance ab, erlaubt sie mit Flag', () => {
    const data = loadExample()
    // acc-vw-tagesgeld: kein allowNegativeBalance → Ablehnung (DM20).
    expect(expectError(setAccountBalance(data, 'acc-vw-tagesgeld', -1, '2026-08-01'))).toContain(
      'negativer Saldo',
    )
    // acc-sparkasse-giro: allowNegativeBalance true → gültig.
    const next = expectOk(setAccountBalance(data, 'acc-sparkasse-giro', -250.75, '2026-08-01'))
    const history = next.accounts.find((entry) => entry.id === 'acc-sparkasse-giro')!.balanceHistory
    expect(history).toEqual([{ date: '2026-08-01', amount: -250.75 }])
  })
})

describe('Reinheit – Eingaben werden nie mutiert', () => {
  it('alle Funktionen arbeiten auf tiefgefrorenen Daten und lassen den Snapshot unverändert', () => {
    const data = loadExample()
    const snapshot = JSON.parse(JSON.stringify(data))
    deepFreeze(data)

    expectOk(addAccount(data, { name: 'Bargeld', type: 'bargeld' }))
    expectOk(updateAccount(data, 'acc-sparkasse-giro', { purpose: 'Gehalt' }))
    expectOk(setAccountActive(data, 'acc-vw-tagesgeld', false))
    expectOk(setAccountBalance(data, 'acc-vw-tagesgeld', 700, '2026-08-01'))
    expectError(setAccountBalance(data, 'acc-tr-depot', 1, '2026-08-01'))

    expect(JSON.parse(JSON.stringify(data))).toEqual(snapshot)
  })
})

describe('DATA_CHANGED – Reducer', () => {
  it('ersetzt data, setzt isDirty und löscht operationError', () => {
    const data = loadExample()
    const before: FinanceState = {
      ...initialFinanceState,
      data,
      fileName: 'finance-data.json',
      isDirty: false,
      operationError: 'alter Fehler',
    }
    const changed = expectOk(setAccountActive(data, 'acc-vw-tagesgeld', false))
    const after = financeDataReducer(before, { type: 'DATA_CHANGED', data: changed })
    expect(after.data).toBe(changed)
    expect(after.isDirty).toBe(true)
    expect(after.operationError).toBeNull()
    // Alles Übrige bleibt unverändert (kein Statusverlust).
    expect(after.fileName).toBe('finance-data.json')
    expect(after.isSaving).toBe(false)
  })
})

describe('Rundreise der additiven Schema-Erweiterung (schemaVersion 1)', () => {
  it('eine Datei mit bargeld/sonstiges/isActive/purpose besteht die Vollvalidierung und überlebt die Serialisierung deep-equal', () => {
    const draft = cloneExampleDraft()
    draft.accounts.push({
      id: 'acc-bargeld-haushalt',
      name: 'Bargeld Haushalt',
      type: 'bargeld',
      purpose: 'Haushaltskasse',
      isActive: true,
      balanceHistory: [{ date: '2026-07-18', amount: 80 }],
    })
    draft.accounts.push({
      id: 'acc-sonstiges-guthaben',
      name: 'Sonstiges Guthaben',
      type: 'sonstiges',
      purpose: null,
      isActive: false,
      balanceHistory: [],
    })
    const text = JSON.stringify(draft, null, 2)
    const result = parseFinanceJson(text)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)

    const serialized = serializeFinanceData(result.data!)
    const reparsed = parseFinanceJson(serialized)
    expect(reparsed.ok).toBe(true)
    expect(JSON.parse(serialized)).toEqual(JSON.parse(text))
  })

  it('lehnt falsche Typen der neuen Felder verständlich ab', () => {
    const badIsActive = mutateExample((draft) => {
      draft.accounts[0].isActive = 'ja'
    })
    const resultA = parseFinanceJson(JSON.stringify(badIsActive))
    expect(resultA.ok).toBe(false)
    expect(resultA.errors.some((issue) => issue.path === 'accounts[0].isActive')).toBe(true)

    const badPurpose = mutateExample((draft) => {
      draft.accounts[0].purpose = 123
    })
    const resultB = parseFinanceJson(JSON.stringify(badPurpose))
    expect(resultB.ok).toBe(false)
    expect(resultB.errors.some((issue) => issue.path === 'accounts[0].purpose')).toBe(true)
  })

  it('die unveränderte Beispieldatei bleibt gültig', () => {
    expect(() => loadExample()).not.toThrow()
  })
})
