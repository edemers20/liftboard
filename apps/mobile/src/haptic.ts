import * as Haptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

/**
 * Every haptic in the app goes through here.
 * `haptic.setEnabled(false)` silences them, and so does Reduce Motion.
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

function fire(run: () => Promise<void>) {
  if (!enabled || reduceMotion) return;
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
};
