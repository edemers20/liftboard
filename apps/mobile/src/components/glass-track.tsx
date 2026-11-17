import { GlassView } from "expo-glass-effect";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useSolidGlass } from "@/glass";
import { theme } from "@/theme";

/**
 * The track behind an in-page switch (Plan Week/Season, History Calendar/Weeks/Lifts). Liquid Glass where it
 * can draw; a solid track on older iOS, other platforms and Reduce Transparency. The segments go inside.
 */
export function GlassTrack({ children, label, style }: { children: ReactNode; label?: string; style?: StyleProp<ViewStyle> }) {
  const solid = useSolidGlass();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, solid && styles.solid, style]}>
      {solid ? null : (
        <GlassView colorScheme="dark" glassEffectStyle={{ style: "regular" }} style={[StyleSheet.absoluteFill, styles.glass]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", alignItems: "stretch", minHeight: 44, borderRadius: theme.radii.pill, padding: 3 },
  solid: { backgroundColor: theme.orange.surface },
  glass: { borderRadius: theme.radii.pill },
});
