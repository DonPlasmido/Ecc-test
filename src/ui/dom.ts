type Attrs = Record<string, string | boolean | ((ev: Event) => void)>

/** Crea un elemento HTML de forma corta: h('p', { class: 'hint' }, 'Hola') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.replace(/^on/, ''), value)
    else if (value === true) el.setAttribute(key, '')
    else if (value !== false) el.setAttribute(key, value)
  }
  for (const child of children) {
    if (child != null) el.append(child)
  }
  return el
}

export type MsgKind = 'ok' | 'error' | 'warn'

export function message(kind: MsgKind, ...lines: string[]): HTMLElement {
  return h('div', { class: `msg ${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    ...lines.flatMap((line, i) => (i === 0 ? [line] : [h('br'), line])))
}

/** Libera la memoria de los enlaces de descarga que había dentro de `container`. */
export function revokeDownloads(container: HTMLElement): void {
  container.querySelectorAll<HTMLAnchorElement>('a[href^="blob:"]').forEach((a) => URL.revokeObjectURL(a.href))
}

export function downloadLink(data: BlobPart, filename: string, mime: string, text = 'Descargar'): HTMLAnchorElement {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  return h('a', { class: 'download', href: url, download: filename }, `${text}: ${filename}`)
}

export function backLink(): HTMLAnchorElement {
  return h('a', { class: 'back', href: '#' }, '← Volver')
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
