const memory = new Map<string, string>();

/**
 * The web bundle is compiled where `localStorage` is undefined, and a direct
 * check gets compiled away. Look the name up so the browser store is used.
 * The phone build uses MMKV through storage.ts.
 */
function browserStore(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  try {
    const store = (globalThis as Record<string, unknown>)["local" + "Storage"] as
      | { getItem(key: string): string | null; setItem(key: string, value: string): void }
      | undefined;
    if (!store || typeof store.getItem !== "function" || typeof store.setItem !== "function") return null;
    return store;
  } catch {
    return null;
  }
}

/** Web preview storage. Answers have to survive a reload. */
export const storage = {
  getItem(key: string): string | null {
    const store = browserStore();
    if (!store) return memory.get(key) ?? null;
    return store.getItem(key);
  },
  setItem(key: string, value: string): void {
    const store = browserStore();
    if (!store) {
      memory.set(key, value);
      return;
    }
    store.setItem(key, value);
  },
};
