import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function Edit({ size = 18, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M13.5 6.5l4 4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </IconSvg>
  );
}
