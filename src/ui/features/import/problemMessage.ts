import type { TFunction } from 'i18next';
import { errorMessage } from '@/ui/i18n/errorMessage';
import type { ImportProblem } from './useImportFlow';

/** Texto traducido de un problema de importación (dominio → `errors`, UI → `import:uiErrors`). */
export function problemMessage(t: TFunction<'import'>, problem: ImportProblem): string {
  if (problem.kind === 'domain') return errorMessage(t as unknown as TFunction, problem.error);
  return t(`uiErrors.${problem.code}`);
}
