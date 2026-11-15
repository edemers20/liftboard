import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { type LayoutChangeEvent } from "react-native";
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { settleHideScroll, stepHideScroll } from "@/hide-scroll";
import { useReduceMotion } from "@/use-reduce-motion";

const SPRING = { duration: 200, dampingRatio: 1 };

/**
 * One header behaviour for every tab and the workout screen.
 * `space` is the measured header height; keep it as scroll padding so content does not jump.
 */
export function useHideOnScroll() {
  const reduce = useReduceMotion();
  const reduceSv = useSharedValue(false);
  const height = useSharedValue(0);
  const offset = useSharedValue(0);
  const pending = useSharedValue(0);
  const lastY = useSharedValue(0);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const [space, setSpace] = useState(0);
  const [blocks, setBlocks] = useState(true);

  useEffect(() => {
    reduceSv.value = reduce;
  }, [reduce, reduceSv]);

  const show = useCallback(() => {
    offset.value = 0;
    pending.value = 0;
    lastY.value = 0;
  }, [lastY, offset, pending]);

  useFocusEffect(
    useCallback(() => {
      show();
    }, [show]),
  );

  const onHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      height.value = next;
      if (offset.value > next) offset.value = next;
      setSpace((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    },
    [height, offset],
  );

  const settle = (y: number) => {
    "worklet";
    const target = settleHideScroll(offset.value, y, height.value);
    pending.value = 0;
    if (Math.abs(offset.value - target) < 0.5) {
      offset.value = target;
      return;
    }
    offset.value = withSpring(target, SPRING);
  };

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      dragging.value = true;
      momentum.value = false;
      lastY.value = event.contentOffset.y;
      pending.value = 0;
    },
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;
      // A new list, or a jump to the top, is not a finger move.
      if (Math.abs(dy) > 240) {
        pending.value = 0;
        if (y <= 0) offset.value = 0;
        return;
      }
      const next = stepHideScroll({ offset: offset.value, pending: pending.value }, y, dy, height.value);
      offset.value = next.offset;
      pending.value = next.pending;
    },
    onEndDrag: (event) => {
      dragging.value = false;
      if (!momentum.value) settle(event.contentOffset.y);
    },
    onMomentumBegin: () => {
      momentum.value = true;
    },
    onMomentumEnd: (event) => {
      momentum.value = false;
      if (!dragging.value) settle(event.contentOffset.y);
    },
  });

  useAnimatedReaction(
    () => height.value <= 0 || offset.value < height.value * 0.98,
    (next, prev) => {
      if (next !== prev) runOnJS(setBlocks)(next);
    },
  );

  /** Slides the header up with the finger. Reduce Motion keeps it in place and fades it. */
  const chromeStyle = useAnimatedStyle(() => {
    const shift = reduceSv.value ? 0 : -offset.value;
    return { transform: [{ translateY: shift }] };
  });

  /** Sits under the header, then rides up with it. */
  const dockStyle = useAnimatedStyle(() => {
    const shift = reduceSv.value ? 0 : offset.value;
    return { top: height.value - shift };
  });

  /** Reduce Motion fades instead of sliding. */
  const headerStyle = useAnimatedStyle(() => {
    if (!reduceSv.value) return { opacity: 1 };
    const span = height.value;
    const gone = span > 0 ? Math.min(1, Math.max(0, offset.value / span)) : 0;
    return { opacity: 1 - gone };
  });

  return { onScroll, chromeStyle, dockStyle, headerStyle, onHeaderLayout, space, show, blocks };
}

export type HideOnScroll = ReturnType<typeof useHideOnScroll>;
