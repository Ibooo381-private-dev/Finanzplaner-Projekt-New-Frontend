import { useContext } from 'react'
import { FinanceDataContext } from './financeDataContext'
import type { FinanceDataContextValue } from './financeDataContext'

/** Kontext-Guard: außerhalb des Providers ist der Zugriff ein Programmierfehler. */
export function useFinanceData(): FinanceDataContextValue {
  const contextValue = useContext(FinanceDataContext)
  if (contextValue === null) {
    throw new Error('useFinanceData muss innerhalb von <FinanceDataProvider> verwendet werden.')
  }
  return contextValue
}
