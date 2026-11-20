import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/domain/category/Category';
import type { Rule, RuleId } from '@/domain/rule/Rule';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { useNotifications } from '@/ui/components/Toast';
import { useContainer } from '@/ui/hooks/useContainer';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { ApplyRules } from './ApplyRules';
import { ConfirmDialog } from './ConfirmDialog';
import { RuleFormDialog } from './RuleFormDialog';
import { RuleItem } from './RuleItem';
import { moveRule, upsertById, type MoveDirection } from './rulesModel';
import { IconPlus } from './rulesIcons';
import { useRuleMatchCounts } from './useRuleMatchCounts';

type RulesSectionProps = {
  rules: readonly Rule[];
  categories: readonly Category[];
  onRulesChange: (update: (rules: readonly Rule[]) => readonly Rule[]) => void;
};

type Editing = { readonly rule: Rule | null } | null;

interface PendingFocus {
  readonly id: RuleId;
  readonly direction: MoveDirection;
}

const OPPOSITE: Readonly<Record<MoveDirection, MoveDirection>> = { up: 'down', down: 'up' };

/** Reglas por prioridad: alta, edición, borrado, reordenación con botones y aplicación manual. */
export function RulesSection({ rules, categories, onRulesChange }: RulesSectionProps) {
  const { t } = useTranslation('rules');
  const { manageCatalog } = useContainer();
  const { notify, announce } = useNotifications();
  const matchCount = useRuleMatchCounts(rules);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Rule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingId, setMovingId] = useState<RuleId | null>(null);
  const moveButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<PendingFocus | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Tras reordenar, el foco sigue al botón pulsado; si quedó deshabilitado (extremo), pasa al opuesto.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null) return;
    pendingFocus.current = null;
    const same = moveButtons.current.get(`${pending.id}:${pending.direction}`);
    const other = moveButtons.current.get(`${pending.id}:${OPPOSITE[pending.direction]}`);
    (same && !same.disabled ? same : other)?.focus();
  }, [rules]);

  const registerMoveButton = (id: RuleId) => (direction: MoveDirection, element: HTMLButtonElement | null) => {
    const key = `${id}:${direction}`;
    if (element) moveButtons.current.set(key, element);
    else moveButtons.current.delete(key);
  };

  const handleMove = async (rule: Rule, direction: MoveDirection) => {
    const reordered = moveRule(rules, rule.id, direction);
    if (reordered === null || movingId !== null) return;
    const previous = rules;
    pendingFocus.current = { id: rule.id, direction };
    setMovingId(rule.id);
    onRulesChange(() => reordered);
    const position = reordered.findIndex((r) => r.id === rule.id) + 1;
    try {
      const result = await manageCatalog.reorderRules(reordered.map((r) => r.id));
      if (!result.ok) throw new Error(result.error.code);
      announce(t('rules.moved', { pattern: rule.pattern, position, total: reordered.length }));
    } catch {
      pendingFocus.current = { id: rule.id, direction: OPPOSITE[direction] };
      onRulesChange(() => previous);
      notify({ tone: 'error', message: t('rules.moveError') });
    } finally {
      setMovingId(null);
    }
  };

  const handleSaved = (saved: Rule, isNew: boolean) => {
    onRulesChange((current) => upsertById(current, saved));
    setEditing(null);
    notify({ tone: 'success', message: t(isNew ? 'rules.created' : 'rules.updated', { pattern: saved.pattern }) });
  };

  const closeDelete = () => {
    setDeleting(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (deleting === null) return;
    setIsDeleting(true);
    try {
      const result = await manageCatalog.deleteRule(deleting.id);
      if (!result.ok) {
        setDeleteError(errorMessage(t, result.error));
        return;
      }
      onRulesChange((current) => current.filter((r) => r.id !== deleting.id));
      notify({ tone: 'success', message: t('rules.deleted', { pattern: deleting.pattern }) });
      closeDelete();
      // La fila desaparece: el foco pasa a un control estable.
      requestAnimationFrame(() => addButtonRef.current?.focus());
    } catch {
      setDeleteError(errorMessage(t, null));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="rules-section stack" aria-labelledby="rules-heading">
      <div className="rules-section__header">
        <h2 id="rules-heading" className="rules-section__title">
          {t('rules.heading')}
        </h2>
        <Button ref={addButtonRef} variant="primary" onClick={() => setEditing({ rule: null })}>
          <IconPlus />
          {t('rules.add')}
        </Button>
      </div>
      <p className="rules-section__lead text-muted">{t('rules.lead')}</p>
      {rules.length === 0 ? (
        <EmptyState headingLevel={3} title={t('rules.emptyTitle')} text={t('rules.emptyText')} />
      ) : (
        <ol className="rules-list" aria-label={t('rules.listLabel')}>
          {rules.map((rule, index) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              position={index + 1}
              total={rules.length}
              category={categoryById.get(rule.categoryId)}
              matchCount={matchCount(rule)}
              isMoving={movingId !== null}
              moveButtonRef={registerMoveButton(rule.id)}
              onMove={(direction) => void handleMove(rule, direction)}
              onEdit={() => setEditing({ rule })}
              onDelete={() => setDeleting(rule)}
            />
          ))}
        </ol>
      )}
      <ApplyRules />
      <RuleFormDialog
        isOpen={editing !== null}
        rule={editing?.rule ?? null}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        title={t('rules.deleteTitle')}
        description={t('rules.deleteText', { pattern: deleting?.pattern ?? '' })}
        confirmLabel={t('rules.deleteConfirm')}
        isBusy={isDeleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onClose={closeDelete}
      />
    </section>
  );
}
