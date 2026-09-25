/**
 * Unit-Tests des simulations-Datenlayers (M13, §3.11): addSimulation
 * (createdAt = injiziertes Kalenderdatum, sim-Slug-ID + Kollisionssuffix,
 * schreibseitige Prüfungen), updateSimulation (Teil-Patch, No-Op
 * Byte-identisch), duplicateSimulation („(Kopie)“ + Kollisions-Suffix),
 * deleteSimulation (hartes Löschen – G12-confirm ist Sache der Seite),
 * AK-3-Stop-Bedingung (alle anderen Collections Byte-identisch), Fehlertexte
 * ohne technische IDs, Validierungs-Rundreise (target-Feld, Default 'depot',
 * unbekannte Zusatzfelder), Verschärfungs-Negativtests (months 0/1,5/1201;
 * Rendite −0,01/0,16; Beitrag −1; Transfer-flowType; target 'foo'),
 * 8-%-WARNUNG (nie Fehler) und Altdatei-Regression.
 */

import { describe, expect, it } from 'vitest'
import {
  addSimulation,
  deleteSimulation,
  duplicateSimulation,
  generateSimulationId,
  updateSimulation,
} from '../../src/data/simulations'
import type { SimulationInput } from '../../src/data/simulations'
import type { FinanceData } from '../../src/types/finance'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { exampleText, loadExample, mutateExample } from '../storage/fixtures'

const TODAY = '2026-07-20'

const BASE_INPUT: SimulationInput = {
  name: 'Basisszenario real',
  params: {
    startDepotValue: 2522.47,
    startTagesgeldValue: 627.59,
    months: 12,
    annualReturnRate: 0,
    monthlyContributions: [
      { label: 'Eigene Depot-Sparraten (monatlich)', amount: 93.5, flowType: 'own_fixed' },
      { label: 'VL-Arbeitgeberzuschuss', amount: 6.5, flowType: 'employer' },
      { label: 'Tagesgeld-Rate', amount: 25, flowType: 'own_fixed', target: 'cash' },
    ],
    telekomMode: 'real',
  },
  note: null,
}

type Result = ReturnType<typeof addSimulation>

function expectOk(result: Result): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: Result): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

/** Roh-Simulation für Ladeprüfungs-Tests (programmatisch, Beispieldatei bleibt unangetastet). */
function simulationRaw(
  paramsOverrides: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'sim-test',
    name: 'Testszenario',
    createdAt: '2026-07-20',
    params: {
      startDepotValue: 0,
      startTagesgeldValue: 0,
      months: 12,
      annualReturnRate: 0,
      monthlyContributions: [],
      telekomMode: 'smoothed',
      ...paramsOverrides,
    },
    note: null,
    ...overrides,
  }
}

describe('generateSimulationId – ID-Konvention (data-model §2)', () => {
  it('bildet "sim-" + kebab(name) mit Umlaut-Transliteration und Kollisions-Suffixen', () => {
    expect(generateSimulationId('Basisszenario real', new Set())).toBe('sim-basisszenario-real')
    expect(generateSimulationId('Größere Rücklage', new Set())).toBe('sim-groessere-ruecklage')
    const ids = new Set(['sim-plan-a', 'sim-plan-a-2'])
    expect(generateSimulationId('Plan A', ids)).toBe('sim-plan-a-3')
    expect(generateSimulationId('???', new Set())).toBe('sim-simulation')
  })
})

describe('addSimulation – Anlegen (createdAt = todayIso, nur Parameter gespeichert)', () => {
  it('legt die Simulation mit createdAt = injiziertem Kalenderdatum (OHNE Uhrzeit) an', () => {
    const data = deepFreeze(loadExample())
    const next = expectOk(addSimulation(data, deepFreeze(BASE_INPUT), TODAY))
    expect(next.simulations).toHaveLength(1)
    const simulation = next.simulations[0]
    expect(simulation.id).toBe('sim-basisszenario-real')
    expect(simulation.name).toBe('Basisszenario real')
    expect(simulation.createdAt).toBe(TODAY)
    expect(simulation.createdAt).not.toContain('T')
    expect(simulation.note).toBeNull()
    expect(simulation.params.months).toBe(12)
    expect(simulation.params.telekomMode).toBe('real')
    // Eingabe unverändert (deepFreeze hätte geworfen); Ausgangsbestand unverändert.
    expect(data.simulations).toHaveLength(0)
  })

  it('K2: target wird nur bei "cash" materialisiert (Default "depot" bleibt implizit)', () => {
    const next = expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY))
    const contributions = next.simulations[0].params.monthlyContributions
    expect('target' in contributions[0]).toBe(false)
    expect('target' in contributions[1]).toBe(false)
    expect(contributions[2].target).toBe('cash')
  })

  it('AK-3-STOP-BEDINGUNG: alle anderen Collections bleiben Byte-identisch', () => {
    const data = loadExample()
    const before = JSON.stringify({ ...data, simulations: [] })
    const next = expectOk(addSimulation(data, BASE_INPUT, TODAY))
    expect(JSON.stringify({ ...next, simulations: [] })).toBe(before)
  })

  // Hinweis (Prüfkette B3): identische NAMEN werden seit der Namens-
  // Eindeutigkeitsprüfung abgelehnt – die ID-Kollision entsteht deshalb über
  // unterschiedliche Namen mit gleichem Slug (Groß-/Kleinschreibung).
  it('vergibt bei Slug-Kollision (verschiedene Namen, gleiche ID-Basis) das ID-Suffix -2', () => {
    const first = expectOk(addSimulation(loadExample(), { ...BASE_INPUT, name: 'Plan A' }, TODAY))
    const second = expectOk(addSimulation(first, { ...BASE_INPUT, name: 'Plan a' }, TODAY))
    expect(second.simulations.map((simulation) => simulation.id)).toEqual([
      'sim-plan-a',
      'sim-plan-a-2',
    ])
  })

  it('lehnt doppelte Namen ab (trim-Vergleich, B3/N1) – Karten und Vergleich identifizieren über den Namen', () => {
    const withOne = expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY))
    const exact = expectError(addSimulation(withOne, BASE_INPUT, TODAY))
    expect(exact).toBe(
      'Name: Es existiert bereits eine Simulation mit diesem Namen – bitte einen eindeutigen Namen wählen.',
    )
    const trimmed = expectError(
      addSimulation(withOne, { ...BASE_INPUT, name: '  Basisszenario real  ' }, TODAY),
    )
    expect(trimmed).toContain('bereits eine Simulation mit diesem Namen')
    // Der Bestand bleibt unverändert (kein zweiter Eintrag).
    expect(withOne.simulations).toHaveLength(1)
  })

  it('leere Beiträge sind gültig (2.6)', () => {
    const next = expectOk(
      addSimulation(
        loadExample(),
        { name: 'Nur Bestand', params: { ...BASE_INPUT.params, monthlyContributions: [] } },
        TODAY,
      ),
    )
    expect(next.simulations[0].params.monthlyContributions).toEqual([])
  })

  it('lehnt fachliche Fehler mit deutschen, feldnahen Meldungen ohne technische IDs ab', () => {
    const data = deepFreeze(loadExample())
    const cases: [SimulationInput, RegExp][] = [
      [{ ...BASE_INPUT, name: '   ' }, /^Name:/],
      [{ ...BASE_INPUT, params: { ...BASE_INPUT.params, months: 0 } }, /zwischen 1 und 1200/],
      [{ ...BASE_INPUT, params: { ...BASE_INPUT.params, months: 1.5 } }, /zwischen 1 und 1200/],
      [{ ...BASE_INPUT, params: { ...BASE_INPUT.params, months: 1201 } }, /zwischen 1 und 1200/],
      [
        { ...BASE_INPUT, params: { ...BASE_INPUT.params, annualReturnRate: -0.01 } },
        /zwischen 0 % und 15 %/,
      ],
      [
        { ...BASE_INPUT, params: { ...BASE_INPUT.params, annualReturnRate: 0.16 } },
        /zwischen 0 % und 15 %/,
      ],
      [
        { ...BASE_INPUT, params: { ...BASE_INPUT.params, annualReturnRate: Number.NaN } },
        /zwischen 0 % und 15 %/,
      ],
      [
        { ...BASE_INPUT, params: { ...BASE_INPUT.params, startDepotValue: -1 } },
        /Depot-Startwert/,
      ],
      [
        { ...BASE_INPUT, params: { ...BASE_INPUT.params, startTagesgeldValue: Number.NaN } },
        /Tagesgeld-Startwert/,
      ],
      [
        {
          ...BASE_INPUT,
          params: {
            ...BASE_INPUT.params,
            monthlyContributions: [{ label: 'Kaputt', amount: -1, flowType: 'own_fixed' }],
          },
        },
        /endliche Zahl ≥ 0/,
      ],
      [
        {
          ...BASE_INPUT,
          params: {
            ...BASE_INPUT.params,
            monthlyContributions: [{ label: '  ', amount: 5, flowType: 'own_fixed' }],
          },
        },
        /Bezeichnung/,
      ],
      [
        {
          ...BASE_INPUT,
          params: {
            ...BASE_INPUT.params,
            monthlyContributions: [{ label: 'ING', amount: 75, flowType: 'reserve_transfer' }],
          },
        },
        /Umbuchung/,
      ],
      [
        {
          ...BASE_INPUT,
          params: {
            ...BASE_INPUT.params,
            monthlyContributions: [{ label: 'TR', amount: 10, flowType: 'liquidity_transfer' }],
          },
        },
        /Umbuchung/,
      ],
    ]
    for (const [input, pattern] of cases) {
      const error = expectError(addSimulation(data, input, TODAY))
      expect(error).toMatch(pattern)
      // Endnutzertexte nennen nie technische IDs (Namens-Regel des Datenlayers).
      expect(error).not.toMatch(/\b(?:tp|pos|sp|acc|goal|plan|sim)-[a-z0-9-]+/)
    }
  })

  it('lehnt ein ungültiges Stichtagsdatum ab (A2: isValidBusinessDate-geprüft)', () => {
    expect(expectError(addSimulation(loadExample(), BASE_INPUT, '20.07.2026'))).toContain(
      'JJJJ-MM-TT',
    )
    expect(expectError(addSimulation(loadExample(), BASE_INPUT, '2026-02-30'))).toContain(
      'JJJJ-MM-TT',
    )
  })
})

describe('updateSimulation – Teil-Patch (K2-Byte-Identität)', () => {
  function withSimulation(): FinanceData {
    return expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY))
  }

  it('ändert nur die übergebenen Felder; createdAt bleibt erhalten', () => {
    const data = deepFreeze(withSimulation())
    const next = expectOk(
      updateSimulation(data, 'sim-basisszenario-real', { name: 'Umbenannt' }),
    )
    expect(next.simulations[0].name).toBe('Umbenannt')
    expect(next.simulations[0].createdAt).toBe(TODAY)
    expect(next.simulations[0].params).toEqual(data.simulations[0].params)
  })

  it('No-Op-Patch: der Bestand bleibt Byte-identisch (kein falscher Dirty-State)', () => {
    const data = withSimulation()
    const next = expectOk(updateSimulation(data, 'sim-basisszenario-real', {}))
    expect(JSON.stringify(next)).toBe(JSON.stringify(data))
  })

  it('params-Patch ersetzt die Beiträge vollständig und prüft die Regeln erneut', () => {
    const data = withSimulation()
    const next = expectOk(
      updateSimulation(data, 'sim-basisszenario-real', {
        params: { ...BASE_INPUT.params, months: 60, annualReturnRate: 0.05 },
      }),
    )
    expect(next.simulations[0].params.months).toBe(60)
    expect(next.simulations[0].params.annualReturnRate).toBe(0.05)
    // AK-3-Stop-Bedingung auch am update-Pfad (calculation-tester M13): eine
    // ECHTE Änderung berührt ausschließlich simulations[] – alle
    // Ist-Collections bleiben Byte-identisch.
    expect(JSON.stringify({ ...next, simulations: [] })).toBe(
      JSON.stringify({ ...data, simulations: [] }),
    )
    // Schreibseitige target-Prüfung (nicht nur Ladeprüfung).
    expect(
      expectError(
        updateSimulation(data, 'sim-basisszenario-real', {
          params: {
            ...BASE_INPUT.params,
            monthlyContributions: [
              { label: 'X', amount: 10, flowType: 'own_fixed', target: 'foo' },
            ] as unknown as typeof BASE_INPUT.params.monthlyContributions,
          },
        }),
      ),
    ).toContain('Ziel')
    const rejected = expectError(
      updateSimulation(data, 'sim-basisszenario-real', {
        params: { ...BASE_INPUT.params, months: 1201 },
      }),
    )
    expect(rejected).toContain('1200')
  })

  it('unbekannte Zusatzfelder der Simulation bleiben per Spread erhalten (Regel 16)', () => {
    const data = withSimulation()
    const withExtra: FinanceData = {
      ...data,
      simulations: [
        { ...data.simulations[0], zukunftsFeld: 'bleibt' },
      ] as FinanceData['simulations'],
    }
    const next = expectOk(updateSimulation(withExtra, 'sim-basisszenario-real', { name: 'Neu' }))
    expect(next.simulations[0]['zukunftsFeld']).toBe('bleibt')
  })

  it('unbekannte Simulation → Fehler ohne technische IDs', () => {
    const error = expectError(updateSimulation(loadExample(), 'sim-unbekannt', { name: 'X' }))
    expect(error).toContain('existiert nicht')
    expect(error).not.toContain('sim-unbekannt')
  })

  it('Namens-Eindeutigkeit beim Bearbeiten: fremder Name abgelehnt, eigener Name erlaubt (excludeId)', () => {
    const data = expectOk(
      addSimulation(withSimulation(), { ...BASE_INPUT, name: 'Zweites Szenario' }, TODAY),
    )
    const rejected = expectError(
      updateSimulation(data, 'sim-zweites-szenario', { name: 'Basisszenario real' }),
    )
    expect(rejected).toContain('bereits eine Simulation mit diesem Namen')
    // Der eigene (unveränderte) Name kollidiert NICHT mit sich selbst.
    const kept = expectOk(
      updateSimulation(data, 'sim-zweites-szenario', { name: 'Zweites Szenario' }),
    )
    expect(kept.simulations[1].name).toBe('Zweites Szenario')
  })
})

describe('duplicateSimulation – Kopieren („(Kopie)“ + Kollisions-Suffix, neues createdAt)', () => {
  function withSimulation(): FinanceData {
    return expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY))
  }

  it('kopiert Parameter identisch, mit Namens-Suffix und NEUEM createdAt', () => {
    const data = deepFreeze(withSimulation())
    const next = expectOk(duplicateSimulation(data, 'sim-basisszenario-real', '2026-07-21'))
    expect(next.simulations).toHaveLength(2)
    const copy = next.simulations[1]
    expect(copy.name).toBe('Basisszenario real (Kopie)')
    expect(copy.id).toBe('sim-basisszenario-real-kopie')
    expect(copy.createdAt).toBe('2026-07-21')
    expect(copy.params).toEqual(data.simulations[0].params)
    // Tiefe Kopie: das Original teilt keine Objektreferenzen mit der Kopie.
    expect(copy.params).not.toBe(data.simulations[0].params)
    expect(copy.params.monthlyContributions[0]).not.toBe(
      data.simulations[0].params.monthlyContributions[0],
    )
  })

  it('NAMENS-Kollision (nicht nur ID) → „(Kopie 2)“', () => {
    const once = expectOk(duplicateSimulation(withSimulation(), 'sim-basisszenario-real', TODAY))
    const twice = expectOk(duplicateSimulation(once, 'sim-basisszenario-real', TODAY))
    expect(twice.simulations.map((simulation) => simulation.name)).toEqual([
      'Basisszenario real',
      'Basisszenario real (Kopie)',
      'Basisszenario real (Kopie 2)',
    ])
    // Auch ein von Hand vergebener „(Kopie)“-Name zählt als Namens-Kollision.
    const manual = expectOk(
      addSimulation(withSimulation(), { ...BASE_INPUT, name: 'Basisszenario real (Kopie)' }, TODAY),
    )
    const copied = expectOk(duplicateSimulation(manual, 'sim-basisszenario-real', TODAY))
    expect(copied.simulations.map((simulation) => simulation.name)).toEqual([
      'Basisszenario real',
      'Basisszenario real (Kopie)',
      'Basisszenario real (Kopie 2)',
    ])
  })

  it('AK-3: Kopieren lässt alle anderen Collections Byte-identisch', () => {
    const data = withSimulation()
    const before = JSON.stringify({ ...data, simulations: [] })
    const next = expectOk(duplicateSimulation(data, 'sim-basisszenario-real', TODAY))
    expect(JSON.stringify({ ...next, simulations: [] })).toBe(before)
  })

  it('unbekannte Simulation → Fehler', () => {
    expect(expectError(duplicateSimulation(loadExample(), 'sim-unbekannt', TODAY))).toContain(
      'existiert nicht',
    )
  })
})

describe('deleteSimulation – hartes Löschen (G12-confirm ist Sache der Seite)', () => {
  it('entfernt genau die eine Simulation; alle anderen Collections bleiben Byte-identisch', () => {
    const data = expectOk(
      addSimulation(
        expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY)),
        { ...BASE_INPUT, name: 'Zweites Szenario' },
        TODAY,
      ),
    )
    const frozen = deepFreeze(data)
    const before = JSON.stringify({ ...data, simulations: [] })
    const next = expectOk(deleteSimulation(frozen, 'sim-basisszenario-real'))
    expect(next.simulations.map((simulation) => simulation.id)).toEqual(['sim-zweites-szenario'])
    expect(JSON.stringify({ ...next, simulations: [] })).toBe(before)
    // Ausgangsbestand unverändert (pur).
    expect(frozen.simulations).toHaveLength(2)
  })

  it('unbekannte Simulation → Fehler ohne technische IDs', () => {
    const error = expectError(deleteSimulation(loadExample(), 'sim-unbekannt'))
    expect(error).toContain('existiert nicht')
    expect(error).not.toContain('sim-unbekannt')
  })
})

describe('Validierung und Rundreise (schemaVersion 1, §3.11 + §6-Verschärfungen)', () => {
  it('Rundreise: target "cash", fehlendes target (Default depot) und Zusatzfelder überleben', () => {
    const data = expectOk(addSimulation(loadExample(), BASE_INPUT, TODAY))
    const withExtra: FinanceData = {
      ...data,
      simulations: [
        {
          ...data.simulations[0],
          zukunftsFeld: 'bleibt erhalten',
          params: {
            ...data.simulations[0].params,
            monthlyContributions: data.simulations[0].params.monthlyContributions.map(
              (contribution, index) =>
                index === 0 ? { ...contribution, beitragsZusatz: 42 } : contribution,
            ),
          },
        },
      ] as FinanceData['simulations'],
    }
    const reloaded = parseFinanceJson(serializeFinanceData(withExtra))
    expect(reloaded.ok).toBe(true)
    const simulation = reloaded.data!.simulations[0]
    expect(simulation['zukunftsFeld']).toBe('bleibt erhalten')
    expect(simulation.params.monthlyContributions[0]['beitragsZusatz']).toBe(42)
    expect('target' in simulation.params.monthlyContributions[0]).toBe(false)
    expect(simulation.params.monthlyContributions[2].target).toBe('cash')
    expect(simulation.createdAt).toBe(TODAY)
  })

  it('Verschärfungs-Negativtests: months 0 / 1,5 / 1201 → E_SETTINGS_RANGE', () => {
    for (const months of [0, 1.5, 1201]) {
      const draft = mutateExample((data) => {
        data.simulations = [simulationRaw({ months })]
      })
      const result = parseFinanceJson(JSON.stringify(draft))
      expect(result.ok).toBe(false)
      expect(
        result.errors.some(
          (issue) =>
            issue.code === 'E_SETTINGS_RANGE' && issue.path === 'simulations[0].params.months',
        ),
      ).toBe(true)
    }
  })

  it('Verschärfungs-Negativtests: Rendite −0,01 / 0,16 → E_SETTINGS_RANGE; Beitrag −1 → E_NEGATIVE_AMOUNT', () => {
    for (const annualReturnRate of [-0.01, 0.16]) {
      const draft = mutateExample((data) => {
        data.simulations = [simulationRaw({ annualReturnRate })]
      })
      const result = parseFinanceJson(JSON.stringify(draft))
      expect(result.ok).toBe(false)
      expect(
        result.errors.some(
          (issue) =>
            issue.code === 'E_SETTINGS_RANGE' &&
            issue.path === 'simulations[0].params.annualReturnRate',
        ),
      ).toBe(true)
    }
    const negative = mutateExample((data) => {
      data.simulations = [
        simulationRaw({
          monthlyContributions: [{ label: 'Kaputt', amount: -1, flowType: 'own_fixed' }],
        }),
      ]
    })
    const rejected = parseFinanceJson(JSON.stringify(negative))
    expect(rejected.ok).toBe(false)
    expect(rejected.errors.some((issue) => issue.code === 'E_NEGATIVE_AMOUNT')).toBe(true)
  })

  it('Transfer-flowType in Beiträgen → E_FLOWTYPE (G7); target "foo" → Ablehnung', () => {
    const transfer = mutateExample((data) => {
      data.simulations = [
        simulationRaw({
          monthlyContributions: [{ label: 'ING', amount: 75, flowType: 'reserve_transfer' }],
        }),
      ]
    })
    const rejectedTransfer = parseFinanceJson(JSON.stringify(transfer))
    expect(rejectedTransfer.ok).toBe(false)
    expect(
      rejectedTransfer.errors.some(
        (issue) =>
          issue.code === 'E_FLOWTYPE' &&
          issue.path === 'simulations[0].params.monthlyContributions[0].flowType',
      ),
    ).toBe(true)

    const badTarget = mutateExample((data) => {
      data.simulations = [
        simulationRaw({
          monthlyContributions: [
            { label: 'Depotbeitrag', amount: 100, flowType: 'own_fixed', target: 'foo' },
          ],
        }),
      ]
    })
    const rejectedTarget = parseFinanceJson(JSON.stringify(badTarget))
    expect(rejectedTarget.ok).toBe(false)
    expect(
      rejectedTarget.errors.some((issue) =>
        issue.path.includes('monthlyContributions[0].target'),
      ),
    ).toBe(true)
  })

  it('8-%-Regel: Rendite 0,09 lädt MIT Warnung (W_RETURN_ASSUMPTION), 0,08 ohne – nie ein Fehler', () => {
    const optimistic = mutateExample((data) => {
      data.simulations = [simulationRaw({ annualReturnRate: 0.09 })]
    })
    const warned = parseFinanceJson(JSON.stringify(optimistic))
    expect(warned.ok).toBe(true)
    expect(warned.warnings.some((issue) => issue.code === 'W_RETURN_ASSUMPTION')).toBe(true)

    const moderate = mutateExample((data) => {
      data.simulations = [simulationRaw({ annualReturnRate: 0.08 })]
    })
    const clean = parseFinanceJson(JSON.stringify(moderate))
    expect(clean.ok).toBe(true)
    expect(clean.warnings.some((issue) => issue.code === 'W_RETURN_ASSUMPTION')).toBe(false)
  })

  it('negative Startwerte werden beim Laden abgelehnt (E_NEGATIVE_AMOUNT)', () => {
    const draft = mutateExample((data) => {
      data.simulations = [simulationRaw({ startDepotValue: -0.01 })]
    })
    const result = parseFinanceJson(JSON.stringify(draft))
    expect(result.ok).toBe(false)
    expect(
      result.errors.some(
        (issue) =>
          issue.code === 'E_NEGATIVE_AMOUNT' &&
          issue.path === 'simulations[0].params.startDepotValue',
      ),
    ).toBe(true)
  })

  it('Altdatei-Regression: die unveränderte Beispieldatei lädt weiterhin (simulations leer)', () => {
    const result = parseFinanceJson(exampleText())
    expect(result.ok).toBe(true)
    expect(result.data!.simulations).toEqual([])
    // Gepinnte Seed-Kennzahlen bleiben unangetastet (DM1-Analogie).
    const depot = result
      .data!.portfolioPositions.map((position) => position.valueHistory[0].value)
      .reduce((sum, value) => sum + value, 0)
    expect(depot).toBeCloseTo(2522.47, 9)
  })
})
