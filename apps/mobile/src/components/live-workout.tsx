"use no memo";

import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/pressable-scale";
import { SheetFrame } from "@/components/motion";
import { NativeTabs } from "expo-router/native-tabs";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copy, fill } from "@/copy";
import { useSolidGlass } from "@/glass";
import { exerciseProgress } from "@/live-activity/state";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { clock } from "@/units";
import { openWorkout } from "@/workout/share-box";

const FLASH_MS = 2500;
const LIME = ["#6fd0b4", "#c8e86a"] as const;
const WARN = "#e07a6a";
const MUTED_PILL = "rgba(237,234,232,0.78)";

/**
 * Reset day deletes the timer, then the open screen can start it again.
 * Hold the pill off until that visit ends.
 */
const quiet = new Set<string>();

export function quietLiveWorkout(id: string) {
  if (id) quiet.add(id);
}

export function releaseLiveWorkout(id: string) {
  quiet.delete(id);
}

export function liveWorkoutHeld(id: string): boolean {
  return quiet.has(id);
}

/** End the live workout as it stands. With no logged sets, the pill goes away. */
export function endLiveWorkout(id: string) {
  const timers = { ...(engine.wk.wt || {}) };
  const current = timers[id];
  if (!current?.start || current.end) return;
  if (!dayHasWork(id)) delete timers[id];
  else timers[id] = { ...current, end: Date.now() };
  engine.wk.wt = timers;
  engine.wk.rest = null;
  engine.save();
}

/** A workout with nothing logged is not live. */
export function releaseEmptyLive(id: string) {
  if (dayHasWork(id)) return;
  const timers = { ...(engine.wk.wt || {}) };
  if (!timers[id]?.start || timers[id]?.end) return;
  delete timers[id];
  engine.wk.wt = timers;
  engine.save();
}

export type LiveWorkout = {
  id: string;
  title: string;
  /** Rest is running, including the "Go" overtime. */
  resting: boolean;
  /** Rest countdown is ≤10s. */
  restUrgent: boolean;
  done: boolean;
  doneAt: number;
  /** Subtitle under the title (`Exercise 2 of 5` or `Rest`). */
  detail: string;
  /** Short form for the minimized tab bar. */
  compact: string;
  /** Elapsed workout seconds. */
  elapsed: number;
  /** Rest seconds left; 0 when over / Go. Null when not resting. */
  restSeconds: number | null;
};

function dayHasWork(id: string): boolean {
  const bag = ((engine.slots || {}) as Record<string, Record<string, { cdone?: boolean; log?: { d?: boolean }[] }>>)[id] || {};
  return Object.values(bag).some((slot) => slot?.cdone || (slot?.log || []).some((row) => row?.d));
}

/** Open, with a set logged, or resting. A finished day is not underway. */
export function workoutUnderway(id: string | null | undefined): boolean {
  if (!id || engine.wk.done?.[id]) return false;
  const timer = (engine.wk.wt || {})[id];
  if (timer?.end) return false;
  if (timer?.start) return true;
  return dayHasWork(id);
}

/** Same numbers as engine.restView, without clearing an expired timer during render. */
function restClock(now: number): { over: boolean; seconds: number } | null {
  const rest = engine.wk.rest;
  if (!rest?.end) return null;
  const left = (rest.end - now) / 1000;
  if (left < -300) return null;
  if (left <= 0) return { over: true, seconds: 0 };
  return { over: false, seconds: Math.round(left) };
}

function elapsedSeconds(id: string, now: number): number {
  const start = ((engine.wk.wt || {}) as Record<string, { start?: number }>)[id]?.start || 0;
  if (!start) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

function liveFrom(id: string, title: string, now: number, doneAt = 0): LiveWorkout {
  const elapsed = elapsedSeconds(id, now);
  if (doneAt && now - doneAt < FLASH_MS) {
    return {
      id,
      title,
      resting: false,
      restUrgent: false,
      done: true,
      doneAt,
      detail: copy.workout.dayDone,
      compact: copy.workout.dayDone,
      elapsed,
      restSeconds: null,
    };
  }
  const rest = restClock(now);
  if (rest) {
    const time = clock(rest.seconds);
    return {
      id,
      title,
      resting: true,
      restUrgent: !rest.over && rest.seconds <= 10,
      done: false,
      doneAt: 0,
      detail: copy.live.rest,
      compact: time,
      elapsed,
      restSeconds: rest.seconds,
    };
  }
  let detail = "";
  try {
    const progress = exerciseProgress(id);
    if (progress) detail = fill(copy.live.exerciseOf, progress.index, progress.total);
  } catch {
    detail = "";
  }
  return {
    id,
    title,
    resting: false,
    restUrgent: false,
    done: false,
    doneAt: 0,
    detail,
    compact: detail || title,
    elapsed,
    restSeconds: null,
  };
}

/** The workout that is underway, or the one just marked done for a moment. */
export function readLiveWorkout(now = Date.now()): LiveWorkout | null {
  const timers = engine.wk.wt || {};
  const started = Object.keys(timers)
    .map((id) => ({ id, start: timers[id]?.start || 0, end: timers[id]?.end || 0 }))
    .filter((item) => item.start)
    .sort((a, b) => b.start - a.start);
  for (const item of started) {
    const day = engine.DAYS.find((entry: any) => entry.id === item.id);
    if (!day) continue;
    const doneAt = (engine.wk.doneT || {})[item.id] || 0;
    const done = !!engine.wk.done?.[item.id];
    if (quiet.has(item.id)) continue;
    if (done) {
      if (now - doneAt >= FLASH_MS) continue;
      return liveFrom(item.id, day.title, now, doneAt);
    }
    if (item.end) continue;
    return liveFrom(item.id, day.title, now);
  }
  const open = (engine.DAYS as { id: string; title: string }[]).find(
    (day) => !quiet.has(day.id) && workoutUnderway(day.id),
  );
  return open ? liveFrom(open.id, open.title, now) : null;
}

function glassTabs(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Older iOS, Android and Reduce Transparency get a solid pill. The tab bar itself is the glass. */
export function useSolidLive(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // iOS only; React Native Web has no isReduceTransparencyEnabled and throws.
    if (Platform.OS !== "ios") return;
    let current = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((on) => {
      if (current) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);
    return () => {
      current = false;
      sub.remove();
    };
  }, []);
  return reduce || !glassTabs();
}

const LiveWorkoutContext = createContext<LiveWorkout | null>(null);

/** One clock for the tab bar and the list spacers under it. */
export function LiveWorkoutState({ live, children }: { live: LiveWorkout | null; children: ReactNode }) {
  return <LiveWorkoutContext.Provider value={live}>{children}</LiveWorkoutContext.Provider>;
}

export function useShownLiveWorkout(): LiveWorkout | null {
  return useContext(LiveWorkoutContext);
}

/** Re-renders as elapsed and rest clocks move, and once the "Day done" flash should leave. */
export function useLiveWorkout(): LiveWorkout | null {
  const version = useEngineStore((state) => state.version);
  const [now, setNow] = useState(() => Date.now());
  const live = readLiveWorkout(now);
  useEffect(() => {
    const rest = engine.wk.rest;
    if (rest?.end && (rest.end - Date.now()) / 1000 < -300) engine.restView();
  }, [version]);
  useEffect(() => {
    if (!live) return;
    const delay = live.done ? Math.max(16, live.doneAt + FLASH_MS - Date.now()) : 1000;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [live?.id, live?.done, live?.resting, live?.doneAt, live?.elapsed, live?.restSeconds, now]);
  return live;
}

function spoken(live: LiveWorkout): string {
  if (live.done) return live.detail;
  const elapsed = clock(live.elapsed);
  if (live.resting && live.restSeconds != null) {
    return `${live.title}: ${copy.live.rest} ${clock(live.restSeconds)}, ${fill(copy.live.elapsedLine, elapsed)}`;
  }
  if (!live.detail) return `${live.title}, ${elapsed}`;
  return `${live.title}: ${live.detail}, ${elapsed}`;
}

function Label({ live, inline }: { live: LiveWorkout; inline: boolean }) {
  if (inline) {
    return (
      <Text numberOfLines={1} style={styles.compact}>
        {live.done ? live.detail : live.resting && live.restSeconds != null ? clock(live.restSeconds) : clock(live.elapsed)}
      </Text>
    );
  }
  if (live.done) {
    return (
      <Text numberOfLines={1} style={styles.label}>
        {live.detail}
      </Text>
    );
  }
  return (
    <View style={styles.pillRow}>
      <View style={styles.pillLeft}>
        <Text numberOfLines={1} style={styles.label}>
          {live.title}
        </Text>
        {live.detail ? (
          <Text numberOfLines={1} style={styles.sub}>
            {live.detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.pillRight, live.resting ? null : styles.pillRightLift]}>
        {live.resting && live.restSeconds != null ? (
          <>
            <Text style={[styles.bigTime, live.restUrgent ? styles.restWarn : styles.restOk]}>{clock(live.restSeconds)}</Text>
            <Text style={styles.timeLabel}>{fill(copy.live.elapsedLine, clock(live.elapsed))}</Text>
          </>
        ) : (
          <Text style={styles.bigTime}>{clock(live.elapsed)}</Text>
        )}
      </View>
    </View>
  );
}

/** Text inside the system glass accessory. Two copies exist; keep state outside. */
export function LiveWorkoutAccessory({ live }: { live: LiveWorkout }) {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const inline = placement === "inline";
  const [endAsk, setEndAsk] = useState(false);
  return (
    <>
      <PressableScale
        kind="plain"
        accessibilityRole="button"
        onPress={() => openWorkout(live.id, "plain")}
        onLongPress={() => setEndAsk(true)}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
      >
        <Label live={live} inline={inline} />
      </PressableScale>
      <EndSheet live={live} visible={endAsk} onClose={() => setEndAsk(false)} />
    </>
  );
}

/** Sits on the 88pt strip the tab bar already covers, with a small gap. */
export function LiveWorkoutBar() {
  const live = useLiveWorkout();
  if (!live) return null;
  return <LiveWorkoutDock live={live} bottom={96} />;
}

export function LiveWorkoutDock({ live, bottom }: { live: LiveWorkout; bottom: number }) {
  const label = spoken(live);
  const [endAsk, setEndAsk] = useState(false);
  const solid = useSolidGlass();
  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
      <PressableScale
        kind="plain"
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => openWorkout(live.id, "plain")}
        onLongPress={() => setEndAsk(true)}
        style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
      >
        {solid ? (
          <View style={[StyleSheet.absoluteFill, styles.solidShell]} />
        ) : (
          <>
            <GlassView
              isInteractive
              colorScheme="dark"
              tintColor="rgba(111,208,180,0.35)"
              glassEffectStyle={{ style: "regular" }}
              style={[StyleSheet.absoluteFill, styles.glass]}
            />
            <LinearGradient
              colors={["rgba(111,208,180,0.42)", "rgba(200,232,106,0.28)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.glassWash]}
              pointerEvents="none"
            />
          </>
        )}
        <Label live={live} inline={false} />
      </PressableScale>
      <EndSheet live={live} visible={endAsk} onClose={() => setEndAsk(false)} />
    </View>
  );
}

function EndSheet({ live, visible, onClose }: { live: LiveWorkout; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <SheetFrame visible={visible} onClose={onClose} label={copy.you.cancel}>
      <View style={[styles.endSheet, { marginBottom: insets.bottom + 12 }]}>
        <Text accessibilityRole="header" style={styles.endTitle}>{copy.workout.endWorkout}</Text>
        <PressableScale
          accessibilityRole="button"
          onPress={() => {
            endLiveWorkout(live.id);
            onClose();
          }}
          style={styles.endButton}
        >
          <Text style={styles.endButtonText}>{copy.workout.endWorkout}</Text>
        </PressableScale>
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  label: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  sub: { color: MUTED_PILL, fontFamily: theme.fonts.bodyMedium, fontSize: 12, marginTop: 2 },
  compact: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 15, textAlign: "center" },
  dock: { position: "absolute", left: 16, right: 16, zIndex: 80 },
  shell: {
    minHeight: 56,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: "rgba(200,232,106,0.32)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    overflow: "hidden",
  },
  solidShell: {
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.surface,
  },
  glass: {
    borderRadius: theme.radii.pill,
  },
  glassWash: {
    borderRadius: theme.radii.pill,
    opacity: 0.55,
  },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  pillLeft: { flex: 1, minWidth: 0 },
  pillRight: { flexShrink: 0, alignItems: "flex-end" },
  pillRightLift: { alignSelf: "stretch", justifyContent: "center", minWidth: 64 },
  bigTime: {
    color: theme.text,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ["tabular-nums"],
  },
  restOk: { color: LIME[0] },
  restWarn: { color: WARN },
  timeLabel: {
    color: MUTED_PILL,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 11,
    marginTop: 2,
  },
  pressed: { opacity: 0.7 },
  endSheet: { marginHorizontal: 16, gap: 12 },
  endTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20 },
  endButton: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
  },
  endButtonText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 15 },
});
