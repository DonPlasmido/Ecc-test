import { describe, expect, test } from 'vitest';
import type { TransactionFilter } from '@/application/ports/inbound/QueryTransactions';
import { createTransactionIndex, type TransactionIndex } from '@/application/read-model/TransactionIndex';
import type { CategoryId } from '@/domain/category/Category';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { YearMonth } from '@/domain/date/YearMonth';
import { fixtureCategoryId, generateTransactions } from '../tests/fixtures/generateTransactions';

const SIZE = 100_000;
const SEED = 42;
const BATCH_SIZE = 5_000;
const MIN_SAMPLES = 30;
const RUN = { iterations: 50, warmupIterations: 10, time: 0, warmupTime: 0, retainSamples: true } as const;

/** Umbrales de AC-032 (ms). */
const FILTER_MEAN_MAX_MS = 25;
const FILTER_P95_MAX_MS = 50;
const FILTER_SORT_P95_MAX_MS = 100;

const data = generateTransactions({ count: SIZE, seed: SEED });

function hydratedIndex(): TransactionIndex {
  const index = createTransactionIndex();
  for (let i = 0; i < data.length; i += BATCH_SIZE) index.hydrate(data.slice(i, i + BATCH_SIZE));
  return index;
}

/** AC-032: texto `mercadona` + rango de 3 meses + 2 categorías. */
const COMBINED: TransactionFilter = {
  text: 'mercadona',
  from: '2025-03-01' as IsoDate,
  to: '2025-05-31' as IsoDate,
  categoryIds: [fixtureCategoryId(2), fixtureCategoryId(7)] as CategoryId[],
};

function percentile(samples: readonly number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] as number;
}

const index = hydratedIndex();
index.filter({}, 'dateDesc'); // fuerza la ordenación diferida antes de medir

function report(name: string, mean: number, p95: number, samples: number): void {
  console.warn(`[bench] ${name}: mean=${mean.toFixed(3)} ms p95=${p95.toFixed(3)} ms n=${samples}`);
}

describe('TransactionIndex 100k (AC-032)', () => {
  test('construir el índice de 100k (lotes de 5.000) y primer orden', async ({ bench }) => {
    const result = await bench('hydrate 100k', () => {
      hydratedIndex().filter({}, 'dateDesc');
    }).run({ ...RUN, iterations: 10, warmupIterations: 2 });
    const samples = result.latency.samples as number[];
    report('hydrate 100k', result.latency.mean, percentile(samples, 0.95), samples.length);
  });

  test('filtro combinado (texto + 3 meses + 2 categorías), orden por fecha descendente', async ({ bench }) => {
    const result = await bench('filter combined', () => {
      index.filter(COMBINED, 'dateDesc');
    }).run(RUN);
    const samples = result.latency.samples as number[];
    const p95 = percentile(samples, 0.95);
    report('filter combined', result.latency.mean, p95, samples.length);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
    expect(result.latency.mean).toBeLessThanOrEqual(FILTER_MEAN_MAX_MS);
    expect(p95).toBeLessThanOrEqual(FILTER_P95_MAX_MS);
  });

  test('filtro combinado + ordenación por fecha ascendente', async ({ bench }) => {
    const result = await bench('filter combined + sort', () => {
      index.filter(COMBINED, 'dateAsc');
    }).run(RUN);
    const samples = result.latency.samples as number[];
    const p95 = percentile(samples, 0.95);
    report('filter combined + sort', result.latency.mean, p95, samples.length);
    expect(samples.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
    expect(p95).toBeLessThanOrEqual(FILTER_SORT_P95_MAX_MS);
  });

  test('filtro de texto sobre todo el rango + orden por importe', async ({ bench }) => {
    const result = await bench('filter text + amount sort', () => {
      index.filter({ text: 'mercadona' }, 'amountDesc');
    }).run(RUN);
    const samples = result.latency.samples as number[];
    const p95 = percentile(samples, 0.95);
    report('filter text + amount sort', result.latency.mean, p95, samples.length);
    expect(p95).toBeLessThanOrEqual(FILTER_SORT_P95_MAX_MS);
  });

  test('agregado mensual por categoría (24 meses)', async ({ bench }) => {
    const result = await bench('monthly totals', () => {
      index.totalsByMonthAndCategory('2024-01' as YearMonth, '2025-12' as YearMonth);
    }).run(RUN);
    const samples = result.latency.samples as number[];
    report('monthly totals', result.latency.mean, percentile(samples, 0.95), samples.length);
  });
});
