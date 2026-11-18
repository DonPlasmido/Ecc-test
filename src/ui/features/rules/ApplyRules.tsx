import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';

type ApplyState =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | { readonly status: 'done'; readonly changed: number }
  | { readonly status: 'error' };

/** «Aplicar reglas ahora»: recategoriza todo lo no manual y resume cuántos movimientos cambiaron. */
export function ApplyRules() {
  const { t } = useTranslation('rules');
  const { categorizeTransactions } = useContainer();
  const { announce } = useNotifications();
  const [state, setState] = useState<ApplyState>({ status: 'idle' });

  const handleApply = async () => {
    setState({ status: 'running' });
    announce(t('apply.running'));
    try {
      const { changed } = await categorizeTransactions.execute({ scope: 'all' });
      setState({ status: 'done', changed });
      announce(t('apply.result', { count: changed }));
    } catch {
      setState({ status: 'error' });
      announce(t('apply.error'), 'assertive');
    }
  };

  return (
    <div className="rules-apply">
      <div className="rules-apply__text">
        <p>{t('apply.text')}</p>
        {state.status === 'done' ? (
          <p className="rules-apply__result tabular">{t('apply.result', { count: state.changed })}</p>
        ) : null}
        {state.status === 'error' ? <p className="field__error">{t('apply.error')}</p> : null}
      </div>
      <Button
        variant="primary"
        isBusy={state.status === 'running'}
        onClick={() => void handleApply()}
      >
        {t('apply.button')}
      </Button>
    </div>
  );
}
