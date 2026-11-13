/** The JSON file You → Download backup writes in the web app. */

export type LiftBackup = {
  app: "liftboard";
  at: string;
  keys: Record<string, string | null>;
};

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type EngineLike = {
  init(storage: Store): void;
  save(): void;
  wk: { setupDone?: boolean; onbDone?: boolean; sessions?: { t: number; k: string }[] };
  weekStartOf(time: number): Date;
};

export function parseBackup(text: string): LiftBackup | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const file = data as { app?: unknown; at?: unknown; keys?: unknown };
  if (file.app !== "liftboard" || !file.keys || typeof file.keys !== "object" || Array.isArray(file.keys)) {
    return null;
  }
  const keys: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(file.keys as Record<string, unknown>)) {
    if (value == null) keys[key] = null;
    else if (typeof value === "string") keys[key] = value;
    else return null;
  }
  return { app: "liftboard", at: typeof file.at === "string" ? file.at : "", keys };
}

/** Write the backup's three storage values and load them. A finished web setup skips phone onboarding. */
export function applyBackup(backup: LiftBackup, store: Store, api: EngineLike) {
  for (const [key, value] of Object.entries(backup.keys)) {
    if (value != null) store.setItem(key, value);
  }
  api.init(store);
  if (api.wk.setupDone && !api.wk.onbDone) api.wk.onbDone = true;
  api.save();
}

/** Same Lifts / Activities / Weeks active counts the You tab shows. */
export function activeCounts(api: EngineLike) {
  const sessions = api.wk.sessions || [];
  const lifts = sessions.filter((session) => session.k === "lift").length;
  const weeks = new Set(sessions.map((session) => api.weekStartOf(session.t).getTime())).size;
  return { lifts, activities: sessions.length - lifts, weeks };
}
