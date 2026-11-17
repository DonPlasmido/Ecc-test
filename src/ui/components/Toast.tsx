import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { IconCheck, IconClose, IconError, IconInfo, IconWarning } from './icons';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  readonly label: string;
  readonly onAction: () => void;
}

export interface ToastInput {
  readonly message: string;
  readonly tone?: ToastTone;
  /** Acción opcional («Deshacer»); con acción el aviso dura ≥ 10 s (a11y §8). */
  readonly action?: ToastAction;
  readonly durationMs?: number;
}

interface ToastItemData extends Required<Omit<ToastInput, 'action'>> {
  readonly id: number;
  readonly action: ToastAction | undefined;
  readonly isLeaving: boolean;
}

export type AnnouncePriority = 'polite' | 'assertive';

interface NotificationsValue {
  /** Muestra un aviso visible (también anunciado: la región es `aria-live="polite"`). */
  readonly notify: (toast: ToastInput) => void;
  /** Solo para lectores de pantalla (filtros, cambios de idioma…). */
  readonly announce: (message: string, priority?: AnnouncePriority) => void;
}

export const TOAST_DURATION_MS = 6_000;
export const TOAST_WITH_ACTION_DURATION_MS = 10_000;
export const TOAST_EXIT_MS = 150;
export const MAX_VISIBLE_TOASTS = 3;
/** Pausa entre vaciar y reescribir la región para que se repita un mismo texto. */
const ANNOUNCE_RESET_MS = 50;

const NotificationsContext = createContext<NotificationsValue | null>(null);

const TONE_ICONS = { info: IconInfo, success: IconCheck, warning: IconWarning, error: IconError } as const;

type ToastItemProps = {
  toast: ToastItemData;
  onDismiss: (id: number) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPaused = isHovered || isFocused;
  const Icon = TONE_ICONS[toast.tone];

  useEffect(() => {
    if (isPaused || toast.isLeaving) return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [isPaused, toast.isLeaving, toast.durationMs, toast.id, onDismiss]);

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onDismiss(toast.id);
  };

  return (
    <div
      className={`toast toast--${toast.tone}`}
      data-leaving={toast.isLeaving || undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <span className="toast__icon">
        <Icon />
      </span>
      <p className="toast__body">
        <span className="visually-hidden">{`${t(`toast.${toast.tone}`)} `}</span>
        {toast.message}
      </p>
      {toast.action ? (
        <Button
          variant="quiet"
          isSmall
          onKeyDown={handleEscape}
          onClick={() => {
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      ) : null}
      <Button
        variant="quiet"
        isIconOnly
        aria-label={t('actions.dismiss')}
        onKeyDown={handleEscape}
        onClick={() => onDismiss(toast.id)}
      >
        <IconClose />
      </Button>
    </div>
  );
}

/**
 * Regiones vivas globales y persistentes (a11y §8 y §13): se montan una vez en la raíz,
 * nunca con su contenido, y solo se reescribe el texto.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<readonly ToastItemData[]>([]);
  const [messages, setMessages] = useState<Readonly<Record<AnnouncePriority, string>>>({ polite: '', assertive: '' });
  const nextId = useRef(1);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, isLeaving: true } : toast)));
      later(() => setToasts((current) => current.filter((toast) => toast.id !== id)), TOAST_EXIT_MS);
    },
    [later],
  );

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const durationMs = input.durationMs ?? (input.action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS);
    const toast: ToastItemData = {
      id,
      message: input.message,
      tone: input.tone ?? 'info',
      action: input.action,
      durationMs: input.action ? Math.max(durationMs, TOAST_WITH_ACTION_DURATION_MS) : durationMs,
      isLeaving: false,
    };
    setToasts((current) => (current.some((item) => item.message === toast.message && !item.isLeaving) ? current : [...current, toast]));
  }, []);

  const announce = useCallback(
    (message: string, priority: AnnouncePriority = 'polite') => {
      setMessages((current) => ({ ...current, [priority]: '' }));
      later(() => setMessages((current) => ({ ...current, [priority]: message })), ANNOUNCE_RESET_MS);
    },
    [later],
  );

  const value = useMemo(() => ({ notify, announce }), [notify, announce]);
  const visible = toasts.slice(0, MAX_VISIBLE_TOASTS);

  return (
    <NotificationsContext value={value}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {messages.polite}
      </div>
      <div className="visually-hidden" role="alert" aria-atomic="true">
        {messages.assertive}
      </div>
      <section className="toast-region" aria-label={t('toast.region')} aria-live="polite" aria-relevant="additions text">
        {visible.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </NotificationsContext>
  );
}

export function useNotifications(): NotificationsValue {
  const value = use(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return value;
}
