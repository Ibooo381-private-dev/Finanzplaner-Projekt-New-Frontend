/**
 * Unit-Tests F1–F9 (Vermögen + Sparleistung) auf Basis des bestätigten Seed-Snapshots
 * 2026-07-17. Erwartungswerte stammen aus docs/calculation-rules.md Abschnitt 12
 * (dort vom finance-analyst unabhängig nachgerechnet). Alle Eingaben sind eingefroren –
 * die Funktionen dürfen sie nicht verändern.
 */

import { describe, expect, it } from 'vitest'
import {
  accountsValue,
  aggregateMonthlyBy,
  annualAmount,
  cashShareOfTotal,
  cashValue,
  depotShareOfTotal,
  depotValue,
  employerAndProviderInflow,
  groupTotal,
  isPlanActiveOn,
  latestEntry,
  monthlyAmount,
  ownMonthlySavings,
  paymentsPerYear,
  positionShareOfDepot,
  positionShareOfTotal,
  realAmountInMonth,
  referenceAllocation,
  roundToUnit,
  share,
  totalMonthlyInflow,
  totalWealth,
  worldTotal,
} from '../../src/finance'
import type { Account, PortfolioPosition, SavingsPlan } from '../../src/types/finance'
import { loadExample } from '../storage/fixtures'
import { deepFreeze } from './deepFreeze'

const example = deepFreeze(loadExample())

describe('F1/F2 – Gesamtvermögen, Depotwert, Tagesgeldwert (Seed-Normalfall)', () => {
  it('Depotwert = 2.522,47; Tagesgeld = 627,59; Gesamtvermögen = 3.150,06', () => {
    const depot = depotValue(example.portfolioPositions)
    const cash = cashValue(example.accounts)
    expect(depot.amount).toBeCloseTo(2522.47, 9)
    expect(depot.missingIds).toEqual([])
    expect(cash.amount).toBeCloseTo(627.59, 9)
    expect(cash.missingIds).toEqual([])
    expect(totalWealth(cash.amount, depot.amount)).toBeCloseTo(3150.06, 9)
  })

  it('Tagesgeld stammt NUR aus Konten mit type "tagesgeld" (nie Giro/Cash/Rücklage)', () => {
    // Nur acc-vw-tagesgeld hat im Seed einen Saldo; alle anderen Kontotypen sind ausgeschlossen.
    const cash = cashValue(example.accounts)
    expect(cash.amount).toBeCloseTo(627.59, 9)
  })

  it('leere Historie = unbekannt, nicht 0: Position ohne Werte landet in missingIds (G11)', () => {
    const positions = deepFreeze([
      {
        id: 'pos-a',
        name: 'A',
        accountId: 'acc-depot',
        group: 'world',
        valueHistory: [{ date: '2026-07-17', value: 100 }],
      },
      { id: 'pos-b', name: 'B', accountId: 'acc-depot', group: 'gold', valueHistory: [] },
    ]) as unknown as PortfolioPosition[]
    const depot = depotValue(positions)
    expect(depot.amount).toBe(100)
    expect(depot.missingIds).toEqual(['pos-b'])
  })

  it('latestEntry nimmt den jüngsten Eintrag nach ISO-Datum', () => {
    const history = deepFreeze([
      { date: '2026-07-17', value: 1 },
      { date: '2026-08-01', value: 2 },
      { date: '2026-07-20', value: 3 },
    ])
    expect(latestEntry(history)!.value).toBe(2)
    expect(latestEntry([])).toBeNull()
  })

  it('latestEntry bei Datumsgleichheit: der zuerst erfasste Eintrag gewinnt (deterministisch)', () => {
    // Erwartung hergeleitet aus der Implementierung (reduce mit striktem »>«):
    // bei gleichem ISO-Datum ist entry.date > latest.date falsch → der erste Eintrag
    // bleibt stehen. Die Validierung verbietet doppelte Daten nicht; dieser Test
    // dokumentiert das stabile Verhalten sichtbar.
    const history = deepFreeze([
      { date: '2026-07-17', value: 1 },
      { date: '2026-07-17', value: 2 },
    ])
    expect(latestEntry(history)!.value).toBe(1)
  })

  it('leeres Depot: D = 0 ohne missingIds (F2-Randfall); GV = 0 + 0 = 0 ist gültig (F1)', () => {
    // F2: „Keine Positionen → D = 0“; F1: „Beide 0 → GV = 0 (gültig)“.
    const empty = depotValue([])
    expect(empty.amount).toBe(0)
    expect(empty.missingIds).toEqual([])
    expect(worldTotal([]).amount).toBe(0)
    expect(totalWealth(0, 0)).toBe(0)
  })
})

describe('F3–F6 – Anteile (Nenner-Disziplin, Division durch 0)', () => {
  const depot = 2522.47
  const total = 3150.06

  it('Seed-Anteile exakt wie im Formelkatalog', () => {
    expect(cashShareOfTotal(627.59, total)!).toBeCloseTo(0.1992311, 7)
    expect(depotShareOfTotal(depot, total)!).toBeCloseTo(0.8007689, 7)
    expect(cashShareOfTotal(627.59, total)! + depotShareOfTotal(depot, total)!).toBeCloseTo(1.0, 9)
    expect(positionShareOfDepot(1369.14, depot)!).toBeCloseTo(0.5427775, 7)
    expect(positionShareOfDepot(33.92, depot)!).toBeCloseTo(0.0134471, 7)
    expect(positionShareOfTotal(1369.14, total)!).toBeCloseTo(0.4346393, 7)
  })

  it('leeres Depot: Anteil ist null („nicht berechenbar“), nie NaN oder Infinity (F20)', () => {
    expect(positionShareOfDepot(100, 0)).toBeNull()
    expect(share(0, 0)).toBeNull()
    expect(cashShareOfTotal(627.59, 0)).toBeNull()
  })

  it('Nullwerte im Zähler sind gültig: Anteil 0', () => {
    expect(positionShareOfDepot(0, depot)).toBe(0)
  })

  it('Tagesgeld gehört nie in den Depotnenner: World-Anteil rechnet nur gegen den Depotwert', () => {
    const world = worldTotal(example.portfolioPositions)
    expect(world.amount).toBeCloseTo(1020.3, 9)
    expect(positionShareOfDepot(world.amount, depot)!).toBeCloseTo(0.4044845, 7)
    // Bewusst KEIN Anteil World/(Depot+Tagesgeld) als „Depotgewichtung“ – das wäre 0,3238…
    expect(positionShareOfDepot(world.amount, depot)!).not.toBeCloseTo(0.3238986, 3)
  })
})

describe('F7 – MSCI World gesamt', () => {
  it('Summe der drei world-Positionen: 577,99 + 237,45 + 204,86 = 1.020,30', () => {
    const world = worldTotal(example.portfolioPositions)
    expect(world.amount).toBeCloseTo(1020.3, 9)
    expect(world.missingIds).toEqual([])
  })
})

describe('DM35 – groupTotal (F7-Verallgemeinerung, Modul Depot)', () => {
  it('Seed-Gruppensummen: world 1.020,30 (= worldTotal); gold 33,92; telekom 1.369,14; em 99,11', () => {
    const positions = example.portfolioPositions
    expect(groupTotal(positions, 'world').amount).toBeCloseTo(1020.3, 9)
    expect(groupTotal(positions, 'world').amount).toBe(worldTotal(positions).amount)
    expect(groupTotal(positions, 'gold').amount).toBeCloseTo(33.92, 9)
    expect(groupTotal(positions, 'telekom').amount).toBeCloseTo(1369.14, 9)
    expect(groupTotal(positions, 'em').amount).toBeCloseTo(99.11, 9)
  })

  it('leere Gruppe → 0 ohne missingIds; Position ohne Wert landet in missingIds (G11)', () => {
    expect(groupTotal([], 'gold')).toEqual({ amount: 0, missingIds: [] })
    const positions = deepFreeze([
      {
        id: 'pos-a',
        name: 'A',
        accountId: 'acc-depot',
        group: 'gold',
        valueHistory: [{ date: '2026-07-17', value: 10 }],
      },
      { id: 'pos-b', name: 'B', accountId: 'acc-depot', group: 'gold', valueHistory: [] },
      { id: 'pos-c', name: 'C', accountId: 'acc-depot', group: 'world', valueHistory: [] },
    ]) as unknown as PortfolioPosition[]
    const gold = groupTotal(positions, 'gold')
    expect(gold.amount).toBe(10)
    // Nur die leere Historie DER GRUPPE zählt als fehlend (pos-c gehört nicht zu gold).
    expect(gold.missingIds).toEqual(['pos-b'])
  })
})

describe('M7 – accountsValue (data-model-§4-Baustein, Dashboard)', () => {
  it('Seed „sonstiges aktives Kontovermögen“: 0,00 mit missingIds Giro/ING/TR-Cash/Bitget (leere Historien, G11)', () => {
    const other = accountsValue(example.accounts, [
      'giro',
      'cash',
      'ruecklage',
      'bargeld',
      'sonstiges',
      'krypto',
    ])
    expect(other.amount).toBe(0)
    expect(other.missingIds).toEqual([
      'acc-sparkasse-giro',
      'acc-ing-ruecklage',
      'acc-tr-cash',
      'acc-bitget-krypto',
    ])
  })

  it('filtert exakt nach Typenliste: tagesgeld-Probe ist deckungsgleich mit cashValue', () => {
    expect(accountsValue(example.accounts, ['tagesgeld'])).toEqual(cashValue(example.accounts))
  })

  it('leere Typenliste → 0 ohne missingIds; pension steht nie in der Dashboard-Typenliste', () => {
    expect(accountsValue(example.accounts, [])).toEqual({ amount: 0, missingIds: [] })
    // pension ist Merkposten ohne Wert: selbst mit expliziter Auswahl liefert es
    // nur missingIds (leere Historie), nie einen erfundenen Betrag.
    const pensionOnly = accountsValue(example.accounts, ['pension'])
    expect(pensionOnly.amount).toBe(0)
    expect(pensionOnly.missingIds).toEqual(['acc-telekom-pension'])
  })

  it('addiert je Konto den jüngsten Saldo; Typen außerhalb der Liste bleiben unberücksichtigt', () => {
    const accounts = deepFreeze([
      {
        id: 'a',
        name: 'A',
        type: 'giro',
        balanceHistory: [
          { date: '2026-07-01', amount: 100 },
          { date: '2026-07-17', amount: 150 },
        ],
      },
      { id: 'b', name: 'B', type: 'krypto', balanceHistory: [{ date: '2026-07-17', amount: 50 }] },
      {
        id: 'c',
        name: 'C',
        type: 'tagesgeld',
        balanceHistory: [{ date: '2026-07-17', amount: 999 }],
      },
    ]) as unknown as Account[]
    const result = accountsValue(accounts, ['giro', 'krypto'])
    expect(result.amount).toBe(200)
    expect(result.missingIds).toEqual([])
  })
})

describe('F8/F9 – eigene Sparleistung und Gesamtzufluss (Seed-Sparpläne)', () => {
  const plans = example.savingsPlans

  it('feste VL- und Telekom-Raten: real 118,50 eigen; geglättet ≈ 201,83 eigen', () => {
    expect(ownMonthlySavings(plans, 'realMonthly')).toBeCloseTo(118.5, 9)
    expect(ownMonthlySavings(plans, 'smoothed')).toBeCloseTo(201.8333333, 6)
  })

  it('Arbeitgeber/Anbieter: real 6,50; geglättet ≈ 48,17', () => {
    expect(employerAndProviderInflow(plans, 'realMonthly')).toBeCloseTo(6.5, 9)
    expect(employerAndProviderInflow(plans, 'smoothed')).toBeCloseTo(48.1666667, 6)
  })

  it('Gesamtzufluss: real 125,00; geglättet exakt 250,00', () => {
    expect(totalMonthlyInflow(plans, 'realMonthly')).toBeCloseTo(125.0, 9)
    expect(totalMonthlyInflow(plans, 'smoothed')).toBeCloseTo(250.0, 9)
  })

  it('reserve_transfer (ING 75) zählt NIE als Sparleistung oder Zufluss (G7)', () => {
    const onlyReserve = deepFreeze([
      {
        id: 'sp-reserve',
        name: 'Rücklage',
        targetKind: 'account',
        targetId: 'acc-x',
        amount: 75,
        interval: 'monthly',
        flowType: 'reserve_transfer',
        validFrom: '2026-01-01',
        validUntil: null,
      },
    ]) as unknown as SavingsPlan[]
    expect(ownMonthlySavings(onlyReserve, 'realMonthly')).toBe(0)
    expect(totalMonthlyInflow(onlyReserve, 'smoothed')).toBe(0)
  })

  it('variable Pläne (amount null) zählen 0 – Saveback/Round-up nur aus Ist-Buchungen', () => {
    const variablePlan = plans.find((plan) => plan.id === 'sp-tr-saveback')!
    expect(monthlyAmount(variablePlan, 'realMonthly')).toBe(0)
    expect(monthlyAmount(variablePlan, 'smoothed')).toBe(0)
  })

  it('Jahrespläne sind kein realer Monats-Cashflow: Telekom 1.000/Jahr → real 0, geglättet 83,33', () => {
    const telekom = plans.find((plan) => plan.id === 'sp-telekom-eigen')!
    expect(monthlyAmount(telekom, 'realMonthly')).toBe(0)
    expect(monthlyAmount(telekom, 'smoothed')).toBeCloseTo(83.3333333, 6)
  })

  it('employer-Jahresplan (Telekom-Bonus 500): real 0, geglättet 500/12 ≈ 41,67', () => {
    // F9/F18: Der Shares2you-Bonus (500/Jahr, Juli) ist kein realer Monats-Cashflow;
    // geglättet 500 / 12 = 41,6666667. Zusammen mit VL-Zuschuss 6,50:
    // 6,50 + 41,6667 = 48,1667 (deckt den geglätteten AG/Anbieter-Wert oben ab).
    const bonus = plans.find((plan) => plan.id === 'sp-telekom-bonus')!
    expect(monthlyAmount(bonus, 'realMonthly')).toBe(0)
    expect(monthlyAmount(bonus, 'smoothed')).toBeCloseTo(41.6666667, 6)
  })

  it('isPlanActiveOn respektiert validFrom/validUntil', () => {
    const plan = plans.find((entry) => entry.id === 'sp-tr-spdr')!
    expect(isPlanActiveOn(plan, '2026-07-19')).toBe(true)
    expect(isPlanActiveOn(plan, '2026-07-18')).toBe(false) // vor validFrom 2026-07-19
    const limited = deepFreeze({ ...plan, validUntil: '2026-12-31' }) as SavingsPlan
    expect(isPlanActiveOn(limited, '2027-01-01')).toBe(false)
  })
})

describe('Reinheit – F1–F9 mutieren Eingaben nicht (Snapshot-Vergleich auf UNGEFRORENEN Daten)', () => {
  it('mutierbare Eingaben sind nach allen Aufrufen Byte-für-Byte unverändert', () => {
    // Bewusst OHNE deepFreeze: deepFreeze weist nur nach, dass Mutation WERFEN würde.
    // Hier wird positiv nachgewiesen, dass die Funktionen mutierbare Eingaben
    // tatsächlich unangetastet lassen (Kopfzeilen-Zusage „Eingaben werden nicht mutiert“).
    const mutable = loadExample()
    const before = JSON.stringify(mutable)
    cashValue(mutable.accounts)
    depotValue(mutable.portfolioPositions)
    worldTotal(mutable.portfolioPositions)
    ownMonthlySavings(mutable.savingsPlans, 'realMonthly')
    ownMonthlySavings(mutable.savingsPlans, 'smoothed')
    employerAndProviderInflow(mutable.savingsPlans, 'smoothed')
    totalMonthlyInflow(mutable.savingsPlans, 'realMonthly')
    expect(JSON.stringify(mutable)).toBe(before)
  })
})

describe('M10 – Sparplan-Bausteine (paymentsPerYear, annualAmount, monthlyAmount je Intervall)', () => {
  const basePlan = {
    id: 'sp-m10',
    name: 'M10-Testplan',
    targetKind: 'position',
    targetId: 'pos-x',
    flowType: 'own_fixed',
    validFrom: '2026-01-01',
    validUntil: null,
  }
  const plan = (patch: Record<string, unknown>) =>
    deepFreeze({ ...basePlan, ...patch }) as unknown as SavingsPlan

  it('paymentsPerYear: monthly 12, quarterly 4, halfyearly 2, yearly 1, once 1', () => {
    expect(paymentsPerYear('monthly')).toBe(12)
    expect(paymentsPerYear('quarterly')).toBe(4)
    expect(paymentsPerYear('halfyearly')).toBe(2)
    expect(paymentsPerYear('yearly')).toBe(1)
    expect(paymentsPerYear('once')).toBe(1)
  })

  it('annualAmount = amount × paymentsPerYear; amount null → null („variabel/unbekannt“, G11 – nie 0)', () => {
    expect(annualAmount(plan({ amount: 25, interval: 'monthly' }))).toBe(300)
    expect(annualAmount(plan({ amount: 120, interval: 'quarterly' }))).toBe(480)
    expect(annualAmount(plan({ amount: 300, interval: 'halfyearly' }))).toBe(600)
    expect(annualAmount(plan({ amount: 1000, interval: 'yearly' }))).toBe(1000)
    expect(annualAmount(plan({ amount: 500, interval: 'once' }))).toBe(500)
    expect(annualAmount(plan({ amount: null, interval: 'monthly', flowType: 'provider' }))).toBeNull()
  })

  it('monthlyAmount: 120 € vierteljährlich → geglättet 40, real 0; halbjährlich /6; once → 0 in beiden Sichten', () => {
    const quarterly = plan({ amount: 120, interval: 'quarterly' })
    expect(monthlyAmount(quarterly, 'smoothed')).toBeCloseTo(40, 9)
    expect(monthlyAmount(quarterly, 'realMonthly')).toBe(0)
    const halfyearly = plan({ amount: 120, interval: 'halfyearly' })
    expect(monthlyAmount(halfyearly, 'smoothed')).toBeCloseTo(20, 9)
    expect(monthlyAmount(halfyearly, 'realMonthly')).toBe(0)
    // once ist nicht wiederkehrend: zählt weder real noch geglättet (U3-konservativ).
    const once = plan({ amount: 500, interval: 'once' })
    expect(monthlyAmount(once, 'smoothed')).toBe(0)
    expect(monthlyAmount(once, 'realMonthly')).toBe(0)
  })

  it('isPlanActiveOn: pausierte Pläne sind NIE aktiv (strikte isPaused-Prüfung)', () => {
    const active = plan({ amount: 10, interval: 'monthly' })
    expect(isPlanActiveOn(active, '2026-07-19')).toBe(true)
    expect(isPlanActiveOn(plan({ amount: 10, interval: 'monthly', isPaused: true }), '2026-07-19')).toBe(false)
    // F8/F9-Folge: der pausierte Plan fällt über den Aktivitätsfilter heraus.
    const plans = [active, plan({ amount: 90, interval: 'monthly', isPaused: true })]
    const filtered = plans.filter((entry) => isPlanActiveOn(entry, '2026-07-19'))
    expect(ownMonthlySavings(filtered, 'realMonthly')).toBe(10)
  })

  it('aggregateMonthlyBy gruppiert nach Schlüssel in Erstnennungs-Reihenfolge', () => {
    const plans = [
      plan({ id: 'a', amount: 10, interval: 'monthly', targetId: 'pos-1' }),
      plan({ id: 'b', amount: 120, interval: 'quarterly', targetId: 'pos-2' }),
      plan({ id: 'c', amount: 5, interval: 'monthly', targetId: 'pos-1' }),
    ]
    expect(aggregateMonthlyBy(plans, 'smoothed', (entry) => entry.targetId)).toEqual([
      { id: 'pos-1', amount: 15 },
      { id: 'pos-2', amount: 40 },
    ])
  })

  it('12-Monats-Konsistenz (F8/2h): 12 × geglättete eigene Sparleistung = Jahresbetrag 2.422,00; Anzeige-Rundung 0,04 sichtbar', () => {
    const ownPlans = example.savingsPlans.filter(
      (entry) => entry.flowType === 'own_fixed' || entry.flowType === 'own_variable',
    )
    const smoothed = ownMonthlySavings(ownPlans, 'smoothed')
    expect(12 * smoothed).toBeCloseTo(2422.0, 9)
    // Jahresbetrag über annualAmount (regelmäßige Pläne; variable zählen null → hier 0 relevante).
    const annual = ownPlans.reduce((sum, entry) => sum + (annualAmount(entry) ?? 0), 0)
    expect(annual).toBeCloseTo(2422.0, 9)
    // Cent-Rundung der ANZEIGE: 12 × 201,83 = 2.421,96 → Differenz 0,04 wird ausgewiesen (F19).
    const displayDifference = roundToUnit(annual - 12 * roundToUnit(smoothed))
    expect(displayDifference).toBeCloseTo(0.04, 9)
  })

  it('F10-Datenbasis über aggregateMonthlyBy: geglättete feste Zuflüsse je Gruppe (Σ 225) → Seed-Anteile', () => {
    // Basis exakt wie dokumentiert: feste (amount ≠ null) Positions-Zuflüsse
    // inkl. Arbeitgeberanteile, ohne variable, ohne Umbuchungen.
    const positionById = new Map(example.portfolioPositions.map((position) => [position.id, position]))
    const basisPlans = example.savingsPlans.filter(
      (entry) =>
        entry.targetKind === 'position' &&
        entry.amount !== null &&
        entry.flowType !== 'reserve_transfer' &&
        entry.flowType !== 'liquidity_transfer',
    )
    const byGroup = aggregateMonthlyBy(
      basisPlans,
      'smoothed',
      (entry) => positionById.get(entry.targetId)!.group,
    )
    const sums = new Map(byGroup.map((entry) => [entry.id, entry.amount]))
    expect(sums.get('world')!).toBeCloseTo(85, 9)
    expect(sums.get('em')!).toBeCloseTo(10, 9)
    expect(sums.get('gold')!).toBeCloseTo(5, 9)
    expect(sums.get('telekom')!).toBeCloseTo(125, 9)
    const shares = referenceAllocation(byGroup)!
    const byId = new Map(shares.map((entry) => [entry.id, entry.share]))
    expect(byId.get('world')!).toBeCloseTo(0.3777778, 6)
    expect(byId.get('em')!).toBeCloseTo(0.0444444, 6)
    expect(byId.get('gold')!).toBeCloseTo(0.0222222, 6)
    expect(byId.get('telekom')!).toBeCloseTo(0.5555556, 6)
  })

  it('Reinheit: die neuen Funktionen mutieren ihre Eingaben nicht', () => {
    const mutable = loadExample()
    const before = JSON.stringify(mutable)
    mutable.savingsPlans.forEach((entry) => {
      annualAmount(entry)
      monthlyAmount(entry, 'smoothed')
      isPlanActiveOn(entry, '2026-07-19')
    })
    aggregateMonthlyBy(mutable.savingsPlans, 'smoothed', (entry) => entry.flowType)
    expect(JSON.stringify(mutable)).toBe(before)
  })
})

describe('U4 – own_variable mit festem Betrag (verbindliche Entscheidung, 2026-07-20)', () => {
  const TODAY = '2026-07-20'
  const base = {
    id: 'sp-u4',
    name: 'U4-Testplan',
    targetKind: 'position',
    targetId: 'pos-x',
    interval: 'monthly',
    flowType: 'own_variable',
    validFrom: '2026-01-01',
    validUntil: null,
  }
  const plan = (patch: Record<string, unknown>) =>
    deepFreeze({ ...base, ...patch }) as unknown as SavingsPlan
  const fixedOwn = plan({ id: 'sp-own-fixed', flowType: 'own_fixed', amount: 100 })

  /** Produktionspfad F8: Aktivitätsfilter am Stichtag, dann ownMonthlySavings. */
  function ownRealAt(plans: readonly SavingsPlan[], todayIso: string): number {
    return ownMonthlySavings(
      plans.filter((entry) => isPlanActiveOn(entry, todayIso)),
      'realMonthly',
    )
  }

  it('(1) own_variable mit festem POSITIVEN Betrag erhöht den primären U3-Fortschritt', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: 15 })], TODAY)).toBe(115)
  })

  it('(1b) U4 am Seed: erhält Round-up einen festen Betrag (15), steigt die eigene reale Sparleistung auf 133,50', () => {
    // Dokumentiert die Nutzerentscheidung am realen Bestand (calculation-tester L6):
    // 118,50 + 15 = 133,50 → primärer U3-Fortschritt 13,35 %.
    const seedPlans = example.savingsPlans.map((entry) =>
      entry.id === 'sp-tr-roundup' ? ({ ...entry, amount: 15 } as SavingsPlan) : entry,
    )
    expect(ownRealAt(seedPlans, TODAY)).toBeCloseTo(133.5, 9)
  })

  it('(2) ohne Betrag (null) zählt nicht – Ist-Werte nur aus Buchungen', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: null })], TODAY)).toBe(100)
  })

  it('(3) Betrag 0 zählt nicht', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: 0 })], TODAY)).toBe(100)
  })

  it('(4) negativer Betrag zählt nicht (0 statt Negativ-Durchreichung, kein Throw)', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: -5 })], TODAY)).toBe(100)
  })

  it('(5) NaN/Infinity zählen nicht (Defensivguard: 0 statt Absturz – zweite Verteidigungslinie hinter der Validierung)', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: Number.NaN })], TODAY)).toBe(100)
    expect(ownRealAt([fixedOwn, plan({ amount: Number.POSITIVE_INFINITY })], TODAY)).toBe(100)
    expect(realAmountInMonth(plan({ amount: Number.NaN }), '2026-07')).toBe(0)
    expect(realAmountInMonth(plan({ amount: -5 }), '2026-07')).toBe(0)
  })

  it('(6) pausierte Pläne zählen nicht', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: 15, isPaused: true })], TODAY)).toBe(100)
  })

  it('(7) geplante Pläne (validFrom in der Zukunft) zählen nicht', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: 15, validFrom: '2026-08-01' })], TODAY)).toBe(100)
  })

  it('(8) beendete Pläne (nach validUntil) zählen nicht', () => {
    expect(ownRealAt([fixedOwn, plan({ amount: 15, validUntil: '2026-06-30' })], TODAY)).toBe(100)
  })

  it('(9) einmalige eigene variable Zuflüsse mit festem Betrag zählen NUR im Ausführungsmonat (Monats-Realsicht), nie in F8, nie geglättet', () => {
    const once = plan({ amount: 500, interval: 'once', validFrom: '2026-08-15', validUntil: '2026-08-15' })
    expect(realAmountInMonth(once, '2026-08')).toBe(500)
    expect(realAmountInMonth(once, '2026-07')).toBe(0)
    expect(realAmountInMonth(once, '2026-09')).toBe(0)
    expect(monthlyAmount(once, 'realMonthly')).toBe(0) // nie in der F8-Rate
    expect(monthlyAmount(once, 'smoothed')).toBe(0) // nie geglättet
  })

  it('(10) zusätzliche externe Zuflüsse ändern den primären U3-Fortschritt nicht (nur der Gesamtzufluss steigt)', () => {
    const plans = [fixedOwn, plan({ amount: 15 }), plan({ id: 'sp-extern', flowType: 'employer', amount: 500 })]
    expect(ownRealAt(plans, TODAY)).toBe(115)
    expect(
      totalMonthlyInflow(plans.filter((entry) => isPlanActiveOn(entry, TODAY)), 'realMonthly'),
    ).toBe(615)
  })

  it('(11) reale und geglättete Sicht bleiben getrennt: vierteljährliche own_variable-Rate zählt real 0, geglättet /3', () => {
    const quarterly = plan({ amount: 30, interval: 'quarterly' })
    expect(monthlyAmount(quarterly, 'realMonthly')).toBe(0)
    expect(monthlyAmount(quarterly, 'smoothed')).toBeCloseTo(10, 9)
  })

  it('(12) Seed-Regression: 118,50/201,83 eigen und 125,00/250,00 gesamt unverändert – Round-up bleibt amount null', () => {
    const plans = example.savingsPlans
    expect(ownMonthlySavings(plans, 'realMonthly')).toBeCloseTo(118.5, 9)
    expect(ownMonthlySavings(plans, 'smoothed')).toBeCloseTo(201.8333333, 6)
    expect(totalMonthlyInflow(plans, 'realMonthly')).toBeCloseTo(125.0, 9)
    expect(totalMonthlyInflow(plans, 'smoothed')).toBeCloseTo(250.0, 9)
    const roundup = plans.find((entry) => entry.id === 'sp-tr-roundup')!
    expect(roundup.amount).toBeNull()
    expect(monthlyAmount(roundup, 'realMonthly')).toBe(0)
    expect(monthlyAmount(roundup, 'smoothed')).toBe(0)
  })
})

describe('F10 – Studenten-Referenzverteilung (Ebene A)', () => {
  it('Depotebene (Σ 225): World 0,3777778; EM 0,0444444; Gold 0,0222222; Telekom 0,5555556; Σ = 1,0', () => {
    // Erwartungswerte aus docs/calculation-rules.md F10: 85/225, 10/225, 5/225, 125/225.
    const shares = referenceAllocation(
      deepFreeze([
        { id: 'world', amount: 85 },
        { id: 'em', amount: 10 },
        { id: 'gold', amount: 5 },
        { id: 'telekom', amount: 125 },
      ]),
    )!
    const byId = new Map(shares.map((entry) => [entry.id, entry.share]))
    expect(byId.get('world')!).toBeCloseTo(0.3777778, 6)
    expect(byId.get('em')!).toBeCloseTo(0.0444444, 6)
    expect(byId.get('gold')!).toBeCloseTo(0.0222222, 6)
    expect(byId.get('telekom')!).toBeCloseTo(0.5555556, 6)
    expect(shares.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1.0, 9)
  })

  it('Vermögensebene (Σ 250, inkl. Tagesgeld 25): 0,34 / 0,04 / 0,02 / 0,50 / 0,10', () => {
    const shares = referenceAllocation(
      deepFreeze([
        { id: 'world', amount: 85 },
        { id: 'em', amount: 10 },
        { id: 'gold', amount: 5 },
        { id: 'telekom', amount: 125 },
        { id: 'tagesgeld', amount: 25 },
      ]),
    )!
    expect(shares.map((entry) => entry.share)).toEqual([0.34, 0.04, 0.02, 0.5, 0.1])
  })

  it('leer oder Summe 0 → null („nicht berechenbar“, F20); negative Zuflüsse → Fehler', () => {
    expect(referenceAllocation([])).toBeNull()
    expect(referenceAllocation([{ id: 'x', amount: 0 }])).toBeNull()
    expect(() => referenceAllocation([{ id: 'x', amount: -1 }])).toThrow(/nicht negativ/)
  })
})
