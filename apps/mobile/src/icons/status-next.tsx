import { Circle, Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function StatusNext({ size = 20, color = "#181513" }: IconProps) {
  return (
    <IconSvg size={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={9} fill="#6fd0b4" />
      <Path
        d="M8.3 6.3L12 10l-3.7 3.7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
