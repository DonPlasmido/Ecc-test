import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { Account } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import { Button } from '@/ui/components/Button';
import { IconWarning } from '@/ui/components/icons';
import type { AsyncResult } from '@/ui/hooks/useAsync';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { AccountPicker } from './AccountPicker';
import { buildPreviewModel, mappingError } from './importModel';
import { MappingEditor } from './MappingEditor';
import { PreviewTable } from './PreviewTable';
import { problemMessage } from './problemMessage';
import type { AccountChoice, ImportDraft, ImportProblem } from './useImportFlow';

/** Por debajo de esta confianza se pide revisar el mapeo. */
const CONFIDENT = 1;

type PreviewPanelProps = {
  draft: ImportDraft;
  accounts: AsyncResult<readonly Account[]>;
  accountChoice: AccountChoice;
  isCommitting: boolean;
  problem: ImportProblem | null;
  onMappingChange: (mapping: ColumnMapping) => void;
  onDatesConfirmedChange: (confirmed: boolean) => void;
  onAccountChange: (choice: AccountChoice) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** Destino del foco cuando acaba de llegar la vista previa. */
  headingRef?: Ref<HTMLHeadingElement>;
};

function DetectionInfo({ draft }: { draft: ImportDraft }) {
  const { t, i18n } = useTranslation('import');
  const { preview } = draft;
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' }).format(preview.confidence);
  const headerRow = draft.mapping.headerRowIndex;
  return (
    <div className="stack stack--tight text-sm">
      <p className="import-file-name">{t('detection.fileName', { name: draft.fileName })}</p>
      <p>{preview.rememberedMapping ? t('detection.remembered') : t('detection.auto', { percent })}</p>
      <p className="text-muted">{headerRow >= 0 ? t('detection.headerRow', { row: headerRow + 1 }) : t('detection.noHeader')}</p>
      {preview.confidence < CONFIDENT ? (
        <p className="status status--near">
          <IconWarning />
          {t('detection.lowConfidence')}
        </p>
      ) : null}
    </div>
  );
}

function AmbiguousDates({ isConfirmed, isDisabled, onChange }: { isConfirmed: boolean; isDisabled: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation('import');
  return (
    <div className="import-callout" role="group" aria-labelledby="import-dates-heading">
      <h3 className="import-subheading" id="import-dates-heading">
        <IconWarning />
        {t('dates.heading')}
      </h3>
      <p className="text-sm">{t('dates.text')}</p>
      <label className="check">
        <input type="checkbox" checked={isConfirmed} disabled={isDisabled} onChange={(event) => onChange(event.target.checked)} />
        <span>{t('dates.confirm')}</span>
      </label>
    </div>
  );
}

function useBlockers(draft: ImportDraft, accounts: AsyncResult<readonly Account[]>, choice: AccountChoice): readonly string[] {
  const { t } = useTranslation('import');
  const invalidMapping = mappingError(draft.mapping);
  return [
    invalidMapping ? errorMessage(t, invalidMapping) : null,
    draft.preview.ambiguousDates && !draft.datesConfirmed ? t('blockers.dates') : null,
    accounts.status === 'loading' ? t('blockers.accounts') : null,
    accounts.status === 'error' ? t('account.loadError') : null,
    choice.kind === 'new' && choice.name.trim() === '' ? t('blockers.accountName') : null,
  ].filter((blocker): blocker is string => blocker !== null);
}

/** Vista previa editable: detección, mapeo, avisos, tabla normalizada, cuenta destino y confirmación. */
export function PreviewPanel({ headingRef, ...props }: PreviewPanelProps) {
  const { draft, accounts, accountChoice, isCommitting, problem } = props;
  const { t } = useTranslation('import');
  const canPreview = mappingError(draft.mapping) === null;
  const model = canPreview ? buildPreviewModel(draft.preview.table, draft.mapping) : null;
  const blockers = useBlockers(draft, accounts, accountChoice);
  const canConfirm = blockers.length === 0;

  return (
    <section className="card import-preview-card" aria-labelledby="import-preview-heading" aria-busy={isCommitting || undefined}>
      <h2 className="card__title" id="import-preview-heading" ref={headingRef} tabIndex={-1}>
        {t('detection.heading')}
      </h2>
      <DetectionInfo draft={draft} />
      {draft.preview.ambiguousDates ? (
        <AmbiguousDates isConfirmed={draft.datesConfirmed} isDisabled={isCommitting} onChange={props.onDatesConfirmedChange} />
      ) : null}
      <MappingEditor table={draft.preview.table} mapping={draft.mapping} isDisabled={isCommitting} onChange={props.onMappingChange} />
      {model && model.warnings.length > 0 ? (
        <div className="import-callout" role="group" aria-labelledby="import-warnings-heading">
          <h3 className="import-subheading" id="import-warnings-heading">
            <IconWarning />
            {t('warnings.heading')}
          </h3>
          <ul className="import-row-errors">
            {model.warnings.map((warning) => (
              <li key={`${warning.line}-${warning.value}`}>{t('warnings.ambiguousAmount', { line: warning.line, value: warning.value })}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model ? <PreviewTable model={model} /> : <p className="text-muted">{t('table.unavailable')}</p>}
      <p className="text-sm text-muted">{t('warnings.duplicatesNote')}</p>
      <section className="stack" aria-labelledby="import-account-heading">
        <h3 className="import-subheading" id="import-account-heading">
          {t('account.heading')}
        </h3>
        {accounts.status === 'success' ? (
          <AccountPicker
            accounts={accounts.data}
            value={accountChoice}
            defaultNewName={t('account.defaultName')}
            isDisabled={isCommitting}
            onChange={props.onAccountChange}
          />
        ) : null}
        {accounts.status === 'error' ? (
          <Button isSmall onClick={accounts.reload}>
            {t('actions.retry', { ns: 'common' })}
          </Button>
        ) : null}
      </section>
      <div className="import-blockers" aria-live="polite">
        {blockers.length > 0 ? (
          <>
            <p className="text-sm">{t('blockers.heading')}</p>
            <ul className="import-row-errors">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      {problem ? (
        <p className="field__error" role="alert">
          {problemMessage(t, problem)}
        </p>
      ) : null}
      <div className="cluster import-actions">
        <Button variant="primary" disabled={!canConfirm} isBusy={isCommitting} onClick={props.onConfirm}>
          {t('actions.confirm')}
        </Button>
        <Button variant="quiet" disabled={isCommitting} onClick={props.onCancel}>
          {t('actions.cancel')}
        </Button>
      </div>
    </section>
  );
}
