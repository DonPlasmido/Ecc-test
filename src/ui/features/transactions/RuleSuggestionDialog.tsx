import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { RuleSuggestion } from '@/domain/rule/ruleSuggestion';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Field } from '@/ui/components/Field';
import { formatInteger } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';
import { useDebouncedValue } from './useTransactionFilters';

/** Mínimo de caracteres del patrón (AC-020; el caso de uso lo vuelve a validar). */
const MIN_PATTERN_LENGTH = 2;
const PREVIEW_DEBOUNCE_MS = 300;

/** Propuesta devuelta por `LearnRuleFromCorrection.correct`. */
export interface RuleProposal {
  readonly suggestion: RuleSuggestion;
  readonly affectedCount: number;
}

type RuleSuggestionDialogProps = {
  proposal: RuleProposal;
  categoryLabel: string;
  onClose: () => void;
  /** Crea la regla; devuelve un error ya traducido o `null`. */
  onAccept: (pattern: string, applyToExisting: boolean) => Promise<string | null>;
  /** Nº aproximado de movimientos cuyo concepto contiene `pattern` (vista previa del patrón editado). */
  countContaining: (pattern: string) => Promise<number>;
};

type Preview = { readonly pattern: string; readonly count: number };

/**
 * «¿Crear regla?» (a11y §4, AC-019): patrón editable, vista previa del alcance y aceptar / «Ahora no».
 * Nunca crea nada sin confirmación; Escape equivale a «Ahora no».
 */
export function RuleSuggestionDialog({ proposal, categoryLabel, onClose, onAccept, countContaining }: RuleSuggestionDialogProps) {
  const { t } = useTranslation('transactions');
  const language = useLanguage();
  const patternRef = useRef<HTMLInputElement>(null);
  const [pattern, setPattern] = useState(proposal.suggestion.pattern);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const trimmed = pattern.trim();
  const debouncedPattern = useDebouncedValue(trimmed, PREVIEW_DEBOUNCE_MS);
  const isOriginal = trimmed === proposal.suggestion.pattern;
  const isTooShort = trimmed.length < MIN_PATTERN_LENGTH;

  useEffect(() => {
    if (debouncedPattern === proposal.suggestion.pattern || debouncedPattern.length < MIN_PATTERN_LENGTH) return undefined;
    let isCurrent = true;
    countContaining(debouncedPattern).then(
      (count) => {
        if (isCurrent) setPreview({ pattern: debouncedPattern, count });
      },
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [debouncedPattern, proposal.suggestion.pattern, countContaining]);

  const previewText = (() => {
    if (isTooShort) return null;
    if (isOriginal) {
      return t('rule.affects', { count: proposal.affectedCount, formatted: formatInteger(proposal.affectedCount, language) });
    }
    if (preview?.pattern !== trimmed) return t('rule.previewLoading');
    return t('rule.affectsApprox', { count: preview.count, formatted: formatInteger(preview.count, language) });
  })();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (isTooShort) {
      setError(t('rule.patternTooShort'));
      patternRef.current?.focus();
      return;
    }
    setIsSaving(true);
    const failure = await onAccept(trimmed, applyToExisting);
    setIsSaving(false);
    setError(failure);
  };

  const footer = (
    <>
      <Button variant="quiet" onClick={onClose}>
        {t('rule.dismiss')}
      </Button>
      <Button variant="primary" type="submit" form="tx-rule-form" isBusy={isSaving}>
        {t('rule.create')}
      </Button>
    </>
  );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('rule.title')}
      description={t('rule.description', { pattern: trimmed || proposal.suggestion.pattern, category: categoryLabel })}
      footer={footer}
      initialFocusRef={patternRef}
    >
      <form id="tx-rule-form" className="stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <Field label={t('rule.pattern')} hint={t('rule.patternHint')} error={error} isRequired>
          {(control) => (
            <input
              {...control}
              ref={patternRef}
              className="input"
              type="text"
              autoComplete="off"
              value={pattern}
              onChange={(event) => {
                setPattern(event.target.value);
                setError(null);
              }}
            />
          )}
        </Field>
        <p className="tx-rule__preview tabular" aria-live="polite">
          {previewText}
        </p>
        <label className="check">
          <input type="checkbox" checked={applyToExisting} onChange={(event) => setApplyToExisting(event.target.checked)} />
          {t('rule.applyExisting')}
        </label>
      </form>
    </Dialog>
  );
}
