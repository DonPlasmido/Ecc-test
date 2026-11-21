import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createTransactionIndex } from '@/application/read-model/TransactionIndex';
import { ImportStatementUseCase } from '@/application/use-cases/ImportStatementUseCase';
import type { StatementFile } from '@/domain/import/StatementFile';
import { ACCOUNT, table } from '../../domain/builders';
import { InMemoryStatementParser } from '../../fakes/InMemoryStatementParser';
import { tx } from '../../fixtures/txBuilder';
import { createWorld } from '../harness';

const FILE: StatementFile = { name: 'bordes.csv', bytes: new ArrayBuffer(0) };

describe('saldo final con varios movimientos el mismo día', () => {
  it('uses the last statement row (bordes.csv fixture) regardless of storage order', async () => {
    const w = createWorld();
    const lines = readFileSync('tests/fixtures/qa/bordes.csv', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(';'));
    const useCase = new ImportStatementUseCase({
      parser: InMemoryStatementParser.returning(table(lines)),
      transactions: w.transactions,
      profiles: w.profiles,
      rules: w.rules,
      accounts: w.accounts,
      clock: w.clock,
      ids: w.ids,
    });
    const preview = await useCase.preview(FILE);
    if (!preview.ok) throw new Error(preview.error.code);
    await useCase.commit({ previewId: preview.value.previewId, accountId: ACCOUNT, mapping: preview.value.suggestedMapping });

    const index = createTransactionIndex();
    // Orden de almacenamiento inverso: el índice no debe depender de él.
    index.hydrate([...w.state.transactions.values()].reverse());

    const [account] = index.latestBalances();
    expect(account?.balance.cents).toBe(58313);
    expect(account?.estimated).toBe(false);
  });

  it('orders same-day rows by sourceLine, not by insertion slot', () => {
    const index = createTransactionIndex();
    index.hydrate([
      { ...tx({ id: 'b', date: '2026-10-31', cents: 2, balance: 58313 }), sourceLine: 6 },
      { ...tx({ id: 'a', date: '2026-10-31', cents: -38130, balance: 58311 }), sourceLine: 5 },
    ]);
    expect(index.latestBalances()[0]?.balance.cents).toBe(58313);
  });
});
