import { Path } from "react-native-svg";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

export function Close({ size = 14, color = "#ffffff" }: IconProps) {
  return (
    <IconSvg size={size}>
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </IconSvg>
  );
}
