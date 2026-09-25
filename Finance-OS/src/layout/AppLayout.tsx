/**
 * App-Grundlayout (V1, ohne Router-Paket): Kopfbereich auf allen Seiten,
 * Desktop-Seitenleiste, mobil einklappbare Navigation (CSS-Media-Query).
 * Der Menü-Button ist ein echter <button> mit aria-expanded; das Menü
 * schließt nach jeder Auswahl. Aktive Seite als useState-Zustand.
 */

import { useState } from 'react'
import { AppHeader } from './Header'
import { Navigation } from './Navigation'
import { DEFAULT_PAGE } from './pages'
import type { PageId } from './pages'
import { AccountsPage } from '../pages/AccountsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { DataBackupsPage } from '../pages/DataBackupsPage'
import { DepotPage } from '../pages/DepotPage'
import { GoalsPage } from '../pages/GoalsPage'
import { RebalancingPage } from '../pages/RebalancingPage'
import { SavingsPlansPage } from '../pages/SavingsPlansPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SimulatorPage } from '../pages/SimulatorPage'

export function AppLayout({ initialPage = DEFAULT_PAGE }: { initialPage?: PageId }) {
  const [activePage, setActivePage] = useState<PageId>(initialPage)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function navigate(page: PageId): void {
    setActivePage(page)
    // Mobil: Menü schließt nach Auswahl; auf dem Desktop ohne Wirkung.
    setIsMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-body">
        <nav className="app-nav" aria-label="Hauptnavigation">
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="app-nav-container"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          </button>
          <div
            id="app-nav-container"
            className={isMenuOpen ? 'nav-container nav-open' : 'nav-container'}
          >
            <Navigation activePage={activePage} onNavigate={navigate} />
          </div>
        </nav>
        <main className="app-main">
          {activePage === 'uebersicht' ? (
            <DashboardPage onNavigate={navigate} />
          ) : activePage === 'daten-backups' ? (
            <DataBackupsPage />
          ) : activePage === 'konten' ? (
            <AccountsPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : activePage === 'depot' ? (
            <DepotPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : activePage === 'sparplaene' ? (
            <SavingsPlansPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : activePage === 'rebalancing' ? (
            <RebalancingPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : activePage === 'ziele' ? (
            <GoalsPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : activePage === 'simulation' ? (
            <SimulatorPage onOpenDataBackups={() => navigate('daten-backups')} />
          ) : (
            // Letzte verbleibende Seite: „einstellungen“ (seit M14 sind alle
            // 9 Navigationspunkte echte Seiten – kein Platzhalter mehr).
            <SettingsPage onOpenDataBackups={() => navigate('daten-backups')} />
          )}
        </main>
      </div>
    </div>
  )
}
