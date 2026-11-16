import { useEffect, useRef, useState, type ReactNode } from "react";
import { type GestureResponderEvent, StyleSheet, Text, View } from "react-native";
import { GestureDetector, Touchable, usePanGesture } from "react-native-gesture-handler";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { haptic } from "@/haptic";
import { createSwipeRegistry, SWIPE_WIDTH, swipeActionShown, swipeDrag, swipeFullAt, swipeSettle } from "@/swipe-settle";
import { theme } from "@/theme";

const rows = createSwipeRegistry();
const SETTLE_MS = 180;

/** Put on the screen's root view: a touch anywhere but the open row's Delete closes that row. */
export const swipeCloseCapture = {
  onStartShouldSetResponderCapture(event: GestureResponderEvent) {
    rows.touch(event.nativeEvent.pageX, event.nativeEvent.pageY);
    return false;
  },
};

/** Closes any open row, e.g. when the list starts scrolling. */
export function closeOpenSwipe() {
  rows.closeAll();
}

/**
 * Swipe left to reveal Delete; keep going past the full-swipe point and let go to delete (iOS Mail style).
 * The row always comes to rest fully closed, fully open or deleted, including when the swipe is
 * interrupted or the list takes over to scroll.
 */
export function SwipeDelete({
  children,
  label,
  onDelete,
}: {
  children: ReactNode;
  label: string;
  onDelete: () => void;
}) {
  const key = useRef({}).current;
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const velocity = useSharedValue(0);
  const dragging = useSharedValue(false);
  const rowWidth = useSharedValue(0);
  const armed = useSharedValue(false);
  const [open, setOpen] = useState(false);
  const action = useRef<{ measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void } | null>(null);

  function close() {
    cancelAnimation(x);
    x.value = withTiming(0, { duration: SETTLE_MS });
    setOpen(false);
  }

  function dragStarted() {
    rows.claim(key, close);
  }

  function settled(to: number) {
    if (to === 0) {
      rows.release(key);
      setOpen(false);
      return;
    }
    if (!rows.isOpen(key)) haptic.medium();
    rows.claim(key, close);
    setOpen(true);
    action.current?.measureInWindow((left, top, width, height) => rows.setRect(key, { x: left, y: top, width, height }));
  }

  function armChanged(on: boolean) {
    if (on) haptic.medium();
    else haptic.tap();
  }

  function fullSwiped() {
    rows.release(key);
    setOpen(false);
    onDelete();
    x.value = 0;
  }

  useEffect(() => () => rows.release(key), [key]);

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onActivate: () => {
      "worklet";
      cancelAnimation(x);
      start.value = x.value;
      velocity.value = 0;
      dragging.value = true;
      armed.value = false;
      runOnJS(dragStarted)();
    },
    onUpdate: (event) => {
      "worklet";
      x.value = swipeDrag(start.value, event.translationX, SWIPE_WIDTH, rowWidth.value);
      velocity.value = event.velocityX;
      const past = x.value <= -swipeFullAt(rowWidth.value, SWIPE_WIDTH);
      if (past !== armed.value) {
        armed.value = past;
        runOnJS(armChanged)(past);
      }
    },
    onFinalize: () => {
      "worklet";
      if (!dragging.value) return;
      dragging.value = false;
      const to = swipeSettle(x.value, velocity.value, SWIPE_WIDTH, rowWidth.value);
      velocity.value = 0;
      armed.value = false;
      if (to < -SWIPE_WIDTH) {
        x.value = withTiming(to, { duration: SETTLE_MS }, (done) => {
          if (done) runOnJS(fullSwiped)();
        });
        return;
      }
      x.value = withTiming(to, { duration: SETTLE_MS });
      runOnJS(settled)(to);
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // The red area grows with the row past fully open, the way Mail's does on a full swipe.
  const actionStyle = useAnimatedStyle(() => ({
    opacity: swipeActionShown(x.value) ? 1 : 0,
    width: Math.max(SWIPE_WIDTH, -x.value),
  }));

  return (
    <View style={styles.wrap} onLayout={(event) => (rowWidth.value = event.nativeEvent.layout.width)}>
      <Animated.View ref={action as never} style={[styles.action, actionStyle]} pointerEvents={open ? "auto" : "none"}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            cancelAnimation(x);
            x.value = 0;
            rows.release(key);
            setOpen(false);
            onDelete();
          }}
          style={styles.delete}
        >
          <Text style={styles.deleteText}>{label}</Text>
        </Touchable>
      </Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={rowStyle}>
          {children}
          {open ? <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} onResponderRelease={close} /> : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  action: { position: "absolute", top: 0, right: 0, bottom: 0, width: SWIPE_WIDTH },
  delete: {
    flex: 1,
    backgroundColor: "#8f3a32",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
