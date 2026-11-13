import { Circle, Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function TabYou({ size = 22, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
