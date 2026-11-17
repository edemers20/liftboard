"use no memo";

import { useEffect } from "react";
import { AppState } from "react-native";
import type { LiveActivity, LiveActivityDismissalPolicy } from "expo-widgets";

import { engine, useEngineStore } from "@/store";

import { activityKey, activityProps, MAX_LIVE_MS, type WorkoutActivityProps } from "./state";
import { WorkoutActivity } from "./workout-activity";

/** How long "Day done ✓" stays on the Lock Screen before the activity goes. */
const DONE_SHOW_MS = 4000;

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

function stale(props: WorkoutActivityProps): Date | undefined {
  return props.restEnd > 0 ? new Date(props.restEnd) : undefined;
}

function finish(props?: WorkoutActivityProps, policy: LiveActivityDismissalPolicy = "immediate") {
  const ending = current;
  current = null;
  if (!ending) return;
  ending.activity.end(policy, props).catch(() => {});
}

/** Start, update or end the workout's Live Activity so it matches the engine. Safe to call often. */
export function syncLiveActivity(now = Date.now()) {
  const factory = WorkoutActivity;
  if (!factory) return;
  try {
    if (!adopted) {
      adopted = true;
      // An activity can outlive the app. Pick it back up; extras from an older run go.
      const left = factory.getInstances();
      const live = underway();
      if (left.length && live) current = { activity: left[0], id: live.id, start: live.start, key: "" };
      left.slice(current ? 1 : 0).forEach((activity) => activity.end("immediate").catch(() => {}));
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
    if (!current) {
      const activity = factory.start(props, `liftboard://workout/${live.id}`, stale(props));
      current = { activity, id: live.id, start: live.start, key };
      return;
    }
    if (current.key !== key) {
      current.key = key;
      current.activity.update(props, stale(props)).catch(() => {});
    }
  } catch {
    // Live Activities can be off in Settings, or the device may not support them. The workout carries on.
  }
}

/** Keeps the Live Activity in step with the workout. Mounted once at the root. */
export function useLiveActivitySync() {
  const version = useEngineStore((state) => state.version);
  useEffect(() => {
    syncLiveActivity();
  }, [version]);
  useEffect(() => {
    if (!WorkoutActivity) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") syncLiveActivity();
    });
    return () => sub.remove();
  }, []);
}
