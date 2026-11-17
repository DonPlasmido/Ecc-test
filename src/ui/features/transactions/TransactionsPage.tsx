import { useTranslation } from 'react-i18next';
import { Page } from '@/ui/layout/Page';
import { PlaceholderNotice } from '@/ui/layout/PlaceholderNotice';

/** Movimientos. TODO(features/transactions): filtros en la query del hash + VirtualTransactionList. */
export function TransactionsPage() {
  const { t } = useTranslation();
  return (
    <Page title={t('pages.transactions.title')} intro={t('pages.transactions.intro')}>
      <PlaceholderNotice />
    </Page>
  );
}
