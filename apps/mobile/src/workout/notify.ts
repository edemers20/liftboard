import { Platform } from "react-native";

import { copy, fill } from "@/copy";
import { engine } from "@/store";
import { clock } from "@/units";

type NotificationsModule = typeof import("expo-notifications");

let notifications: NotificationsModule | null = null;
let currentId: string | null = null;
let ticket = 0;

function lib(): NotificationsModule | null {
  if (Platform.OS === "web") return null;
  if (!notifications) {
    // Loaded lazily so web and tests don't pull in the native module.
    notifications = require("expo-notifications") as NotificationsModule;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return notifications;
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

/** Schedule the chime for the end of rest. Cancels the previous one. No-op when the sound setting is off. */
export async function armRest(seconds: number) {
  const my = ++ticket;
  const previous = currentId || engine.wk.rest?.noteId || null;
  currentId = null;
  await cancelId(previous);
  const N = lib();
  if (!N || (engine.wk.sound || "Yes") === "No" || seconds < 1 || !engine.wk.rest) return;
  const existing = await N.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") status = (await N.requestPermissionsAsync()).status;
  if (status !== "granted" || my !== ticket || !engine.wk.rest) return;
  const id = await N.scheduleNotificationAsync({
    content: {
      title: fill(copy.workout.goOver, clock(0)),
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
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
  await cancelId(id);
}
