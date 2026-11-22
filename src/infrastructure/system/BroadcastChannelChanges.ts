import type { CrossTabChangesPort } from '@/application/ports/outbound/CrossTabChangesPort';

/** Aviso entre pestañas con `BroadcastChannel`. Sin soporte del navegador no hace nada. */
export class BroadcastChannelChanges implements CrossTabChangesPort {
  private readonly channel: BroadcastChannel | null;
  private readonly listeners = new Set<() => void>();

  constructor(name: string) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name);
    if (this.channel) this.channel.onmessage = () => this.listeners.forEach((listener) => listener());
  }

  publish(): void {
    try {
      this.channel?.postMessage('changed');
    } catch {
      // Canal cerrado: nada que avisar.
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
    this.channel?.close();
  }
}
