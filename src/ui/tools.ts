export interface Tool {
  id: string
  title: string
  description: string
  /** Pinta la herramienta dentro de `root`. Se carga bajo demanda para que la app arranque rápido. */
  load: () => Promise<{ render: (root: HTMLElement) => void }>
}

export const tools: Tool[] = [
  {
    id: 'limpiar',
    title: 'Limpiar tabla',
    description: 'Quita filas duplicadas, filas vacías y espacios sobrantes.',
    load: () => import('./clean'),
  },
  {
    id: 'juntar',
    title: 'Juntar Excels',
    description: 'Une varios archivos en uno solo, columna con columna.',
    load: () => import('./merge'),
  },
  {
    id: 'resumen',
    title: 'Resumen y gráfico',
    description: 'Total, media, mínimo y máximo de una columna, con gráfico por grupos.',
    load: () => import('./summary'),
  },
  {
    id: 'word',
    title: 'Rellenar Word',
    description: 'Crea un Word por cada fila de un Excel a partir de una plantilla (cartas, facturas…).',
    load: () => import('./word'),
  },
]
