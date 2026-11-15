import { useEffect, useRef, useState } from "react";
import { PressableScale } from "@/components/pressable-scale";
import { StyleSheet, Text } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { theme } from "@/theme";

/** ‹ › beside a date. Pressed fill is the tab colour; the arrow stays dark on it for at least 140ms. */
export function StepButton({
  glyph,
  label,
  disabled,
  reduce,
  onPress,
  surface,
  hot,
  ink,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  reduce: boolean;
  onPress: () => void;
  surface: string;
  hot: string;
  ink: string;
}) {
  const scale = useSharedValue(1);
  const [on, setOn] = useState(false);
  const down = useRef(0);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const look = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(
    () => () => {
      if (hold.current) clearTimeout(hold.current);
    },
    [],
  );

  return (
    <Reanimated.View style={look}>
      <PressableScale
        kind="plain"
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        onPressIn={() => {
          if (disabled) return;
          down.current = Date.now();
          if (hold.current) clearTimeout(hold.current);
          setOn(true);
          if (!reduce) scale.value = withTiming(0.96, { duration: 80 });
        }}
        onPressOut={() => {
          if (!reduce) scale.value = withTiming(1, { duration: 140 });
          const left = Math.max(0, 140 - (Date.now() - down.current));
          hold.current = setTimeout(() => setOn(false), left);
        }}
        onPress={onPress}
        style={[styles.button, { backgroundColor: on ? hot : surface }, disabled && styles.off]}
      >
        <Text style={[styles.glyph, { color: on ? ink : theme.text }]}>{glyph}</Text>
      </PressableScale>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  off: { opacity: 0.35 },
  glyph: { fontSize: 22, lineHeight: 24 },
});
