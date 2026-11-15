import { isLiquidGlassAvailable } from "expo-glass-effect";
import { PressableScale } from "@/components/pressable-scale";
import { SheetFrame } from "@/components/motion";
import { NativeTabs } from "expo-router/native-tabs";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { copy, fill } from "@/copy";
import { engine, useEngineStore } from "@/store";
import { theme } from "@/theme";
import { clock } from "@/units";
import { openWorkout } from "@/workout/share-box";

const FLASH_MS = 2500;

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
  done: boolean;
  doneAt: number;
  /** Full line after the title, or the whole inline line. */
  detail: string;
  /** Short form for the minimized tab bar. */
  compact: string;
};

function slotDone(id: string, _day: any, planned: any, index: number): boolean {
  return engine.rowDone(id, index, { days: { [id]: planned } });
}

function setLine(id: string): { full: string; compact: string } | null {
  const planned = engine.plan().days[id];
  const day = engine.DAYS.find((item: any) => item.id === id);
  if (!day || !planned) return null;
  const order = (engine.slotOrder(day) as number[]).filter((index) =>
    engine.countsInDay(id, index, { days: { [id]: planned } }),
  );
  const saved = (engine.wk.active || {})[id];
  let index = order[0] ?? -1;
  if (saved === -1) index = -1;
  else if (saved != null && day.slots[saved] && planned.slots[saved] && planned.slots[saved].skip !== "hidden") index = saved;
  else {
    const next = order.find((item) => !slotDone(id, day, planned, item));
    index = next ?? order[order.length - 1] ?? -1;
  }
  if (index < 0 || day.slots[index].cardio) return null;
  const total = planned.slots[index]?.sets || 0;
  if (!total) return null;
  const ticks = (engine.get(id, index).log || []).filter((row: any) => row.d).length;
  const current = Math.min(ticks + 1, total);
  const line = fill(copy.workout.setOf, current, total);
  return { full: line, compact: line };
}

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

function liveFrom(id: string, title: string, now: number, doneAt = 0): LiveWorkout {
  if (doneAt && now - doneAt < FLASH_MS) {
    return {
      id,
      title,
      resting: false,
      done: true,
      doneAt,
      detail: copy.workout.dayDone,
      compact: copy.workout.dayDone,
    };
  }
  const rest = restClock(now);
  if (rest) {
    const time = clock(rest.seconds);
    return {
      id,
      title,
      resting: true,
      done: false,
      doneAt: 0,
      detail: fill(copy.workout.rest, time),
      compact: time,
    };
  }
  let set: { full: string; compact: string } | null = null;
  try {
    set = setLine(id);
  } catch {
    set = null;
  }
  return {
    id,
    title,
    resting: false,
    done: false,
    doneAt: 0,
    detail: set?.full || "",
    compact: set?.compact || title,
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

/** Re-renders as the rest clock moves, and once the "Day done" flash should leave. */
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
    const delay = live.done ? Math.max(16, live.doneAt + FLASH_MS - Date.now()) : live.resting ? 1000 : 0;
    if (!delay) return;
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [live?.id, live?.done, live?.resting, live?.doneAt, now]);
  return live;
}

function spoken(live: LiveWorkout, inline: boolean): string {
  if (live.done) return live.detail;
  if (inline) return live.compact;
  if (!live.detail) return live.title;
  return `${live.title} · ${live.detail}`;
}

function Label({ live, inline }: { live: LiveWorkout; inline: boolean }) {
  if (inline) {
    return (
      <Text numberOfLines={1} style={styles.compact}>
        {live.done ? live.detail : live.compact}
      </Text>
    );
  }
  if (live.done || !live.detail) {
    return (
      <Text numberOfLines={1} style={styles.label}>
        {live.done ? live.detail : live.title}
      </Text>
    );
  }
  return (
    <Text numberOfLines={1} style={styles.label}>
      {live.title}
      <Text style={styles.time}>{` · ${live.detail}`}</Text>
    </Text>
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
  const label = spoken(live, false);
  const [endAsk, setEndAsk] = useState(false);
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
  time: { fontFamily: theme.fonts.monoMedium },
  compact: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 15, textAlign: "center" },
  dock: { position: "absolute", left: 16, right: 16, zIndex: 80 },
  shell: {
    minHeight: 56,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.green.surface,
    borderWidth: 1,
    borderColor: theme.green.accent,
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  glass: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: theme.radii.pill,
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
