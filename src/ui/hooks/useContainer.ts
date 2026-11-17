import { use } from 'react';
import type { AppContainer } from '@/composition/container.types';
import { ContainerContext } from '@/ui/container/ContainerContext';

/** Puertos de entrada de la aplicación. Lanza si falta `<ContainerProvider>` (error de programación). */
export function useContainer(): AppContainer {
  const container = use(ContainerContext);
  if (!container) throw new Error('useContainer must be used inside <ContainerProvider>');
  return container;
}
