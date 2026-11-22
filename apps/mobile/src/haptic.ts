import * as Haptics from "expo-haptics";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Every haptic in the app goes through here.
 * `haptic.setEnabled(false)` silences them, and so does Reduce Motion (except the rest-end alert).
 */
let enabled = true;
let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => {});
const reduceMotionWatch = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => {
  reduceMotion = on;
});
void reduceMotionWatch;

function fire(run: () => Promise<void>, alert = false) {
  if (!enabled || (reduceMotion && !alert) || Platform.OS === "web") return;
  void run().catch(() => {});
}

export const haptic = {
  setEnabled(on: boolean) {
    enabled = on;
  },
  /** Light impact. */
  tap() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  medium() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  heavy() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  selection() {
    fire(() => Haptics.selectionAsync());
  },
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  /** Rest is over. Information, not motion, so Reduce Motion keeps it; it is the backup when sound is muted. */
  alert() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), true);
  },
};
