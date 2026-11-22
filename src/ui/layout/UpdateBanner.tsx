import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { usePendingUpdate } from '@/ui/pwa/updateOffer';

/**
 * Aviso persistente de versión nueva. Nunca recarga solo: con un diálogo abierto (importación, copia,
 * edición…) se perdería trabajo, así que en ese caso pide terminar antes.
 */
export function UpdateBanner() {
  const { t } = useTranslation();
  const apply = usePendingUpdate();
  const [isBlocked, setIsBlocked] = useState(false);
  if (apply === null) return null;

  const handleReload = () => {
    if (document.querySelector('[role="dialog"], dialog[open]')) {
      setIsBlocked(true);
      return;
    }
    setIsBlocked(false);
    apply();
  };

  return (
    <div className="msg msg--info index-banner" role="status">
      <p>{isBlocked ? t('update.finishFirst') : t('update.message')}</p>
      <Button variant="secondary" onClick={handleReload}>
        {t('update.reload')}
      </Button>
    </div>
  );
}
