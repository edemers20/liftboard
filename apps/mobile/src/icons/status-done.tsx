import { Circle, Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function StatusDone({ size = 20, color = "#a8a09c" }: IconProps) {
  return (
    <IconSvg size={size} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={9} fill="#34302c" />
      <Path
        d="M6 10.3l2.6 2.6L14 7.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
