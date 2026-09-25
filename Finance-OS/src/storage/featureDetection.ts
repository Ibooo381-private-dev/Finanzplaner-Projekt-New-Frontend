/** Erkennung der File System Access API für das ÖFFNEN (Blueprint §4). */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/**
 * Getrennter Check für den SPEICHERPFAD: "Speichern"/"Speichern unter" benutzen
 * showSaveFilePicker – der Open-Check reicht dafür nicht. Ohne diesen Check würde
 * saveAsNewFile in Browsern ohne Save-Picker still null liefern und das Speichern
 * würde kommentarlos als "Dialog-Abbruch" enden.
 */
export function isSaveFilePickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
}
