/**
 * Dateizugriff (Blueprint §4): File System Access API mit Download-/Datei-Fallback.
 * Diese Funktionen sind bewusst logikfrei gehalten (Blueprint §7.2/§7.4) –
 * die Browser-Picker sind nur manuell prüfbar, nicht in jsdom.
 * Jede Schreiboperation geschieht nur im Rahmen einer Nutzergeste (C1-Prinzip).
 */

/** Strukturelles Handle – der übrige Code programmiert nur hiergegen (Blueprint §7.1). */
export interface WritableHandle {
  readonly name: string
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
}

export interface OpenedFile {
  fileName: string
  text: string
  handle: WritableHandle | null
}

const JSON_PICKER_TYPES = [{ description: 'JSON-Datei', accept: { 'application/json': ['.json'] } }]

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** Liest eine File als Text; FileReader-Fallback für Umgebungen ohne Blob.text() (z. B. jsdom). */
function readTextFromFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () =>
      reject(reader.error ?? new Error('Die Datei konnte nicht gelesen werden.'))
    reader.readAsText(file)
  })
}

/** Öffnet über showOpenFilePicker. AbortError (Nutzer bricht ab) → null. Nur aus Nutzergeste aufrufen. */
export async function openViaFilePicker(): Promise<OpenedFile | null> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return null
  try {
    const [handle] = await window.showOpenFilePicker({ types: JSON_PICKER_TYPES, multiple: false })
    if (!handle) return null
    const file = await handle.getFile()
    const text = await readTextFromFile(file)
    return { fileName: file.name, text, handle }
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

/** Fallback für input[type=file]: liest die Datei, ohne Handle (nur Download-Weg zum Speichern). */
export async function readFileAsText(file: File): Promise<OpenedFile> {
  const text = await readTextFromFile(file)
  return { fileName: file.name, text, handle: null }
}

/** Schreibt über das gehaltene Handle. Fehler werden unverändert geworfen (Aufrufer meldet + Fallback). */
export async function saveToHandle(handle: WritableHandle, json: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(json)
  await writable.close()
}

/** "Speichern unter" über showSaveFilePicker; null bei Abbruch. */
export async function saveAsNewFile(
  suggestedName: string,
  json: string,
): Promise<{ handle: WritableHandle; fileName: string } | null> {
  if (typeof window === 'undefined' || !window.showSaveFilePicker) return null
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types: JSON_PICKER_TYPES })
    await saveToHandle(handle, json)
    return { handle, fileName: handle.name }
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

/** Download-Weg: Blob → ObjectURL → a[download] → revoke. Kein BOM. */
export function downloadAsFile(fileName: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
