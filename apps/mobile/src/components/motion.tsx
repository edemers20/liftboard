import { usePathname } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useNotice } from "@/activity-log";
import { copy } from "@/copy";
import { haptic } from "@/haptic";
import { planColors } from "@/components/plan-widgets";
import { theme } from "@/theme";
import { useReduceMotion } from "@/use-reduce-motion";

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Overlay fades to 75% black. The sheet slides up, or fades when Reduce Motion is on. */
export function SheetFrame({
  visible,
  onClose,
  label,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  label?: string;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShown(true);
      progress.value = reduce ? 0 : 0;
      progress.value = withTiming(1, { duration: reduce ? 160 : 320, easing: ease });
      return;
    }
    progress.value = withTiming(0, { duration: reduce ? 120 : 220, easing: ease }, (finished) => {
      if (finished) runOnJS(setShown)(false);
    });
  }, [progress, reduce, visible]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduce ? progress.value : 1,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * 36 }],
  }));

  if (!shown && !visible) return null;

  return (
    <Modal visible={shown} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View pointerEvents="none" style={[styles.dim, dimStyle]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label ?? copy.close}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={sheetStyle}>{children}</Animated.View>
      </View>
    </Modal>
  );
}

/** Fade the dim and slide a card. Restarts each time `active` turns on. Reduce Motion fades only. */
export function useEnterMotion(active: boolean) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: reduce ? 160 : 320, easing: ease });
  }, [active, progress, reduce]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduce ? progress.value : 1,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * 28 }],
  }));

  return { dimStyle, sheetStyle };
}

/** Rise and fade. Reduce Motion fades in place. */
export function Rise({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const opacity = useSharedValue(0);
  const y = useSharedValue(reduce ? 0 : 12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: reduce ? 160 : 320, easing: ease }));
    if (!reduce) y.value = withDelay(delay, withTiming(0, { duration: 320, easing: ease }));
  }, [delay, opacity, reduce, y]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Tick fill: 1 → 1.15 → 1. Reduce Motion fades instead of scaling. */
export function SetBounce({ on, children }: { on: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const previous = useRef(on);

  useEffect(() => {
    const turnedOn = on && !previous.current;
    previous.current = on;
    if (!turnedOn) return;
    if (reduce) {
      opacity.value = 0.35;
      opacity.value = withTiming(1, { duration: 140 });
      return;
    }
    scale.value = 1;
    scale.value = withSequence(withTiming(1.15, { duration: 90 }), withTiming(1, { duration: 120 }));
  }, [on, opacity, reduce, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={anim}>{children}</Animated.View>;
}

export function useCountUp(target: number, duration = 600) {
  const reduce = useReduceMotion();
  const [value, setValue] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(step);
      else setValue(target);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, reduce, target]);

  return value;
}

/** Slides up 16px and fades in. Leaves after about 2.5s, or when swiped down. */
export function BottomToast({
  lines,
  bottom,
  onDismiss,
  pulse = false,
  variant = "plain",
}: {
  lines: string[];
  bottom: number;
  onDismiss: () => void;
  pulse?: boolean;
  variant?: "plan" | "plain";
}) {
  const reduce = useReduceMotion();
  const opacity = useSharedValue(0);
  const y = useSharedValue(reduce ? 0 : 16);
  const drag = useSharedValue(0);
  const gone = useRef(false);
  const dismissRef = useRef<() => void>(() => {});

  function dismiss() {
    if (gone.current) return;
    gone.current = true;
    opacity.value = withTiming(0, { duration: reduce ? 120 : 180 });
    drag.value = withTiming(0, { duration: 0 });
    y.value = withTiming(reduce ? 0 : 16, { duration: reduce ? 0 : 180 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }

  dismissRef.current = dismiss;

  useEffect(() => {
    if (pulse) haptic.tap();
    opacity.value = withTiming(1, { duration: reduce ? 160 : 220, easing: ease });
    if (!reduce) y.value = withTiming(0, { duration: 220, easing: ease });
    const timer = setTimeout(() => dismissRef.current(), 2500);
    return () => clearTimeout(timer);
  }, [opacity, pulse, reduce, y]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        drag.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 24 || gesture.vy > 0.6) dismissRef.current();
        else drag.value = withTiming(0, { duration: 160 });
      },
    }),
  ).current;

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value + drag.value }],
  }));

  const plan = variant === "plan";

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.toast, plan ? styles.toastPlan : styles.toastPlain, { bottom }, anim]}
      {...pan.panHandlers}
    >
      <Pressable accessibilityRole="alert" onPress={() => dismissRef.current()}>
        <Text style={plan ? styles.planTitle : styles.plainTitle}>{lines[0]}</Text>
        {lines.slice(1).map((line, index) => (
          <Text key={`${index}-${line}`} style={plan && index === 0 ? styles.planStrong : styles.toastBody}>
            {line}
          </Text>
        ))}
      </Pressable>
    </Animated.View>
  );
}

/** One bottom toast for plan changes, logged activities and moves. */
export function NoticeHost() {
  const id = useNotice((state) => state.id);
  const lines = useNotice((state) => state.lines);
  const pulse = useNotice((state) => state.pulse);
  const variant = useNotice((state) => state.variant);
  const insets = useSafeAreaInsets();
  const path = usePathname();
  if (!lines.length) return null;
  const overTabs = path.startsWith("/workout") || path === "/onboarding";
  return (
    <BottomToast
      key={id}
      lines={lines}
      pulse={pulse}
      variant={variant}
      bottom={insets.bottom + (overTabs ? 16 : 64)}
      onDismiss={() => useNotice.getState().clear()}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.75)" },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    zIndex: 40,
  },
  toastPlain: { backgroundColor: theme.green.surface },
  toastPlan: { backgroundColor: planColors.card },
  plainTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  planTitle: {
    color: theme.orange.accent,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: "uppercase",
  },
  planStrong: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15, lineHeight: 20 },
  toastBody: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 20 },
});
