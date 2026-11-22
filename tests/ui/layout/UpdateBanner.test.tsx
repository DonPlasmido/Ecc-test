import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateBanner } from '@/ui/layout/UpdateBanner';
import { offerUpdate, resetUpdateOffer } from '@/ui/pwa/updateOffer';
import { renderWithProviders, setupI18n } from '../renderWithProviders';

describe('UpdateBanner (service worker en modo prompt)', () => {
  beforeAll(() => setupI18n('es'));
  afterEach(() => {
    cleanup();
    resetUpdateOffer();
  });

  it('no muestra nada mientras no haya versión nueva', () => {
    renderWithProviders(<UpdateBanner />);
    expect(screen.queryByText(/versión nueva/i)).toBeNull();
  });

  it('avisa de forma persistente y solo recarga cuando la persona pulsa «Recargar»', async () => {
    const apply = vi.fn();
    renderWithProviders(<UpdateBanner />);

    act(() => offerUpdate(apply));

    expect(screen.getByText(/hay una versión nueva/i)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Recargar' }));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('no recarga mientras haya un diálogo abierto (p. ej. una importación en curso)', async () => {
    const apply = vi.fn();
    renderWithProviders(
      <>
        <UpdateBanner />
        <div role="dialog" aria-label="Importar" />
      </>,
    );
    act(() => offerUpdate(apply));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Recargar' }));

    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByText(/termina lo que estás haciendo/i)).toBeInTheDocument();
  });
});
