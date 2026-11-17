import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/components/Button';
import { IconError } from '@/ui/components/icons';

type ErrorFallbackProps = {
  onRetry: () => void;
};

/** Mensaje traducido: no muestra detalles técnicos ni datos del extracto. */
export function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();
  return (
    <div className="empty" role="alert">
      <IconError className="icon empty__icon" />
      <h2 className="empty__title">{t('errorBoundary.title')}</h2>
      <p className="empty__text">{t('errorBoundary.text')}</p>
      <Button variant="primary" onClick={onRetry}>
        {t('errorBoundary.retry')}
      </Button>
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Al cambiar (p. ej. la ruta) se limpia el error. */
  resetKey?: string;
};

type ErrorBoundaryState = {
  error: unknown;
  resetKey: string | undefined;
};

/**
 * Límite de errores de render. Excepción deliberada a «sin componentes de clase»:
 * React 19 no tiene equivalente funcional para `componentDidCatch`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error ?? new Error('unknown render error') };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('UI render error', error, info.componentStack);
  }

  private readonly handleRetry = () => this.setState({ error: null });

  render() {
    if (this.state.error) return <ErrorFallback onRetry={this.handleRetry} />;
    return this.props.children;
  }
}
