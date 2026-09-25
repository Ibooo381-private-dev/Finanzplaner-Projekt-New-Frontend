/**
 * Unit-Tests der reinen Ziel-Datenfunktionen (Modul M12):
 * add/update/pause/resume/complete/archive inkl. Metrikwechsel-Normalisierung
 * (Auflage C), K2-Byte-Identität, Fehlertexte ohne technische IDs, Reinheit
 * (deepFreeze) sowie die Validierungs-/Rundreisetests der additiven
 * Schema-Erweiterung (accountBalance/positionValue/manual/archived,
 * refId/manualCurrentAmount/startDate; Negativtests je Auflage B;
 * Altdatei-Regression mit gepinnten Seed-Kennzahlen, DM9-Analogie).
 */

import { describe, expect, it } from 'vitest'
import {
  addGoal,
  archiveGoal,
  completeGoal,
  generateGoalId,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from '../../src/data/goals'
import type { GoalInput } from '../../src/data/goals'
import { effectiveGoalTarget, goalActualValue } from '../../src/finance'
import type { FinanceData } from '../../src/types/finance'
import { validateFinanceData } from '../../src/validation/validateFinanceData'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { exampleText, loadExample, mutateExample } from '../storage/fixtures'

const TODAY = '2026-07-20'

function expectOk(result: ReturnType<typeof addGoal>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof addGoal>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

const BASE_INPUT: GoalInput = {
  name: 'Neues Testziel',
  targetAmount: 5000,
  metric: 'tagesgeld',
}

describe('generateGoalId – ID-Konvention (data-model §2)', () => {
  it('bildet "goal-" + kebab(name) inkl. Umlaut-Transliteration und Kollisions-Suffixen', () => {
    expect(generateGoalId('Größeres Ziel', new Set())).toBe('goal-groesseres-ziel')
    expect(generateGoalId('!!!', new Set())).toBe('goal-ziel')
    const ids = new Set(['goal-urlaub', 'goal-urlaub-2'])
    expect(generateGoalId('Urlaub', ids)).toBe('goal-urlaub-3')
  })
})

describe('addGoal', () => {
  it('legt ein Ziel mit goal-ID, status active und isAutoCalculated false an; Eingabe bleibt unverändert', () => {
    const data = deepFreeze(loadExample())
    const next = expectOk(addGoal(data, BASE_INPUT))
    const goal = next.goals[next.goals.length - 1]
    expect(goal.id).toBe('goal-neues-testziel')
    expect(goal.status).toBe('active')
    expect(goal.isAutoCalculated).toBe(false)
    expect(goal.targetAmount).toBe(5000)
    expect(goal.metric).toBe('tagesgeld')
    // Nicht gesetzte neue Schlüssel werden NICHT materialisiert (schlanke Datei).
    expect('refId' in goal).toBe(false)
    expect('manualCurrentAmount' in goal).toBe(false)
    expect('startDate' in goal).toBe(false)
    expect(data.goals).toHaveLength(8)
    expect(next.goals).toHaveLength(9)
  })

  it('Kontostand-/Positionswert-Ziel: refId wird übernommen; freies Geldziel: manualCurrentAmount', () => {
    const data = loadExample()
    const kontoZiel = expectOk(
      addGoal(data, {
        name: 'VW-Puffer',
        targetAmount: 2000,
        metric: 'accountBalance',
        refId: 'acc-vw-tagesgeld',
      }),
    ).goals.at(-1)!
    expect(kontoZiel.refId).toBe('acc-vw-tagesgeld')
    const freiZiel = expectOk(
      addGoal(data, {
        name: 'Freies Geldziel',
        targetAmount: 1000,
        metric: 'manual',
        manualCurrentAmount: 250,
        startDate: '2026-08-01',
        targetDate: '2027-08-01',
      }),
    ).goals.at(-1)!
    expect(freiZiel.manualCurrentAmount).toBe(250)
    expect(freiZiel.startDate).toBe('2026-08-01')
  })

  it('lehnt fachliche Fehler feldbezogen ab (deutsche Meldungen, keine technischen IDs)', () => {
    const data = loadExample()
    expect(expectError(addGoal(data, { ...BASE_INPUT, name: '  ' }))).toContain('Name')
    expect(expectError(addGoal(data, { ...BASE_INPUT, targetAmount: 0 }))).toContain('größer als 0')
    expect(expectError(addGoal(data, { ...BASE_INPUT, targetAmount: -5 }))).toContain('größer als 0')
    expect(expectError(addGoal(data, { ...BASE_INPUT, targetAmount: Number.NaN }))).toContain(
      'endliche Zahl',
    )
    expect(
      expectError(addGoal(data, { name: 'X', metric: 'accountBalance', targetAmount: 100 })),
    ).toContain('referenziertes Konto')
    expect(
      expectError(addGoal(data, { name: 'X', metric: 'positionValue', targetAmount: 100 })),
    ).toContain('referenzierte Depotposition')
    // Referenz falscher Art: accountBalance mit Positions-ID.
    const wrongKind = expectError(
      addGoal(data, {
        name: 'X',
        metric: 'accountBalance',
        refId: 'pos-telekom-aktien',
        targetAmount: 100,
      }),
    )
    expect(wrongKind).toContain('Referenz')
    expect(wrongKind).not.toContain('pos-telekom-aktien')
    expect(
      expectError(addGoal(data, { ...BASE_INPUT, refId: 'acc-vw-tagesgeld' })),
    ).toContain('nur bei Kontostand- und Positionswert-Zielen')
    expect(
      expectError(
        addGoal(data, { name: 'X', metric: 'manual', manualCurrentAmount: -1 }),
      ),
    ).toContain('nicht negativ')
    expect(
      expectError(addGoal(data, { ...BASE_INPUT, manualCurrentAmount: 100 })),
    ).toContain('nur bei freien Geldzielen')
    expect(expectError(addGoal(data, { ...BASE_INPUT, targetDate: '2026-02-30' }))).toContain(
      'Kalenderdatum',
    )
    expect(expectError(addGoal(data, { ...BASE_INPUT, startDate: 'bald' }))).toContain(
      'Kalenderdatum',
    )
    expect(
      expectError(
        addGoal(data, { ...BASE_INPUT, startDate: '2027-01-01', targetDate: '2026-12-31' }),
      ),
    ).toContain('nicht vor dem Startdatum')
  })

  it('erlaubt eine DEAKTIVIERTE Referenz (Warnung ist Sache der UI, kein Blocker)', () => {
    const data = loadExample()
    const withInactive: FinanceData = {
      ...data,
      accounts: data.accounts.map((account) =>
        account.id === 'acc-vw-tagesgeld' ? { ...account, isActive: false } : account,
      ),
    }
    expect(
      addGoal(withInactive, {
        name: 'X',
        metric: 'accountBalance',
        refId: 'acc-vw-tagesgeld',
        targetAmount: 100,
      }).ok,
    ).toBe(true)
  })

  it('Zielbetrag null bleibt erlaubt („offen“ – nichts erfinden, G11)', () => {
    const goal = expectOk(
      addGoal(loadExample(), { name: 'Offenes Ziel', targetAmount: null, metric: null }),
    ).goals.at(-1)!
    expect(goal.targetAmount).toBeNull()
    expect(goal.metric).toBeNull()
  })
})

describe('updateGoal – Teil-Patch, K2-Byte-Identität, Auflage-C-Normalisierung', () => {
  it('Teil-Patch ändert nur die übergebenen Felder', () => {
    const data = deepFreeze(loadExample())
    const next = expectOk(updateGoal(data, 'goal-depot-10k', { targetAmount: 12000 }))
    const goal = next.goals.find((entry) => entry.id === 'goal-depot-10k')!
    expect(goal.targetAmount).toBe(12000)
    expect(goal.metric).toBe('depotValue')
    expect(goal.name).toBe('10.000 EUR Depot')
    expect(goal.status).toBe('active')
  })

  it('unverändertes Speichern ist Byte-identisch (leerer Patch UND identische Werte, K2)', () => {
    const data = loadExample()
    const before = JSON.stringify(data)
    const emptyPatch = expectOk(updateGoal(data, 'goal-depot-10k', {}))
    expect(JSON.stringify(emptyPatch)).toBe(before)
    const sameValues = expectOk(
      updateGoal(data, 'goal-depot-10k', {
        name: '10.000 EUR Depot',
        targetAmount: 10000,
        targetDate: null,
        metric: 'depotValue',
        note: null,
      }),
    )
    expect(JSON.stringify(sameValues)).toBe(before)
  })

  it('K2 für Altdatei-Ziele: fehlende optionale Schlüssel werden nie als null-Schlüssel materialisiert', () => {
    const data = loadExample()
    const withMinimal: FinanceData = {
      ...data,
      goals: [...data.goals, { id: 'goal-minimal', name: 'Minimalziel', status: 'active' }],
    }
    const next = expectOk(updateGoal(withMinimal, 'goal-minimal', { name: 'Minimalziel neu' }))
    const goal = next.goals.find((entry) => entry.id === 'goal-minimal')!
    expect(Object.keys(goal)).toEqual(['id', 'name', 'status'])
    expect(goal.name).toBe('Minimalziel neu')
  })

  it('Auflage C: Wechsel WEG von accountBalance verwirft ein nicht ausdrücklich mitgegebenes refId', () => {
    const data = loadExample()
    const withRefGoal = expectOk(
      addGoal(data, {
        name: 'VW-Puffer',
        targetAmount: 2000,
        metric: 'accountBalance',
        refId: 'acc-vw-tagesgeld',
      }),
    )
    const next = expectOk(updateGoal(withRefGoal, 'goal-vw-puffer', { metric: 'tagesgeld' }))
    const goal = next.goals.find((entry) => entry.id === 'goal-vw-puffer')!
    expect(goal.metric).toBe('tagesgeld')
    expect(goal.refId).toBeNull()
    // Ausdrücklich mitgegebenes refId bei fremder Kennzahl bleibt ein Fehler.
    expect(
      expectError(
        updateGoal(withRefGoal, 'goal-vw-puffer', { metric: 'tagesgeld', refId: 'acc-vw-tagesgeld' }),
      ),
    ).toContain('nur bei Kontostand- und Positionswert-Zielen')
  })

  it('Auflage C: Wechsel WEG von manual verwirft manualCurrentAmount', () => {
    const data = loadExample()
    const withManual = expectOk(
      addGoal(data, {
        name: 'Freies Geldziel',
        targetAmount: 1000,
        metric: 'manual',
        manualCurrentAmount: 250,
      }),
    )
    const next = expectOk(
      updateGoal(withManual, 'goal-freies-geldziel', { metric: 'depotValue' }),
    )
    const goal = next.goals.find((entry) => entry.id === 'goal-freies-geldziel')!
    expect(goal.metric).toBe('depotValue')
    expect(goal.manualCurrentAmount).toBeNull()
  })

  it('isAutoCalculated ist über updateGoal NICHT änderbar (per Spread erhalten – Notgroschen bleibt Auto-Ziel)', () => {
    const data = loadExample()
    const next = expectOk(updateGoal(data, 'goal-notgroschen', { name: 'Notgroschen neu' }))
    const goal = next.goals.find((entry) => entry.id === 'goal-notgroschen')!
    expect(goal.isAutoCalculated).toBe(true)
    expect(effectiveGoalTarget(goal, next.settings.emergencyFund)).toBe(4680)
  })

  it('unbekanntes Ziel → verständlicher Fehler ohne technische ID', () => {
    const error = expectError(updateGoal(loadExample(), 'goal-gibt-es-nicht', { name: 'X' }))
    expect(error).toContain('existiert nicht')
    expect(error).not.toContain('goal-gibt-es-nicht')
  })
})

describe('Statusaktionen – pause/resume/complete/archive (kein Löschen)', () => {
  it('pauseGoal setzt deferred; resumeGoal reaktiviert; Fehlertexte nennen den Namen', () => {
    const data = deepFreeze(loadExample())
    const paused = expectOk(pauseGoal(data, 'goal-depot-10k'))
    expect(paused.goals.find((entry) => entry.id === 'goal-depot-10k')!.status).toBe('deferred')
    expect(expectError(pauseGoal(paused, 'goal-depot-10k'))).toContain('bereits pausiert')
    expect(expectError(pauseGoal(paused, 'goal-depot-10k'))).toContain('10.000 EUR Depot')
    const resumed = expectOk(resumeGoal(paused, 'goal-depot-10k'))
    expect(resumed.goals.find((entry) => entry.id === 'goal-depot-10k')!.status).toBe('active')
    expect(expectError(resumeGoal(resumed, 'goal-depot-10k'))).toContain('bereits aktiv')
  })

  it('completeGoal speichert den MANUELLEN Abschluss (reached); reaktivierbar; doppelt → Fehler', () => {
    const data = loadExample()
    const completed = expectOk(completeGoal(data, 'goal-depot-10k'))
    expect(completed.goals.find((entry) => entry.id === 'goal-depot-10k')!.status).toBe('reached')
    expect(expectError(completeGoal(completed, 'goal-depot-10k'))).toContain(
      'bereits manuell abgeschlossen',
    )
    const resumed = expectOk(resumeGoal(completed, 'goal-depot-10k'))
    expect(resumed.goals.find((entry) => entry.id === 'goal-depot-10k')!.status).toBe('active')
  })

  it('archiveGoal ist endgültig: keine weiteren Statusaktionen, kein Löschen – das Ziel bleibt in der Datei', () => {
    const data = loadExample()
    const archived = expectOk(archiveGoal(data, 'goal-urlaub'))
    expect(archived.goals.find((entry) => entry.id === 'goal-urlaub')!.status).toBe('archived')
    expect(archived.goals).toHaveLength(data.goals.length)
    expect(expectError(archiveGoal(archived, 'goal-urlaub'))).toContain('bereits archiviert')
    expect(expectError(pauseGoal(archived, 'goal-urlaub'))).toContain('archiviert')
    expect(expectError(resumeGoal(archived, 'goal-urlaub'))).toContain('archiviert')
    expect(expectError(completeGoal(archived, 'goal-urlaub'))).toContain('archiviert')
    // Auch Bearbeiten ist ausgeschlossen (A11y-Befund M12-B5).
    expect(expectError(updateGoal(archived, 'goal-urlaub', { name: 'Umbenannt' }))).toContain(
      'archiviert',
    )
  })

  it('Reinheit: Statusaktionen mutieren die Eingabe nicht (Byte-Vergleich)', () => {
    const mutable = loadExample()
    const before = JSON.stringify(mutable)
    pauseGoal(mutable, 'goal-depot-10k')
    completeGoal(mutable, 'goal-vermoegen-50k')
    archiveGoal(mutable, 'goal-urlaub')
    updateGoal(mutable, 'goal-depot-10k', { targetAmount: 11000 })
    addGoal(mutable, BASE_INPUT)
    expect(JSON.stringify(mutable)).toBe(before)
  })
})

describe('M12 – Validierung und Rundreise der additiven Schema-Erweiterung', () => {
  it('Altdatei-Regression: Seed lädt unverändert; Notgroschen 4.680/627,59 und U3-Basis 118,50 gepinnt', () => {
    const result = parseFinanceJson(exampleText())
    expect(result.ok).toBe(true)
    const data = result.data!
    expect(data.goals).toHaveLength(8)
    const notgroschen = data.goals.find((goal) => goal.id === 'goal-notgroschen')!
    expect(effectiveGoalTarget(notgroschen, data.settings.emergencyFund)).toBe(4680)
    expect(goalActualValue(notgroschen, data, TODAY)!.amount).toBeCloseTo(627.59, 9)
    const sparziel = data.goals.find((goal) => goal.id === 'goal-sparrate-1000')!
    expect(goalActualValue(sparziel, data, TODAY)!.amount).toBeCloseTo(118.5, 9)
  })

  it('Rundreise (DM9-Analogie): neue Felder + archived + unbekanntes Zusatzfeld überleben laden → speichern → laden', () => {
    const draft = mutateExample((data) => {
      data.goals.push(
        {
          id: 'goal-test-konto',
          name: 'Kontoziel',
          targetAmount: 2000,
          targetDate: '2027-06-30',
          metric: 'accountBalance',
          refId: 'acc-vw-tagesgeld',
          startDate: '2026-08-01',
          isAutoCalculated: false,
          status: 'active',
          note: null,
          x_zusatz: 'bleibt erhalten',
        },
        {
          id: 'goal-test-frei',
          name: 'Freies Ziel',
          targetAmount: 1000,
          metric: 'manual',
          manualCurrentAmount: 300,
          status: 'archived',
        },
      )
    })
    const first = validateFinanceData(draft)
    expect(first.ok).toBe(true)
    const serialized = serializeFinanceData(first.data!)
    const second = parseFinanceJson(serialized)
    expect(second.ok).toBe(true)
    expect(second.data).toEqual(first.data)
    const konto = second.data!.goals.find((goal) => goal.id === 'goal-test-konto')!
    expect(konto['x_zusatz']).toBe('bleibt erhalten')
    expect(konto.refId).toBe('acc-vw-tagesgeld')
    expect(konto.startDate).toBe('2026-08-01')
    const frei = second.data!.goals.find((goal) => goal.id === 'goal-test-frei')!
    expect(frei.status).toBe('archived')
    expect(frei.manualCurrentAmount).toBe(300)
  })

  it('Negativtests je Auflage B: unbekannte metric, refId-Kopplung, manualCurrentAmount, targetDate < startDate', () => {
    const withGoal = (patch: Record<string, unknown>) =>
      mutateExample((data) => {
        data.goals.push({ id: 'goal-kaputt', name: 'Kaputt', status: 'active', ...patch })
      })
    // Unbekannte Kennzahl → Enum-Fehler.
    expect(validateFinanceData(withGoal({ metric: 'depotXY' })).ok).toBe(false)
    // Unbekannter Status → Enum-Fehler.
    expect(validateFinanceData(withGoal({ status: 'fertig' })).ok).toBe(false)
    // refId fehlt bei accountBalance/positionValue.
    const missingRef = validateFinanceData(withGoal({ metric: 'accountBalance' }))
    expect(missingRef.ok).toBe(false)
    expect(missingRef.errors.some((issue) => issue.code === 'E_GOAL_COUPLING')).toBe(true)
    expect(validateFinanceData(withGoal({ metric: 'positionValue' })).ok).toBe(false)
    // refId bei fremder Kennzahl.
    expect(
      validateFinanceData(withGoal({ metric: 'tagesgeld', refId: 'acc-vw-tagesgeld' })).ok,
    ).toBe(false)
    // Tote Referenz und Referenz falscher Art → E_REF_TARGET (harter Fehler).
    const deadRef = validateFinanceData(
      withGoal({ metric: 'accountBalance', refId: 'acc-gibt-es-nicht' }),
    )
    expect(deadRef.ok).toBe(false)
    expect(deadRef.errors.some((issue) => issue.code === 'E_REF_TARGET')).toBe(true)
    expect(
      validateFinanceData(withGoal({ metric: 'accountBalance', refId: 'pos-telekom-aktien' })).ok,
    ).toBe(false)
    expect(
      validateFinanceData(withGoal({ metric: 'positionValue', refId: 'acc-vw-tagesgeld' })).ok,
    ).toBe(false)
    // manualCurrentAmount negativ bzw. bei fremder Kennzahl.
    expect(
      validateFinanceData(withGoal({ metric: 'manual', manualCurrentAmount: -1 })).ok,
    ).toBe(false)
    expect(
      validateFinanceData(withGoal({ metric: 'tagesgeld', manualCurrentAmount: 5 })).ok,
    ).toBe(false)
    // targetDate < startDate und ungültiges startDate.
    expect(
      validateFinanceData(
        withGoal({ startDate: '2027-01-01', targetDate: '2026-12-31' }),
      ).ok,
    ).toBe(false)
    expect(validateFinanceData(withGoal({ startDate: '2026-02-30' })).ok).toBe(false)
  })

  it('DEAKTIVIERTE Referenz ist KEIN Ladefehler (nur UI-Warnung); manual mit null bleibt „offen“ und gültig', () => {
    const draft = mutateExample((data) => {
      const account = data.accounts.find((entry) => entry.id === 'acc-vw-tagesgeld')!
      account['isActive'] = false
      data.goals.push(
        {
          id: 'goal-inaktiv-ref',
          name: 'Ziel auf inaktives Konto',
          metric: 'accountBalance',
          refId: 'acc-vw-tagesgeld',
          status: 'active',
        },
        {
          id: 'goal-manual-offen',
          name: 'Offenes freies Ziel',
          metric: 'manual',
          manualCurrentAmount: null,
          status: 'active',
        },
      )
    })
    const result = validateFinanceData(draft)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
