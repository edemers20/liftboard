"use no memo";

import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/pressable-scale";
import { SheetFrame } from "@/components/motion";
import { NativeTabs } from "expo-router/native-tabs";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copy, fill } from "@/copy";
import { useSolidGlass } from "@/glass";
import { currentSlot, exerciseProgress } from "@/live-activity/state";
import { perfTime } from "@/perf/probe";
import { useScreenShown } from "@/screen-version";
import { useSecondClock } from "@/second-clock";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { clock } from "@/units";
import { useReduceMotion } from "@/use-reduce-motion";
import { openWorkout } from "@/workout/share-box";

const FLASH_MS = 2500;
const FADE_MS = 280;
/** Rest/elapsed digits: lighter than lime-a, still readable on glass. */
const TIMER_LIME = "#9fcfc1";
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

/** Stable live-workout presence. Clocks tick only in the pill, not the app root. */
export type LiveIdentity = {
  id: string;
  title: string;
  /** Current exercise name; primary line on the pill when set. */
  exercise: string;
  /** Rest is running, including the "Go" overtime. */
  resting: boolean;
  /** Rest countdown is ≤10s at the time this was read. */
  restUrgent: boolean;
  done: boolean;
  doneAt: number;
  /** Subtitle (`Exercise 2 of 5` or `Rest`). */
  detail: string;
  /** Short form for the minimized tab bar. */
  compact: string;
  /** Rest end in ms; 0 when not resting. */
  restEnd: number;
  /** Workout timer start in ms. */
  workoutStart: number;
};

export type LiveWorkout = LiveIdentity & {
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

function readExerciseName(id: string): string {
  try {
    const day = (engine.DAYS as any[]).find((entry) => entry.id === id);
    const planned = engine.plan().days[id];
    if (!day || !planned) return "";
    const restName = (engine.wk.rest as { name?: string } | null)?.name;
    if (restName) return String(restName);
    const index = currentSlot(id, day, planned);
    if (index < 0) return "";
    const slot = day.slots[index];
    if (!slot || slot.cardio) return "";
    return String(engine.exName(day, slot, index) || "");
  } catch {
    return "";
  }
}

function identityFrom(id: string, title: string, now: number, doneAt = 0): LiveIdentity {
  const workoutStart = ((engine.wk.wt || {}) as Record<string, { start?: number }>)[id]?.start || now;
  if (doneAt && now - doneAt < FLASH_MS) {
    return {
      id,
      title,
      exercise: "",
      resting: false,
      restUrgent: false,
      done: true,
      doneAt,
      detail: copy.workout.dayDone,
      compact: copy.workout.dayDone,
      restEnd: 0,
      workoutStart,
    };
  }
  const rest = restClock(now);
  if (rest) {
    const restEnd = (engine.wk.rest as { end?: number } | null)?.end || 0;
    return {
      id,
      title,
      exercise: readExerciseName(id),
      resting: true,
      restUrgent: !rest.over && rest.seconds <= 10,
      done: false,
      doneAt: 0,
      detail: copy.live.rest,
      compact: clock(rest.seconds),
      restEnd,
      workoutStart,
    };
  }
  let detail = "";
  let exercise = "";
  try {
    const planned = engine.plan().days[id];
    const progress = exerciseProgress(id, planned);
    if (progress) detail = fill(copy.live.exerciseOf, progress.index, progress.total);
    exercise = readExerciseName(id);
  } catch {
    detail = "";
  }
  return {
    id,
    title,
    exercise,
    resting: false,
    restUrgent: false,
    done: false,
    doneAt: 0,
    detail,
    compact: detail || title,
    restEnd: 0,
    workoutStart,
  };
}

function liveFromIdentity(identity: LiveIdentity, now: number): LiveWorkout {
  const elapsed = identity.workoutStart
    ? Math.max(0, Math.floor((now - identity.workoutStart) / 1000))
    : elapsedSeconds(identity.id, now);
  if (identity.done) {
    return { ...identity, elapsed, restSeconds: null };
  }
  if (identity.resting && identity.restEnd) {
    const left = (identity.restEnd - now) / 1000;
    const seconds = left <= 0 ? 0 : Math.round(left);
    const over = left <= 0;
    const restUrgent = !over && seconds <= 10;
    return {
      ...identity,
      resting: true,
      restUrgent,
      detail: copy.live.rest,
      compact: clock(seconds),
      elapsed,
      restSeconds: seconds,
    };
  }
  return { ...identity, elapsed, restSeconds: null };
}

/** Presence for the underway workout, or the one just marked done for a moment. No per-second clocks. */
export function readLiveIdentity(now = Date.now()): LiveIdentity | null {
  return perfTime("live:identity", () => readIdentityNow(now));
}

function readIdentityNow(now: number): LiveIdentity | null {
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
      return identityFrom(item.id, day.title, now, doneAt);
    }
    if (item.end) continue;
    return identityFrom(item.id, day.title, now);
  }
  const open = (engine.DAYS as { id: string; title: string }[]).find(
    (day) => !quiet.has(day.id) && workoutUnderway(day.id),
  );
  return open ? identityFrom(open.id, open.title, now) : null;
}

/** The workout that is underway, or the one just marked done for a moment. */
export function readLiveWorkout(now = Date.now()): LiveWorkout | null {
  const identity = readLiveIdentity(now);
  return identity ? liveFromIdentity(identity, now) : null;
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

const LiveWorkoutContext = createContext<LiveIdentity | null>(null);

/**
 * Identity only: spacers and sheets re-render on start/rest/done, not every second. Reads the
 * identity itself so a save redraws the provider and the consumers whose identity changed, not
 * the app root and every navigator under it.
 */
export function LiveWorkoutState({ children }: { children: ReactNode }) {
  const live = useLiveIdentity();
  return <LiveWorkoutContext.Provider value={live}>{children}</LiveWorkoutContext.Provider>;
}

export function useShownLiveWorkout(): LiveIdentity | null {
  return useContext(LiveWorkoutContext);
}

/**
 * Presence for the app root. Updates on engine version and at rest urgent / rest end /
 * day-done flash — never on a one-second clock.
 */
export function useLiveIdentity(): LiveIdentity | null {
  const version = useEngineStore((state) => state.version);
  const [pulse, setPulse] = useState(0);
  const last = useRef<LiveIdentity | null>(null);
  const read = readLiveIdentity();
  const live = sameIdentity(last.current, read) ? last.current : read;
  last.current = live;
  useEffect(() => {
    const rest = engine.wk.rest;
    if (rest?.end && (rest.end - Date.now()) / 1000 < -300) engine.restView();
  }, [version, pulse]);
  useEffect(() => {
    if (!live) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bump = () => setPulse((n) => n + 1);
    if (live.done) {
      timers.push(setTimeout(bump, Math.max(16, live.doneAt + FLASH_MS - now)));
    }
    if (live.restEnd > now) {
      const urgentAt = live.restEnd - 10_000;
      if (urgentAt > now) timers.push(setTimeout(bump, urgentAt - now));
      timers.push(setTimeout(bump, live.restEnd - now + 30));
    }
    return () => timers.forEach(clearTimeout);
    // pulse is intentionally omitted: timers stay armed across urgent/end bumps.
  }, [live?.id, live?.restEnd, live?.done, live?.doneAt, version]);
  return live;
}

function sameIdentity(a: LiveIdentity | null, b: LiveIdentity | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (Object.keys(b) as (keyof LiveIdentity)[]).every((key) => a[key] === b[key]);
}

/**
 * Re-renders as elapsed and rest clocks move, on the shared second tick. Use only in the pill /
 * accessory. `on` false (pill under a pushed screen) stops the clock until it shows again.
 */
export function useLiveWorkout(on = true): LiveWorkout | null {
  const identity = useContext(LiveWorkoutContext);
  useSecondClock(on && !!identity && !identity.done);
  if (!identity) return null;
  return liveFromIdentity(identity, Date.now());
}

function spoken(live: LiveWorkout): string {
  if (live.done) return live.detail;
  const elapsed = clock(live.elapsed);
  const name = live.exercise || live.title;
  if (live.resting && live.restSeconds != null) {
    return `${name}: ${copy.live.rest} ${clock(live.restSeconds)}, ${fill(copy.live.elapsedLine, elapsed)}`;
  }
  if (!live.detail) return `${name}, ${elapsed}`;
  return `${name}: ${live.detail}, ${elapsed}`;
}

type PillWidths = { shell: number; row: number; left: number; right: number; title: number };

/** DIAG: on-screen width readout in Release too. Numbers only; never exercise names. */
function PillWidthProbe({ widths }: { widths: PillWidths }) {
  const { shell, row, left, right, title } = widths;
  if (row <= 0) return null;
  const leftover = Math.max(0, Math.round(row - left - right));
  return (
    <Text pointerEvents="none" style={styles.widthProbe} importantForAccessibility="no">
      {`pill s${Math.round(shell)} r${Math.round(row)} L${Math.round(left)} R${Math.round(right)} T${Math.round(title)} gap${leftover}`}
    </Text>
  );
}

function Label({ live, inline }: { live: LiveWorkout; inline: boolean }) {
  const [widths, setWidths] = useState<PillWidths>({ shell: 0, row: 0, left: 0, right: 0, title: 0 });
  const setSlot = (slot: keyof PillWidths, width: number) => {
    setWidths((prev) => (prev[slot] === width ? prev : { ...prev, [slot]: width }));
  };

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
  const primary = live.exercise || live.title;
  const secondary = live.exercise ? (live.detail ? `${live.title}: ${live.detail}` : live.title) : live.detail;
  return (
    <View style={styles.pillBody} onLayout={(event) => setSlot("shell", event.nativeEvent.layout.width)}>
      <View style={styles.pillRow} onLayout={(event) => setSlot("row", event.nativeEvent.layout.width)}>
        {/* flex:1 + minWidth:0 so the name owns every point the timer does not. */}
        <View style={styles.pillLeft} onLayout={(event) => setSlot("left", event.nativeEvent.layout.width)}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={styles.label}
            onLayout={(event) => setSlot("title", event.nativeEvent.layout.width)}
          >
            {primary}
          </Text>
          {secondary ? (
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.sub}>
              {secondary}
            </Text>
          ) : null}
        </View>
        <View
          style={[styles.pillRight, live.resting ? null : styles.pillRightLift]}
          onLayout={(event) => setSlot("right", event.nativeEvent.layout.width)}
        >
          {live.resting && live.restSeconds != null ? (
            <>
              <Text numberOfLines={1} style={[styles.bigTime, live.restUrgent ? styles.restWarn : styles.restOk]}>
                {clock(live.restSeconds)}
              </Text>
              <Text numberOfLines={1} style={styles.timeLabel}>
                {clock(live.elapsed)}
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={[styles.bigTime, styles.elapsedOk]}>
              {clock(live.elapsed)}
            </Text>
          )}
        </View>
      </View>
      <PillWidthProbe widths={widths} />
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
  const live = useLiveWorkout(useScreenShown());
  if (!live) return null;
  return <LiveWorkoutDock live={live} bottom={96} />;
}

export function LiveWorkoutDock({ live, bottom }: { live: LiveWorkout; bottom: number }) {
  const label = spoken(live);
  const [endAsk, setEndAsk] = useState(false);
  const solid = useSolidGlass();
  const reduce = useReduceMotion();
  const opacity = useSharedValue(1);
  const modeKey = `${live.id}:${live.resting ? "rest" : live.done ? "done" : "lift"}`;
  const lastMode = useRef(modeKey);

  useLayoutEffect(() => {
    if (lastMode.current === modeKey) return;
    lastMode.current = modeKey;
    // Rest (and other mode) swaps: fade chrome + words together so text never leads the glass.
    if (reduce) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) });
  }, [modeKey, opacity, reduce]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="box-none" style={[styles.dock, { bottom }, fadeStyle]}>
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
              tintColor={live.restUrgent ? "rgba(224,122,106,0.4)" : "rgba(111,208,180,0.35)"}
              glassEffectStyle={{ style: "regular", animate: false }}
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
    </Animated.View>
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
  label: {
    color: theme.text,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 15,
    lineHeight: 18,
    width: "100%",
    flexShrink: 1,
  },
  sub: { color: MUTED_PILL, fontFamily: theme.fonts.bodyMedium, fontSize: 12, marginTop: 2, width: "100%" },
  compact: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 15, textAlign: "center" },
  dock: { position: "absolute", left: 16, right: 16, zIndex: 80 },
  shell: {
    minHeight: 56,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: "rgba(200,232,106,0.32)",
    justifyContent: "center",
    // DIAG: less horizontal chrome so the name keeps more of the dock width.
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
    alignSelf: "stretch",
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
  pillBody: { width: "100%", alignSelf: "stretch" },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    alignSelf: "stretch",
  },
  /** Name column: take all leftover width; never a fixed/max width. */
  pillLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: "100%",
    marginRight: 8,
  },
  /** Timer: intrinsic width only; must not steal flex from the name. */
  pillRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    alignItems: "flex-end",
  },
  pillRightLift: { alignSelf: "center", justifyContent: "center" },
  widthProbe: {
    marginTop: 2,
    color: "rgba(237,234,232,0.55)",
    fontFamily: theme.fonts.monoMedium,
    fontSize: 9,
    lineHeight: 11,
  },
  bigTime: {
    color: theme.text,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  restOk: { color: TIMER_LIME },
  elapsedOk: { color: TIMER_LIME },
  restWarn: { color: WARN },
  timeLabel: {
    color: MUTED_PILL,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 10,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
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
