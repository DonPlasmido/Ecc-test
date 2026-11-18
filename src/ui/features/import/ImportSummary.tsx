import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ImportResult } from '@/application/ports/inbound/ImportStatement';
import { Button } from '@/ui/components/Button';
import { IconCheck } from '@/ui/components/icons';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { ROUTES } from '@/ui/routes';

type ImportSummaryProps = {
  fileName: string;
  result: ImportResult;
  onImportAnother: () => void;
};

/**
 * Resumen tras confirmar: recuentos, filas rechazadas con su línea y siguientes pasos. El foco va al título
 * para que el lector lo lea (el anuncio corto lo hace la región global `status`).
 */
export function ImportSummary({ fileName, result, onImportAnother }: ImportSummaryProps) {
  const { t } = useTranslation('import');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const figures = [
    { key: 'inserted', value: result.inserted },
    { key: 'duplicates', value: result.duplicates },
    { key: 'categorized', value: result.autoCategorized },
    { key: 'rowErrors', value: result.rowErrors.length },
  ] as const;

  return (
    <section className="card import-summary" aria-labelledby="import-summary-heading">
      <div className="import-summary__header">
        <IconCheck className="icon import-summary__icon" />
        <div className="stack stack--tight">
          <h2 className="card__title" id="import-summary-heading" ref={headingRef} tabIndex={-1}>
            {t('summary.heading')}
          </h2>
          <p className="text-muted text-sm">{t('detection.fileName', { name: fileName })}</p>
        </div>
      </div>
      <dl className="import-figures">
        {figures.map((figure) => (
          <div key={figure.key} className="import-figures__item" data-kind={figure.key}>
            <dt className="eyebrow">{t(`summary.${figure.key}`)}</dt>
            <dd className="figure tabular">{figure.value}</dd>
          </div>
        ))}
      </dl>
      {result.inserted === 0 && result.duplicates > 0 ? <p>{t('summary.nothingNew')}</p> : null}
      {result.rowErrors.length > 0 ? (
        <div className="stack stack--tight">
          <h3 className="import-subheading">{t('summary.rowErrorsHeading')}</h3>
          <ul className="import-row-errors">
            {result.rowErrors.map((rowError) => (
              <li key={rowError.line}>
                {t('summary.rowError', { line: rowError.line, message: errorMessage(t, rowError.error) })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="cluster">
        <Link className="btn btn--primary" to={ROUTES.transactions}>
          {t('actions.goToTransactions')}
        </Link>
        <Button onClick={onImportAnother}>{t('actions.another')}</Button>
      </div>
    </section>
  );
}
