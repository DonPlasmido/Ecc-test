import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { useTransactionIndex } from '@/ui/hooks/useTransactionIndex';

/**
 * Aviso persistente si el índice de movimientos no se pudo cargar o sincronizar: sin él, las pantallas
 * mostrarían datos vacíos o desfasados como si fueran reales. IndexSync reintenta solo; si se recupera,
 * el aviso desaparece.
 */
export function IndexStatusBanner() {
  const { t } = useTranslation();
  const { hydration } = useTransactionIndex();
  if (hydration.status !== 'failed') return null;

  return (
    <div className="msg msg--error index-banner" role="alert">
      <p>{t('indexFailed.message')}</p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {t('indexFailed.reload')}
      </Button>
    </div>
  );
}
