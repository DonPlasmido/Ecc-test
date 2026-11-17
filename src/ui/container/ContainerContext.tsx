import { createContext, type ReactNode } from 'react';
import type { AppContainer } from '@/composition/container.types';

/** Solo inyecta el `AppContainer` (puertos de entrada); no guarda estado de la app (ADR-0005). */
export const ContainerContext = createContext<AppContainer | null>(null);

type ContainerProviderProps = {
  container: AppContainer;
  children: ReactNode;
};

export function ContainerProvider({ container, children }: ContainerProviderProps) {
  return <ContainerContext value={container}>{children}</ContainerContext>;
}
