import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { Path } from "react-native-svg";

import { useReduceMotion } from "@/use-reduce-motion";

import { IconSvg } from "./svg";
import type { IconProps } from "./types";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const LENGTH = 24;

export function Check({ size = 28, color = "#6fd0b4", draw = false }: IconProps & { draw?: boolean }) {
  const reduceMotion = useReduceMotion();
  const offset = useRef(new Animated.Value(draw ? LENGTH : 0)).current;
  const opacity = useRef(new Animated.Value(draw && reduceMotion ? 0 : 1)).current;

  useEffect(() => {
    if (!draw) return;
    if (reduceMotion) {
      offset.setValue(0);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }).start();
      return;
    }
    offset.setValue(LENGTH);
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: 420,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [draw, offset, reduceMotion]);

  return (
    <IconSvg size={size}>
      <AnimatedPath
        d="M6 12.4l3.9 3.9L18 8.1"
        opacity={opacity}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={draw ? LENGTH : undefined}
        strokeDashoffset={draw ? offset : 0}
      />
    </IconSvg>
  );
}
