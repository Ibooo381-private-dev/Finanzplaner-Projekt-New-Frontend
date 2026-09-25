/**
 * Kopfbereich auf allen Seiten (M6): App-Titel, Dateiname, Speicherstatus und
 * Ungespeichert-Hinweis als Text + Symbol (nicht nur Farbe). Alle Angaben
 * kommen aus dem Provider-State – keine Finanzwerte im UI-Code.
 */

import { useFinanceData } from '../state/useFinanceData'
import { formatIsoTimestampGerman } from '../format/date'

export function AppHeader() {
  const { state } = useFinanceData()
  const { data, fileName, fileHandle, lastSavedAt, isDirty } = state

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
      <h1>Finance OS</h1>
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
      {/* Ungespeichert-Indikator als Text + Symbol, nicht nur Farbe (M6). */}
      <p className={isDirty ? 'dirty-indicator' : 'saved-indicator'} role="status">
        {isDirty
          ? '● Ungespeicherte Änderungen'
          : data
            ? '✓ Keine ungespeicherten Änderungen'
            : 'Keine Daten im Arbeitsspeicher'}
      </p>
    </header>
  )
}
