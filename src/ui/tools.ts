export interface Tool {
  id: string
  title: string
  description: string
  /** Pinta la herramienta dentro de `root`. Se carga bajo demanda para que la app arranque rápido. */
  load: () => Promise<{ render: (root: HTMLElement) => void }>
}

export const tools: Tool[] = []
