import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";

/**
 * Render and engine-cost counters for checking live-workout lag. Off unless the build sets
 * EXPO_PUBLIC_LB_PERF=1. Records counts and milliseconds only, never engine data.
 */
export const PERF_ON = process.env.EXPO_PUBLIC_LB_PERF === "1";

type Bucket = { n: number; ms: number };
const buckets = new Map<string, Bucket>();

function bucket(name: string): Bucket {
  let found = buckets.get(name);
  if (!found) {
    found = { n: 0, ms: 0 };
    buckets.set(name, found);
  }
  return found;
}

export function perfCount(name: string, ms = 0) {
  if (!PERF_ON) return;
  const found = bucket(name);
  found.n += 1;
  found.ms += ms;
}

export function perfTime<Result>(name: string, run: () => Result): Result {
  if (!PERF_ON) return run();
  const start = performance.now();
  try {
    return run();
  } finally {
    perfCount(name, performance.now() - start);
  }
}

export function perfSnapshot(): Record<string, Bucket> {
  const out: Record<string, Bucket> = {};
  [...buckets.keys()].sort().forEach((key) => {
    const value = buckets.get(key)!;
    out[key] = { n: value.n, ms: Math.round(value.ms * 100) / 100 };
  });
  return out;
}

export function perfReset() {
  buckets.clear();
}

const onRender: ProfilerOnRenderCallback = (id, _phase, actualDuration) => {
  perfCount(`render:${id}`, actualDuration);
};

/** Counts commits of the subtree and the time React spent rendering it. */
export function Probe({ id, children }: { id: string; children: ReactNode }) {
  if (!PERF_ON) return children;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

if (PERF_ON) {
  (globalThis as Record<string, unknown>).__lbPerf = { snapshot: perfSnapshot, reset: perfReset };
  (globalThis as Record<string, unknown>).__lbEngineTime = perfCount;
}

if (PERF_ON && typeof document === "undefined") {
  setInterval(() => {
    const snap = perfSnapshot();
    if (!Object.keys(snap).length) return;
    console.log(`[perf] last 10s ${JSON.stringify(snap)}`);
    perfReset();
  }, 10_000);
}
