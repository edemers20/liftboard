import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { useReduceMotion } from "@/use-reduce-motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressKind = "button" | "surface" | "text" | "tab" | "plain";

const PRESS_IN = 80;
const PRESS_OUT = 140;

type Props = Omit<PressableProps, "style" | "children"> & {
  kind?: PressKind;
  /**
   * Selected pills and switches. Any change after mount flashes brighter.
   * Leave unset on controls that should not flash.
   */
  brighten?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: ReactNode;
};

/** Shared press feedback. Disabled controls stay still. A scroll cancels the press. */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { kind = "button", brighten, disabled, style, children, onPressIn, onPressOut, ...rest },
  ref,
) {
  const reduce = useReduceMotion();
  const [down, setDown] = useState(false);
  const scale = useSharedValue(1);
  const shade = useSharedValue(0);
  const flash = useSharedValue(0);
  const skipFlash = useRef(true);

  useEffect(() => {
    if (brighten === undefined) return;
    if (skipFlash.current) {
      skipFlash.current = false;
      return;
    }
    flash.value = withSequence(withTiming(0.28, { duration: PRESS_IN }), withTiming(0, { duration: PRESS_OUT }));
  }, [brighten, flash]);

  const scaleTo = kind === "surface" ? 0.985 : kind === "tab" ? 0.88 : kind === "button" ? 0.96 : 1;
  const darken = kind === "surface" ? 0.1 : kind === "button" || (kind === "tab" && reduce) ? 0.15 : 0;

  function pressIn(event: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) {
    if (disabled) return;
    setDown(true);
    if (!reduce && scaleTo !== 1) scale.value = withTiming(scaleTo, { duration: PRESS_IN });
    if (kind === "text" || darken > 0) shade.value = withTiming(1, { duration: PRESS_IN });
    onPressIn?.(event);
  }

  function pressOut(event: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) {
    setDown(false);
    scale.value = withTiming(1, { duration: PRESS_OUT });
    shade.value = withTiming(0, { duration: PRESS_OUT });
    onPressOut?.(event);
  }

  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: kind === "text" ? 1 - shade.value * 0.4 : 1,
  }));
  const dim = useAnimatedStyle(() => ({ opacity: shade.value * darken }));
  const glow = useAnimatedStyle(() => ({ opacity: flash.value }));
  const resolved = typeof style === "function" ? style({ pressed: down }) : style;

  return (
    <AnimatedPressable
      ref={ref as never}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[resolved, motion, kind === "button" || kind === "surface" ? styles.clip : null]}
      {...rest}
    >
      {children}
      {darken > 0 ? <Animated.View pointerEvents="none" style={[styles.shade, dim]} /> : null}
      {brighten !== undefined ? <Animated.View pointerEvents="none" style={[styles.glow, glow]} /> : null}
    </AnimatedPressable>
  );
});

const fill = { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0 };

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  shade: { ...fill, backgroundColor: "#000" },
  glow: { ...fill, backgroundColor: "#fff" },
});
