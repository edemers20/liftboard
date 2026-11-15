import { GlassView } from "expo-glass-effect";
import { StyleSheet, Text } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { copy } from "@/copy";
import { useSolidGlass } from "@/glass";
import { theme } from "@/theme";

const TINT = "rgba(111, 208, 180, 0.34)";

/** Workouts header control. Glass when another day is showing; dim and still on today. */
export function TodayButton({ today, onPress }: { today: boolean; onPress: () => void }) {
  const solid = useSolidGlass();
  const label = (
    <Text style={[styles.label, today && styles.labelOff, solid && !today && styles.labelOn]}>{copy.workouts.today}</Text>
  );

  if (solid || today) {
    return (
      <PressableScale
        kind="button"
        disabled={today}
        accessibilityRole="button"
        accessibilityState={{ disabled: today }}
        onPress={onPress}
        style={[styles.hit, solid && !today ? styles.solidOn : styles.solid, today && styles.dim]}
      >
        {label}
      </PressableScale>
    );
  }

  return (
    <PressableScale kind="plain" accessibilityRole="button" onPress={onPress} style={styles.hit}>
      <GlassView isInteractive colorScheme="dark" tintColor={TINT} glassEffectStyle={{ style: "regular" }} style={styles.glass}>
        {label}
      </GlassView>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: 44, borderRadius: theme.radii.pill, justifyContent: "center" },
  glass: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: theme.radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  solid: {
    paddingHorizontal: 16,
    backgroundColor: theme.green.surface,
    alignItems: "center",
  },
  solidOn: { backgroundColor: "#1d3a34" },
  dim: { opacity: 0.4 },
  label: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  labelOn: { color: theme.green.accent },
  labelOff: { color: theme.muted },
});
