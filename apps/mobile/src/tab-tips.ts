import { useSyncExternalStore } from "react";

import { storage } from "@/storage";

const KEY = "liftboard.tabTips.v1";

export const TAB_TIP_IDS = ["workouts", "plan", "history", "you"] as const;
export type TabTipId = (typeof TAB_TIP_IDS)[number];

type Seen = Partial<Record<TabTipId, boolean>>;
type Snapshot = { seen: Seen; holdPath: string | null };

let seen: Seen = read();
let holdPath: string | null = null;
let snapshot: Snapshot = { seen, holdPath };
const listeners = new Set<() => void>();

function read(): Seen {
  const raw = storage.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Seen;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function publish() {
  snapshot = { seen, holdPath };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTabTips(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function markTabTipSeen(id: TabTipId): void {
  if (seen[id]) return;
  seen = { ...seen, [id]: true };
  storage.setItem(KEY, JSON.stringify(seen));
  publish();
}

/** Clears every tab's flag. Stays quiet on `fromPath` until the route changes. */
export function resetTabTips(fromPath: string): void {
  seen = {};
  holdPath = fromPath;
  storage.setItem(KEY, JSON.stringify(seen));
  publish();
}

export function watchTabTipPath(path: string): void {
  if (!holdPath || path === holdPath) return;
  holdPath = null;
  publish();
}
