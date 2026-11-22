/** Aviso entre pestañas de la misma app: «los datos han cambiado» (sin detalle). */
export interface CrossTabChangesPort {
  /** Avisa a las demás pestañas de que esta ha escrito datos. */
  publish(): void;
  /** Se invoca cuando OTRA pestaña avisa. Devuelve la función para darse de baja. */
  subscribe(listener: () => void): () => void;
  /** Cierra el canal. */
  dispose(): void;
}
