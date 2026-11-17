/** Límite de tamaño para que el móvil no se quede sin memoria. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024

export type FileKind = 'excel' | 'word'

export type FileCheck =
  | { readonly ok: true; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly error: string }

interface FileInfo {
  readonly name: string
  readonly size: number
}

const ACCEPTED: Record<FileKind, readonly string[]> = {
  excel: ['xlsx', 'xlsm'],
  word: ['docx'],
}

const OLD_FORMATS: Record<string, string> = {
  xls: 'Es un Excel antiguo (.xls). Ábrelo en Excel y guárdalo como .xlsx.',
  doc: 'Es un Word antiguo (.doc). Ábrelo en Word y guárdalo como .docx.',
}

const KIND_LABEL: Record<FileKind, string> = { excel: 'un Excel (.xlsx)', word: 'un Word (.docx)' }

function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Comprueba que el archivo es del tipo esperado y de un tamaño razonable antes de abrirlo. */
export function checkFile(file: FileInfo, kind: FileKind): FileCheck {
  const ext = extension(file.name)
  const oldFormat = OLD_FORMATS[ext]
  if (oldFormat) return { ok: false, error: `«${file.name}»: ${oldFormat}` }
  if (!ACCEPTED[kind].includes(ext)) {
    return { ok: false, error: `«${file.name}» no es ${KIND_LABEL[kind]}.` }
  }
  if (file.size === 0) return { ok: false, error: `«${file.name}» está vacío.` }
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(MAX_FILE_BYTES / 1024 / 1024)
    return { ok: false, error: `«${file.name}» es demasiado grande (máximo ${mb} MB).` }
  }
  const warnings =
    ext === 'xlsm' ? [`«${file.name}» tiene macros: aquí no se ejecutan y el archivo que descargues no las incluirá.`] : []
  return { ok: true, warnings }
}
