import { GlassView } from "expo-glass-effect";
import { StyleSheet, View, type ViewProps } from "react-native";

import { useSolidGlass } from "@/glass";

/** "#rrggbb" at the given opacity; other colours pass through. */
function tintOf(color: unknown, alpha: number): string | undefined {
  if (typeof color !== "string") return undefined;
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * A pop-up card (confirmations, the number dial, the exercise picker). Where Liquid Glass can draw, the card's
 * solid fill becomes glass tinted with that colour, so each sheet keeps its palette; elsewhere it stays solid.
 * `solid` keeps the fill on glass devices too (Day done).
 */
export function GlassSheet({ style, children, solid: keepSolid = false, ...rest }: ViewProps & { solid?: boolean }) {
  const noGlass = useSolidGlass();
  if (noGlass || keepSolid) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }
  const flat = StyleSheet.flatten(style) ?? {};
  return (
    <View style={[style, styles.clear]} {...rest}>
      <GlassView
        colorScheme="dark"
        tintColor={tintOf(flat.backgroundColor, 0.6)}
        glassEffectStyle={{ style: "regular" }}
        style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clear: { backgroundColor: "transparent", overflow: "hidden" },
});
