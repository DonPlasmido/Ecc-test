import { cleanTable } from '../core/clean'
import { writeWorkbook } from '../io/excel'
import { downloadLink, h, message, XLSX_MIME } from './dom'
import {
  baseName, checkbox, EXCEL_ACCEPT, fileInput, isChecked, loadExcel, plural, runAction,
  selectedIndex, sheetSelect, type LoadedExcel,
} from './shared'

export function render(root: HTMLElement): void {
  const input = fileInput('clean-file', EXCEL_ACCEPT)
  const options = h('div')
  const output = h('div', { 'aria-live': 'polite' })
  let loaded: LoadedExcel | null = null

  const button = h('button', { class: 'primary', type: 'button', disabled: true }, 'Limpiar')

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    loaded = null
    button.disabled = true
    options.replaceChildren()
    if (!file) return
    void runAction(button, output, async () => {
      loaded = await loadExcel(file)
      options.replaceChildren(
        sheetSelect('clean-sheet', loaded.sheets),
        h('label', {}, 'Qué hacer'),
        checkbox('opt-empty', 'Quitar filas vacías'),
        checkbox('opt-dup', 'Quitar filas duplicadas'),
        checkbox('opt-trim', 'Quitar espacios sobrantes en los textos'),
      )
      if (loaded.warnings.length) output.replaceChildren(message('warn', ...loaded.warnings))
    }).then(() => { button.disabled = loaded === null })
  })

  button.addEventListener('click', () => {
    if (!loaded) return
    const source = loaded
    void runAction(button, output, async () => {
      const sheet = source.sheets[selectedIndex(root, 'clean-sheet')] ?? source.sheets[0]!
      const result = cleanTable(sheet.table, {
        removeEmptyRows: isChecked(root, 'opt-empty'),
        removeDuplicates: isChecked(root, 'opt-dup'),
        trimText: isChecked(root, 'opt-trim'),
      })
      const data = await writeWorkbook([{ name: sheet.name, table: result.table }])
      output.replaceChildren(
        message('ok',
          `Listo. Quedan ${plural(result.table.rows.length, 'fila', 'filas')}.`,
          `Quitadas: ${plural(result.removedDuplicates, 'duplicada', 'duplicadas')} y ${plural(result.removedEmpty, 'vacía', 'vacías')}.`),
        downloadLink(data, `${baseName(source.fileName)}-limpio.xlsx`, XLSX_MIME),
      )
    })
  })

  root.append(
    h('div', { class: 'card' },
      h('label', { for: 'clean-file' }, 'Archivo de Excel'),
      input,
      h('p', { class: 'hint' }, 'Se descarga un Excel nuevo con los datos limpios (sin colores ni formatos).'),
      options,
      button,
      output,
    ),
  )
}
