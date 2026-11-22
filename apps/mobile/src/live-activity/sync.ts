"use no memo";

import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { LiveActivity, LiveActivityDismissalPolicy } from "expo-widgets";

import { perfCount, perfTime } from "@/perf/probe";
import { engine, useEngineStore } from "@/store";

import { activityKey, activityProps, MAX_LIVE_MS, type WorkoutActivityProps } from "./state";
import { WorkoutActivity } from "./workout-activity";

/** How long "Day done ✓" stays on the Lock Screen before the activity goes. */
const DONE_SHOW_MS = 4000;
/** Saves in one burst (a set tap, then its rest) share one Live Activity update. */
const SYNC_AFTER_SAVE_MS = 120;

type Current = { activity: LiveActivity<WorkoutActivityProps>; id: string; start: number; key: string };

let current: Current | null = null;
let adopted = false;

/** The workout that is underway: started, not ended or finished. Newest first. */
function underway(): { id: string; start: number } | null {
  const timers = (engine.wk.wt || {}) as Record<string, { start?: number; end?: number }>;
  const open = Object.entries(timers)
    .filter(([id, timer]) => timer?.start && !timer.end && !engine.wk.done?.[id])
    .map(([id, timer]) => ({ id, start: timer.start || 0 }))
    .sort((a, b) => b.start - a.start);
  return open[0] ?? null;
}

function finish(props?: WorkoutActivityProps, policy: LiveActivityDismissalPolicy = "immediate") {
  const ending = current;
  current = null;
  if (!ending) return;
  ending.activity.end(policy, props).catch(() => {});
}

/** End every Live Activity instance. Clears Lock Screen chrome left by an older build. */
function endAllInstances() {
  const factory = WorkoutActivity;
  if (!factory) return;
  try {
    factory.getInstances().forEach((activity) => activity.end("immediate").catch(() => {}));
  } catch {
    // Live Activities unavailable.
  }
  current = null;
}

/** Start, update or end the workout's Live Activity so it matches the engine. Safe to call often. */
export function syncLiveActivity(now = Date.now()) {
  perfTime("la:sync", () => syncNow(now));
}

function syncNow(now: number) {
  const factory = WorkoutActivity;
  if (!factory) return;
  try {
    if (!adopted) {
      adopted = true;
      // Orphans from a previous run or build are ended; this run starts fresh from the engine.
      endAllInstances();
    }

    const live = underway();
    if (current && (!live || live.id !== current.id || live.start !== current.start)) {
      const doneNow = !!engine.wk.done?.[current.id];
      if (doneNow) {
        const props = activityProps(current.id, now);
        finish(props ?? undefined, { after: new Date(now + DONE_SHOW_MS) });
      } else finish();
    }
    if (!live || now - live.start > MAX_LIVE_MS) {
      if (current) finish();
      return;
    }

    const props = activityProps(live.id, now);
    if (!props) return;
    const key = activityKey(props);
    const staleDate = props.restEnd > 0 ? new Date(props.restEnd) : undefined;
    if (!current) {
      const activity = factory.start(props, `liftboard://workout/${live.id}`, staleDate);
      current = { activity, id: live.id, start: live.start, key };
      return;
    }
    if (current.key !== key) {
      current.key = key;
      perfCount("la:update");
      current.activity.update(props, staleDate).catch(() => {});
    }
  } catch {
    // Live Activities can be off in Settings, or the device may not support them. The workout carries on.
  }
}

/** Keeps the Live Activity in step with the workout. Mounted once at the root, beside the app tree. */
export function LiveActivitySync() {
  useLiveActivitySync();
  return null;
}

/**
 * Keeps the Live Activity in step with the workout.
 * Syncs after engine saves, on app foreground, at rest-urgent and at rest-end; not every second
 * (elapsed and rest countdown are Timeline dates on the widget). Saves are followed outside React
 * and synced a moment later, so a tap's redraw never waits on plan() or the ActivityKit bridge.
 */
export function useLiveActivitySync() {
  useEffect(() => {
    let soon: ReturnType<typeof setTimeout> | null = null;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      soon = null;
      timers.forEach(clearTimeout);
      timers = [];
      syncLiveActivity();
      if (!WorkoutActivity || Platform.OS !== "ios") return;
      const live = underway();
      if (!live) return;
      const now = Date.now();
      const rest = engine.wk.rest as { end?: number } | null | undefined;
      if (rest?.end && rest.end > now) {
        const urgentAt = rest.end - 10_000;
        if (urgentAt > now) timers.push(setTimeout(() => syncLiveActivity(), urgentAt - now));
        timers.push(setTimeout(() => syncLiveActivity(), rest.end - now + 50));
      }
      const maxLeft = live.start + MAX_LIVE_MS - now;
      if (maxLeft > 0 && maxLeft < 48 * 3600e3) {
        timers.push(setTimeout(() => syncLiveActivity(), maxLeft));
      }
    };
    run();
    const unsubscribe = useEngineStore.subscribe(() => {
      if (soon) clearTimeout(soon);
      soon = setTimeout(run, SYNC_AFTER_SAVE_MS);
    });
    return () => {
      unsubscribe();
      if (soon) clearTimeout(soon);
      timers.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    if (!WorkoutActivity || Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      // Over-installs leave a Lock Screen activity on the old appex UI until it is ended.
      endAllInstances();
      adopted = true;
      syncLiveActivity();
    });
    return () => sub.remove();
  }, []);
}
