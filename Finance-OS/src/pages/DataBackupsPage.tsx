/**
 * Seite „Daten & Backups“: komplette Speicher-UI (Blueprint §1) –
 * Aktionen, Import-Feld, Importvorschau mit Bestätigen/Abbrechen,
 * Fehler-/Warnungslisten und Zusammenfassung des geladenen Bestands.
 * Der Dateistatus (Dateiname, Speicherstatus, Ungespeichert-Hinweis) steht im
 * Kopfbereich (AppHeader). Keine Finanzlogik in Komponenten –
 * Zählungen kommen aus buildImportSummary.
 */

import type { ChangeEvent } from 'react'
import { useFinanceData } from '../state/useFinanceData'
import { isSaveFilePickerSupported } from '../storage/featureDetection'
import { buildImportSummary } from '../storage/importFlow'
import type { ImportSummary } from '../storage/importFlow'
import type { ValidationIssue } from '../validation/issues'

function IssueList({
  issues,
  title,
  tone,
}: {
  issues: ValidationIssue[]
  title: string
  tone: 'error' | 'warning'
}) {
  if (issues.length === 0) return null
  return (
    <section className={`issue-box issue-box-${tone}`} aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path}-${index}`}>
            <strong>{issue.code}</strong>
            {issue.path !== '' ? (
              <>
                {' – '}
                <code>{issue.path}</code>
              </>
            ) : null}
            {': '}
            {issue.message}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SummaryCounts({ summary }: { summary: ImportSummary }) {
  return (
    <ul className="counts">
      <li>Konten: {summary.counts.accounts}</li>
      <li>Depotpositionen: {summary.counts.portfolioPositions}</li>
      <li>Snapshots: {summary.counts.snapshots}</li>
      <li>Sparpläne: {summary.counts.savingsPlans}</li>
      <li>Ziele: {summary.counts.goals}</li>
      <li>Buchungen: {summary.counts.transactions}</li>
    </ul>
  )
}

function ImportPreview() {
  const { state, actions } = useFinanceData()
  const candidate = state.pendingImport
  if (!candidate) return null
  const { result, summary } = candidate
  const importUpdatedAt = result.data ? result.data.metadata.updatedAt : null
  const currentSummary = state.data ? buildImportSummary(state.data) : null
  return (
    <section className="import-preview" aria-labelledby="import-preview-heading">
      <h3 id="import-preview-heading">Importvorschau</h3>
      <p>
        Datei: <strong>{candidate.fileName}</strong>
      </p>
      {summary ? (
        <>
          <p>
            Schema-Version: {summary.schemaVersion}
            {summary.isExampleData ? ' – als Beispiel-/Startvorlage gekennzeichnet' : ''}
          </p>
          {summary.description !== null ? (
            <p className="app-hint">Beschreibung: {summary.description}</p>
          ) : null}
          <SummaryCounts summary={summary} />
          <p>Jüngstes erfasstes Datum: {summary.latestDate ?? 'keins'}</p>
        </>
      ) : null}
      {state.data && currentSummary && result.ok ? (
        <section aria-label="Vergleich mit dem aktuell geladenen Bestand">
          <h4>Vergleich mit dem aktuell geladenen Bestand</h4>
          <p>
            Aktuell geladen:{' '}
            <strong>{state.fileName ?? 'neue, noch nicht gespeicherte Datei'}</strong> – Stand der
            Daten: {state.data.metadata.updatedAt}
          </p>
          <SummaryCounts summary={currentSummary} />
          {importUpdatedAt !== null && state.data.metadata.updatedAt > importUpdatedAt ? (
            <p className="operation-error" role="alert">
              ⚠ Der aktuell geladene Bestand ist neuer als die Importdatei (Stand{' '}
              {state.data.metadata.updatedAt} gegenüber {importUpdatedAt}). Beim Import gehen die
              neueren Daten im Arbeitsspeicher verloren.
            </p>
          ) : null}
          <p>
            <button
              type="button"
              onClick={() => actions.backupDownload()}
              disabled={state.isSaving}
            >
              Vor dem Import: Sicherungskopie des aktuellen Bestands herunterladen
            </button>
          </p>
        </section>
      ) : null}
      {result.ok ? (
        <>
          <IssueList issues={result.warnings} title="Hinweise zur Importdatei" tone="warning" />
          <p>
            Der Import ersetzt den aktuell geladenen Bestand vollständig und löst die Verbindung zur
            bisher geöffneten Datei. Speichere danach über „Speichern" neu.
          </p>
          {state.isDirty ? (
            <p className="operation-error" role="alert">
              ⚠ Achtung: Der aktuelle Bestand enthält ungespeicherte Änderungen, die beim Import
              verloren gehen.
            </p>
          ) : null}
          <div className="toolbar">
            <button type="button" onClick={() => actions.confirmImport()} disabled={state.isSaving}>
              Import bestätigen
            </button>
            <button type="button" onClick={() => actions.cancelImport()} disabled={state.isSaving}>
              Abbrechen
            </button>
          </div>
        </>
      ) : (
        <>
          <IssueList
            issues={result.errors}
            title="Diese Datei kann nicht importiert werden"
            tone="error"
          />
          <p>Der aktuell geladene Bestand bleibt unverändert.</p>
          <div className="toolbar">
            <button type="button" onClick={() => actions.cancelImport()}>
              Schließen
            </button>
          </div>
        </>
      )}
    </section>
  )
}

export function DataBackupsPage() {
  const { state, actions } = useFinanceData()
  const { data, isSaving, errors, warnings, operationError, pendingImport } = state
  const summary = data ? buildImportSummary(data) : null
  // Ehrliche Beschriftung (Erwartung 5): ohne Save-Picker wird nie direkt überschrieben.
  const canDirectSave = isSaveFilePickerSupported()

  function onImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null
    if (file) void actions.importFile(file)
    event.target.value = ''
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <h2 id="page-title">Daten &amp; Backups</h2>
      <p className="app-hint">
        Datei öffnen, importieren, speichern, exportieren – die JSON-Datei ist die einzige
        dauerhafte Datenquelle. Es werden keine Daten an einen Server gesendet.
      </p>

      <section aria-labelledby="actions-heading">
        <h3 id="actions-heading">Aktionen</h3>
        <div className="toolbar">
          <button type="button" onClick={() => void actions.openFile()} disabled={isSaving}>
            Datei öffnen
          </button>
          <button
            type="button"
            onClick={() => void actions.saveDirect()}
            disabled={!data || isSaving}
          >
            {isSaving
              ? 'Speichern läuft …'
              : canDirectSave
                ? 'Speichern'
                : 'Speichern (als Download)'}
          </button>
          {canDirectSave ? (
            <button
              type="button"
              onClick={() => void actions.saveAs()}
              disabled={!data || isSaving}
            >
              Speichern unter …
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => actions.exportDownload({ markAsSaved: false })}
            disabled={!data || isSaving}
          >
            Exportieren (Download)
          </button>
          <button
            type="button"
            onClick={() => actions.exportDownload({ markAsSaved: true })}
            disabled={!data || isSaving}
          >
            Exportieren und als gespeichert markieren
          </button>
          <button
            type="button"
            onClick={() => actions.backupDownload()}
            disabled={!data || isSaving}
          >
            Sicherungskopie herunterladen
          </button>
          <button type="button" onClick={() => actions.newFile()} disabled={isSaving}>
            Neue leere Datei
          </button>
        </div>
        <p className="import-field">
          <label htmlFor="import-file-input">Datei importieren (JSON):</label>{' '}
          <input
            id="import-file-input"
            type="file"
            accept="application/json,.json"
            onChange={onImportFileChange}
            disabled={isSaving}
          />
        </p>
        {operationError !== null ? (
          <p className="operation-error" role="alert">
            ⚠ {operationError}
          </p>
        ) : null}
      </section>

      <ImportPreview />

      <IssueList issues={errors} title="Fehler beim Laden" tone="error" />
      <IssueList issues={warnings} title="Hinweise (Warnungen)" tone="warning" />

      {data && summary ? (
        <section aria-labelledby="data-heading">
          <h3 id="data-heading">Geladener Bestand</h3>
          {data.metadata.isExampleData === true ? (
            <p className="app-hint">
              Hinweis: Diese Datei ist als Beispiel-/Startvorlage gekennzeichnet.
            </p>
          ) : null}
          <p>Schema-Version: {data.schemaVersion}</p>
          <SummaryCounts summary={summary} />
          <p>Jüngstes erfasstes Datum: {summary.latestDate ?? 'keins'}</p>
        </section>
      ) : null}

      {!data && !pendingImport ? (
        <p className="app-hint">
          Es sind noch keine Finanzdaten geladen. Öffne eine vorhandene JSON-Datei („Datei öffnen"),
          importiere eine Datei oder lege mit „Neue leere Datei" einen frischen Bestand an. Die
          JSON-Datei bleibt die einzige dauerhafte Datenquelle – es werden keine Daten an einen
          Server gesendet.
        </p>
      ) : null}
    </section>
  )
}
