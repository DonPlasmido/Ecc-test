import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatMoneyCompact } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { ChartTable } from './ChartTable';
import { extentWithZero, labelIndices, minMaxIndices, niceTicks, round1, scaleLinear } from './chartScale';

export interface LineSeries {
  readonly key: string;
  readonly label: string;
  /** Un valor por etiqueta del eje X (céntimos por defecto). */
  readonly values: readonly number[];
  /** Color CSS, p. ej. `var(--color-chart-income)`. */
  readonly color: string;
  /** Trazo discontinuo para distinguir series sin color (a11y §6). */
  readonly isDashed?: boolean;
}

type LineChartProps = {
  title: string;
  /** Etiquetas del eje X ya formateadas (≤ 24 puntos). */
  labels: readonly string[];
  series: readonly LineSeries[];
  labelColumn?: string;
  formatValue?: (value: number) => string;
  /** Formato corto de las marcas del eje Y. */
  formatTick?: (value: number) => string;
};

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 8, right: 8, bottom: 22, left: 48 } as const;
const MAX_X_LABELS = 6;

/** Gráfico de líneas SVG con `role="img"`, `<title>`/`<desc>`, leyenda en texto y tabla equivalente. */
export function LineChart({ title, labels, series, labelColumn, formatValue, formatTick }: LineChartProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const baseId = useId();
  const titleId = `${baseId}-t`;
  const descId = `${baseId}-d`;
  const format = formatValue ?? ((value: number) => formatMoney(value, language, false));
  const formatAxis = formatTick ?? ((value: number) => formatMoneyCompact(value, language));

  if (labels.length === 0 || series.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart__title">{title}</figcaption>
        <p className="text-muted">{t('chart.empty')}</p>
      </figure>
    );
  }

  const ticks = niceTicks(extentWithZero(series.flatMap((serie) => serie.values)));
  const domain = [ticks[0] ?? 0, ticks.at(-1) ?? 1] as const;
  const y = scaleLinear(domain, [HEIGHT - PAD.bottom, PAD.top]);
  const x = scaleLinear([0, Math.max(labels.length - 1, 1)], [PAD.left, WIDTH - PAD.right]);
  const xFor = (index: number) => round1(labels.length === 1 ? (PAD.left + WIDTH - PAD.right) / 2 : x(index));

  const description = series
    .map((serie) => {
      const extremes = minMaxIndices(serie.values);
      if (!extremes) return serie.label;
      return t('chart.summary', {
        title: serie.label,
        max: format(serie.values[extremes.max] ?? 0),
        maxLabel: labels[extremes.max] ?? '',
        min: format(serie.values[extremes.min] ?? 0),
        minLabel: labels[extremes.min] ?? '',
      });
    })
    .join(' ');

  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      <svg className="chart-line" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>
        <g aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart-line__grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={round1(y(tick))} y2={round1(y(tick))} />
              <text className="chart-line__axis" x={PAD.left - 4} y={round1(y(tick))} textAnchor="end" dominantBaseline="middle">
                {formatAxis(tick)}
              </text>
            </g>
          ))}
          {labelIndices(labels.length, MAX_X_LABELS).map((index) => (
            <text key={index} className="chart-line__axis" x={xFor(index)} y={HEIGHT - 6} textAnchor="middle">
              {labels[index]}
            </text>
          ))}
          {series.map((serie) => (
            <g key={serie.key} style={{ color: serie.color }}>
              <polyline
                className="chart-line__path"
                strokeDasharray={serie.isDashed ? '5 4' : undefined}
                points={serie.values.map((value, index) => `${xFor(index)},${round1(y(value))}`).join(' ')}
              />
              {serie.values.map((value, index) => (
                <circle key={labels[index] ?? index} className="chart-line__dot" cx={xFor(index)} cy={round1(y(value))} r={2.5} />
              ))}
            </g>
          ))}
        </g>
      </svg>
      {series.length > 1 ? (
        <ul className="chart__legend cluster">
          {series.map((serie) => (
            <li key={serie.key} className="chart__legend-item" style={{ color: serie.color }}>
              <svg className="chart__swatch" viewBox="0 0 24 8" aria-hidden="true" focusable="false">
                <line x1="0" x2="24" y1="4" y2="4" strokeDasharray={serie.isDashed ? '5 4' : undefined} />
              </svg>
              <span className="chart__legend-text">{serie.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ChartTable
        caption={title}
        rowHeader={labelColumn ?? t('chart.labelColumn')}
        columns={series.map((serie) => serie.label)}
        rows={labels.map((label, index) => ({
          key: `${index}-${label}`,
          header: label,
          cells: series.map((serie) => format(serie.values[index] ?? 0)),
        }))}
      />
    </figure>
  );
}
