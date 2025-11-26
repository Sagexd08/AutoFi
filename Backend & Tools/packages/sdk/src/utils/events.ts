
export type SDKEventMap = {
  request: { path: string; method: string; options: unknown };
  response: { path: string; method: string; response: unknown };
  error: { path: string; method: string; error: unknown };
  retry: { attempt: number; error: unknown };
  cache: { hit: boolean; key: string };
  rateLimit: { key: string; status: { remaining: number; resetAt: number } };
  circuitBreaker: { state: 'closed' | 'open' | 'half-open' };
};

export type EventListener<T = unknown> = (data: T) => void | Promise<void>;

export class EventEmitter<TEventMap extends Record<string, unknown> = SDKEventMap> {
  private listeners = new Map<keyof TEventMap, Set<EventListener>>();

  on<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    (this.listeners.get(event)! as Set<EventListener<TEventMap[K]>>).add(listener);

    return () => {
      const eventListeners = this.listeners.get(event) as Set<EventListener<TEventMap[K]>> | undefined;
      if (eventListeners) {
        eventListeners.delete(listener);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  once<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap[K]>
  ): () => void {
    const wrappedListener = ((data: TEventMap[K]) => {
      listener(data);
      unsubscribe();
    }) as EventListener<TEventMap[K]>;
    const unsubscribe = this.on(event, wrappedListener);
    return unsubscribe;
  }

  async emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const promises = Array.from(eventListeners).map((listener) => {
        try {
          return Promise.resolve(listener(data));
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
          return Promise.resolve();
        }
      });
      await Promise.all(promises);
    }
  }

  off<K extends keyof TEventMap>(event: K): void {
    this.listeners.delete(event);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  listenerCount<K extends keyof TEventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

