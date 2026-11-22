import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetProgressBar } from '@/ui/components/BudgetProgressBar';
import { Button } from '@/ui/components/Button';
import { CategoryChip } from '@/ui/components/CategoryChip';
import { DateText } from '@/ui/components/DateText';
import { EmptyState } from '@/ui/components/EmptyState';
import { Field } from '@/ui/components/Field';
import { MoneyText } from '@/ui/components/MoneyText';
import { Select } from '@/ui/components/Select';
import { Skeleton } from '@/ui/components/Skeleton';
import { customCategory, groceries, money } from './fixtures';
import { renderWithProviders, setupI18n } from './renderWithProviders';

beforeEach(async () => {
  await setupI18n('es');
});

afterEach(async () => {
  await setupI18n('es');
});

describe('Button', () => {
  it('defaults to type=button and calls onClick', async () => {
    const onClick = vi.fn();
    renderWithProviders(<Button onClick={onClick}>Guardar</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks busy state with aria-busy/aria-disabled and ignores clicks while focusable', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button variant="primary" isBusy onClick={onClick}>
        Cifrando
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Cifrando' });

    await userEvent.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveClass('btn', 'btn--primary');
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('links label, hint and error to the control', () => {
    renderWithProviders(
      <Field label="Contraseña" hint="Mínimo 12 caracteres" error="Demasiado corta" isRequired>
        {(control) => <input className="input" type="password" {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText(/Contraseña/);
    expect(input).toHaveAccessibleDescription('Mínimo 12 caracteres Demasiado corta');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(screen.getByText('Demasiado corta')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('(obligatorio)')).toBeInTheDocument();
  });

  it('has no aria-invalid nor alert without error', () => {
    const { container } = renderWithProviders(
      <Field label="Nombre">{(control) => <input className="input" {...control} />}</Field>,
    );

    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-describedby');
    expect(container.querySelector('.field__error')).toBeNull();
  });
});

describe('Select', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <Select
        label="Opción"
        value={value}
        onChange={setValue}
        options={[
          { value: 'a', label: 'Alfa' },
          { value: 'b', label: 'Beta', lang: 'en' },
        ]}
      />
    );
  }

  it('is a labelled native combobox and reports typed values', async () => {
    renderWithProviders(<Harness />);
    const select = screen.getByRole('combobox', { name: 'Opción' });

    await userEvent.selectOptions(select, 'Beta');

    expect(select).toHaveValue('b');
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('lang', 'en');
  });
});

describe('MoneyText', () => {
  it('shows the sign and a hidden kind label, not only colour', () => {
    renderWithProviders(<MoneyText value={money(-4230)} hasKindLabel />);

    const amount = screen.getByText(/42,30/);
    expect(amount.textContent?.replace(/\s/g, ' ')).toBe('-42,30 € (gasto)');
    expect(amount).toHaveClass('amount', 'amount--negative');
  });

  it('renders zero without sign in muted tone', () => {
    renderWithProviders(<MoneyText value={money(0)} hasKindLabel />);

    expect(screen.getByText(/0,00/)).toHaveClass('amount--zero');
    expect(screen.queryByText(/gasto|ingreso/)).not.toBeInTheDocument();
  });

  it('follows the active language', async () => {
    await setupI18n('en');
    renderWithProviders(<MoneyText value={money(150_000)} />);

    expect(screen.getByText('+€1,500.00')).toHaveClass('amount--positive');
  });
});

describe('DateText', () => {
  it('renders a <time> with the ISO value and a localised text', () => {
    renderWithProviders(<DateText value="2026-03-15" />);

    const time = screen.getByText('15/03/2026');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('datetime', '2026-03-15');
  });

  it('formats year-months', () => {
    renderWithProviders(<DateText value="2026-03" dateStyle="long" />);

    expect(screen.getByText(/marzo.*2026/)).toBeInTheDocument();
  });
});

describe('CategoryChip', () => {
  it('translates default categories through nameKey and keeps a colour class', () => {
    renderWithProviders(<CategoryChip category={groceries} />);

    expect(screen.getByText('Supermercado').closest('.chip')).toHaveClass('chip--cat-1');
  });

  it('uses the user name for edited categories and works as a toggle', async () => {
    const onToggle = vi.fn();
    renderWithProviders(<CategoryChip category={customCategory} onToggle={onToggle} isPressed />);
    const chip = screen.getByRole('button', { name: 'Mascotas' });

    await userEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe('BudgetProgressBar', () => {
  it('states the status with words and amounts, bar decorative', () => {
    renderWithProviders(
      <BudgetProgressBar label="Supermercado" spent={money(54_000)} limit={money(40_000)} usedBasisPoints={13_500} status="over" />,
    );

    const group = screen.getByRole('group', { name: 'Supermercado' });
    expect(group).toHaveAttribute('data-status', 'over');
    expect(screen.getByText('Superado')).toBeInTheDocument();
    expect(screen.getByText(/540,00 € de 400,00 €/)).toBeInTheDocument();
    expect(screen.getByText(/135\s%/)).toBeInTheDocument();
    expect(group.querySelector('.budget-meter__track')).toHaveAttribute('aria-hidden', 'true');
  });

  it('never shows 100 % before the limit is exceeded, and rounds an overspend up', () => {
    const { unmount } = renderWithProviders(
      <BudgetProgressBar label="A" spent={money(79_999)} limit={money(80_000)} usedBasisPoints={9_999} status="near" />,
    );
    expect(screen.getByText(/99\s%/)).toBeInTheDocument();
    unmount();
    renderWithProviders(
      <BudgetProgressBar label="B" spent={money(80_000)} limit={money(79_999)} usedBasisPoints={10_000} status="over" />,
    );
    expect(screen.getByText(/101\s%/)).toBeInTheDocument();
  });

  it('uses the near status wording', () => {
    renderWithProviders(
      <BudgetProgressBar label="Ocio" spent={money(8_000)} limit={money(10_000)} usedBasisPoints={8_000} status="near" />,
    );

    expect(screen.getByText('Cerca del límite')).toHaveClass('status', 'status--near');
  });
});

describe('EmptyState and Skeleton', () => {
  it('explains and offers the next action', () => {
    renderWithProviders(
      <EmptyState title="Aún no hay movimientos" text="Importa un extracto." action={<Button>Importar extracto</Button>} />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Aún no hay movimientos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar extracto' })).toBeInTheDocument();
  });

  it('hides skeleton blocks from assistive tech but can label the loading state', () => {
    const { container } = renderWithProviders(<Skeleton variant="row" count={3} hasLabel />);

    expect(container.querySelectorAll('.skeleton[aria-hidden="true"]')).toHaveLength(3);
    expect(screen.getByText('Cargando')).toHaveClass('visually-hidden');
  });
});
