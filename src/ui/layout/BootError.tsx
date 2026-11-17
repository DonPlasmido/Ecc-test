import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { errorMessage } from '@/ui/i18n/errorMessage';
import type { DomainError } from '@/domain/shared/DomainError';

type BootErrorProps = {
  /** Error de dominio si el arranque lo identificó (p. ej. `storage.unavailable`). */
  error: DomainError | null;
};

/** Pantalla mínima cuando no se puede crear el contenedor (IndexedDB bloqueada, cuota…). */
export function BootError({ error }: BootErrorProps) {
  const { t } = useTranslation();
  return (
    <main id="main" className="container page">
      <div className="empty" role="alert">
        <h1 className="empty__title">{t('boot.failedTitle')}</h1>
        <p className="empty__text">{errorMessage(t, error)}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('boot.reload')}
        </Button>
      </div>
    </main>
  );
}
