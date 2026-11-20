import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { domainError } from '@/domain/shared/DomainError';
import { errorMessage } from '@/ui/i18n/errorMessage';
import { i18n } from '@/ui/i18n/i18n';
import { BootError } from '@/ui/layout/BootError';
import { renderWithProviders, setupI18n } from './renderWithProviders';

beforeEach(async () => {
  await setupI18n('es');
});

describe('errorMessage', () => {
  it('translates domain error codes with interpolated details', () => {
    const t = i18n.getFixedT('es');

    expect(errorMessage(t, domainError('backup.weakPassword', { expected: 12 }))).toBe(
      'La contraseña debe tener al menos 12 caracteres.',
    );
    expect(errorMessage(t, domainError('money.invalidAmount', { value: '12,3x' }))).toBe(
      'No se reconoce el importe «12,3x».',
    );
  });

  it('falls back to the generic message without error', () => {
    expect(errorMessage(i18n.getFixedT('es'), null)).toBe('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
  });
});

describe('BootError', () => {
  it('explains the startup failure with the translated domain error', () => {
    renderWithProviders(<BootError error={domainError('storage.unavailable')} />);

    expect(screen.getByRole('heading', { level: 1, name: 'No se ha podido abrir la aplicación' })).toBeInTheDocument();
    expect(screen.getByText(/almacenamiento del navegador no está disponible/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});
