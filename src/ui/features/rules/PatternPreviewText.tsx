import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/ui/components/Toast';
import type { MatchCriteria } from './ruleMatches';
import { usePatternPreview, type PatternPreview } from './usePatternPreview';

type PatternPreviewTextProps = {
  criteria: MatchCriteria;
};

/**
 * Coincidencias del patrón que se está escribiendo. El recuento se anuncia por la región viva global
 * (a11y T16) solo cuando cambia, no en cada pulsación.
 */
export function PatternPreviewText({ criteria }: PatternPreviewTextProps) {
  const { t } = useTranslation('rules');
  const { announce } = useNotifications();
  const preview = usePatternPreview(criteria);
  const count = preview.status === 'ready' ? preview.count : null;

  useEffect(() => {
    if (count !== null) announce(t('preview.matches', { count }));
  }, [count, announce, t]);

  return (
    <div className="rules-preview" aria-busy={preview.status === 'loading' || undefined}>
      <p className="rules-preview__title">{previewTitle(preview.status, count, t)}</p>
      {preview.status === 'ready' && preview.samples.length > 0 ? (
        <ul className="rules-preview__samples" aria-label={t('preview.samplesLabel')}>
          {preview.samples.map((sample, index) => (
            // Los conceptos pueden repetirse: la posición forma parte de la clave (lista estática).
            <li key={`${index}-${sample}`} className="truncate">
              {sample}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function previewTitle(status: PatternPreview['status'], count: number | null, t: TFunction): string {
  switch (status) {
    case 'tooShort':
      return t('preview.tooShort');
    case 'loading':
      return t('preview.loading');
    case 'error':
      return t('preview.error');
    case 'ready':
      return t('preview.matches', { count: count ?? 0 });
  }
}
