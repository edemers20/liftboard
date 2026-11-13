import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function Fuel({ size = 28, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path
        d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 2-6 5-10Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
