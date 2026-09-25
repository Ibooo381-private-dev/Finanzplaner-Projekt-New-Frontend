/**
 * Beschriftung der Speicheraktion – identisch im Kopfbereich und auf der
 * Seite „Daten & Backups“. Ehrlich je Browser (Erwartung 5): ohne
 * Save-Picker wird nie direkt überschrieben, sondern heruntergeladen.
 */

import { isSaveFilePickerSupported } from '../storage/featureDetection'

export function saveButtonLabel(isSaving: boolean): string {
  if (isSaving) return 'Speichern läuft …'
  return isSaveFilePickerSupported() ? 'In Datei speichern' : 'Als Download speichern'
}
