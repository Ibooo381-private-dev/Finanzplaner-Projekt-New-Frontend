/**
 * Rundung und Rundungsausgleich (Formelkatalog F19, S2):
 * Intern wird ungerundet gerechnet; gerundet wird nur für Anzeige/Vorschläge,
 * und Rundungsdifferenzen werden sichtbar zurückgegeben – nie stillschweigend
 * verändert. Reine Funktionen ohne React-Abhängigkeit; Eingaben werden nicht mutiert.
 */

/** Rundungseinheit: Cent (0.01) oder volle Euro (1). */
export type RoundingUnit = 0.01 | 1

/** Wirft bei nicht-endlichen Zahlen (Schutz vor NaN/Infinity-Ausgaben, F20/S3). */
export function assertFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`»${name}« muss eine endliche Zahl sein. Ist-Wert: ${String(value)}.`)
  }
}

/** Kaufmännische Rundung auf die Einheit (Standard: Cent). */
export function roundToUnit(value: number, unit: RoundingUnit = 0.01): number {
  assertFinite(value, 'value')
  const factor = unit === 1 ? 1 : 100
  return Math.round(value * factor) / factor
}

/**
 * Abrunden auf die Einheit (Review-Befund M1): Budgets, die nicht einheiten-genau
 * sind, werden vor einer Verteilung abgerundet – die Verteilung darf das reale
 * Budget nie überschreiten (S2). Das kleine Epsilon fängt Gleitkomma-Artefakte ab.
 */
export function floorToUnit(value: number, unit: RoundingUnit = 0.01): number {
  assertFinite(value, 'value')
  const factor = unit === 1 ? 1 : 100
  return Math.floor(value * factor + 1e-9) / factor
}

export interface RoundedDistribution {
  /** Gerundete Beträge in Eingabereihenfolge; Summe = exakt der gerundete Zielbetrag, sofern ein Ausgleich möglich ist (leere Liste: Differenz wird nur ausgewiesen). */
  amounts: number[]
  /** Sichtbare Rundungsdifferenz VOR dem Ausgleich (gerundete Rohsumme − Zielbetrag). */
  roundingDifference: number
  /** Index des Eintrags, an dem ausgeglichen wurde (−1 = kein Ausgleich nötig). */
  adjustedIndex: number
}

/**
 * Rundet Einzelbeträge und gleicht die entstehende Differenz an der betragsgrößten
 * Position aus; die Differenz wird sichtbar zurückgegeben (F19: „Rundungsdifferenzen
 * sichtbar ausweisen“). Beispiel F17: 23,84 + 22,00 + 10,65 + 3,52 = 60,01 → Ausgleich
 * −0,01 an der größten Rate, Endsumme exakt 60,00.
 */
export function roundWithVisibleAdjustment(
  rawAmounts: readonly number[],
  targetTotal: number,
  unit: RoundingUnit = 0.01,
): RoundedDistribution {
  rawAmounts.forEach((value, index) => assertFinite(value, `rawAmounts[${index}]`))
  assertFinite(targetTotal, 'targetTotal')
  const rounded = rawAmounts.map((value) => roundToUnit(value, unit))
  const roundedTotal = roundToUnit(
    rounded.reduce((sum, value) => sum + value, 0),
    unit,
  )
  const target = roundToUnit(targetTotal, unit)
  const roundingDifference = roundToUnit(roundedTotal - target, unit)
  if (roundingDifference === 0 || rounded.length === 0) {
    return { amounts: rounded, roundingDifference, adjustedIndex: -1 }
  }
  let adjustedIndex = 0
  rounded.forEach((value, index) => {
    if (value > rounded[adjustedIndex]) adjustedIndex = index
  })
  const amounts = rounded.slice()
  const adjusted = roundToUnit(amounts[adjustedIndex] - roundingDifference, unit)
  if (adjusted < 0) {
    // Schutzregel: Der Ausgleich darf keine negative Rate erzeugen (S2).
    throw new Error(
      `Rundungsausgleich nicht möglich: Ausgleich von ${roundingDifference} an Position ${adjustedIndex} ergäbe einen negativen Betrag.`,
    )
  }
  amounts[adjustedIndex] = adjusted
  return { amounts, roundingDifference, adjustedIndex }
}
