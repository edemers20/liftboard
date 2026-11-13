import { AppState, Platform } from "react-native";

import { playChime } from "@/chime";
import { copy, fill } from "@/copy";
import { engine } from "@/store";

type NotificationsModule = typeof import("expo-notifications");

const CHIME_FILE = "rest_chime.wav";
const CHANNEL = "rest-chime";

let notifications: NotificationsModule | null = null;
let currentId: string | null = null;
let ticket = 0;
let channelReady = false;
let chimedEnd = 0;

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
          claimRestChime(end);
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
 * Play the in-app chime once for this rest end, and only while the app is open.
 * Returns true the first time this end is claimed in the foreground.
 */
export function claimRestChime(end: number): boolean {
  if (!end || chimedEnd === end) return false;
  if (AppState.currentState !== "active") return false;
  chimedEnd = end;
  playChime();
  return true;
}

/** Schedule the lock screen alert for the end of rest. Cancels the previous one. No alert when the sound setting is off. */
export async function armRest(seconds: number) {
  const my = ++ticket;
  const previous = currentId || engine.wk.rest?.noteId || null;
  currentId = null;
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
  const id = await N.scheduleNotificationAsync({
    content: {
      title: copy.workout.restUp,
      body: restLine(),
      sound: CHIME_FILE,
      data: { end: engine.wk.rest.end },
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
  engine.wk.rest.noteId = id;
  engine.save();
}

/** Cancel the locked-phone chime. Call this before clearing rest. */
export async function cancelRestChime() {
  ticket += 1;
  const id = currentId || engine.wk.rest?.noteId || null;
  currentId = null;
  if (engine.wk.rest) engine.wk.rest.noteId = null;
  await cancelId(id);
}
