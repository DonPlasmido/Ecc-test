import type { Rule, RuleId } from '@/domain/rule/Rule';

export type MoveDirection = 'up' | 'down';

/**
 * Nuevo orden tras mover una regla un puesto (prioridades 1…n como hará `reorderRules`),
 * o `null` si no se puede mover (no existe o ya está en el extremo).
 */
export function moveRule(rules: readonly Rule[], id: RuleId, direction: MoveDirection): readonly Rule[] | null {
  const from = rules.findIndex((rule) => rule.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= rules.length) return null;
  const reordered = rules.map((rule, index) => {
    if (index === from) return rules[to] as Rule;
    if (index === to) return rules[from] as Rule;
    return rule;
  });
  return reordered.map((rule, index) => ({ ...rule, priority: index + 1 }));
}

/** Inserta o sustituye una regla (por `id`). */
export function upsertById<T extends { readonly id: string }>(items: readonly T[], item: T): readonly T[] {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];
}
