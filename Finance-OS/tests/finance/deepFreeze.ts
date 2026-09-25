/** Friert Objekte rekursiv ein: Mutationsversuche der reinen Funktionen würden im Strict Mode werfen. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.getOwnPropertyNames(value).forEach((key) => {
      deepFreeze((value as Record<string, unknown>)[key])
    })
    Object.freeze(value)
  }
  return value
}
