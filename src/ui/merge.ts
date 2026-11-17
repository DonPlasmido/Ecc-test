import { mergeTables, type MergeInput } from '../core/merge'
import { writeWorkbook } from '../io/excel'
import { downloadLink, h, message, XLSX_MIME } from './dom'
import { checkbox, EXCEL_ACCEPT, fileInput, isChecked, loadExcel, plural, runAction } from './shared'

async function collectInputs(files: readonly File[], allSheets: boolean): Promise<{ inputs: MergeInput[]; warnings: string[] }> {
  const inputs: MergeInput[] = []
  const warnings: string[] = []
  for (const file of files) {
    const loaded = await loadExcel(file)
    warnings.push(...loaded.warnings)
    const sheets = allSheets ? loaded.sheets : loaded.sheets.slice(0, 1)
    for (const sheet of sheets) {
      inputs.push({ source: allSheets ? `${file.name} › ${sheet.name}` : file.name, table: sheet.table })
    }
  }
  return { inputs, warnings }
}

export function render(root: HTMLElement): void {
  const input = fileInput('merge-files', EXCEL_ACCEPT, true)
  const output = h('div', { 'aria-live': 'polite' })
  const button = h('button', { class: 'primary', type: 'button', disabled: true }, 'Juntar')
  const chosen = h('p', { class: 'hint' }, 'Puedes elegir varios a la vez. Si tu móvil no te deja, elígelos todos desde la misma carpeta.')

  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])]
    button.disabled = files.length === 0
    output.replaceChildren()
    chosen.textContent = files.length ? `Elegidos: ${files.map((f) => f.name).join(', ')}` : ''
  })

  button.addEventListener('click', () => {
    const files = [...(input.files ?? [])]
    void runAction(button, output, async () => {
      const { inputs, warnings } = await collectInputs(files, isChecked(root, 'merge-all-sheets'))
      const result = mergeTables(inputs, { addSourceColumn: isChecked(root, 'merge-source') })
      const data = await writeWorkbook([{ name: 'Juntos', table: result.table }])
      const allWarnings = [...warnings, ...result.warnings]
      output.replaceChildren(
        message('ok',
          `Listo. ${plural(result.table.rows.length, 'fila', 'filas')} en total:`,
          ...result.rowsPerSource.map((s) => `• ${s.source}: ${plural(s.rows, 'fila', 'filas')}`)),
        ...(allWarnings.length ? [message('warn', 'Ojo:', ...allWarnings)] : []),
        downloadLink(data, 'juntos.xlsx', XLSX_MIME),
      )
    })
  })

  root.append(
    h('div', { class: 'card' },
      h('label', { for: 'merge-files' }, 'Archivos de Excel'),
      input,
      chosen,
      h('label', {}, 'Opciones'),
      checkbox('merge-source', 'Añadir una columna «Origen» con el archivo de cada fila'),
      checkbox('merge-all-sheets', 'Usar todas las hojas de cada archivo (si no, solo la primera)', false),
      h('p', { class: 'hint' }, 'Las columnas se emparejan por su nombre, aunque estén en otro orden.'),
      button,
      output,
    ),
  )
}
