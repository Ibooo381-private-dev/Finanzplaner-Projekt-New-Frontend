/**
 * Hauptnavigation: genau die 9 Einträge aus pages.ts in fester Reihenfolge,
 * visuell in thematische Gruppen gegliedert (Start · Vermögen · Planung ·
 * Verwaltung). Jede Gruppe ist eine eigene, über ihren Titel benannte Liste.
 * Der aktive Punkt ist semantisch (aria-current="page") UND visuell
 * (gefüllte Fläche + Balken + Schriftstärke, nicht nur Farbe) gekennzeichnet.
 * Buttons statt Links, da es in V1 keinen Router gibt.
 */

import { Icon } from '../components/Icon'
import { PAGE_GROUPS, PAGES } from './pages'
import type { PageId } from './pages'

export function Navigation({
  activePage,
  onNavigate,
}: {
  activePage: PageId
  onNavigate: (page: PageId) => void
}) {
  return (
    <div className="nav-groups">
      {PAGE_GROUPS.map((group) => {
        const pages = PAGES.filter((page) => page.group === group.id)
        const labelId = `nav-group-${group.id}`
        return (
          <div key={group.id}>
            <span className="nav-group-label" id={labelId}>
              {group.label}
            </span>
            <ul className="nav-list" aria-labelledby={labelId}>
              {pages.map((page) => {
                const isActive = page.id === activePage
                return (
                  <li key={page.id}>
                    <button
                      type="button"
                      className="nav-item"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => onNavigate(page.id)}
                    >
                      <Icon name={page.icon} />
                      {page.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
