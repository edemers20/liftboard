import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function TabHistory({ size = 22, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path
        d="M4 19V11M10 19V5M16 19v-6M22 19H2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
