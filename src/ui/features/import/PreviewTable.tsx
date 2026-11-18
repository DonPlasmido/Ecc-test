import { useTranslation } from 'react-i18next';
import { DateText } from '@/ui/components/DateText';
import { IconCheck, IconError, IconWarning } from '@/ui/components/icons';
import { MoneyText } from '@/ui/components/MoneyText';
import { errorMessage } from '@/ui/i18n/errorMessage';
import type { PreviewModel, PreviewRow } from './importModel';

const CAPTION_ID = 'import-preview-caption';

function RowStatus({ row }: { row: PreviewRow }) {
  const { t } = useTranslation('import');
  if (row.kind === 'error') {
    return (
      <span className="import-status import-status--error">
        <IconError />
        <span>
          {t('table.error')}: {errorMessage(t, row.error)}
        </span>
      </span>
    );
  }
  if (row.warning) {
    return (
      <span className="import-status import-status--warning">
        <IconWarning />
        <span>{t('table.warning')}</span>
      </span>
    );
  }
  return (
    <span className="import-status import-status--ok">
      <IconCheck />
      <span>{t('table.valid')}</span>
    </span>
  );
}

function ValidCells({ row }: { row: Extract<PreviewRow, { kind: 'valid' }> }) {
  return (
    <>
      <td className="table__cell">
        <DateText value={row.date} />
      </td>
      <td className="table__cell import-preview__desc">{row.description}</td>
      <td className="table__cell table__cell--num">
        <MoneyText value={row.amount} hasKindLabel />
      </td>
      <td className="table__cell table__cell--num">{row.balance ? <MoneyText value={row.balance} isUnsigned /> : null}</td>
    </>
  );
}

/**
 * Tabla semántica con las primeras filas ya normalizadas (a11y §1.3): `<caption>`, cabeceras con `scope`,
 * contenedor desplazable con foco y estado de cada fila con icono + texto (nunca solo color).
 * Los textos del extracto se pintan como texto (datos no confiables).
 */
export function PreviewTable({ model }: { model: PreviewModel }) {
  const { t } = useTranslation('import');
  return (
    <div className="stack stack--tight">
      <p className="text-sm text-muted">{t('table.counts', { valid: model.validCount, errors: model.errorCount })}</p>
      {/* Región desplazable con teclado: única excepción al reflow (a11y §1.3, WCAG 1.4.10). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="table-wrap import-preview" role="region" aria-labelledby={CAPTION_ID} tabIndex={0}>
        <table className="table">
          <caption id={CAPTION_ID}>{t('table.caption', { count: model.rows.length })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('table.line')}</th>
              <th scope="col">{t('table.date')}</th>
              <th scope="col">{t('table.description')}</th>
              <th scope="col" className="table__cell--num">
                {t('table.amount')}
              </th>
              <th scope="col" className="table__cell--num">
                {t('table.balance')}
              </th>
              <th scope="col">{t('table.status')}</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.line} className="table__row" data-status={row.kind}>
                <td className="table__cell tabular">{row.line}</td>
                {row.kind === 'valid' ? <ValidCells row={row} /> : <td className="table__cell" colSpan={4} />}
                <td className="table__cell">
                  <RowStatus row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
