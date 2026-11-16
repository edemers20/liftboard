import { useRef, type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { Touchable } from "react-native-gesture-handler";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { haptic } from "@/haptic";
import { theme } from "@/theme";

/**
 * Hidden until the row moves: rows without their own fill would otherwise show it at rest.
 * A gesture-handler button, so the swipe can't swallow the tap.
 */
function DeleteAction({
  progress,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  const shown = useAnimatedStyle(() => ({ opacity: progress.value > 0.02 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.action, shown]}>
      <Touchable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.delete}>
        <Text style={styles.deleteText}>{label}</Text>
      </Touchable>
    </Animated.View>
  );
}

/** Swipe left to reveal Delete. A haptic fires when the button is revealed. Delete closes the row first. */
export function SwipeDelete({
  children,
  label,
  onDelete,
}: {
  children: ReactNode;
  label: string;
  onDelete: () => void;
}) {
  const revealed = useRef(false);
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (revealed.current) return;
        revealed.current = true;
        haptic.medium();
      }}
      onSwipeableClose={() => {
        revealed.current = false;
      }}
      renderRightActions={(progress: SharedValue<number>, _translation: SharedValue<number>, methods: SwipeableMethods) => (
        <DeleteAction
          progress={progress}
          label={label}
          onPress={() => {
            methods.close();
            revealed.current = false;
            onDelete();
          }}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: 88 },
  delete: {
    flex: 1,
    backgroundColor: "#8f3a32",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
