import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function TabWorkouts({ size = 22, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path
        d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
