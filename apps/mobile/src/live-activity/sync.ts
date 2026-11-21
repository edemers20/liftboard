"use no memo";

import { useEffect } from "react";
import { AppState, Platform } from "react-native";
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
      // Orphans from a previous run or build are ended; this run starts fresh from the engine.
      factory.getInstances().forEach((activity) => activity.end("immediate").catch(() => {}));
      current = null;
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
      current.activity.update(props, staleDate).catch(() => {});
    }
  } catch {
    // Live Activities can be off in Settings, or the device may not support them. The workout carries on.
  }
}

/**
 * Keeps the Live Activity in step with the workout. Mounted once at the root.
 * Syncs on engine version, app foreground, rest-urgent and rest-end — not every second
 * (elapsed and rest countdown are Timeline dates on the widget).
 */
export function useLiveActivitySync() {
  const version = useEngineStore((state) => state.version);
  useEffect(() => {
    syncLiveActivity();
    if (!WorkoutActivity || Platform.OS !== "ios") return;
    const live = underway();
    if (!live) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
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
    return () => timers.forEach(clearTimeout);
  }, [version]);
  useEffect(() => {
    if (!WorkoutActivity || Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") syncLiveActivity();
    });
    return () => sub.remove();
  }, []);
}
