import { Path, Rect } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function TabPlan({ size = 22, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Rect
        x={3.5}
        y={5}
        width={17}
        height={15}
        rx={2.5}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 9.5h17M8 3v4M16 3v4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconSvg>
  );
}
