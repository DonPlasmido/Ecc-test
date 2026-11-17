import { useId, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { ChartTable } from './ChartTable';
import { minMaxIndices } from './chartScale';

export interface BarDatum {
  readonly key: string;
  readonly label: string;
  /** Céntimos (o la unidad que entienda `formatValue`). */
  readonly value: number;
  /** Color CSS (`var(--color-cat-3)`); por defecto el acento. */
  readonly color?: string;
}

type BarChartProps = {
  title: string;
  data: readonly BarDatum[];
  /** Cabecera de la columna de etiquetas en la tabla alternativa. */
  labelColumn?: string;
  valueColumn?: string;
  formatValue?: (value: number) => string;
};

/**
 * Barras horizontales HTML/CSS (ADR-0011): el bloque visual es `role="img"` con un resumen
 * como nombre, cada barra lleva su etiqueta y valor visibles, y hay tabla equivalente.
 */
export function BarChart({ title, data, labelColumn, valueColumn, formatValue }: BarChartProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const captionId = useId();
  const format = formatValue ?? ((value: number) => formatMoney(value, language, false));

  if (data.length === 0) {
    return (
      <figure className="chart" aria-labelledby={captionId}>
        <figcaption id={captionId} className="chart__title">
          {title}
        </figcaption>
        <p className="text-muted">{t('chart.empty')}</p>
      </figure>
    );
  }

  const values = data.map((datum) => datum.value);
  const largest = Math.max(...values.map(Math.abs)) || 1;
  const extremes = minMaxIndices(values);
  const maxDatum = data[extremes?.max ?? 0];
  const minDatum = data[extremes?.min ?? 0];
  const summary = t('chart.summary', {
    title,
    max: maxDatum ? format(maxDatum.value) : '',
    maxLabel: maxDatum?.label ?? '',
    min: minDatum ? format(minDatum.value) : '',
    minLabel: minDatum?.label ?? '',
  });

  return (
    <figure className="chart" aria-labelledby={captionId}>
      <figcaption id={captionId} className="chart__title">
        {title}
      </figcaption>
      <div className="chart-bars" role="img" aria-label={summary}>
        {data.map((datum) => {
          const style = {
            '--bar-value': (Math.abs(datum.value) / largest).toFixed(4),
            '--bar-color': datum.color ?? 'var(--color-accent)',
          } as CSSProperties;
          return (
            <div key={datum.key} className="chart-bars__row" style={style}>
              <span className="chart-bars__label truncate">{datum.label}</span>
              <span className="chart-bars__value amount">{format(datum.value)}</span>
              <span className="chart-bars__track">
                <span className="chart-bars__fill" />
              </span>
            </div>
          );
        })}
      </div>
      <ChartTable
        caption={title}
        rowHeader={labelColumn ?? t('chart.labelColumn')}
        columns={[valueColumn ?? t('chart.valueColumn')]}
        rows={data.map((datum) => ({ key: datum.key, header: datum.label, cells: [format(datum.value)] }))}
      />
    </figure>
  );
}
