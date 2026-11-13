import * as Haptics from "expo-haptics";

/**
 * Every haptic in the app goes through here, so they stay consistent
 * and can be silenced with `haptic.setEnabled(false)`.
 */
let enabled = true;

function fire(run: () => Promise<void>) {
  if (!enabled) return;
  void run().catch(() => {});
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const haptic = {
  setEnabled(on: boolean) {
    enabled = on;
  },
  /** Light impact. */
  tap() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** Two light impacts, close together. */
  doubleTap() {
    fire(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await wait(90);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
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
