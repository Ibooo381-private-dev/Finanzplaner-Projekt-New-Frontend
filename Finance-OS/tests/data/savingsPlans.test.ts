/**
 * Unit-Tests der reinen Sparplan-Datenfunktionen (Modul M10):
 * add/update/pause/resume/end inkl. once-Normalisierung (Auflage 2a),
 * Fehlertexte ohne technische IDs, Reinheit (deepFreeze) sowie die
 * Validierungs-/Rundreisetests der additiven Schema-Erweiterung
 * (quarterly/halfyearly/once/isPaused; Negativtests weekly, dueMonth auf
 * nicht-yearly, once+amount null, once+validUntil≠validFrom, isPaused
 * nicht-boolean; Altdatei-Regression mit gepinnten Seed-Kennzahlen).
 */

import { describe, expect, it } from 'vitest'
import {
  addSavingsPlan,
  endSavingsPlan,
  generateSavingsPlanId,
  pauseSavingsPlan,
  resumeSavingsPlan,
  updateSavingsPlan,
} from '../../src/data/savingsPlans'
import type { SavingsPlanInput } from '../../src/data/savingsPlans'
import {
  employerAndProviderInflow,
  ownMonthlySavings,
  totalMonthlyInflow,
} from '../../src/finance'
import type { FinanceData } from '../../src/types/finance'
import { validateFinanceData } from '../../src/validation/validateFinanceData'
import { parseFinanceJson } from '../../src/validation/parseFinanceJson'
import { serializeFinanceData } from '../../src/storage/serializer'
import { deepFreeze } from '../finance/deepFreeze'
import { exampleText, loadExample, mutateExample } from '../storage/fixtures'

function expectOk(result: ReturnType<typeof addSavingsPlan>): FinanceData {
  if (!result.ok) throw new Error(`Erwartet ok, erhalten Fehler: ${result.error}`)
  return result.data
}

function expectError(result: ReturnType<typeof addSavingsPlan>): string {
  if (result.ok) throw new Error('Erwartet Fehler, erhalten ok.')
  return result.error
}

const BASE_INPUT: SavingsPlanInput = {
  name: 'Neuer Testsparplan',
  targetKind: 'position',
  targetId: 'pos-ishares-gold-etc',
  amount: 20,
  interval: 'monthly',
  flowType: 'own_fixed',
  validFrom: '2026-08-01',
}

describe('generateSavingsPlanId – ID-Konvention (data-model §2)', () => {
  it('bildet "sp-" + kebab(name) inkl. Umlaut-Transliteration und Kollisions-Suffixen', () => {
    expect(generateSavingsPlanId('Gold Zusatzrate', new Set())).toBe('sp-gold-zusatzrate')
    expect(generateSavingsPlanId('Übertrag Größe', new Set())).toBe('sp-uebertrag-groesse')
    const ids = new Set(['sp-gold'])
    expect(generateSavingsPlanId('Gold', ids)).toBe('sp-gold-2')
  })
})

describe('addSavingsPlan', () => {
  it('legt einen Plan mit sp-ID, isFlexible-Default true und minAmount null an; Eingabe bleibt unverändert', () => {
    const data = deepFreeze(loadExample())
    const next = expectOk(addSavingsPlan(data, BASE_INPUT))
    const plan = next.savingsPlans[next.savingsPlans.length - 1]
    expect(plan.id).toBe('sp-neuer-testsparplan')
    expect(plan.isFlexible).toBe(true)
    expect(plan.minAmount).toBeNull()
    expect(plan.validUntil).toBeNull()
    expect(data.savingsPlans).toHaveLength(12)
    expect(next.savingsPlans).toHaveLength(13)
  })

  it('once-Normalisierung (Auflage 2a): validUntil wird immer auf validFrom gesetzt', () => {
    const next = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Einmalige Sonderzahlung',
        interval: 'once',
        amount: 500,
        validUntil: null,
      }),
    )
    const plan = next.savingsPlans[next.savingsPlans.length - 1]
    expect(plan.validUntil).toBe(plan.validFrom)
  })

  it('dueMonth wird nur bei yearly übernommen', () => {
    const yearly = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Jahresplan',
        interval: 'yearly',
        dueMonth: 7,
      }),
    )
    expect(yearly.savingsPlans[yearly.savingsPlans.length - 1].dueMonth).toBe(7)
  })

  it('lehnt fachliche Fehler feldbezogen ab (deutsche Meldungen, keine IDs)', () => {
    const data = loadExample()
    expect(expectError(addSavingsPlan(data, { ...BASE_INPUT, name: '  ' }))).toContain('Name')
    expect(expectError(addSavingsPlan(data, { ...BASE_INPUT, amount: -5 }))).toContain(
      'nicht negativ',
    )
    expect(
      expectError(addSavingsPlan(data, { ...BASE_INPUT, amount: null })),
    ).toContain('variabel')
    expect(
      expectError(
        addSavingsPlan(data, { ...BASE_INPUT, interval: 'once', amount: null, flowType: 'provider' }),
      ),
    ).toContain('einmaliger Zufluss')
    expect(
      expectError(addSavingsPlan(data, { ...BASE_INPUT, dueMonth: 7 })),
    ).toContain('jährlichem Rhythmus')
    expect(
      expectError(addSavingsPlan(data, { ...BASE_INPUT, interval: 'yearly', dueMonth: 13 })),
    ).toContain('1 (Januar) bis 12 (Dezember)')
    expect(
      expectError(addSavingsPlan(data, { ...BASE_INPUT, validFrom: '2026-02-30' })),
    ).toContain('Kalenderdatum')
    expect(
      expectError(addSavingsPlan(data, { ...BASE_INPUT, validUntil: '2026-07-01' })),
    ).toContain('nicht vor dem Startdatum')
    const transferError = expectError(
      addSavingsPlan(data, { ...BASE_INPUT, flowType: 'reserve_transfer' }),
    )
    expect(transferError).toContain('Umbuchungen')
    expect(transferError).not.toContain('pos-')
    const refError = expectError(
      addSavingsPlan(data, { ...BASE_INPUT, targetId: 'acc-vw-tagesgeld' }),
    )
    // targetKind position + Konto-ID → passt nicht; Meldung ohne technische ID.
    expect(refError).toContain('Ziel')
    expect(refError).not.toContain('acc-vw-tagesgeld')
  })

  it('erlaubt ein deaktiviertes Ziel (Warnung ist Sache der UI, kein Blocker)', () => {
    const data = loadExample()
    const withInactive: FinanceData = {
      ...data,
      portfolioPositions: data.portfolioPositions.map((position) =>
        position.id === 'pos-ishares-gold-etc' ? { ...position, isActive: false } : position,
      ),
    }
    expect(addSavingsPlan(withInactive, BASE_INPUT).ok).toBe(true)
  })
})

describe('updateSavingsPlan', () => {
  it('aktualisiert Stammdaten; unbekannte Felder des Plans bleiben erhalten (Regel 16)', () => {
    const data = loadExample()
    const withUnknown: FinanceData = {
      ...data,
      savingsPlans: data.savingsPlans.map((plan) =>
        plan.id === 'sp-tr-gold' ? { ...plan, x_custom: 'bleibt' } : plan,
      ),
    }
    const next = expectOk(updateSavingsPlan(deepFreeze(withUnknown), 'sp-tr-gold', { amount: 10 }))
    const plan = next.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!
    expect(plan.amount).toBe(10)
    expect(plan['x_custom']).toBe('bleibt')
  })

  it('once-Normalisierung (Auflage 2a): validFrom-Änderung zieht validUntil mit', () => {
    const base = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Einmalzahlung',
        interval: 'once',
        amount: 500,
      }),
    )
    const planId = base.savingsPlans[base.savingsPlans.length - 1].id
    const next = expectOk(updateSavingsPlan(base, planId, { validFrom: '2026-09-15' }))
    const plan = next.savingsPlans.find((entry) => entry.id === planId)!
    expect(plan.validFrom).toBe('2026-09-15')
    expect(plan.validUntil).toBe('2026-09-15')
  })

  it('lehnt bei once ein explizit abweichendes Enddatum ab', () => {
    const base = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Einmalzahlung',
        interval: 'once',
        amount: 500,
      }),
    )
    const planId = base.savingsPlans[base.savingsPlans.length - 1].id
    expect(
      expectError(updateSavingsPlan(base, planId, { validUntil: '2026-12-31' })),
    ).toContain('Ausführungsdatum')
  })

  it('Intervallwechsel zu once normalisiert das Enddatum auf validFrom', () => {
    const data = loadExample()
    const next = expectOk(
      updateSavingsPlan(data, 'sp-tr-gold', { interval: 'once' }),
    )
    const plan = next.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!
    expect(plan.validUntil).toBe(plan.validFrom)
  })

  it('Intervallwechsel WEG von yearly verwirft einen nicht mitgegebenen dueMonth (Befund M10-2)', () => {
    // sp-telekom-eigen hat dueMonth 7; der Teil-Patch {interval: monthly} darf
    // nicht an der dueMonth-Regel scheitern – der Wert wird normalisiert.
    const next = expectOk(
      updateSavingsPlan(loadExample(), 'sp-telekom-eigen', { interval: 'monthly' }),
    )
    const plan = next.savingsPlans.find((entry) => entry.id === 'sp-telekom-eigen')!
    expect(plan.interval).toBe('monthly')
    expect(plan.dueMonth).toBeNull()
  })

  it('Intervallwechsel WEG von once setzt das Normalisierungs-Enddatum zurück (Befund M10-3)', () => {
    const base = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Einmalzahlung',
        interval: 'once',
        amount: 500,
      }),
    )
    const planId = base.savingsPlans[base.savingsPlans.length - 1].id
    // Ohne ausdrückliches neues Enddatum: das once-Artefakt (validUntil =
    // Ausführungsdatum) fällt weg – der Plan endet NICHT still nach einem Monat.
    const next = expectOk(updateSavingsPlan(base, planId, { interval: 'monthly' }))
    const plan = next.savingsPlans.find((entry) => entry.id === planId)!
    expect(plan.interval).toBe('monthly')
    expect(plan.validUntil).toBeNull()
    // Ein AUSDRÜCKLICH mitgegebenes Enddatum bleibt dagegen erhalten.
    const explicit = expectOk(
      updateSavingsPlan(base, planId, { interval: 'monthly', validUntil: '2026-12-31' }),
    )
    expect(explicit.savingsPlans.find((entry) => entry.id === planId)!.validUntil).toBe(
      '2026-12-31',
    )
  })

  it('nicht-endlicher Betrag (NaN) wird mit deutscher Meldung abgelehnt', () => {
    expect(expectError(addSavingsPlan(loadExample(), { ...BASE_INPUT, amount: NaN }))).toContain(
      'endliche Zahl',
    )
  })

  it('Plan OHNE isFlexible-Schlüssel: unverändertes Speichern bleibt Byte-identisch (Reviewer K2)', () => {
    // Fremd-/Altdatei-Plan ohne den optionalen Schlüssel: ein Update mit dem
    // Default-Wert (true, wie ihn die UI immer mitsendet) darf den Schlüssel
    // NICHT neu anlegen – sonst entstünde ein falscher Dirty-State.
    const data = loadExample()
    const withoutKey: FinanceData = {
      ...data,
      savingsPlans: data.savingsPlans.map((plan) => {
        if (plan.id !== 'sp-tr-gold') return plan
        const clone: Record<string, unknown> = { ...plan }
        delete clone['isFlexible']
        return clone as unknown as FinanceData['savingsPlans'][number]
      }),
    }
    const existing = withoutKey.savingsPlans.find((plan) => plan.id === 'sp-tr-gold')!
    const next = expectOk(
      updateSavingsPlan(deepFreeze(withoutKey), 'sp-tr-gold', {
        name: existing.name,
        amount: existing.amount,
        isFlexible: true,
      }),
    )
    expect(JSON.parse(JSON.stringify(next))).toEqual(JSON.parse(JSON.stringify(withoutKey)))
    // Eine ECHTE Abweichung vom Default legt den Schlüssel dagegen an.
    const changed = expectOk(
      updateSavingsPlan(withoutKey, 'sp-tr-gold', { isFlexible: false }),
    )
    expect(changed.savingsPlans.find((plan) => plan.id === 'sp-tr-gold')!.isFlexible).toBe(false)
  })

  it('unbekannter Plan → Fehler ohne technische ID', () => {
    const error = expectError(updateSavingsPlan(loadExample(), 'sp-gibt-es-nicht', { amount: 1 }))
    expect(error).toContain('existiert nicht')
    expect(error).not.toContain('sp-gibt-es-nicht')
  })

  it('unverändertes Speichern liefert einen fachlich identischen Bestand (Basis des UI-Vergleichs)', () => {
    const data = loadExample()
    const plan = data.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!
    const next = expectOk(
      updateSavingsPlan(data, 'sp-tr-gold', { name: plan.name, amount: plan.amount }),
    )
    expect(JSON.stringify(next)).toBe(JSON.stringify(data))
  })
})

describe('pause/resume/endSavingsPlan', () => {
  it('pausiert und reaktiviert; F8/F9 schließen pausierte Pläne automatisch aus', () => {
    const data = deepFreeze(loadExample())
    const paused = expectOk(pauseSavingsPlan(data, 'sp-tr-gold'))
    const pausedPlan = paused.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!
    expect(pausedPlan.isPaused).toBe(true)
    const activePlans = paused.savingsPlans.filter((plan) => plan.isPaused !== true)
    expect(ownMonthlySavings(activePlans, 'realMonthly')).toBeCloseTo(113.5, 9)
    const resumed = expectOk(resumeSavingsPlan(paused, 'sp-tr-gold'))
    expect(resumed.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!.isPaused).toBe(false)
  })

  it('doppeltes Pausieren/Reaktivieren wird mit Namensnennung abgelehnt', () => {
    const paused = expectOk(pauseSavingsPlan(loadExample(), 'sp-tr-gold'))
    expect(expectError(pauseSavingsPlan(paused, 'sp-tr-gold'))).toContain(
      'TR Sparplan Physical Gold',
    )
    expect(expectError(resumeSavingsPlan(loadExample(), 'sp-tr-gold'))).toContain('nicht pausiert')
  })

  it('beendet einen Plan über validUntil; Enddatum vor Start und once werden abgelehnt', () => {
    const data = deepFreeze(loadExample())
    const ended = expectOk(endSavingsPlan(data, 'sp-tr-gold', '2026-12-31'))
    expect(ended.savingsPlans.find((entry) => entry.id === 'sp-tr-gold')!.validUntil).toBe(
      '2026-12-31',
    )
    expect(expectError(endSavingsPlan(data, 'sp-tr-gold', '2026-01-01'))).toContain(
      'nicht vor dem Startdatum',
    )
    const withOnce = expectOk(
      addSavingsPlan(loadExample(), {
        ...BASE_INPUT,
        name: 'Einmalzahlung',
        interval: 'once',
        amount: 500,
      }),
    )
    const onceId = withOnce.savingsPlans[withOnce.savingsPlans.length - 1].id
    expect(expectError(endSavingsPlan(withOnce, onceId, '2026-12-31'))).toContain(
      'automatisch abgeschlossen',
    )
  })
})

describe('M10 – Validierung und Rundreise der additiven Schema-Erweiterung', () => {
  it('Altdatei-Regression: Seed lädt unverändert; 118,50/201,83/125/250 gepinnt', () => {
    const result = parseFinanceJson(exampleText())
    expect(result.ok).toBe(true)
    const plans = result.data!.savingsPlans
    expect(ownMonthlySavings(plans, 'realMonthly')).toBeCloseTo(118.5, 9)
    expect(ownMonthlySavings(plans, 'smoothed')).toBeCloseTo(201.8333333, 6)
    expect(totalMonthlyInflow(plans, 'realMonthly')).toBeCloseTo(125.0, 9)
    expect(totalMonthlyInflow(plans, 'smoothed')).toBeCloseTo(250.0, 9)
    expect(employerAndProviderInflow(plans, 'realMonthly')).toBeCloseTo(6.5, 9)
  })

  it('Rundreise: quarterly/halfyearly/once/isPaused + unbekanntes Zusatzfeld überleben laden → speichern → laden', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans.push(
        {
          id: 'sp-test-quartal',
          name: 'Quartalsplan',
          targetKind: 'position',
          targetId: 'pos-ishares-gold-etc',
          amount: 120,
          interval: 'quarterly',
          flowType: 'own_fixed',
          validFrom: '2026-08-01',
          validUntil: null,
          x_zusatz: 'bleibt erhalten',
        },
        {
          id: 'sp-test-halbjahr',
          name: 'Halbjahresplan',
          targetKind: 'account',
          targetId: 'acc-vw-tagesgeld',
          amount: 300,
          interval: 'halfyearly',
          flowType: 'own_fixed',
          validFrom: '2026-08-01',
          validUntil: null,
          isPaused: true,
        },
        {
          id: 'sp-test-einmal',
          name: 'Einmalzahlung',
          targetKind: 'position',
          targetId: 'pos-ishares-gold-etc',
          amount: 500,
          interval: 'once',
          flowType: 'own_fixed',
          validFrom: '2026-09-01',
          validUntil: '2026-09-01',
        },
      )
    })
    const first = validateFinanceData(draft)
    expect(first.ok).toBe(true)
    const serialized = serializeFinanceData(first.data!)
    const second = parseFinanceJson(serialized)
    expect(second.ok).toBe(true)
    expect(second.data).toEqual(first.data)
    const quartal = second.data!.savingsPlans.find((plan) => plan.id === 'sp-test-quartal')!
    expect(quartal['x_zusatz']).toBe('bleibt erhalten')
    expect(second.data!.savingsPlans.find((plan) => plan.id === 'sp-test-halbjahr')!.isPaused).toBe(
      true,
    )
  })

  it('Negativtest: interval "weekly" wird abgelehnt', () => {
    const draft = mutateExample((data) => {
      data.savingsPlans[0].interval = 'weekly'
    })
    const result = validateFinanceData(draft)
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.path.includes('interval'))).toBe(true)
  })

  it('Negativtest (Auflage 2f): numerisches dueMonth auf nicht-yearly wird abgelehnt; null bleibt überall gültig', () => {
    const bad = validateFinanceData(
      mutateExample((data) => {
        // sp-tr-gold ist monthly → numerisches dueMonth ist unzulässig.
        data.savingsPlans[5].dueMonth = 7
      }),
    )
    expect(bad.ok).toBe(false)
    expect(bad.errors.some((issue) => issue.message.includes('yearly'))).toBe(true)
    const nullOk = validateFinanceData(
      mutateExample((data) => {
        data.savingsPlans[5].dueMonth = null
      }),
    )
    expect(nullOk.ok).toBe(true)
  })

  it('Negativtest: once mit amount null wird abgelehnt (auch bei variabler Zuflussart)', () => {
    const result = validateFinanceData(
      mutateExample((data) => {
        // sp-tr-saveback: provider mit amount null – als once unzulässig.
        data.savingsPlans[10].interval = 'once'
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.message.includes('once'))).toBe(true)
  })

  it('Negativtest: once mit validUntil ≠ validFrom wird abgelehnt; validUntil = validFrom lädt', () => {
    const bad = validateFinanceData(
      mutateExample((data) => {
        data.savingsPlans[5].interval = 'once'
        data.savingsPlans[5].validUntil = '2026-12-31'
      }),
    )
    expect(bad.ok).toBe(false)
    const good = validateFinanceData(
      mutateExample((data) => {
        data.savingsPlans[5].interval = 'once'
        data.savingsPlans[5].validUntil = data.savingsPlans[5].validFrom
      }),
    )
    expect(good.ok).toBe(true)
  })

  it('Negativtest: nicht-boolesches isPaused wird abgelehnt', () => {
    const result = validateFinanceData(
      mutateExample((data) => {
        data.savingsPlans[0].isPaused = 'ja'
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.some((issue) => issue.path.includes('isPaused'))).toBe(true)
  })
})
