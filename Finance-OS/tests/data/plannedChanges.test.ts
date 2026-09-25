/**
 * Unit-Tests des plannedChanges-Datenlayers (M11, §3.10): addPlannedChange
 * (G5-Speicherung, createdAt = injiziertes Kalenderdatum A2, Kollisions-Suffix,
 * schreibseitige A5-Prüfungen), discardPlannedChange (A3, kein Löschen),
 * Byte-Identität des übrigen Bestands, Fehlertexte ohne technische IDs,
 * Validierungs-Rundreise ('discarded' + unbekanntes Zusatzfeld + createdAt als
 * Datum UND als Zeitstempel ladbar), A5-Negativtests (tote items-Referenzen)
 * und Altdatei-Regression.
 */

import { describe, expect, it } from 'vitest'
import {
  addPlannedChange,
  discardPlannedChange,
  generatePlannedChangeId,
} from '../../src/data/plannedChanges'
import type { PlannedChangeInput } from '../../src/data/plannedChanges'
import type { FinanceData } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { exampleText, loadExample, mutateExample } from '../storage/fixtures'

const TODAY = '2026-07-20'

const BASE_INPUT: PlannedChangeInput = {
  basedOnProfileId: 'tp-job',
  items: [
    { refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: 23.83 },
    { refKind: 'position', ref: 'pos-xtrackers-world-dist', plannedMonthlyAmount: 22 },
    { refKind: 'position', ref: 'pos-ishares-em-imi', plannedMonthlyAmount: 10.65 },
    { refKind: 'position', ref: 'pos-ishares-gold-etc', plannedMonthlyAmount: 3.52 },
  ],
}

function expectOk(result: ReturnType<typeof addPlannedChange>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof addPlannedChange>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

describe('generatePlannedChangeId – ID-Konvention (data-model §2)', () => {
  it('bildet "plan-" + Kalenderdatum mit Kollisions-Suffixen', () => {
    expect(generatePlannedChangeId('2026-07-20', new Set())).toBe('plan-2026-07-20')
    const ids = new Set(['plan-2026-07-20', 'plan-2026-07-20-2'])
    expect(generatePlannedChangeId('2026-07-20', ids)).toBe('plan-2026-07-20-3')
  })
})

describe('addPlannedChange – G5-Speicherung', () => {
  it('legt die Planung mit createdAt = injiziertem Kalenderdatum (OHNE Uhrzeit) und status planned an', () => {
    const data = deepFreeze(loadExample())
    const next = expectOk(addPlannedChange(data, deepFreeze(BASE_INPUT), TODAY))
    expect(next.plannedChanges).toHaveLength(1)
    const change = next.plannedChanges[0]
    expect(change.id).toBe('plan-2026-07-20')
    expect(change.createdAt).toBe(TODAY)
    expect(change.createdAt).not.toContain('T')
    expect(change.status).toBe('planned')
    expect(change.basedOnProfileId).toBe('tp-job')
    expect(change.items).toHaveLength(4)
    expect(change.items[0]).toEqual({
      refKind: 'position',
      ref: 'pos-spdr-world-acc',
      plannedMonthlyAmount: 23.83,
    })
    expect(change.note).toBeNull()
    // Eingabe unverändert (deepFreeze hätte geworfen); Ausgangsbestand unverändert.
    expect(data.plannedChanges).toHaveLength(0)
  })

  it('ändert NIE Ist-Daten oder Sparpläne (M11-AK 2): übriger Bestand bleibt Byte-identisch', () => {
    const data = loadExample()
    const before = JSON.stringify({ ...data, plannedChanges: [] })
    const next = expectOk(addPlannedChange(data, BASE_INPUT, TODAY))
    expect(JSON.stringify({ ...next, plannedChanges: [] })).toBe(before)
  })

  it('vergibt bei Kollision am selben Tag das Suffix -2', () => {
    const data = loadExample()
    const first = expectOk(addPlannedChange(data, BASE_INPUT, TODAY))
    const second = expectOk(addPlannedChange(first, BASE_INPUT, TODAY))
    expect(second.plannedChanges.map((change) => change.id)).toEqual([
      'plan-2026-07-20',
      'plan-2026-07-20-2',
    ])
  })

  it('lehnt fachliche Fehler mit deutschen Meldungen ohne technische IDs ab (A5-Schreibseite)', () => {
    const data = deepFreeze(loadExample())
    const cases: [PlannedChangeInput, RegExp][] = [
      [{ ...BASE_INPUT, basedOnProfileId: 'tp-gibt-es-nicht' }, /Zielprofil/],
      [{ ...BASE_INPUT, items: [] }, /keine geplanten Monatsraten/],
      [
        {
          ...BASE_INPUT,
          items: [{ refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: -1 }],
        },
        /negativ/,
      ],
      [
        {
          ...BASE_INPUT,
          items: [
            { refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: Number.NaN },
          ],
        },
        /endliche Zahl/,
      ],
      [
        {
          ...BASE_INPUT,
          items: [{ refKind: 'position', ref: 'pos-tot', plannedMonthlyAmount: 5 }],
        },
        /nicht existiert/,
      ],
      [
        {
          ...BASE_INPUT,
          items: [{ refKind: 'group', ref: 'krypto', plannedMonthlyAmount: 5 }],
        },
        /unbekannte Positionsgruppe/,
      ],
    ]
    for (const [input, pattern] of cases) {
      const error = expectError(addPlannedChange(data, input, TODAY))
      expect(error).toMatch(pattern)
      // Endnutzertexte nennen nie technische IDs (Namens-Regel des Datenlayers).
      expect(error).not.toMatch(/\b(?:tp|pos|sp|acc|goal|plan)-[a-z0-9-]+/)
    }
  })

  it('lehnt ein ungültiges Stichtagsdatum ab (A2: isValidBusinessDate-geprüft)', () => {
    const data = loadExample()
    expect(expectError(addPlannedChange(data, BASE_INPUT, '20.07.2026'))).toContain(
      'JJJJ-MM-TT',
    )
    expect(expectError(addPlannedChange(data, BASE_INPUT, '2026-02-30'))).toContain(
      'JJJJ-MM-TT',
    )
  })

  it('erlaubt Gruppen-Referenzen und den Betrag 0 („erhält bewusst nichts")', () => {
    const data = loadExample()
    const next = expectOk(
      addPlannedChange(
        data,
        {
          basedOnProfileId: 'tp-custom',
          items: [{ refKind: 'group', ref: 'gold', plannedMonthlyAmount: 0 }],
          note: 'Testnotiz',
        },
        TODAY,
      ),
    )
    expect(next.plannedChanges[0].items[0]).toEqual({
      refKind: 'group',
      ref: 'gold',
      plannedMonthlyAmount: 0,
    })
    expect(next.plannedChanges[0].note).toBe('Testnotiz')
  })
})

describe('discardPlannedChange – Verwerfen (A3, kein Löschen)', () => {
  function withPlanned(): FinanceData {
    return expectOk(addPlannedChange(loadExample(), BASE_INPUT, TODAY))
  }

  it('setzt status auf discarded; die Planung bleibt erhalten (Historie, kein Löschen)', () => {
    const data = deepFreeze(withPlanned())
    const next = expectOk(discardPlannedChange(data, 'plan-2026-07-20'))
    expect(next.plannedChanges).toHaveLength(1)
    expect(next.plannedChanges[0].status).toBe('discarded')
    expect(next.plannedChanges[0].items).toHaveLength(4)
    expect(data.plannedChanges[0].status).toBe('planned')
  })

  it('bereits verworfene Planung → Fehler mit Profilname und deutschem Datum (nie ID)', () => {
    const discarded = expectOk(discardPlannedChange(withPlanned(), 'plan-2026-07-20'))
    const error = expectError(discardPlannedChange(discarded, 'plan-2026-07-20'))
    expect(error).toContain('bereits verworfen')
    expect(error).toContain('20.07.2026')
    expect(error).toContain('Job-Profil')
    expect(error).not.toContain('plan-2026-07-20')
  })

  it('unbekannte Planung → Fehler', () => {
    expect(expectError(discardPlannedChange(loadExample(), 'plan-unbekannt'))).toContain(
      'existiert nicht',
    )
  })
})

describe('Validierung und Rundreise (schemaVersion 1, §3.10)', () => {
  function plannedChangeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'plan-2026-07-20',
      createdAt: '2026-07-20',
      basedOnProfileId: 'tp-job',
      status: 'planned',
      items: [{ refKind: 'position', ref: 'pos-spdr-world-acc', plannedMonthlyAmount: 23.83 }],
      note: null,
      ...overrides,
    }
  }

  it('Rundreise: discarded + unbekanntes Zusatzfeld überleben Speichern und erneutes Laden', () => {
    const data = expectOk(
      discardPlannedChange(
        expectOk(addPlannedChange(loadExample(), BASE_INPUT, TODAY)),
        'plan-2026-07-20',
      ),
    )
    const withExtra: FinanceData = {
      ...data,
      plannedChanges: [
        { ...data.plannedChanges[0], zukunftsFeld: 'bleibt erhalten' },
      ] as FinanceData['plannedChanges'],
    }
    const reloaded = parseFinanceJson(serializeFinanceData(withExtra))
    expect(reloaded.ok).toBe(true)
    const change = reloaded.data!.plannedChanges[0]
    expect(change.status).toBe('discarded')
    expect(change['zukunftsFeld']).toBe('bleibt erhalten')
    expect(change.createdAt).toBe(TODAY)
  })

  it('createdAt ist tolerant auch als voller Zeitstempel ladbar (A2-Ladeprüfung)', () => {
    const draft = mutateExample((data) => {
      data.plannedChanges = [plannedChangeRaw({ createdAt: '2026-07-20T10:30:00.000Z' })]
    })
    const result = parseFinanceJson(JSON.stringify(draft))
    expect(result.ok).toBe(true)
    expect(result.data!.plannedChanges[0].createdAt).toBe('2026-07-20T10:30:00.000Z')
  })

  it('unbekannter status wird abgelehnt; "discarded" ist gültig', () => {
    const invalid = mutateExample((data) => {
      data.plannedChanges = [plannedChangeRaw({ status: 'zurueckgenommen' })]
    })
    const rejected = parseFinanceJson(JSON.stringify(invalid))
    expect(rejected.ok).toBe(false)
    expect(rejected.errors.some((issue) => issue.path.includes('status'))).toBe(true)

    const valid = mutateExample((data) => {
      data.plannedChanges = [plannedChangeRaw({ status: 'discarded' })]
    })
    expect(parseFinanceJson(JSON.stringify(valid)).ok).toBe(true)
  })

  it('A5: tote items-Referenz (position) und unbekannte Gruppe sind harte Ladefehler (E_REF_TARGET)', () => {
    const deadPosition = mutateExample((data) => {
      data.plannedChanges = [
        plannedChangeRaw({
          items: [{ refKind: 'position', ref: 'pos-tot', plannedMonthlyAmount: 5 }],
        }),
      ]
    })
    const rejectedPosition = parseFinanceJson(JSON.stringify(deadPosition))
    expect(rejectedPosition.ok).toBe(false)
    expect(
      rejectedPosition.errors.some(
        (issue) =>
          issue.code === 'E_REF_TARGET' && issue.path === 'plannedChanges[0].items[0].ref',
      ),
    ).toBe(true)

    const badGroup = mutateExample((data) => {
      data.plannedChanges = [
        plannedChangeRaw({
          items: [{ refKind: 'group', ref: 'krypto', plannedMonthlyAmount: 5 }],
        }),
      ]
    })
    const rejectedGroup = parseFinanceJson(JSON.stringify(badGroup))
    expect(rejectedGroup.ok).toBe(false)
    expect(rejectedGroup.errors.some((issue) => issue.code === 'E_REF_TARGET')).toBe(true)
  })

  it('Altdatei-Regression: die unveränderte Beispieldatei lädt weiterhin (plannedChanges leer)', () => {
    const result = parseFinanceJson(exampleText())
    expect(result.ok).toBe(true)
    expect(result.data!.plannedChanges).toEqual([])
    // Gepinnte Seed-Kennzahlen bleiben unangetastet (DM1-Analogie).
    const depot = result
      .data!.portfolioPositions.map((position) => position.valueHistory[0].value)
      .reduce((sum, value) => sum + value, 0)
    expect(depot).toBeCloseTo(2522.47, 9)
  })
})
