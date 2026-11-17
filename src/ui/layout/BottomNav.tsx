import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconBudget, IconDashboard, IconImport, IconLedger, IconSettings } from '@/ui/components/icons';
import { ROUTES } from '@/ui/routes';

interface NavDestination {
  readonly to: string;
  readonly labelKey: string;
  readonly Icon: ComponentType<{ className?: string }>;
}

/** Cinco destinos fijos, mismo orden y etiquetas en todas las pantallas (a11y §9, 3.2.3). */
const DESTINATIONS: readonly NavDestination[] = [
  { to: ROUTES.dashboard, labelKey: 'nav.dashboard', Icon: IconDashboard },
  { to: ROUTES.transactions, labelKey: 'nav.transactions', Icon: IconLedger },
  { to: ROUTES.import, labelKey: 'nav.import', Icon: IconImport },
  { to: ROUTES.budgets, labelKey: 'nav.budgets', Icon: IconBudget },
  { to: ROUTES.settings, labelKey: 'nav.settings', Icon: IconSettings },
];

/** Navegación inferior: enlaces reales (`<a href="#/…">`) con texto visible y `aria-current="page"`. */
export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')}>
      {DESTINATIONS.map(({ to, labelKey, Icon }) => (
        <NavLink key={to} to={to} end={to === ROUTES.dashboard} className="bottom-nav__item">
          <Icon />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
