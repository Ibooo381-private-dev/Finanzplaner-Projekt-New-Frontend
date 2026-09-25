/**
 * App-Grundlayout (V1, ohne Router-Paket): Kopfbereich auf allen Seiten,
 * Desktop-Seitenleiste, mobil einklappbare Navigation (CSS-Media-Query).
 * Der Menü-Button ist ein echter <button> mit aria-expanded; das Menü
 * schließt nach jeder Auswahl. Aktive Seite als useState-Zustand.
 *
 * Redesign 2026-09: „Zum Inhalt springen“-Link für Tastaturnutzer; nach jedem
 * Seitenwechsel springt die Ansicht an den Seitenanfang und der Fokus auf den
 * Inhaltsbereich (Screenreader starten beim neuen Seitentitel). Die Höhe des
 * klebenden Kopfbereichs wird als CSS-Variable gemessen, damit die
 * Seitenleiste direkt darunter haftet.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppHeader } from './Header'
import { Navigation } from './Navigation'
import { DEFAULT_PAGE } from './pages'
import type { PageId } from './pages'
import { Icon } from '../components/Icon'
import { useFinanceData } from '../state/useFinanceData'
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
  const { state } = useFinanceData()
  const [activePage, setActivePage] = useState<PageId>(initialPage)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  // Nur nach einem echten Seitenwechsel fokussieren – nie beim ersten Rendern.
  const hasNavigated = useRef(false)

  function navigate(page: PageId): void {
    hasNavigated.current = true
    setActivePage(page)
    // Mobil: Menü schließt nach Auswahl; auf dem Desktop ohne Wirkung.
    setIsMenuOpen(false)
  }

  useEffect(() => {
    if (!hasNavigated.current) return
    const scroller = document.scrollingElement ?? document.documentElement
    scroller.scrollTop = 0
    mainRef.current?.focus({ preventScroll: true })
  }, [activePage])

  // Höhe des klebenden Kopfbereichs messen (CSS-Variable --header-h).
  useLayoutEffect(() => {
    const shell = shellRef.current
    const header = shell?.querySelector<HTMLElement>('.app-header')
    if (!shell || !header || typeof ResizeObserver === 'undefined') return
    const update = (): void => {
      shell.style.setProperty('--header-h', `${header.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="app-shell" ref={shellRef}>
      <a className="skip-link" href="#app-main">
        Zum Inhalt springen
      </a>
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
            <Icon name={isMenuOpen ? 'close' : 'menu'} />
            {isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          </button>
          <div
            id="app-nav-container"
            className={isMenuOpen ? 'nav-container nav-open' : 'nav-container'}
          >
            <Navigation activePage={activePage} onNavigate={navigate} />
            <p className="nav-footnote">
              Deine Daten bleiben in deiner JSON-Datei – nichts wird an einen Server gesendet.
            </p>
          </div>
        </nav>
        <main className="app-main" id="app-main" ref={mainRef} tabIndex={-1}>
          {/* Speichern ist von jeder Seite aus möglich (Kopfbereich) – Fehler des
              Datei-Vorgangs deshalb auch überall zeigen; „Daten & Backups“ zeigt
              sie ohnehin selbst, der Startzustand ohne Daten ebenfalls. */}
          {state.operationError !== null &&
          state.data !== null &&
          activePage !== 'daten-backups' ? (
            <div className="operation-error" role="alert">
              <p>⚠ {state.operationError}</p>
              <button
                type="button"
                className="btn-sm"
                onClick={() => navigate('daten-backups')}
              >
                Zu Daten &amp; Backups
              </button>
            </div>
          ) : null}
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
