import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { isBlank, type Cell, type Row, type Table } from '../core/table'

export interface GeneratedFile {
  readonly name: string
  readonly data: Uint8Array<ArrayBuffer>
}

export interface FillOptions {
  /** Índice de la columna cuyo valor se usa como nombre de cada archivo. */
  readonly fileNameColumn?: number
}

const READ_ERROR = 'No se pudo leer la plantilla de Word. Comprueba que es un .docx válido y que no está dañado.'
const TAG_ERROR = 'La plantilla tiene huecos mal escritos: revisa las llaves, cada { necesita su }.'
const MAX_FILE_NAME = 80

const normalize = (name: string): string => name.trim().toLowerCase()

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

/** Cómo se escribe cada valor dentro del Word. */
export function formatCell(cell: Cell): string {
  if (cell === null) return ''
  if (cell instanceof Date) return dateFormat.format(cell)
  if (typeof cell === 'number') return numberFormat.format(cell)
  if (typeof cell === 'boolean') return cell ? 'Sí' : 'No'
  return cell
}

function isTemplateError(err: unknown): boolean {
  const props = (err as { properties?: { errors?: unknown[]; id?: string } }).properties
  return Boolean(props?.errors?.length) || Boolean(props?.id?.includes('tag'))
}

/** `onTag` recibe cada hueco de la plantilla en cuanto docxtemplater lo lee. */
function openTemplate(template: ArrayBuffer, scope: Record<string, string> = {}, onTag?: (tag: string) => void): Docxtemplater {
  let zip: PizZip
  try {
    zip = new PizZip(template)
  } catch (cause) {
    throw new Error(READ_ERROR, { cause })
  }
  try {
    return new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      parser: (tag) => {
        onTag?.(tag)
        return { get: () => scope[normalize(tag)] ?? '' }
      },
    })
  } catch (cause) {
    throw new Error(isTemplateError(cause) ? TAG_ERROR : READ_ERROR, { cause })
  }
}

/** Los huecos {…} que usa la plantilla, en el orden en que aparecen. */
export function templateTags(template: ArrayBuffer): string[] {
  const tags: string[] = []
  openTemplate(template, {}, (tag) => tags.push(tag.trim()))
  return [...new Set(tags)]
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, MAX_FILE_NAME)
}

/** Nombres de archivo sin repetir: Ana.docx, Ana (2).docx… */
function fileNames(rows: readonly Row[], column: number | undefined): string[] {
  const used = new Map<string, number>()
  return rows.map((row, i) => {
    const fromColumn = column === undefined ? '' : safeFileName(formatCell(row[column] ?? null))
    const base = fromColumn || `documento-${i + 1}`
    const count = (used.get(base) ?? 0) + 1
    used.set(base, count)
    return `${count === 1 ? base : `${base} (${count})`}.docx`
  })
}

/** Crea un Word por cada fila del Excel rellenando los huecos {Columna} de la plantilla. */
export function fillTemplates(template: ArrayBuffer, table: Table, options: FillOptions = {}): { files: GeneratedFile[] } {
  const tags = templateTags(template)
  if (tags.length === 0) {
    throw new Error('La plantilla no tiene ningún hueco. Escribe el nombre de una columna entre llaves, por ejemplo {Nombre}.')
  }

  const columns = new Map(table.headers.map((h, i) => [normalize(h), i]))
  const missing = tags.filter((t) => !columns.has(normalize(t)))
  if (missing.length > 0) {
    throw new Error(`La plantilla usa columnas que el Excel no tiene: ${missing.map((m) => `«${m}»`).join(', ')}.`)
  }

  const rows = table.rows.filter((row) => !row.every(isBlank))
  if (rows.length === 0) throw new Error('El Excel no tiene filas con datos.')

  const names = fileNames(rows, options.fileNameColumn)
  const files = rows.map((row, i) => {
    const scope = Object.fromEntries([...columns].map(([key, col]) => [key, formatCell(row[col] ?? null)]))
    const doc = openTemplate(template, scope)
    doc.render()
    return { name: names[i]!, data: doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' }) as Uint8Array<ArrayBuffer> }
  })
  return { files }
}

/** Mete varios archivos en un .zip. */
export function zipFiles(files: readonly GeneratedFile[]): ArrayBuffer {
  const zip = new PizZip()
  for (const file of files) zip.file(file.name, file.data)
  const out = zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}
