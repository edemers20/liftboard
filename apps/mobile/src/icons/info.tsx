import { Circle, Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function Info({ size = 16, color = "#edeae8" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Circle cx={12} cy={12} r={9.75} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 10.8v6M12 7.2v.3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </IconSvg>
  );
}
