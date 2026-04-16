export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    this.preAllocate(initialSize);
  }

  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.reset(obj);
      return obj;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.pool.push(obj);
  }

  get available(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }
}
