import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip, type Plugin } from 'chart.js'
import type { GroupTotal } from '../core/summary'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

const BAR_HEIGHT_PX = 34
const CHART_PADDING_PX = 48

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Pinta el fondo para que el PNG descargado no salga transparente. */
const background: Plugin<'bar'> = {
  id: 'surface-background',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = cssVar('--surface')
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

/** Barras horizontales ordenadas: se leen bien en el móvil aunque las etiquetas sean largas. */
export function drawGroupChart(
  wrap: HTMLElement,
  groups: readonly GroupTotal[],
  valueLabel: string,
  format: (n: number) => string,
): Chart<'bar'> {
  wrap.style.height = `${groups.length * BAR_HEIGHT_PX + CHART_PADDING_PX}px`
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', `Gráfico de barras: ${valueLabel} por grupo`)
  wrap.replaceChildren(canvas)

  const text = cssVar('--muted')
  const grid = cssVar('--chart-grid')
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: groups.map((g) => g.label),
      datasets: [{
        label: valueLabel,
        data: groups.map((g) => g.total),
        backgroundColor: cssVar('--chart-bar'),
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        tooltip: { callbacks: { label: (item) => `${valueLabel}: ${format(item.parsed.x ?? 0)}` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: grid }, border: { display: false }, ticks: { color: text, callback: (v) => format(Number(v)) } },
        y: { grid: { display: false }, border: { color: grid }, ticks: { color: text, autoSkip: false } },
      },
    },
    plugins: [background],
  })
}
