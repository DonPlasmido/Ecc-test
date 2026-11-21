import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppContainer } from '@/composition/container.types';
import { UNCATEGORIZED } from '@/domain/category/Category';
import { RulesPage } from '@/ui/features/rules/RulesPage';
import { createFakeContainer } from '../../fakeContainer';
import { renderWithProviders, setupI18n } from '../../renderWithProviders';
import { cat, createRulesContainer } from './seedRules';

let container: AppContainer;

beforeEach(async () => {
  await setupI18n('es');
  container = await createRulesContainer();
});

function renderPage() {
  return renderWithProviders(<RulesPage />, { container, route: '/reglas' });
}

async function ruleList() {
  return screen.findByRole('list', { name: 'Reglas por prioridad' });
}

function ruleTexts(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.rules-item__condition')?.textContent ?? '');
}

describe('RulesPage: rules', () => {
  it('lists rules by priority with their target category and the number of matching transactions', async () => {
    renderPage();

    const list = await ruleList();
    const [first, second] = within(list).getAllByRole('listitem');

    expect(screen.getByRole('heading', { level: 1, name: 'Reglas y categorías' })).toBeInTheDocument();
    expect(ruleTexts(list)).toEqual(['Regla 1 de 2: Contiene «MERCADONA»', 'Regla 2 de 2: Contiene «CENTRAL»']);
    expect(first).toHaveTextContent('Supermercado');
    expect(second).toHaveTextContent('Ocio');
    expect(await within(first as HTMLElement).findByText('2 movimientos coinciden')).toBeInTheDocument();
    expect(await within(second as HTMLElement).findByText('2 movimientos coinciden')).toBeInTheDocument();
  });

  it('creates a rule with a live preview of matching transactions', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Nueva regla' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva regla' });
    const pattern = within(dialog).getByRole('textbox', { name: /Texto del concepto/ });
    expect(pattern).toHaveFocus();
    expect(within(dialog).getByText(/Escribe al menos 2 caracteres para ver/)).toBeInTheDocument();

    await user.type(pattern, 'netflix.com');
    expect(await within(dialog).findByText('Coincide con 1 movimiento')).toBeInTheDocument();
    expect(within(dialog).getByText('NETFLIX.COM 1234')).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Categoría que asigna/ }), 'Suscripciones');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar regla' }));

    const list = await ruleList();
    await waitFor(() => expect(ruleTexts(list)).toHaveLength(3));
    expect(ruleTexts(list)[2]).toBe('Regla 3 de 3: Contiene «NETFLIX.COM»');
    const saved = (await container.manageCatalog.listRules()).find((r) => r.pattern === 'NETFLIX.COM');
    expect(saved).toMatchObject({ categoryId: cat('subscriptions'), priority: 3, operator: 'contains' });
  });

  it('rejects a pattern shorter than 2 characters and a missing category with field messages', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Nueva regla' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva regla' });
    const pattern = within(dialog).getByRole('textbox', { name: /Texto del concepto/ });
    await user.type(pattern, 'a');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar regla' }));

    expect(pattern).toHaveAttribute('aria-invalid', 'true');
    expect(pattern).toHaveAccessibleDescription(expect.stringContaining('Escribe al menos 2 caracteres.'));
    expect(pattern).toHaveFocus();
    expect(within(dialog).getByText('Elige la categoría que asignará la regla.')).toHaveAttribute('role', 'alert');
    expect(await container.manageCatalog.listRules()).toHaveLength(2);
  });

  it('edits a rule keeping its priority', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Editar regla «CENTRAL»' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar regla' });
    const pattern = within(dialog).getByRole('textbox', { name: /Texto del concepto/ });
    await user.clear(pattern);
    await user.type(pattern, 'mercado central');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar regla' }));

    await waitFor(async () => expect(ruleTexts(await ruleList())[1]).toBe('Regla 2 de 2: Contiene «MERCADO CENTRAL»'));
    expect((await container.manageCatalog.listRules()).find((r) => r.id === 'rule-central')).toMatchObject({
      pattern: 'MERCADO CENTRAL',
      priority: 2,
    });
  });

  it('reorders with accessible buttons, persists the order and keeps focus on the moved rule', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Bajar prioridad de «MERCADONA»' }));

    const list = await ruleList();
    expect(ruleTexts(list)).toEqual(['Regla 1 de 2: Contiene «CENTRAL»', 'Regla 2 de 2: Contiene «MERCADONA»']);
    // «Bajar» queda deshabilitado en la última posición: el foco pasa a «Subir» de la misma regla.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subir prioridad de «MERCADONA»' })).toHaveFocus());
    expect(screen.getByRole('button', { name: 'Bajar prioridad de «MERCADONA»' })).toBeDisabled();
    await waitFor(async () =>
      expect((await container.manageCatalog.listRules()).map((r) => [r.pattern, r.priority])).toEqual(
        expect.arrayContaining([
          ['CENTRAL', 1],
          ['MERCADONA', 2],
        ]),
      ),
    );
    expect(await screen.findByText('«MERCADONA» ahora es la regla 2 de 2')).toBeInTheDocument();
  });

  it('restores the previous order and warns when reordering fails', async () => {
    const user = userEvent.setup();
    const real = container.manageCatalog;
    // El puerto real es una clase: se delega en sus métodos y solo se sustituye `reorderRules`.
    const failingReorder = new Proxy(real, {
      get: (target, property, receiver) =>
        property === 'reorderRules'
          ? () => Promise.reject(new Error('disk'))
          : (Reflect.get(target, property, receiver) as () => unknown).bind(target),
    });
    container = { ...container, manageCatalog: failingReorder };
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Bajar prioridad de «MERCADONA»' }));

    expect(await screen.findByText(/No se ha podido cambiar el orden/)).toBeInTheDocument();
    expect(ruleTexts(await ruleList())[0]).toBe('Regla 1 de 2: Contiene «MERCADONA»');
  });

  it('deletes a rule after confirmation, with focus starting on «Cancelar»', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Borrar regla «CENTRAL»' }));
    const dialog = screen.getByRole('dialog', { name: '¿Borrar la regla?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Borrar regla' }));

    await waitFor(async () => expect(ruleTexts(await ruleList())).toEqual(['Regla 1 de 1: Contiene «MERCADONA»']));
    expect(await container.manageCatalog.listRules()).toHaveLength(1);
  });

  it('applies the rules now and summarises how many transactions changed, never touching manual ones', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();

    await user.click(screen.getByRole('button', { name: 'Aplicar reglas ahora' }));

    expect(await screen.findByText('Hecho: 3 movimientos han cambiado de categoría.')).toBeInTheDocument();
    const [manual] = await container.queryTransactions
      .search({ filter: { text: 'cafe central' }, sort: 'dateAsc' })
      .then(({ resultId }) => container.queryTransactions.page({ resultId, offset: 0, limit: 1 }));
    expect(manual?.categoryId).toBe(cat('gifts'));
  });

  it('clears the stale «Hecho» result when a rule is edited afterwards', async () => {
    const user = userEvent.setup();
    renderPage();
    await ruleList();
    await user.click(screen.getByRole('button', { name: 'Aplicar reglas ahora' }));
    await waitFor(() => expect(document.querySelector('.rules-apply__result')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Editar regla «CENTRAL»' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar regla' });
    await user.type(within(dialog).getByRole('textbox', { name: /Texto del concepto/ }), ' x');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar regla' }));

    await waitFor(() => expect(document.querySelector('.rules-apply__result')).toBeNull());
  });

  it('shows an empty state when there are no rules', async () => {
    container = await createRulesContainer({ rules: [] });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Aún no tienes reglas' })).toBeInTheDocument();
  });

  it('offers a retry when the catalog cannot be loaded', async () => {
    const user = userEvent.setup();
    let calls = 0;
    container = createFakeContainer({
      manageCatalog: {
        ...container.manageCatalog,
        // Solo se usan estos dos métodos en la carga.
        listRules: () => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve([]);
        },
        listCategories: () => Promise.resolve([]),
      },
    });
    renderPage();

    expect(await screen.findByText('No se han podido cargar las reglas y categorías.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Aún no tienes reglas' })).toBeInTheDocument();
  });
});

describe('RulesPage: categories', () => {
  async function categoryList() {
    return screen.findByRole('list', { name: 'Categorías' });
  }

  it('lists categories with colour and name and never offers deleting «Sin categoría»', async () => {
    renderPage();
    const list = await categoryList();

    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(17);
    expect(items[0]).toHaveTextContent('Sin categoría');
    expect(items[1]).toHaveTextContent('Compras');
    expect(within(list).getByText('Sin categoría')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar categoría «Sin categoría»' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar categoría «Sin categoría»' })).not.toBeInTheDocument();
  });

  it('creates a category with a colour', async () => {
    const user = userEvent.setup();
    renderPage();
    await categoryList();

    await user.click(screen.getByRole('button', { name: 'Nueva categoría' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva categoría' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar categoría' }));
    expect(within(dialog).getByText('Escribe un nombre para la categoría.')).toHaveAttribute('role', 'alert');

    await user.type(within(dialog).getByRole('textbox', { name: /Nombre/ }), 'Mascotas');
    await user.click(within(dialog).getByRole('radio', { name: 'Ciruela' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar categoría' }));

    expect(await within(await categoryList()).findByText('Mascotas')).toBeInTheDocument();
    const created = (await container.manageCatalog.listCategories()).find((c) => c.name === 'Mascotas');
    expect(created).toMatchObject({ color: 'cat-4', kind: 'expense', archived: false });
  });

  it('renames a default category and keeps its colour token', async () => {
    const user = userEvent.setup();
    renderPage();
    await categoryList();

    await user.click(screen.getByRole('button', { name: 'Editar categoría «Viajes»' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar categoría' });
    const name = within(dialog).getByRole('textbox', { name: /Nombre/ });
    expect(name).toHaveValue('Viajes');
    await user.clear(name);
    await user.type(name, 'Vacaciones');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar categoría' }));

    expect(await screen.findByRole('button', { name: 'Editar categoría «Vacaciones»' })).toBeInTheDocument();
    const travel = (await container.manageCatalog.listCategories()).find((c) => c.id === cat('travel'));
    expect(travel).toMatchObject({ name: 'Vacaciones', nameKey: null, color: 'chart-11' });
  });

  it('deletes an unused category after confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await categoryList();

    await user.click(screen.getByRole('button', { name: 'Borrar categoría «Educación»' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '¿Borrar la categoría?' })).getByRole('button', { name: 'Borrar categoría' }),
    );

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Editar categoría «Educación»' })).not.toBeInTheDocument());
    expect((await container.manageCatalog.listCategories()).some((c) => c.id === cat('education'))).toBe(false);
  });

  it('blocks deleting a category in use and offers archiving it instead', async () => {
    const user = userEvent.setup();
    renderPage();
    await categoryList();

    await user.click(screen.getByRole('button', { name: 'Borrar categoría «Supermercado»' }));
    await user.click(
      within(screen.getByRole('dialog', { name: '¿Borrar la categoría?' })).getByRole('button', { name: 'Borrar categoría' }),
    );
    const blocked = await screen.findByRole('dialog', { name: '«Supermercado» está en uso' });
    expect(blocked).toHaveAccessibleDescription(/no se puede borrar/);
    await user.click(within(blocked).getByRole('button', { name: 'Archivar categoría' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const groceries = (await container.manageCatalog.listCategories()).find((c) => c.id === cat('groceries'));
    expect(groceries?.archived).toBe(true);
    expect((await container.manageCatalog.listRules()).find((r) => r.id === 'rule-mercadona')?.enabled).toBe(false);
    expect((await screen.findAllByText(/desactivada/i)).length).toBeGreaterThan(0);
    expect((await container.manageCatalog.listCategories()).some((c) => c.id === UNCATEGORIZED)).toBe(true);
  });
});
