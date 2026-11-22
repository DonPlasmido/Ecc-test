import { createContext } from 'react';

/** `true` cuando la app ya ha cambiado de ruta alguna vez (Atrás, hash a mano o enlace). */
export const NavigationTrackerContext = createContext<boolean>(false);
