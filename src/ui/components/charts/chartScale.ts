/** Funciones puras de escalas y marcas para los gráficos propios (ADR-0011). */

export type Domain = readonly [number, number];

const NICE_FACTORS = [1, 2, 2.5, 5, 10] as const;

/** Paso «redondo» (1, 2, 2,5, 5 × 10ⁿ) para cubrir `span` con unas `targetTicks` divisiones. */
export function niceStep(span: number, targetTicks: number): number {
  if (!(span > 0) || targetTicks < 1) return 1;
  const raw = span / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = NICE_FACTORS.find((candidate) => candidate * magnitude >= raw) ?? 10;
  return factor * magnitude;
}

/** Mínimo y máximo, incluyendo siempre el 0 (las barras y áreas parten de cero). */
export function extentWithZero(values: readonly number[]): Domain {
  let min = 0;
  let max = 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

/** Marcas redondas que cubren el dominio; el dominio «bonito» es `[ticks[0], ticks.at(-1)]`. */
export function niceTicks([min, max]: Domain, targetTicks = 4): readonly number[] {
  if (min === max) {
    return max === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, max)];
  }
  const step = niceStep(max - min, targetTicks);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const count = Math.round((end - start) / step);
  return Array.from({ length: count + 1 }, (_, index) => Number((start + index * step).toPrecision(12)));
}

/** Escala lineal `dominio → rango`. Con dominio degenerado devuelve el centro del rango. */
export function scaleLinear([d0, d1]: Domain, [r0, r1]: Domain): (value: number) => number {
  if (d0 === d1) {
    const middle = (r0 + r1) / 2;
    return () => middle;
  }
  const ratio = (r1 - r0) / (d1 - d0);
  return (value) => r0 + (value - d0) * ratio;
}

/** Índices de etiquetas del eje X para no superponerlas: como mucho `max`, incluye siempre el último. */
export function labelIndices(count: number, max: number): readonly number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, index) => index);
  const every = Math.ceil(count / max);
  const picked = Array.from({ length: count }, (_, index) => index).filter((index) => index % every === 0);
  const last = count - 1;
  if (picked.at(-1) !== last) {
    picked[picked.length - 1] = last;
  }
  return picked;
}

/** Índices del máximo y mínimo de una serie (primero en caso de empate), o `null` si está vacía. */
export function minMaxIndices(values: readonly number[]): { readonly min: number; readonly max: number } | null {
  if (values.length === 0) return null;
  let min = 0;
  let max = 0;
  values.forEach((value, index) => {
    if (value < (values[min] ?? value)) min = index;
    if (value > (values[max] ?? value)) max = index;
  });
  return { min, max };
}

/** Redondea coordenadas SVG a 1 decimal (menos bytes en el DOM). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
