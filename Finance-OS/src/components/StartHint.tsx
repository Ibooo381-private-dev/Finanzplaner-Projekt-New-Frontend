/**
 * Gemeinsamer Startzustand aller Fachseiten ohne geladene Datei.
 *
 * Statt nur auf „Daten & Backups“ zu verweisen, bietet er die beiden
 * häufigsten ersten Schritte direkt an (Datei öffnen / neue leere Datei) –
 * beide rufen exakt dieselben Provider-Aktionen wie die Seite „Daten &
 * Backups“ auf. Schlägt das Öffnen fehl, erscheint die Meldung hier sichtbar
 * (role="alert") mit Weg zu den Details auf „Daten & Backups“.
 */

import { useFinanceData } from '../state/useFinanceData'
import { Icon } from './Icon'

export function StartHint({ onOpenDataBackups }: { onOpenDataBackups: () => void }) {
  const { state, actions } = useFinanceData()
  const openFailed = state.errors.length > 0 || state.operationError !== null
  return (
    <div className="start-hint">
      <h3>Starte mit deiner Finanzdatei</h3>
      <p>
        Es sind noch keine Finanzdaten geladen. Öffne deine vorhandene JSON-Datei oder lege eine
        neue leere Datei an. Die Datei bleibt auf deinem Gerät – es werden keine Daten an einen
        Server gesendet.
      </p>
      <div className="toolbar">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void actions.openFile()}
          disabled={state.isSaving}
        >
          <Icon name="open" />
          Datei öffnen …
        </button>
        <button type="button" onClick={() => actions.newFile()} disabled={state.isSaving}>
          <Icon name="file" />
          Neue leere Datei anlegen
        </button>
        <button type="button" className="btn-quiet" onClick={onOpenDataBackups}>
          Import und weitere Optionen
        </button>
      </div>
      {openFailed ? (
        <p className="operation-error" role="alert">
          ⚠ Die Datei konnte nicht geladen werden. Die Details stehen unter „Daten &amp; Backups“
          – über „Import und weitere Optionen“.
        </p>
      ) : null}
    </div>
  )
}
