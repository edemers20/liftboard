import { AppState, Platform } from "react-native";

import { playChime } from "@/chime";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { engine, useEngineStore } from "@/store";

import { restCueDue, restCueWait } from "./rest-cue";

type NotificationsModule = typeof import("expo-notifications");

const CHIME_FILE = "rest_chime.wav";
const CHANNEL = "rest-chime";

let notifications: NotificationsModule | null = null;
let currentId: string | null = null;
/** Rest end the scheduled alert in `currentId` belongs to. */
let currentEnd = 0;
let ticket = 0;
let channelReady = false;
let cuedEnd = 0;

function lib(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  if (!notifications) {
    // Loaded lazily so web and tests don't pull in the native module.
    notifications = require("expo-notifications") as NotificationsModule;
    notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const foreground = AppState.currentState === "active";
        if (foreground) {
          const end = Number(notification.request.content.data?.end || engine.wk.rest?.end || 0);
          cueRestEnd(end);
          return {
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
        return {
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
  }
  return notifications;
}

/** Install the foreground handler. Does not ask for permission. */
export function prepareRestAlerts() {
  lib();
}

async function cancelId(id: string | null) {
  const N = lib();
  if (!N || !id) return;
  try {
    await N.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or already cancelled.
  }
}

async function ensureChannel(N: NotificationsModule) {
  if (channelReady || Platform.OS !== "android") return;
  try {
    await N.setNotificationChannelAsync(CHANNEL, {
      name: copy.you.restTimerSound,
      importance: N.AndroidImportance.HIGH,
      sound: CHIME_FILE,
      audioAttributes: {
        usage: N.AndroidAudioUsage.NOTIFICATION,
        contentType: N.AndroidAudioContentType.SONIFICATION,
      },
    });
    channelReady = true;
  } catch {
    // An old build can reject the channel. The alert still schedules.
  }
}

function restLine(): string {
  const name = engine.wk.rest?.name as string | undefined;
  if (!name) return "";
  const timers = (engine.wk.wt || {}) as Record<string, { start?: number; end?: number }>;
  const open = Object.keys(timers).filter((id) => timers[id]?.start && !timers[id]?.end);
  const day = (engine.DAYS as { id: string; slots: unknown[] }[]).find((item) => {
    if (open.length && !open.includes(item.id)) return false;
    return item.slots.some((slot, index) => {
      const row = slot as { cardio?: boolean };
      return !row.cardio && engine.exName(item, slot, index) === name;
    });
  });
  if (!day) return name;
  const planned = engine.plan().days[day.id];
  if (!planned) return name;
  const order = engine.slotOrder(day) as number[];
  const index = order.find((slotIndex) => engine.exName(day, day.slots[slotIndex], slotIndex) === name);
  if (index == null) return name;
  const total = planned.slots[index]?.sets || 0;
  const ticks = ((engine.get(day.id, index).log || []) as { d?: boolean }[]).filter((row) => row.d).length;
  if (total > ticks) return fill(copy.workout.restUpBody, ticks + 1, total, name);
  const next = order.slice(order.indexOf(index) + 1).find((slotIndex) => {
    const slot = day.slots[slotIndex] as { cardio?: boolean } | undefined;
    const planSlot = planned.slots[slotIndex];
    if (!slot || slot.cardio || !planSlot || planSlot.skip) return false;
    const done = ((engine.get(day.id, slotIndex).log || []) as { d?: boolean }[]).filter((row) => row.d).length;
    return done < (planSlot.sets || 0);
  });
  if (next == null) return name;
  return fill(
    copy.workout.restUpBody,
    1,
    planned.slots[next]?.sets || 1,
    engine.exName(day, day.slots[next], next),
  );
}

/**
 * Buzz and chime once for this rest end, only while the app is open, then drop its lock screen
 * alert so it doesn't sound a second time. Returns true the first time this end is cued.
 * The chime plays even with Rest timer sound off; that switch only skips the lock screen alert.
 */
export function cueRestEnd(end: number): boolean {
  if (!end || cuedEnd === end) return false;
  if (AppState.currentState !== "active") return false;
  cuedEnd = end;
  haptic.alert();
  playChime();
  if (currentEnd === end) {
    const id = currentId;
    currentId = null;
    currentEnd = 0;
    if (engine.wk.rest?.end === end) engine.wk.rest.noteId = null;
    void cancelId(id);
  }
  return true;
}

/**
 * Watches the rest end from the app root, so the cue plays on any tab, not only on the workout
 * screen. Re-arms after every save and on return to the app. Returns a stop function.
 */
export function startRestCue(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const end = Number(engine.wk.rest?.end) || 0;
    const now = Date.now();
    if (restCueDue(end, now, AppState.currentState === "active", cuedEnd)) {
      cueRestEnd(end);
      return;
    }
    const wait = restCueWait(end, now);
    if (wait != null) timer = setTimeout(check, wait);
  };
  check();
  const unsubscribe = useEngineStore.subscribe(check);
  const sub = AppState.addEventListener("change", check);
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
    sub.remove();
  };
}

/** Schedule the lock screen alert for the end of rest. Cancels the previous one. No alert when the sound setting is off. */
export async function armRest(seconds: number) {
  const my = ++ticket;
  const previous = currentId || engine.wk.rest?.noteId || null;
  currentId = null;
  currentEnd = 0;
  await cancelId(previous);
  const N = lib();
  if (my !== ticket || !engine.wk.rest) return;
  if (!N || (engine.wk.sound || "Yes") === "No" || seconds < 1) {
    engine.wk.rest.noteId = null;
    return;
  }
  const existing = await N.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (
      await N.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      })
    ).status;
  }
  const end = engine.wk.rest?.end as number | undefined;
  const remaining = end ? Math.round((end - Date.now()) / 1000) : 0;
  if (my !== ticket || !engine.wk.rest) return;
  if (status !== "granted" || remaining < 1) {
    engine.wk.rest.noteId = null;
    return;
  }
  await ensureChannel(N);
  if (my !== ticket || !engine.wk.rest) return;
  const scheduledEnd = engine.wk.rest.end as number;
  const id = await N.scheduleNotificationAsync({
    content: {
      title: copy.workout.restUp,
      body: restLine(),
      sound: CHIME_FILE,
      // Breaks through Focus (Fitness Focus turns on with a watch workout). Needs the
      // time-sensitive entitlement in app.json; without it iOS delivers it as a normal alert.
      interruptionLevel: "timeSensitive",
      data: { end: scheduledEnd },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: remaining,
      channelId: CHANNEL,
    },
  });
  if (my !== ticket || !engine.wk.rest) {
    await cancelId(id);
    return;
  }
  currentId = id;
  currentEnd = scheduledEnd;
  engine.wk.rest.noteId = id;
  // Stored for a relaunch only; nothing on screen shows it, so it skips the redraw a save brings.
  try {
    engine.persist();
  } catch {
    // Storage full or unavailable. The id is still held in memory for this run.
  }
}

/**
 * Cancel the locked-phone chime. Reads the alert id before its first await, so call it (without
 * awaiting) right before clearing rest; awaiting first leaves a gap where a newly ticked set's rest
 * gets cleared.
 */
export async function cancelRestChime() {
  ticket += 1;
  const id = currentId || engine.wk.rest?.noteId || null;
  currentId = null;
  currentEnd = 0;
  if (engine.wk.rest) engine.wk.rest.noteId = null;
  await cancelId(id);
}
