import { afterAll, beforeAll } from 'vitest';
import { useLocation } from 'react-router-dom';
import type { AppContainer } from '@/composition/container.types';
import { createTestContainer } from '@/composition/createTestContainer';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Transaction } from '@/domain/transaction/Transaction';
import { TransactionsPage } from '@/ui/features/transactions/TransactionsPage';
import { InMemoryAccountRepository } from '../../../fakes/InMemoryCatalogRepositories';
import { createInMemoryState } from '../../../fakes/InMemoryState';
import { InMemoryTransactionRepository } from '../../../fakes/InMemoryTransactionRepository';
import { renderWithProviders } from '../../renderWithProviders';

export const VIEWPORT = { width: 400, height: 600 };

export function account(id: string, name: string, ibanLast4: string | null = null): Account {
  return { id: id as AccountId, name, ibanLast4, currency: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' };
}

/** Contenedor real (casos de uso + índice) con fakes en memoria sembrados con estos datos. */
export async function seededContainer(
  transactions: readonly Transaction[],
  accounts: readonly Account[] = [account('a1', 'Cuenta nómina', '1234')],
): Promise<AppContainer> {
  const state = createInMemoryState();
  for (const tx of transactions) state.transactions.set(tx.id, tx);
  for (const acc of accounts) state.accounts.set(acc.id, acc);
  return createTestContainer({
    transactions: new InMemoryTransactionRepository(state),
    accounts: new InMemoryAccountRepository(state),
  });
}

/** Muestra la query actual para comprobar que los filtros viven en la URL. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

export function renderTransactionsPage(container: AppContainer, route = '/movimientos') {
  return renderWithProviders(
    <>
      <TransactionsPage />
      <LocationProbe />
    </>,
    { container, route },
  );
}

/**
 * jsdom no tiene layout: da tamaño al contenedor `.vgrid` y simula su scroll (ADR-0008), igual que el
 * test del componente compartido.
 */
export function installFakeGridLayout(): void {
  const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const scrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  const originalScrollTo = Element.prototype.scrollTo;
  const scrollTops = new WeakMap<Element, number>();

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get(this: Element) {
        return scrollTops.get(this) ?? 0;
      },
      set(this: Element, value: number) {
        scrollTops.set(this, value);
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('vgrid') ? VIEWPORT.height : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('vgrid') ? VIEWPORT.width : 0;
      },
    });
    Element.prototype.scrollTo = function scrollTo(this: Element, options?: ScrollToOptions | number) {
      this.scrollTop = typeof options === 'object' ? (options.top ?? 0) : 0;
      this.dispatchEvent(new Event('scroll'));
    } as Element['scrollTo'];
  });

  afterAll(() => {
    if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
    if (scrollTopDescriptor) Object.defineProperty(Element.prototype, 'scrollTop', scrollTopDescriptor);
    Element.prototype.scrollTo = originalScrollTo;
  });
}
