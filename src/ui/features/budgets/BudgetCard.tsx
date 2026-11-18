import { useTranslation } from 'react-i18next';
import type { BudgetEvaluation } from '@/application/ports/inbound/EvaluateBudgets';
import { BudgetProgressBar } from '@/ui/components/BudgetProgressBar';
import { Button } from '@/ui/components/Button';
import { formatMoney } from '@/ui/i18n/format';
import { useLanguage } from '@/ui/i18n/useLanguage';

type BudgetCardProps = {
  evaluation: BudgetEvaluation;
  categoryName: string;
  onEdit: (evaluation: BudgetEvaluation) => void;
  onDelete: (evaluation: BudgetEvaluation) => void;
};

/** Fila de la lista: barra con estado (texto + icono + color), restante y acciones. */
export function BudgetCard({ evaluation, categoryName, onEdit, onDelete }: BudgetCardProps) {
  const { t } = useTranslation('budgets');
  const language = useLanguage();
  const remainingCents = evaluation.remaining.cents;
  const amount = formatMoney(Math.abs(remainingCents), language, false);
  const remainingText = remainingCents < 0 ? t('list.overBy', { amount }) : t('list.remaining', { amount });

  return (
    <li className="budgets-card" data-status={evaluation.status}>
      <BudgetProgressBar
        label={categoryName}
        spent={evaluation.spent}
        limit={evaluation.limit}
        usedBasisPoints={evaluation.usedBasisPoints}
        status={evaluation.status}
      />
      <div className="budgets-card__footer">
        <p className="budgets-card__remaining">{remainingText}</p>
        <div className="budgets-card__actions">
          <Button
            variant="quiet"
            isSmall
            aria-label={t('list.editLabel', { category: categoryName })}
            onClick={() => onEdit(evaluation)}
          >
            {t('list.edit')}
          </Button>
          <Button
            variant="quiet"
            isSmall
            className="budgets-card__delete"
            aria-label={t('list.deleteLabel', { category: categoryName })}
            onClick={() => onDelete(evaluation)}
          >
            {t('list.delete')}
          </Button>
        </div>
      </div>
    </li>
  );
}
