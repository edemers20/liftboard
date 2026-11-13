import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function Swap({ size = 16, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path
        d="M4 8h13l-3-3M20 16H7l3 3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
