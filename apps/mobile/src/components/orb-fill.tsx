import { LinearGradient } from "expo-linear-gradient";
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * A lit fill for a card: a diagonal gradient with a soft glow near the top left, like a lit orb.
 * Put it first inside a card with `overflow: "hidden"`; the card's content draws over it.
 */
export function OrbFill({
  colors,
  glow,
  glowOpacity,
  at = { x: 0.3, y: 0.22 },
  reach = 0.55,
}: {
  colors: readonly [string, string];
  glow: string;
  glowOpacity: number;
  at?: { x: number; y: number };
  reach?: number;
}) {
  const id = `orb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors} start={{ x: 0.29, y: 0 }} end={{ x: 0.71, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx={at.x} cy={at.y} r={reach} fx={at.x} fy={at.y}>
            <Stop offset="0" stopColor={glow} stopOpacity={glowOpacity} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
