/**
 * App-Einstieg: verdrahtet den FinanceDataProvider mit dem Grundlayout
 * (Kopfbereich, Navigation mit 9 Punkten, Seiteninhalte – src/layout/,
 * src/pages/). Keine Finanzlogik in Komponenten.
 */

import { FinanceDataProvider } from './state/FinanceDataProvider'
import { AppLayout } from './layout/AppLayout'

/**
 * Kompatibler Ersatz für den bisherigen StorageScreen (wird von bestehenden
 * Tests direkt innerhalb eines Providers gerendert): rendert das Grundlayout
 * mit der Startseite „Daten & Backups“ – also Kopfbereich mit Dateistatus und
 * Ungespeichert-Hinweis plus komplette Speicher-UI, wie zuvor in einem Screen.
 */
export function StorageScreen() {
  return <AppLayout initialPage="daten-backups" />
}

function App() {
  return (
    <FinanceDataProvider>
      <AppLayout />
    </FinanceDataProvider>
  )
}

export default App
