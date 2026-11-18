import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import { useNotifications } from '@/ui/components/Toast';
import { useAsync } from '@/ui/hooks/useAsync';
import { useContainer } from '@/ui/hooks/useContainer';
import { Page } from '@/ui/layout/Page';
import { FilePicker } from './FilePicker';
import { ImportSummary } from './ImportSummary';
import { buildPreviewModel, mappingError } from './importModel';
import { PreviewPanel } from './PreviewPanel';
import { useImportFlow, type AccountChoice, type FileSource } from './useImportFlow';
import './import.css';

/** Extracto ficticio servido desde `public/samples` (mismo origen: lo permite `connect-src 'self'`). */
const SAMPLE_FILE = 'bbva.csv';

function effectiveChoice(choice: AccountChoice | null, accounts: readonly Account[] | null, defaultName: string): AccountChoice {
  if (choice) return choice;
  const first = accounts?.[0];
  return first ? { kind: 'existing', id: first.id } : { kind: 'new', name: defaultName };
}

async function fetchSample(): Promise<ArrayBuffer> {
  const response = await fetch(`${import.meta.env.BASE_URL}samples/${SAMPLE_FILE}`);
  if (!response.ok) throw new Error(`Sample not available: HTTP ${response.status}`);
  return response.arrayBuffer();
}

/** Pantalla Importar: archivo → vista previa editable → confirmación → resumen (F1). */
export function ImportPage() {
  const { t } = useTranslation('import');
  const { manageCatalog } = useContainer();
  const { announce } = useNotifications();
  const { state, load, updateDraft, commit, reset } = useImportFlow();
  const [accountChoice, setAccountChoice] = useState<AccountChoice | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // `async`: un fallo síncrono del puerto también llega como estado de error (no rompe la pantalla).
  const accountsTask = useCallback(async () => manageCatalog.listAccounts(), [manageCatalog]);
  const accounts = useAsync(accountsTask);
  const choice = effectiveChoice(accountChoice, accounts.status === 'success' ? accounts.data : null, t('account.defaultName'));

  const loadSource = async (source: FileSource) => {
    const preview = await load(source);
    if (!preview) return;
    const model = buildPreviewModel(preview.table, preview.suggestedMapping);
    announce(t('status.previewReady', { valid: model.validCount, errors: model.errorCount }));
  };

  const handleFile = (file: File) =>
    loadSource({ name: file.name, read: () => file.arrayBuffer(), readFailure: 'unexpected' });

  const handleSample = () => loadSource({ name: SAMPLE_FILE, read: fetchSample, readFailure: 'sampleUnavailable' });

  const handleMappingChange = (mapping: ColumnMapping) => {
    if (state.step !== 'preview') return;
    updateDraft((draft) => ({ ...draft, mapping }));
    if (mappingError(mapping) !== null) return;
    const model = buildPreviewModel(state.draft.preview.table, mapping);
    announce(t('mapping.updated', { valid: model.validCount, errors: model.errorCount }));
  };

  const handleConfirm = async () => {
    announce(t('status.committing'));
    const result = await commit(choice);
    if (!result) return;
    if (choice.kind === 'new') setAccountChoice(null);
    // Una cuenta recién creada debe aparecer en la próxima importación.
    accounts.reload();
    announce(
      t('summary.announce', { inserted: result.inserted, duplicates: result.duplicates, categorized: result.autoCategorized }),
    );
  };

  const handleCancel = () => {
    reset();
    announce(t('status.cancelled'));
    // El botón desaparece: el foco vuelve al selector de archivo (no se pierde en el documento).
    requestAnimationFrame(() => fileInputRef.current?.focus());
  };

  const handleImportAnother = () => {
    reset();
    requestAnimationFrame(() => fileInputRef.current?.focus());
  };

  return (
    <Page title={t('title')} intro={t('intro')}>
      {state.step === 'done' ? (
        <ImportSummary fileName={state.fileName} result={state.result} onImportAnother={handleImportAnother} />
      ) : (
        <FilePicker
          inputRef={fileInputRef}
          isReading={state.step === 'select' && state.isReading}
          problem={state.step === 'select' ? state.problem : null}
          onFile={handleFile}
          onSample={handleSample}
        />
      )}
      {state.step === 'preview' ? (
        <PreviewPanel
          draft={state.draft}
          accounts={accounts}
          accountChoice={choice}
          isCommitting={state.isCommitting}
          problem={state.problem}
          onMappingChange={handleMappingChange}
          onDatesConfirmedChange={(datesConfirmed) => updateDraft((draft) => ({ ...draft, datesConfirmed }))}
          onAccountChange={setAccountChoice}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}
    </Page>
  );
}
