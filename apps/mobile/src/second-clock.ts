import { useSyncExternalStore } from "react";

/**
 * One timer for every on-screen clock (live pill, workout header, rest bar). Each wakes on the
 * same tick, so they redraw in one pass a second instead of each on its own timer.
 */
const listeners = new Set<() => void>();
let tick = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function arm() {
  // Just past the wall-clock second, so every clock flips together.
  timer = setTimeout(
    () => {
      tick += 1;
      listeners.forEach((run) => run());
      if (listeners.size) arm();
      else timer = null;
    },
    1000 - (Date.now() % 1000) + 5,
  );
}

function subscribe(run: () => void): () => void {
  listeners.add(run);
  if (!timer) arm();
  return () => {
    listeners.delete(run);
    if (!listeners.size && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

const idle = () => () => {};
const read = () => tick;

/** Redraws once a second while `on`. Read the time with Date.now() in render. */
export function useSecondClock(on = true): void {
  useSyncExternalStore(on ? subscribe : idle, read, read);
}
