import { checkFile, type FileKind } from '../core/files'
import { readWorkbook, type Sheet } from '../io/excel'
import { h, message } from './dom'

export interface LoadedExcel {
  readonly fileName: string
  readonly sheets: readonly Sheet[]
  readonly warnings: readonly string[]
}

/** Comprueba el archivo y lanza un Error con un mensaje para la persona si no vale. */
export function assertFile(file: File, kind: FileKind): readonly string[] {
  const check = checkFile(file, kind)
  if (!check.ok) throw new Error(check.error)
  return check.warnings
}

export async function loadExcel(file: File): Promise<LoadedExcel> {
  const warnings = assertFile(file, 'excel')
  const sheets = await readWorkbook(await file.arrayBuffer())
  const withData = sheets.filter((s) => s.table.headers.length > 0)
  if (withData.length === 0) throw new Error(`«${file.name}» no tiene datos.`)
  return { fileName: file.name, sheets: withData, warnings }
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Ha ocurrido un error inesperado.'
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

export function fileInput(id: string, accept: string, multiple = false): HTMLInputElement {
  return h('input', { id, type: 'file', accept, multiple })
}

export const EXCEL_ACCEPT = '.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const WORD_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Desplegable para elegir hoja. Si solo hay una, no se muestra. */
export function sheetSelect(id: string, sheets: readonly Sheet[]): HTMLElement {
  const select = h('select', { id }, ...sheets.map((s, i) => h('option', { value: String(i) }, s.name)))
  return h('div', { hidden: sheets.length < 2 }, h('label', { for: id }, 'Hoja'), select)
}

export function selectedIndex(root: HTMLElement, id: string): number {
  const select = root.querySelector<HTMLSelectElement>(`#${id}`)
  return select ? Number(select.value) : 0
}

export function checkbox(id: string, text: string, checked = true): HTMLElement {
  return h('label', { class: 'check', for: id }, h('input', { id, type: 'checkbox', checked }), text)
}

export function isChecked(root: HTMLElement, id: string): boolean {
  return root.querySelector<HTMLInputElement>(`#${id}`)?.checked ?? false
}

/** Ejecuta una acción mostrando "Trabajando…" en el botón y el error si falla. */
export async function runAction(button: HTMLButtonElement, output: HTMLElement, action: () => Promise<void>): Promise<void> {
  const label = button.textContent
  button.disabled = true
  button.textContent = 'Trabajando…'
  output.replaceChildren()
  try {
    await action()
  } catch (err) {
    output.replaceChildren(message('error', errorText(err)))
  } finally {
    button.disabled = false
    button.textContent = label
  }
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
