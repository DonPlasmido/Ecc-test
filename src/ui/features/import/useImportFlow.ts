import { useCallback, useRef, useState } from 'react';
import type { ImportPreview, ImportResult } from '@/application/ports/inbound/ImportStatement';
import type { AccountId } from '@/domain/account/Account';
import type { ColumnMapping } from '@/domain/import/ColumnMapping';
import type { DomainError } from '@/domain/shared/DomainError';
import { useContainer } from '@/ui/hooks/useContainer';

/** Error que se enseña en la pantalla: código de dominio (`errors.json`) o fallo propio de la UI (`import.json`). */
export type ImportProblem =
  | { readonly kind: 'domain'; readonly error: DomainError }
  | { readonly kind: 'ui'; readonly code: 'unexpected' | 'sampleUnavailable' };

/** Vista previa en edición: el mapeo y la confirmación de fechas viven aquí hasta pulsar «Importar». */
export interface ImportDraft {
  readonly fileName: string;
  readonly preview: ImportPreview;
  readonly mapping: ColumnMapping;
  readonly datesConfirmed: boolean;
}

/** Cuenta destino: una existente o una nueva que se crea al confirmar. */
export type AccountChoice = { readonly kind: 'existing'; readonly id: AccountId } | { readonly kind: 'new'; readonly name: string };

export type ImportFlowState =
  | { readonly step: 'select'; readonly isReading: boolean; readonly problem: ImportProblem | null }
  | {
      readonly step: 'preview';
      readonly draft: ImportDraft;
      readonly isCommitting: boolean;
      readonly problem: ImportProblem | null;
      /** Cuenta creada en un intento anterior que falló después: no se vuelve a crear. */
      readonly createdAccountId: AccountId | null;
    }
  | { readonly step: 'done'; readonly fileName: string; readonly result: ImportResult };

const INITIAL: ImportFlowState = { step: 'select', isReading: false, problem: null };

/** Lee los bytes del archivo; si falla, el problema que se muestra. */
export interface FileSource {
  readonly name: string;
  readonly read: () => Promise<ArrayBuffer>;
  readonly readFailure: 'unexpected' | 'sampleUnavailable';
}

function uiProblem(code: 'unexpected' | 'sampleUnavailable'): ImportProblem {
  return { kind: 'ui', code };
}

/** Flujo de importación en dos pasos (vista previa → confirmación) sobre los puertos `importStatement` y `manageCatalog`. */
export function useImportFlow() {
  const { importStatement, manageCatalog } = useContainer();
  const [state, setState] = useState<ImportFlowState>(INITIAL);
  // Solo cuenta la última lectura: si el usuario elige otro archivo, la respuesta anterior se descarta.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (source: FileSource): Promise<ImportPreview | null> => {
      const request = ++latestRequest.current;
      const isStale = () => request !== latestRequest.current;
      setState({ step: 'select', isReading: true, problem: null });
      let bytes: ArrayBuffer;
      try {
        bytes = await source.read();
      } catch {
        if (!isStale()) setState({ step: 'select', isReading: false, problem: uiProblem(source.readFailure) });
        return null;
      }
      try {
        const result = await importStatement.preview({ name: source.name, bytes });
        if (isStale()) return null;
        if (!result.ok) {
          setState({ step: 'select', isReading: false, problem: { kind: 'domain', error: result.error } });
          return null;
        }
        const draft: ImportDraft = {
          fileName: source.name,
          preview: result.value,
          mapping: result.value.suggestedMapping,
          datesConfirmed: false,
        };
        setState({ step: 'preview', draft, isCommitting: false, problem: null, createdAccountId: null });
        return result.value;
      } catch (error: unknown) {
        console.error('importStatement.preview failed', error);
        if (!isStale()) setState({ step: 'select', isReading: false, problem: uiProblem('unexpected') });
        return null;
      }
    },
    [importStatement],
  );

  const updateDraft = useCallback((change: (draft: ImportDraft) => ImportDraft) => {
    setState((current) => (current.step === 'preview' ? { ...current, draft: change(current.draft), problem: null } : current));
  }, []);

  const reset = useCallback(() => {
    latestRequest.current += 1;
    setState(INITIAL);
  }, []);

  const resolveAccount = useCallback(
    async (choice: AccountChoice, createdAccountId: AccountId | null) => {
      if (choice.kind === 'existing') return { ok: true as const, value: choice.id };
      if (createdAccountId !== null) return { ok: true as const, value: createdAccountId };
      const saved = await manageCatalog.saveAccount({ name: choice.name.trim(), ibanLast4: null });
      return saved.ok ? { ok: true as const, value: saved.value.id } : saved;
    },
    [manageCatalog],
  );

  const commit = useCallback(
    async (choice: AccountChoice): Promise<ImportResult | null> => {
      if (state.step !== 'preview' || state.isCommitting) return null;
      const { draft } = state;
      let createdAccountId = state.createdAccountId;
      const fail = (problem: ImportProblem) => setState({ ...state, isCommitting: false, problem, createdAccountId });
      setState({ ...state, isCommitting: true, problem: null });
      try {
        const account = await resolveAccount(choice, createdAccountId);
        if (!account.ok) {
          fail({ kind: 'domain', error: account.error });
          return null;
        }
        if (choice.kind === 'new') createdAccountId = account.value;
        const result = await importStatement.commit({
          previewId: draft.preview.previewId,
          accountId: account.value,
          mapping: draft.mapping,
        });
        if (!result.ok) {
          fail({ kind: 'domain', error: result.error });
          return null;
        }
        setState({ step: 'done', fileName: draft.fileName, result: result.value });
        return result.value;
      } catch (error: unknown) {
        console.error('importStatement.commit failed', error);
        fail(uiProblem('unexpected'));
        return null;
      }
    },
    [state, importStatement, resolveAccount],
  );

  return { state, load, updateDraft, commit, reset };
}
