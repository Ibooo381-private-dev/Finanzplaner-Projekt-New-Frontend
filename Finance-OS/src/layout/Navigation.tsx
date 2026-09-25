/**
 * Hauptnavigation: genau die 9 Einträge aus pages.ts in fester Reihenfolge.
 * Der aktive Punkt ist semantisch (aria-current="page") UND visuell
 * (Marker-Symbol + Schriftstärke, nicht nur Farbe) gekennzeichnet.
 * Buttons statt Links, da es in V1 keinen Router gibt.
 */

import { PAGES } from './pages'
import type { PageId } from './pages'

export function Navigation({
  activePage,
  onNavigate,
}: {
  activePage: PageId
  onNavigate: (page: PageId) => void
}) {
  return (
    <ul className="nav-list">
      {PAGES.map((page) => {
        const isActive = page.id === activePage
        return (
          <li key={page.id}>
            <button
              type="button"
              className="nav-item"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(page.id)}
            >
              <span className="nav-marker" aria-hidden="true">
                {isActive ? '▸' : ''}
              </span>
              {page.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
