/**
 * Minimal-Deklarationen für die File System Access API.
 *
 * showOpenFilePicker/showSaveFilePicker sind nicht Teil von lib.dom –
 * daher eigene strukturelle Interfaces (Blueprint §7.1). Der übrige Code
 * programmiert ausschließlich gegen das strukturelle WritableHandle aus
 * src/storage/fileAccess.ts.
 */

export {}

declare global {
  interface FsaWritableFileStream {
    write(data: string): Promise<void>
    close(): Promise<void>
  }

  interface FsaFileHandle {
    readonly name: string
    getFile(): Promise<File>
    createWritable(): Promise<FsaWritableFileStream>
  }

  interface FsaFilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }

  interface FsaOpenFilePickerOptions {
    types?: FsaFilePickerAcceptType[]
    multiple?: boolean
    excludeAcceptAllOption?: boolean
  }

  interface FsaSaveFilePickerOptions {
    types?: FsaFilePickerAcceptType[]
    suggestedName?: string
    excludeAcceptAllOption?: boolean
  }

  interface Window {
    showOpenFilePicker?: (options?: FsaOpenFilePickerOptions) => Promise<FsaFileHandle[]>
    showSaveFilePicker?: (options?: FsaSaveFilePickerOptions) => Promise<FsaFileHandle>
  }
}
