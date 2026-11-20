import { useTranslation } from 'react-i18next';
import type { AmountConvention, ColumnMapping, ColumnRole } from '@/domain/import/ColumnMapping';
import type { RawTable } from '@/domain/import/RawTable';
import { Select, type SelectOption } from '@/ui/components/Select';
import { AMOUNT_CONVENTIONS, COLUMN_ROLES, assignRole, sourceColumns, withConvention, type SourceColumn } from './importModel';

/** Longitud máxima del ejemplo bajo cada `<select>` (los conceptos pueden ser muy largos). */
const MAX_EXAMPLE_LENGTH = 40;

type MappingEditorProps = {
  table: RawTable;
  mapping: ColumnMapping;
  isDisabled: boolean;
  onChange: (mapping: ColumnMapping) => void;
};

function shorten(text: string): string {
  return text.length > MAX_EXAMPLE_LENGTH ? `${text.slice(0, MAX_EXAMPLE_LENGTH - 1)}…` : text;
}

/**
 * Un `<select>` nativo por columna del archivo con etiqueta única «Columna N (cabecera): usar como» y la
 * convención de signo (a11y §1.2). Cambiar un valor no envía nada: solo recalcula la vista previa.
 */
export function MappingEditor({ table, mapping, isDisabled, onChange }: MappingEditorProps) {
  const { t } = useTranslation('import');
  const roleOptions: readonly SelectOption<ColumnRole>[] = COLUMN_ROLES.map((role) => ({
    value: role,
    label: t(`mapping.roles.${role}`),
  }));
  const conventionOptions: readonly SelectOption<AmountConvention>[] = AMOUNT_CONVENTIONS.map((convention) => ({
    value: convention,
    label: t(`mapping.convention.${convention}`),
  }));

  const labelOf = (column: SourceColumn) =>
    column.header === ''
      ? t('mapping.columnLabelNoHeader', { number: column.index + 1 })
      : t('mapping.columnLabel', { number: column.index + 1, header: column.header });

  return (
    <section className="stack" aria-labelledby="import-mapping-heading">
      <div className="stack stack--tight">
        <h3 className="import-subheading" id="import-mapping-heading">
          {t('mapping.heading')}
        </h3>
        <p className="text-muted text-sm">{t('mapping.intro')}</p>
      </div>
      <Select
        label={t('mapping.convention.label')}
        hint={t('mapping.convention.hint')}
        value={mapping.amountConvention}
        options={conventionOptions}
        isDisabled={isDisabled}
        onChange={(convention) => onChange(withConvention(mapping, convention))}
      />
      <div className="import-columns">
        {sourceColumns(table, mapping).map((column) => (
          <Select
            key={column.index}
            id={`import-column-${column.index}`}
            label={labelOf(column)}
            hint={column.example === '' ? t('mapping.noExample') : t('mapping.example', { value: shorten(column.example) })}
            value={mapping.columns[column.index] ?? 'ignore'}
            options={roleOptions}
            isDisabled={isDisabled}
            onChange={(role) => onChange(assignRole(mapping, column.index, role))}
          />
        ))}
      </div>
    </section>
  );
}
