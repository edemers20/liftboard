import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { PressableScale } from "@/components/pressable-scale";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { copy, fill } from "@/copy";
import { useSolidGlass } from "@/glass";
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
  const [mounted, setMounted] = useState(open);
  const [glassOn, setGlassOn] = useState(false);
  const gap = useRestGap(open && mounted, reduce);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setGlassOn(true));
      return () => cancelAnimationFrame(frame);
    }
    setGlassOn(false);
    if (reduce) {
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => setMounted(false), MOVE_MS);
    return () => clearTimeout(timer);
  }, [open, reduce]);

  const view = rest ?? latest.current;
  if (!mounted || !view) return null;

  const label = fill(copy.workout.rest, clock(view.over ? 0 : view.seconds));
  const soon = !view.over && view.seconds <= 10;
  const tint = view.over ? theme.fuel : soon ? SOON : undefined;
  const effect = {
    style: glassOn ? ("regular" as const) : ("none" as const),
    animate: true,
    animationDuration: reduce ? 0.01 : MOVE_MS / 1000,
  };

  return (
    <View pointerEvents="box-none" style={[styles.float, { bottom }]}>
      {solid ? (
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
    </View>
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

function Side({ label, over, onPress }: { label: string; over: boolean; onPress: () => void }) {
  return (
    <PressableScale kind="button" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.hit}>
      <Text style={[styles.side, over && styles.onGo]}>{label}</Text>
    </PressableScale>
  );
}

function Middle({ label, over, onSkip }: { label: string; over: boolean; onSkip: () => void }) {
  return (
    <View style={styles.mid}>
      <Text style={[styles.clock, over && styles.onGo]}>{label}</Text>
      <PressableScale kind="text" accessibilityRole="button" onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} style={styles.skip}>
        <Text style={[styles.skipText, over && styles.onGo]}>{over ? copy.workout.done : copy.workout.skip}</Text>
      </PressableScale>
    </View>
  );
}

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
  mid: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center" },
  side: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  clock: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 17, lineHeight: 20 },
  skip: { minHeight: 32, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  skipText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    textDecorationLine: "underline",
    textDecorationColor: theme.muted,
  },
  onGo: { color: "#181513", textDecorationColor: "#181513" },
});
