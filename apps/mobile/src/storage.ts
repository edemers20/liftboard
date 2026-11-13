import { Platform } from "react-native";

const memory = new Map<string, string>();

/**
 * The web bundle is built where `localStorage` is undefined, and that check gets
 * compiled away. Look the name up so the browser store is still used on the client.
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

/** Web preview only. The phone build keeps using MMKV. */
const webStorage = {
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

function nativeStorage() {
  const { createMMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
  const mmkv = createMMKV({ id: "liftboard" });
  return {
    getItem(key: string): string | null {
      return mmkv.getString(key) ?? null;
    },
    setItem(key: string, value: string): void {
      mmkv.set(key, value);
    },
  };
}

/** Synchronous storage in the shape engine.init() expects. */
export const storage = Platform.OS === "web" ? webStorage : nativeStorage();
