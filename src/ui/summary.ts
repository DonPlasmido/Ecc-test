import type { Chart } from 'chart.js'
import { groupTotals, numericColumns, summarizeColumn, type ColumnSummary, type GroupTotal } from '../core/summary'
import type { Table } from '../core/table'
import { h, message } from './dom'
import { EXCEL_ACCEPT, fileInput, loadExcel, plural, runAction, selectedIndex, sheetSelect, type LoadedExcel } from './shared'

const NO_GROUP = '-1'
const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
const fmt = (n: number | null): string => (n === null ? '—' : numberFormat.format(n))

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('b', {}, value), h('small', {}, label))
}

function statsView(s: ColumnSummary): HTMLElement {
  return h('div', { class: 'stats' },
    stat('Total', fmt(s.sum)), stat('Media', fmt(s.mean)),
    stat('Mínimo', fmt(s.min)), stat('Máximo', fmt(s.max)),
    stat('Celdas con número', String(s.numeric)), stat('Celdas ignoradas', String(s.ignored)),
  )
}

function groupTable(groups: readonly GroupTotal[], groupName: string, valueName: string): HTMLElement {
  return h('details', {},
    h('summary', {}, 'Ver como tabla'),
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, groupName), h('th', { class: 'num' }, `Total ${valueName}`))),
      h('tbody', {}, ...groups.map((g) => h('tr', {}, h('td', {}, g.label), h('td', { class: 'num' }, fmt(g.total))))),
    ),
  )
}

function columnControls(table: Table): HTMLElement {
  const numeric = numericColumns(table)
  if (numeric.length === 0) return message('error', 'Esta hoja no tiene ninguna columna con números.')
  const option = (i: number) => h('option', { value: String(i) }, table.headers[i] ?? '')
  return h('div', {},
    h('label', { for: 'sum-value' }, 'Columna a calcular'),
    h('select', { id: 'sum-value' }, ...numeric.map(option)),
    h('label', { for: 'sum-group' }, 'Agrupar por (para el gráfico)'),
    h('select', { id: 'sum-group' },
      h('option', { value: NO_GROUP }, 'No agrupar (sin gráfico)'),
      ...table.headers.map((_, i) => i).filter((i) => !numeric.includes(i)).map(option),
      ...numeric.map(option)),
  )
}

export function render(root: HTMLElement): void {
  const input = fileInput('sum-file', EXCEL_ACCEPT)
  const controls = h('div')
  const columns = h('div')
  const output = h('div', { 'aria-live': 'polite' })
  const button = h('button', { class: 'primary', type: 'button', disabled: true }, 'Calcular')
  let loaded: LoadedExcel | null = null
  let chart: Chart<'bar'> | null = null

  const currentTable = (): Table | null => {
    if (!loaded) return null
    return (loaded.sheets[selectedIndex(root, 'sum-sheet')] ?? loaded.sheets[0])?.table ?? null
  }
  const showColumns = (): void => {
    const table = currentTable()
    columns.replaceChildren(table ? columnControls(table) : '')
    button.disabled = !root.querySelector('#sum-value')
    output.replaceChildren()
  }

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    loaded = null
    controls.replaceChildren()
    columns.replaceChildren()
    button.disabled = true
    if (!file) return
    void runAction(button, output, async () => {
      loaded = await loadExcel(file)
      const select = sheetSelect('sum-sheet', loaded.sheets)
      select.addEventListener('change', showColumns)
      controls.replaceChildren(select)
      showColumns()
      if (loaded.warnings.length) output.replaceChildren(message('warn', ...loaded.warnings))
    }).then(() => { button.disabled = !root.querySelector('#sum-value') })
  })

  button.addEventListener('click', () => {
    const table = currentTable()
    if (!table) return
    void runAction(button, output, async () => {
      chart?.destroy()
      chart = null
      const valueIndex = selectedIndex(root, 'sum-value')
      const groupIndex = selectedIndex(root, 'sum-group')
      const valueName = table.headers[valueIndex] ?? ''
      const summary = summarizeColumn(table, valueIndex)
      const parts: HTMLElement[] = [statsView(summary)]
      if (summary.ignored > 0) {
        parts.push(message('warn', `${plural(summary.ignored, 'celda no es un número y no se ha', 'celdas no son números y no se han')} tenido en cuenta.`))
      }
      if (groupIndex >= 0 && groupIndex !== valueIndex) {
        const groupName = table.headers[groupIndex] ?? ''
        const groups = groupTotals(table, groupIndex, valueIndex)
        const wrap = h('div', { class: 'chart-wrap' })
        const download = h('a', { class: 'download', href: '#', download: 'grafico.png' }, 'Descargar gráfico (PNG)')
        parts.push(h('h2', {}, `${valueName} por ${groupName}`), wrap, groupTable(groups, groupName, valueName), download)
        output.replaceChildren(...parts)
        chart = (await import('./chart')).drawGroupChart(wrap, groups, valueName, fmt)
        download.href = chart.toBase64Image('image/png')
        return
      }
      output.replaceChildren(...parts)
    })
  })

  root.append(
    h('div', { class: 'card' },
      h('label', { for: 'sum-file' }, 'Archivo de Excel'),
      input,
      controls,
      columns,
      button,
      output,
    ),
  )
}
