import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { matchesConfirmWord } from './settingsModel';

/** Borrar todos los datos: confirmación tecleando una palabra (a11y §15, 3.3.4). */
export function DeleteAllDataSection({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="card settings-danger" aria-labelledby="settings-delete">
      <div className="card__header">
        <h2 className="card__title" id="settings-delete">
          {t('delete.title')}
        </h2>
      </div>
      <div className="card__section stack">
        <p className="settings-prose">{t('delete.text')}</p>
        <div>
          <Button variant="danger" onClick={() => setIsOpen(true)}>
            {t('delete.open')}
          </Button>
        </div>
      </div>
      {isOpen ? (
        <DeleteAllDataDialog
          onClose={() => setIsOpen(false)}
          onDeleted={() => {
            setIsOpen(false);
            onDeleted();
          }}
        />
      ) : null}
    </section>
  );
}

function DeleteAllDataDialog({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation('settings');
  const { deleteAllData } = useContainer();
  const { notify } = useNotifications();
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const word = t('delete.word');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    if (!matchesConfirmWord(typed, word)) {
      setError(t('delete.mismatch', { word }));
      inputRef.current?.focus();
      return;
    }
    setIsBusy(true);
    const result = await deleteAllData.execute().catch(() => null);
    setIsBusy(false);
    if (!result?.ok) {
      setError(errorMessage(t, result?.error));
      return;
    }
    notify({ tone: 'success', message: t('delete.done') });
    onDeleted();
  };

  const footer = (
    <>
      <Button variant="quiet" onClick={onClose}>
        {t('actions.cancel')}
      </Button>
      <Button variant="danger" type="submit" form={formId} isBusy={isBusy}>
        {t('delete.submit')}
      </Button>
    </>
  );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('delete.dialogTitle')}
      description={t('delete.description')}
      footer={footer}
      initialFocusRef={inputRef}
    >
      <form id={formId} className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Field label={t('delete.confirmLabel', { word })} error={error} isRequired>
          {(control) => (
            <input
              {...control}
              ref={inputRef}
              className="input"
              type="text"
              name="delete-confirmation"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
