/**
 * ST3 (Mapping DM2, DM3, DM16): Rundreise laden → serialisieren → erneut laden.
 * (a) Deep-Equal + identische ID-Mengen, (b) unbekannte Zusatzfelder überleben,
 * (c) "Cache-Löschung": frischer zweiter Ladevorgang, (d) fehlende optionale
 * Arrays werden als [] normalisiert und bleiben rundreisestabil.
 */

import { describe, expect, it } from 'vitest'
import type { FinanceData } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { validateFinanceData } from '../../src/validation/validateFinanceData'
import { serializeFinanceData } from '../../src/storage/serializer'
import { exampleText, mutateExample } from './fixtures'

function collectIds(data: FinanceData): string[] {
  return [
    ...data.accounts.map((item) => item.id),
    ...data.portfolioPositions.map((item) => item.id),
    ...data.snapshots.map((item) => item.id),
    ...data.savingsPlans.map((item) => item.id),
    ...data.targetProfiles.map((item) => item.id),
    ...data.goals.map((item) => item.id),
    ...data.transactions.map((item) => item.id),
    ...data.importHistory.map((item) => item.id),
  ].sort()
}

function loadOrThrow(text: string): FinanceData {
  const result = parseFinanceJson(text)
  if (!result.ok || result.data === null) {
    throw new Error(`Laden fehlgeschlagen: ${JSON.stringify(result.errors)}`)
  }
  return result.data
}

describe('ST3 – Rundreise laden → speichern → laden (DM2/DM3/DM16)', () => {
  it('(a) Rundreise ist Deep-Equal und alle IDs bleiben unverändert', () => {
    const first = loadOrThrow(exampleText())
    const serialized = serializeFinanceData(first)
    const second = loadOrThrow(serialized)

    expect(second).toEqual(first)
    expect(collectIds(second)).toEqual(collectIds(first))
  })

  it('(b) unbekannte Zusatzfelder überleben Laden + Speichern vollständig (Regel 16)', () => {
    const draft = mutateExample((data) => {
      data['x_futureFeature'] = { enabled: true, tag: 'aus-version-99' } // Top-Level
      data.metadata['x_origin'] = 'roundtrip-test' // metadata
      data.accounts[0]['x_customField'] = 42 // Konto
      data.accounts[2].balanceHistory[0]['x_source'] = 'csv-import' // Historien-Eintrag
    })
    const first = validateFinanceData(draft)
    expect(first.ok).toBe(true)

    const serialized = serializeFinanceData(first.data!)
    const second = loadOrThrow(serialized)

    expect(second['x_futureFeature']).toEqual({ enabled: true, tag: 'aus-version-99' })
    expect(second.metadata['x_origin']).toBe('roundtrip-test')
    expect(second.accounts[0]['x_customField']).toBe(42)
    expect(second.accounts[2].balanceHistory[0]['x_source']).toBe('csv-import')
  })

  it('(c) "Cache-Löschung": ein frischer zweiter Ladevorgang ist Deep-Equal zum ersten (DM16)', () => {
    // Zwei völlig unabhängige Ladevorgänge desselben Dateitexts –
    // simuliert das erneute Öffnen nach Löschen des Browser-Speichers.
    const firstLoad = loadOrThrow(exampleText())
    const secondLoad = loadOrThrow(exampleText())

    expect(secondLoad).toEqual(firstLoad)
    expect(secondLoad).not.toBe(firstLoad) // wirklich unabhängige Objekte
  })

  it('(d) Datei ohne optionale Arrays → nach dem Laden [], zweite Rundreise stabil', () => {
    const draft = mutateExample((data) => {
      delete data.transactions
      delete data.plannedChanges
      delete data.simulations
      delete data.fixedCosts
      delete data.monthlyClosings
      delete data.journalEntries
    })
    const first = validateFinanceData(draft)
    expect(first.ok).toBe(true)
    const data = first.data!

    // Loader-Normalisierung: fehlende optionale Arrays werden als [] gesetzt.
    expect(data.transactions).toEqual([])
    expect(data.plannedChanges).toEqual([])
    expect(data.simulations).toEqual([])
    expect(data.fixedCosts).toEqual([])
    expect(data.monthlyClosings).toEqual([])
    expect(data.journalEntries).toEqual([])

    // Der Writer schreibt sie immer; die zweite Rundreise ist Deep-Equal zur ersten.
    const secondData = loadOrThrow(serializeFinanceData(data))
    expect(secondData).toEqual(data)
    const thirdData = loadOrThrow(serializeFinanceData(secondData))
    expect(thirdData).toEqual(secondData)
  })
})
