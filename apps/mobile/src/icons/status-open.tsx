import { Circle } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function StatusOpen({ size = 20, color = "#3a3431" }: IconProps) {
  return (
    <IconSvg size={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={8.25} stroke={color} strokeWidth={1.5} />
    </IconSvg>
  );
}
