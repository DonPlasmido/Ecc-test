import { useRef, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { renderWithProviders, setupI18n } from './renderWithProviders';

beforeEach(async () => {
  await setupI18n('es');
});

function Harness({ withInitialFocus = false }: { withInitialFocus?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Crear regla</Button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Crear regla de categorización"
        description="Afectaría a 37 movimientos"
        initialFocusRef={withInitialFocus ? inputRef : undefined}
        footer={<Button onClick={() => setIsOpen(false)}>Ahora no</Button>}
      >
        <label htmlFor="pattern">Texto que debe contener</label>
        <input id="pattern" ref={inputRef} />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('opens with an accessible name and description, focusing the title by default', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Crear regla' }));

    const dialog = screen.getByRole('dialog', { name: 'Crear regla de categorización' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('Afectaría a 37 movimientos');
    expect(screen.getByRole('heading', { name: 'Crear regla de categorización' })).toHaveFocus();
  });

  it('focuses the requested element and returns focus to the opener on close', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness withInitialFocus />);
    const opener = screen.getByRole('button', { name: 'Crear regla' });

    await user.click(opener);
    expect(screen.getByLabelText('Texto que debe contener')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on Escape (cancel event) and via the translated close button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const opener = screen.getByRole('button', { name: 'Crear regla' });

    await user.click(opener);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
