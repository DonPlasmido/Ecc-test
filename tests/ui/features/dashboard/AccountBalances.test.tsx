import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AccountBalance } from '@/application/ports/inbound/BuildDashboard';
import type { Account, AccountId } from '@/domain/account/Account';
import type { IsoDate } from '@/domain/date/IsoDate';
import type { Cents } from '@/domain/money/Money';
import { AccountBalances } from '@/ui/features/dashboard/AccountBalances';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';

const known: AccountBalance = {
  accountId: 'a1' as AccountId,
  balance: { cents: 100000 as Cents },
  asOf: '2026-10-31' as IsoDate,
};
const unknown: AccountBalance = {
  accountId: 'a2' as AccountId,
  balance: { cents: -148207 as Cents },
  asOf: '2026-10-28' as IsoDate,
  estimated: true,
  balanceUnknown: true,
};
const accounts = new Map<AccountId, Account>([
  ['a1' as AccountId, { id: 'a1' as AccountId, name: 'Con saldo' } as Account],
  ['a2' as AccountId, { id: 'a2' as AccountId, name: 'Sin saldo' } as Account],
]);

describe('AccountBalances without a statement balance', () => {
  beforeEach(async () => {
    await setupI18n('es');
  });

  it('does not show a computed amount as estimated and leaves it out of the total', () => {
    renderWithProviders(<AccountBalances balances={[known, unknown]} accounts={accounts} />);

    const rows = within(screen.getByRole('region', { name: '¿Cuánto tengo?' })).getAllByRole('listitem');
    expect(rows[1]).toHaveTextContent('Sin saldo en el extracto');
    expect(rows[1]).not.toHaveTextContent('1.482');
    expect(rows[1]).not.toHaveTextContent('estimado');
    expect(rows).toHaveLength(2);
    expect(screen.queryByText(/^Total en/)).not.toBeInTheDocument();
  });
});
