/**
 * Kopfbereich auf allen Seiten (M6, Redesign 2026-09): App-Titel, Dateiname,
 * Speicherstatus und Ungespeichert-Hinweis als Text + Symbol (nicht nur
 * Farbe). Neu: Die Speicheraktion ist von JEDER Seite aus erreichbar – der
 * Button ruft dieselbe Provider-Aktion (saveDirect) auf wie „In Datei
 * speichern“ auf der Seite „Daten & Backups“ und trägt dieselbe ehrliche
 * Beschriftung (ohne Save-Picker: „Als Download speichern“).
 * Alle Angaben kommen aus dem Provider-State – keine Finanzwerte im UI-Code.
 */

import { useFinanceData } from '../state/useFinanceData'
import { formatIsoTimestampGerman } from '../format/date'
import { Icon } from '../components/Icon'
import { saveButtonLabel } from './saveLabel'

export function AppHeader() {
  const { state, actions } = useFinanceData()
  const { data, fileName, fileHandle, lastSavedAt, isDirty, isSaving } = state

  // Verhalten wie bisher: Download-Hinweis, wenn ohne fileHandle gespeichert
  // wurde; ohne lastSavedAt gilt der Stand der Datei (metadata.updatedAt).
  const savedStatus = lastSavedAt
    ? `${formatIsoTimestampGerman(lastSavedAt)}${
        fileHandle
          ? ''
          : ' (als Download – die ursprünglich geöffnete Datei wurde nicht überschrieben)'
      }`
    : data
      ? `noch nicht in dieser Sitzung – Stand der Datei: ${formatIsoTimestampGerman(data.metadata.updatedAt)}`
      : '–'

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          €
        </span>
        <h1>Finance OS</h1>
      </div>
      <dl className="header-status">
        <div>
          <dt>Datei</dt>
          <dd>{fileName ?? 'Keine Datei geöffnet'}</dd>
        </div>
        <div>
          <dt>Zuletzt gespeichert</dt>
          <dd>{savedStatus}</dd>
        </div>
      </dl>
      <div className="header-actions">
        {/* Ungespeichert-Indikator als Text + Symbol, nicht nur Farbe (M6). */}
        <p
          className={isDirty ? 'dirty-indicator' : data ? 'saved-indicator' : 'nodata-indicator'}
          role="status"
        >
          {isDirty
            ? '● Ungespeicherte Änderungen'
            : data
              ? '✓ Alle Änderungen gespeichert'
              : 'Keine Daten im Arbeitsspeicher'}
        </p>
        {data ? (
          <button
            type="button"
            className={isDirty ? 'btn-primary' : undefined}
            onClick={() => void actions.saveDirect()}
            disabled={isSaving}
          >
            <Icon name="save" />
            {saveButtonLabel(isSaving)}
          </button>
        ) : null}
      </div>
    </header>
  )
}
