import { downloadLink, DOCX_MIME, h, message } from './dom'
import { fillTemplates, zipFiles } from '../io/word'
import {
  assertFile, EXCEL_ACCEPT, fileInput, loadExcel, plural, runAction, selectedIndex, sheetSelect, WORD_ACCEPT,
  type LoadedExcel,
} from './shared'

const NUMBERED = '-1'
const ZIP_MIME = 'application/zip'

function nameColumnSelect(headers: readonly string[]): HTMLElement {
  return h('div', {},
    h('label', { for: 'word-name' }, 'Nombre de cada archivo'),
    h('select', { id: 'word-name' },
      h('option', { value: NUMBERED }, 'Numerados (documento-1, documento-2…)'),
      ...headers.map((name, i) => h('option', { value: String(i) }, `Según la columna «${name}»`))),
  )
}

function examples(): HTMLElement {
  const base = import.meta.env.BASE_URL
  return h('details', {},
    h('summary', {}, '¿Cómo se hace una plantilla?'),
    h('p', {}, 'Escribe tu documento en Word y, donde quieras un dato del Excel, pon el nombre de la columna entre llaves. Por ejemplo: «Hola {Nombre}, debes {Importe} €».'),
    h('p', {}, 'Se crea un Word por cada fila del Excel. Puedes probar con estos ejemplos:'),
    h('a', { class: 'download', href: `${base}ejemplos/plantilla-ejemplo.docx`, download: 'plantilla-ejemplo.docx' }, 'Plantilla de ejemplo (.docx)'),
    h('a', { class: 'download', href: `${base}ejemplos/clientes-ejemplo.xlsx`, download: 'clientes-ejemplo.xlsx' }, 'Excel de ejemplo (.xlsx)'),
  )
}

export function render(root: HTMLElement): void {
  const templateInput = fileInput('word-template', WORD_ACCEPT)
  const excelInput = fileInput('word-excel', EXCEL_ACCEPT)
  const excelOptions = h('div')
  const output = h('div', { 'aria-live': 'polite' })
  const button = h('button', { class: 'primary', type: 'button', disabled: true }, 'Crear documentos')
  let loaded: LoadedExcel | null = null

  const updateButton = (): void => {
    button.disabled = !(templateInput.files?.length && loaded)
  }
  const showNameOptions = (): void => {
    const sheet = loaded?.sheets[selectedIndex(root, 'word-sheet')]
    root.querySelector('#word-name')?.parentElement?.remove()
    if (sheet) excelOptions.append(nameColumnSelect(sheet.table.headers))
  }

  templateInput.addEventListener('change', () => {
    output.replaceChildren()
    updateButton()
  })

  excelInput.addEventListener('change', () => {
    const file = excelInput.files?.[0]
    loaded = null
    excelOptions.replaceChildren()
    updateButton()
    if (!file) return
    void runAction(button, output, async () => {
      loaded = await loadExcel(file)
      const select = sheetSelect('word-sheet', loaded.sheets)
      select.addEventListener('change', showNameOptions)
      excelOptions.replaceChildren(select)
      showNameOptions()
      if (loaded.warnings.length) output.replaceChildren(message('warn', ...loaded.warnings))
    }).then(updateButton)
  })

  button.addEventListener('click', () => {
    const templateFile = templateInput.files?.[0]
    const source = loaded
    if (!templateFile || !source) return
    void runAction(button, output, async () => {
      assertFile(templateFile, 'word')
      const sheet = source.sheets[selectedIndex(root, 'word-sheet')] ?? source.sheets[0]!
      const nameColumn = Number(root.querySelector<HTMLSelectElement>('#word-name')?.value ?? NUMBERED)
      const { files } = fillTemplates(await templateFile.arrayBuffer(), sheet.table, {
        fileNameColumn: nameColumn >= 0 ? nameColumn : undefined,
      })
      const only = files.length === 1 ? files[0] : undefined
      output.replaceChildren(
        message('ok', `Listo. ${plural(files.length, 'documento creado', 'documentos creados')}.`),
        only
          ? downloadLink(only.data, only.name, DOCX_MIME)
          : downloadLink(zipFiles(files), 'documentos.zip', ZIP_MIME, 'Descargar todos en un .zip'),
      )
    })
  })

  root.append(
    h('div', { class: 'card' },
      examples(),
      h('label', { for: 'word-template' }, 'Plantilla de Word'),
      templateInput,
      h('label', { for: 'word-excel' }, 'Excel con los datos'),
      excelInput,
      excelOptions,
      button,
      output,
    ),
  )
}
