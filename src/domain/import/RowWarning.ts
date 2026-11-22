/** Aviso sobre una fila aceptada que conviene revisar. */
export interface RowWarning {
  /** Línea 1-based del archivo de origen. */
  readonly line: number
  /**
   * `ambiguousAmount`: p. ej. `12.345`, que podría ser 12,345 (formato inglés).
   * `summaryRowIgnored`: fila de resumen («TOTAL INGRESOS») ignorada; no cuenta como error.
   */
  readonly code: 'ambiguousAmount' | 'summaryRowIgnored'
  /** Texto original (recortado) que originó el aviso. */
  readonly value: string
}
