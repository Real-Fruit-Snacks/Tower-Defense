type Callback<T> = (data: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Callback<never>>>();

  on<K extends keyof EventMap>(event: K, callback: Callback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Callback<never>);
  }

  off<K extends keyof EventMap>(event: K, callback: Callback<EventMap[K]>): void {
    this.listeners.get(event)?.delete(callback as Callback<never>);
  }

  once<K extends keyof EventMap>(event: K, callback: Callback<EventMap[K]>): void {
    const wrapper = ((data: EventMap[K]) => {
      this.off(event, wrapper);
      callback(data);
    }) as Callback<EventMap[K]>;
    this.on(event, wrapper);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        (cb as Callback<EventMap[K]>)(data);
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
