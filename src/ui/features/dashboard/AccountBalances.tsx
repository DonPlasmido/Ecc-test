import { useTranslation } from 'react-i18next';
import type { AccountBalance } from '@/application/ports/inbound/BuildDashboard';
import type { Account, AccountId } from '@/domain/account/Account';
import type { Cents } from '@/domain/money/Money';
import { MoneyText } from '@/ui/components/MoneyText';
import { formatDate } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';

type AccountBalancesProps = {
  balances: readonly AccountBalance[];
  accounts: ReadonlyMap<AccountId, Account>;
};

/**
 * ¿Cuánto tengo? Saldo por cuenta a la fecha del último movimiento. Si no sale del extracto se marca
 * «estimado» con texto (AC-028) y una nota explica cómo se calcula.
 */
export function AccountBalances({ balances, accounts }: AccountBalancesProps) {
  const { t } = useTranslation('dashboard');
  const language = useLanguage();
  const hasEstimate = balances.some((balance) => balance.estimated === true);
  const total = balances.reduce((sum, balance) => sum + balance.balance.cents, 0);

  return (
    <section className="dash-section dash-section--balances" aria-labelledby="dash-balances-title">
      <h2 id="dash-balances-title" className="dash-section__title">
        {t('balances.heading')}
      </h2>
      {balances.length === 0 ? (
        <p className="dash-section__note">{t('balances.none')}</p>
      ) : (
        <ul className="dash-balances">
          {balances.map((balance) => {
            const account = accounts.get(balance.accountId);
            const name = account?.name ?? t('balances.unknownAccount');
            const isEstimated = balance.estimated === true;
            return (
              <li key={balance.accountId} className="dash-balances__row">
                <span className="dash-balances__name">
                  <span className="truncate">{name}</span>
                  {account?.ibanLast4 ? <span className="dash-balances__iban tabular">···{account.ibanLast4}</span> : null}
                </span>
                <MoneyText value={balance.balance} className="dash-balances__amount figure figure--md" />
                <span className="dash-balances__meta">
                  {balance.asOf ? t('balances.asOf', { date: formatDate(balance.asOf, language, 'medium') }) : null}
                  {isEstimated ? (
                    <span className="dash-balances__estimated">
                      {t('balances.estimated')}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
          {balances.length > 1 ? (
            <li className="dash-balances__row dash-balances__row--total">
              <span className="dash-balances__name">{t('balances.total', { count: balances.length })}</span>
              <MoneyText value={{ cents: total as Cents }} className="dash-balances__amount figure figure--md" />
            </li>
          ) : null}
        </ul>
      )}
      {hasEstimate ? (
        <p className="dash-section__note">
          {t('balances.estimatedNote')}
        </p>
      ) : null}
    </section>
  );
}
