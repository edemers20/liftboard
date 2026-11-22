"use no memo";

import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { PressableScale } from "@/components/pressable-scale";
import { memo, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { copy, fill } from "@/copy";
import { useSolidGlass } from "@/glass";
import { useSecondClock } from "@/second-clock";
import { theme } from "@/theme";
import { clock } from "@/units";
import { useReduceMotion } from "@/use-reduce-motion";

type Rest = { over: boolean; seconds: number; why: string; end: number };

const SPLIT = 14;
const MERGE = 8;
const MOVE_MS = 320;
/** Soft red wash for the last 10 seconds. Go replaces it at zero. */
const SOON = "rgba(196, 72, 64, 0.45)";
const SOON_SOLID = "#5c3836";
const effect = {
  style: "regular" as const,
  animate: false,
  animationDuration: 0.01,
};

function glassApi(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

function useSolidRest(): boolean {
  return useSolidGlass();
}

/** 0 while the side buttons are merged into the timer, then the gap that splits them. */
function useRestGap(open: boolean, reduce: boolean): number {
  const [gap, setGap] = useState(0);
  const gapRef = useRef(0);
  useEffect(() => {
    const target = open ? SPLIT : 0;
    if (reduce) {
      gapRef.current = target;
      setGap(target);
      return;
    }
    const from = gapRef.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / MOVE_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (target - from) * eased;
      gapRef.current = next;
      setGap(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, reduce]);
  return gap;
}

export function RestBar({
  rest,
  bottom,
  onMinus,
  onPlus,
  onSkip,
}: {
  rest: Rest | null;
  bottom: number;
  onMinus: () => void;
  onPlus: () => void;
  onSkip: () => void;
}) {
  const solid = useSolidRest();
  const reduce = useReduceMotion();
  const latest = useRef<Rest | null>(rest);
  if (rest) latest.current = rest;
  const open = rest != null;
  const [mounted, setMounted] = useState(false);
  /** Clock ticks here only; the workout screen does not re-render every second for rest. */
  useSecondClock(!!rest?.end);
  const nowRef = useRef(Date.now());
  if (rest?.end) nowRef.current = Date.now();
  const now = nowRef.current;
  const opacity = useSharedValue(0);
  const gap = useRestGap(open && mounted, reduce);
  const canGlass = !solid && glassApi();

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Glass is on from the first painted frame; fade chrome + words together (no words-before-glass).
      opacity.value = reduce ? 1 : 0;
      if (!reduce) {
        opacity.value = withTiming(1, {
          duration: MOVE_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
      return;
    }
    if (reduce) {
      opacity.value = 0;
      setMounted(false);
      return;
    }
    opacity.value = withTiming(0, { duration: MOVE_MS, easing: Easing.in(Easing.cubic) });
    const timer = setTimeout(() => setMounted(false), MOVE_MS);
    return () => clearTimeout(timer);
  }, [open, reduce, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const base = rest ?? latest.current;
  if (!mounted || !base) return null;

  const left = (base.end - now) / 1000;
  const view: Rest = {
    ...base,
    over: left <= 0,
    seconds: left <= 0 ? 0 : Math.round(left),
  };
  const label = fill(copy.workout.rest, clock(view.over ? 0 : view.seconds));
  const soon = !view.over && view.seconds <= 10;
  const tint = view.over ? theme.fuel : soon ? SOON : undefined;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.float, { bottom }, fadeStyle]}>
      {solid || !canGlass ? (
        <View style={[styles.solid, soon && styles.solidSoon, view.over && styles.solidGo]}>
          <Zones view={view} label={label} onMinus={onMinus} onPlus={onPlus} onSkip={onSkip} />
        </View>
      ) : (
        <GlassContainer spacing={MERGE} style={[styles.row, { gap }]}>
          <GlassView isInteractive colorScheme="dark" tintColor={tint} glassEffectStyle={effect} style={styles.sidePiece}>
            <Side label={copy.workout.minus15} over={view.over} onPress={onMinus} />
          </GlassView>
          <GlassView isInteractive colorScheme="dark" tintColor={tint} glassEffectStyle={effect} style={styles.midPiece}>
            <Middle label={label} over={view.over} onSkip={onSkip} />
          </GlassView>
          <GlassView isInteractive colorScheme="dark" tintColor={tint} glassEffectStyle={effect} style={styles.sidePiece}>
            <Side label={copy.workout.plus15} over={view.over} onPress={onPlus} />
          </GlassView>
        </GlassContainer>
      )}
    </Animated.View>
  );
}

function Zones({
  view,
  label,
  onMinus,
  onPlus,
  onSkip,
}: {
  view: Rest;
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <Side label={copy.workout.minus15} over={view.over} onPress={onMinus} />
      <Middle label={label} over={view.over} onSkip={onSkip} />
      <Side label={copy.workout.plus15} over={view.over} onPress={onPlus} />
    </>
  );
}

/** Memoized: the gap animation redraws the bar every frame, the buttons only when their text changes. */
const Side = memo(function Side({ label, over, onPress }: { label: string; over: boolean; onPress: () => void }) {
  return (
    <PressableScale kind="button" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.hit}>
      <Text style={[styles.side, over && styles.onGo]}>{label}</Text>
    </PressableScale>
  );
});

const Middle = memo(function Middle({ label, over, onSkip }: { label: string; over: boolean; onSkip: () => void }) {
  return (
    <View style={styles.mid}>
      <Text style={[styles.clock, over && styles.onGo]}>{label}</Text>
      <PressableScale kind="text" accessibilityRole="button" onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} style={styles.skip}>
        <Text style={[styles.skipText, over && styles.onGo]}>{over ? copy.workout.done : copy.workout.skip}</Text>
      </PressableScale>
    </View>
  );
});

const styles = StyleSheet.create({
  float: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 25,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  sidePiece: {
    borderRadius: 28,
    justifyContent: "center",
  },
  midPiece: {
    flex: 1,
    borderRadius: 28,
    justifyContent: "center",
  },
  solid: {
    minHeight: 64,
    borderRadius: 999,
    backgroundColor: theme.green.surface,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  solidSoon: { backgroundColor: SOON_SOLID },
  solidGo: { backgroundColor: theme.fuel },
  hit: {
    minWidth: 84,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  mid: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 2 },
  side: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  clock: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 17, lineHeight: 20 },
  skip: {
    minHeight: 36,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  skipText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    textDecorationLine: "underline",
    textDecorationColor: theme.muted,
  },
  onGo: { color: "#181513", textDecorationColor: "#181513" },
});
