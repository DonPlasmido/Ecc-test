import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';

export interface ChartTableRow {
  readonly key: string;
  readonly header: ReactNode;
  readonly cells: readonly ReactNode[];
}

type ChartTableProps = {
  caption: string;
  /** Cabecera de la primera columna (periodo, categoría…). */
  rowHeader: string;
  columns: readonly string[];
  rows: readonly ChartTableRow[];
};

/**
 * Tabla equivalente al gráfico (ADR-0011, a11y §6): botón «Ver como tabla» con
 * `aria-expanded`/`aria-controls`; el foco se queda en el botón.
 */
export function ChartTable({ caption, rowHeader, columns, rows }: ChartTableProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const tableId = useId();

  return (
    <div className="chart__table stack stack--tight">
      <Button isSmall aria-expanded={isOpen} aria-controls={tableId} onClick={() => setIsOpen((open) => !open)}>
        {isOpen ? t('actions.hideTable') : t('actions.showTable')}
      </Button>
      <div id={tableId} className="table-wrap" hidden={!isOpen}>
        <table className="table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{rowHeader}</th>
              {columns.map((column) => (
                <th key={column} scope="col" className="num">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.header}</th>
                {row.cells.map((cell, index) => (
                  <td key={columns[index] ?? index} className="num">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
