import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { TOAST_DURATION_MS, TOAST_EXIT_MS, useNotifications, type ToastInput } from '@/ui/components/Toast';
import { renderWithProviders, setupI18n } from './renderWithProviders';

function Trigger({ toast, announcement }: { toast?: ToastInput; announcement?: string }) {
  const { notify, announce } = useNotifications();
  return (
    <>
      {toast ? <Button onClick={() => notify(toast)}>avisar</Button> : null}
      {announcement ? <Button onClick={() => announce(announcement)}>anunciar</Button> : null}
    </>
  );
}

beforeEach(async () => {
  await setupI18n('es');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Notifications', () => {
  it('mounts persistent live regions before any message', () => {
    renderWithProviders(<Trigger toast={{ message: 'x' }} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
    expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveAttribute('aria-live', 'polite');
  });

  it('shows a toast with a textual tone prefix and auto-dismisses it', () => {
    renderWithProviders(<Trigger toast={{ message: 'Copia guardada', tone: 'success' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    const region = screen.getByRole('region', { name: 'Notificaciones' });
    expect(region).toHaveTextContent('Hecho: Copia guardada');

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS + TOAST_EXIT_MS));
    expect(region).toBeEmptyDOMElement();
  });

  it('does not dismiss while hovered and closes with the dismiss button', () => {
    renderWithProviders(<Trigger toast={{ message: 'Importado', action: { label: 'Deshacer', onAction: vi.fn() } }} />);

    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    const toast = screen.getByText('Importado').closest('.toast');
    if (!toast) throw new Error('toast not rendered');
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Importado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));
    act(() => vi.advanceTimersByTime(TOAST_EXIT_MS));
    expect(screen.queryByText('Importado')).not.toBeInTheDocument();
  });

  it('runs the toast action', () => {
    const onAction = vi.fn();
    renderWithProviders(<Trigger toast={{ message: 'Categoría cambiada', action: { label: 'Deshacer', onAction } }} />);

    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('announces screen-reader-only messages in the status region', () => {
    renderWithProviders(<Trigger announcement="1.234 movimientos encontrados" />);

    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }));
    act(() => vi.advanceTimersByTime(100));

    expect(screen.getByRole('status')).toHaveTextContent('1.234 movimientos encontrados');
  });

  it('keeps live regions and toasts inside the open modal dialog so they are not inert', () => {
    renderWithProviders(
      <>
        <Trigger toast={{ message: 'Copia guardada' }} announcement="Hecho" />
        <Dialog isOpen onClose={() => undefined} title="Confirmar">
          <p>contenido</p>
        </Dialog>
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'avisar' }));
    fireEvent.click(screen.getByRole('button', { name: 'anunciar' }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).toContainElement(screen.getByRole('status'));
    expect(dialog).toContainElement(screen.getByRole('region', { name: 'Notificaciones' }));
    expect(screen.getByRole('status')).toHaveTextContent('Hecho');
    expect(dialog).toContainElement(screen.getByText('Copia guardada'));
  });

  it('returns the regions to the page when the dialog closes', () => {
    const { rerender } = renderWithProviders(
      <Dialog isOpen onClose={() => undefined} title="Confirmar" />,
    );
    rerender(<Dialog isOpen={false} onClose={() => undefined} title="Confirmar" />);

    expect(document.querySelector('dialog')).not.toContainElement(screen.getByRole('status'));
  });
});
