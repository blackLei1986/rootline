export interface JobLocks {
  tryAcquire(key: string): Promise<(() => void) | null>;
}

export class InMemoryJobLocks implements JobLocks {
  private readonly active = new Set<string>();

  async tryAcquire(key: string): Promise<(() => void) | null> {
    if (this.active.has(key)) return null;
    this.active.add(key);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active.delete(key);
    };
  }
}

export const processJobLocks = new InMemoryJobLocks();
