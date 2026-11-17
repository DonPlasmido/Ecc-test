import type { ReactNode } from 'react';
import { IconEmpty } from './icons';

type EmptyStateProps = {
  title: string;
  text?: ReactNode;
  /** Siguiente acción (p. ej. botón «Importar extracto»). */
  action?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
};

/** Estado vacío: explica y ofrece la siguiente acción (DESIGN.md §1, a11y §14). */
export function EmptyState({ title, text, action, icon, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="empty">
      {icon ?? <IconEmpty className="icon empty__icon" />}
      <Heading className="empty__title">{title}</Heading>
      {text ? <p className="empty__text">{text}</p> : null}
      {action}
    </div>
  );
}
