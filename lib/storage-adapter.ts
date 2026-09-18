export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();

export const memoryStorageAdapter: StorageAdapter = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
  removeItem: (key) => { memory.delete(key); }
};

export function getStorageAdapter(): StorageAdapter {
  if (typeof window === "undefined") return memoryStorageAdapter;
  return window.localStorage;
}
