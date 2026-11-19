"use no memo";

import { useNavigation, useRoute } from "expo-router";
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useEngineStore } from "@/store";

/** Form sheets leave the screen under them on view, so it keeps redrawing. */
const SHEETS = new Set(["activity/[t]", "sheet-fit", "sheet-report"]);

/** Hidden screens catch up this long after the last save, as a transition that yields to taps. */
const CATCH_UP_MS = 400;

type NavState = { key?: string; index?: number; routes?: { key: string; name: string; state?: { key?: string } }[] };
type Nav = {
  getState(): NavState | undefined;
  getParent(): Nav | undefined;
  addListener(event: string, run: () => void): () => void;
};

/** On view: the screen's route is on top of its navigator (sheets aside), all the way up. */
export function screenShown(nav: Nav | undefined, routeKey: string | undefined): boolean {
  if (!nav || !routeKey) return true;
  const state = nav.getState();
  const routes = state?.routes;
  if (!state || !routes?.length) return true;
  let top = Math.min(state.index ?? routes.length - 1, routes.length - 1);
  while (top > 0 && SHEETS.has(routes[top].name)) top--;
  if (routes[top].key !== routeKey) return false;
  const parent = nav.getParent();
  if (!parent) return true;
  const owner = parent.getState()?.routes?.find((route) => route.state?.key && route.state.key === state.key);
  return owner ? screenShown(parent, owner.key) : true;
}

function listen(nav: Nav | undefined, run: () => void): () => void {
  const offs: (() => void)[] = [];
  for (let at = nav; at; at = at.getParent()) {
    offs.push(at.addListener("state", run), at.addListener("focus", run), at.addListener("blur", run));
  }
  return () => offs.forEach((off) => off());
}

/** True while this screen can be seen. Tabs behind another tab or under a pushed screen are hidden. */
export function useScreenShown(): boolean {
  const nav = useNavigation() as unknown as Nav;
  const route = useRoute();
  const key = route?.key;
  return useSyncExternalStore(
    (run) => listen(nav, run),
    () => screenShown(nav, key),
    () => true,
  );
}

const catchUp = new Set<(version: number) => void>();
let catchUpTimer: ReturnType<typeof setTimeout> | null = null;

useEngineStore.subscribe(() => {
  if (catchUpTimer) clearTimeout(catchUpTimer);
  catchUpTimer = setTimeout(() => {
    catchUpTimer = null;
    const version = useEngineStore.getState().version;
    startTransition(() => catchUp.forEach((run) => run(version)));
  }, CATCH_UP_MS);
});

/**
 * Store version for a screen inside a navigator. On view it follows every save. Hidden, it stops
 * redrawing on each save and catches up once saves pause, so a tap only redraws what can be seen.
 */
export function useEngineVersion(): number {
  const shown = useScreenShown();
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const live = useEngineStore((state) => (shown ? state.version : -1));
  const [late, setLate] = useState(() => useEngineStore.getState().version);
  useEffect(() => {
    const run = (version: number) => {
      if (!shownRef.current) setLate(version);
    };
    catchUp.add(run);
    return () => {
      catchUp.delete(run);
    };
  }, []);
  const last = useRef(-1);
  last.current = Math.max(last.current, live, late);
  return last.current;
}
