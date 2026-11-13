import type { ReactNode } from "react";
import { View } from "react-native";
import Svg from "react-native-svg";

/** Outline icon frame. Stroke width stays in the 24 (or 20) grid, so it scales with `size`. */
export function IconSvg({
  size,
  viewBox = "0 0 24 24",
  children,
}: {
  size: number;
  viewBox?: string;
  children: ReactNode;
}) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={viewBox} fill="none">
        {children}
      </Svg>
    </View>
  );
}
