import { useState, type ChangeEvent, type DragEvent, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { IconImport } from '@/ui/components/icons';
import { problemMessage } from './problemMessage';
import type { ImportProblem } from './useImportFlow';

/** `accept` del selector: CSV y XLSX (el `.xls` antiguo no se admite). */
const ACCEPTED_TYPES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const INPUT_ID = 'import-file';

type FilePickerProps = {
  isReading: boolean;
  problem: ImportProblem | null;
  onFile: (file: File) => void;
  onSample: () => void;
  inputRef: Ref<HTMLInputElement>;
};

/**
 * Selector de archivo accesible (a11y §1.1): `<input type="file">` nativo con etiqueta visible, ayuda y error
 * enlazados. Arrastrar y soltar es una mejora en escritorio, nunca la única vía.
 */
export function FilePicker({ isReading, problem, onFile, onSample, inputRef }: FilePickerProps) {
  const { t } = useTranslation('import');
  const [isDragOver, setIsDragOver] = useState(false);
  const hintId = `${INPUT_ID}-hint`;
  const errorId = `${INPUT_ID}-error`;
  const describedBy = problem ? `${hintId} ${errorId}` : hintId;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se vacía para que volver a elegir el mismo archivo dispare `change` otra vez.
    event.target.value = '';
    if (file) onFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !isReading) onFile(file);
  };

  return (
    <section className="card import-picker" aria-labelledby="import-file-heading" aria-busy={isReading || undefined}>
      <h2 className="card__title" id="import-file-heading">
        {t('file.heading')}
      </h2>
      <div
        className="import-drop"
        data-drag-over={isDragOver || undefined}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <IconImport className="icon import-drop__icon" />
        <label className="field__label" htmlFor={INPUT_ID}>
          {t('file.label')}
        </label>
        <input
          ref={inputRef}
          id={INPUT_ID}
          className="import-drop__input"
          type="file"
          accept={ACCEPTED_TYPES}
          aria-describedby={describedBy}
          aria-invalid={problem ? true : undefined}
          disabled={isReading}
          onChange={handleChange}
        />
        <p className="field__hint" id={hintId}>
          {t('file.hint')} <span className="import-drop__drag">{isDragOver ? t('file.dropActive') : t('file.drop')}</span>
        </p>
      </div>
      {problem ? (
        <p className="field__error" id={errorId} role="alert">
          {problemMessage(t, problem)}
        </p>
      ) : null}
      {isReading ? (
        <p className="import-reading" role="status">
          <span className="import-spinner" aria-hidden="true" />
          {t('file.reading')}
        </p>
      ) : null}
      <div className="import-sample">
        <Button variant="quiet" onClick={onSample} isBusy={isReading} aria-describedby="import-sample-hint">
          {t('file.sample')}
        </Button>
        <p className="text-muted text-sm" id="import-sample-hint">
          {t('file.sampleHint')}
        </p>
      </div>
    </section>
  );
}
