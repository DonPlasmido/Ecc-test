import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/domain/category/Category';
import type { Rule } from '@/domain/rule/Rule';
import { Button } from '@/ui/components/Button';
import { CategoryChip } from '@/ui/components/CategoryChip';
import type { MoveDirection } from './rulesModel';
import { IconArrowDown, IconArrowUp } from './rulesIcons';

type RuleItemProps = {
  rule: Rule;
  position: number;
  total: number;
  category: Category | undefined;
  /** `undefined` = calculando; `null` = no disponible. */
  matchCount: number | null | undefined;
  isMoving: boolean;
  /** Registra los botones de mover para devolverles el foco tras reordenar. */
  moveButtonRef: (direction: MoveDirection, element: HTMLButtonElement | null) => void;
  onMove: (direction: MoveDirection) => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Fila de la lista de reglas: prioridad, condición, categoría destino, coincidencias y acciones. */
export function RuleItem({
  rule,
  position,
  total,
  category,
  matchCount,
  isMoving,
  moveButtonRef,
  onMove,
  onEdit,
  onDelete,
}: RuleItemProps) {
  const { t } = useTranslation('rules');
  const condition = t(`summary.${rule.operator}`, { pattern: rule.pattern });
  const names = { pattern: rule.pattern };

  return (
    <li className="rules-item" data-disabled={!rule.enabled || undefined}>
      <span className="rules-item__position tabular" aria-hidden="true">
        {position}
      </span>
      <div className="rules-item__body">
        <p className="rules-item__condition">
          <span className="visually-hidden">{t('rules.position', { position, total })} </span>
          {condition}
        </p>
        <p className="rules-item__target">
          <span className="text-muted">{t('rules.assigns')}</span>{' '}
          {category ? <CategoryChip category={category} /> : <span>{t('rules.missingCategory')}</span>}
        </p>
        <p className="rules-item__meta text-sm text-muted">
          <span className="tabular">{matchLabel(matchCount, t)}</span>
          {rule.amountSign === 'any' ? null : <span>{t(`sign.${rule.amountSign}`)}</span>}
          {rule.origin === 'learned' ? <span>{t('rules.learned')}</span> : null}
          {rule.enabled ? null : <span className="rules-item__off">{t('rules.disabled')}</span>}
        </p>
      </div>
      <div className="rules-item__actions">
        <div className="rules-item__move">
          <Button
            ref={(element) => moveButtonRef('up', element)}
            variant="quiet"
            isIconOnly
            disabled={position === 1}
            isBusy={isMoving}
            aria-label={t('rules.moveUp', names)}
            onClick={() => onMove('up')}
          >
            <IconArrowUp />
          </Button>
          <Button
            ref={(element) => moveButtonRef('down', element)}
            variant="quiet"
            isIconOnly
            disabled={position === total}
            isBusy={isMoving}
            aria-label={t('rules.moveDown', names)}
            onClick={() => onMove('down')}
          >
            <IconArrowDown />
          </Button>
        </div>
        <Button variant="quiet" isSmall aria-label={t('rules.edit', names)} onClick={onEdit}>
          {t('actions.edit')}
        </Button>
        <Button variant="quiet" isSmall aria-label={t('rules.delete', names)} onClick={onDelete}>
          {t('actions.delete')}
        </Button>
      </div>
    </li>
  );
}

function matchLabel(count: number | null | undefined, t: TFunction): string {
  if (count === undefined) return t('rules.counting');
  if (count === null) return t('rules.countUnavailable');
  return t('rules.matches', { count });
}
