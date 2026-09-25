/**
 * Neue leere Finanzdatei (Blueprint §4, exakte Vorgabe).
 * Standardwerte sind in docs/requirements.md M14 dokumentiert
 * (Notgroschen-Faktor 4, Netto 1.170 EUR) – nichts erfunden.
 * Zeit wird injiziert (nowIso als Parameter, Blueprint §7.7).
 */

import type { FinanceData } from '../types/finance'
import { SUPPORTED_SCHEMA_VERSION } from '../types/finance'

export function createEmptyFinanceData(nowIso: string): FinanceData {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    metadata: {
      appName: 'Finance OS',
      createdAt: nowIso,
      updatedAt: nowIso,
      currency: 'EUR',
      isExampleData: false,
      description:
        'Neue leere Finanzdatei. Notgroschen-Einstellungen mit dokumentierten Standardwerten vorbelegt (Faktor 4, Netto 1.170 EUR laut requirements.md M14) - in den Einstellungen anpassen.',
    },
    settings: {
      emergencyFund: {
        factor: 4,
        netIncomeMonthly: 1170,
        manualOverrideAmount: null,
      },
      monthlySavingsBudget: null,
      backup: {
        mode: 'everySave',
        retentionCount: 10,
      },
      display: {
        numberLocale: 'de-DE',
        percentDecimals: 2,
      },
      activeTargetProfileId: null,
    },
    accounts: [],
    portfolioPositions: [],
    snapshots: [],
    savingsPlans: [],
    targetProfiles: [],
    goals: [],
    transactions: [],
    plannedChanges: [],
    simulations: [],
    fixedCosts: [],
    monthlyClosings: [],
    journalEntries: [],
    importHistory: [],
  }
}
