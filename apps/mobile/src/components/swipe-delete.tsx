import { useRef, type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { PressableScale } from "@/components/pressable-scale";
import { haptic } from "@/haptic";
import { theme } from "@/theme";

/** Swipe left to reveal Delete. A haptic fires when the button is revealed. */
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
      renderRightActions={() => (
        <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onDelete} style={styles.delete}>
          <Text style={styles.deleteText}>{label}</Text>
        </PressableScale>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  delete: {
    width: 88,
    backgroundColor: "#8f3a32",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
