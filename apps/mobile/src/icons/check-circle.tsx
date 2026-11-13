import { Circle, Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function CheckCircle({ size = 28, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
