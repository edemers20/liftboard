import { GlassView } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { PressableScale } from "@/components/pressable-scale";
import { LIME_GLASS, useSolidGlass } from "@/glass";
import { theme } from "@/theme";

const SIZE = 44;

/** Round icon-only header control in the live pill's lime glass; a solid circle where glass can't draw. */
export function GlassIconButton({
  label,
  onPress,
  expanded,
  children,
}: {
  label: string;
  onPress: () => void;
  expanded?: boolean;
  children: ReactNode;
}) {
  const solid = useSolidGlass();
  return (
    <PressableScale
      kind="plain"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
    >
      {solid ? (
        <View style={[StyleSheet.absoluteFill, styles.solid]} />
      ) : (
        <>
          <GlassView
            isInteractive
            colorScheme="dark"
            tintColor={LIME_GLASS.tint}
            glassEffectStyle={{ style: "regular", animate: false }}
            style={[StyleSheet.absoluteFill, styles.round]}
          />
          <LinearGradient
            colors={LIME_GLASS.wash}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.round, styles.wash]}
            pointerEvents="none"
          />
        </>
      )}
      {/* A positioned wrapper keeps the icon above the absolute fill on web. */}
      <View>{children}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: LIME_GLASS.edge,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  round: { borderRadius: theme.radii.pill },
  wash: { opacity: LIME_GLASS.washOpacity },
  solid: { borderRadius: theme.radii.pill, backgroundColor: theme.green.surface },
  pressed: { opacity: 0.7 },
});
