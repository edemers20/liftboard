import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotice } from "@/activity-log";
import { Rise, SetBounce, SheetFrame } from "@/components/motion";
import { DialValue, liftWeightDial, repsDial } from "@/components/number-dial";
import { copy, fill } from "@/copy";
import { haptic } from "@/haptic";
import { engine } from "@/store";
import { theme } from "@/theme";
import { clock, fromDisplay, toDisplay, unitWord, usingKg, weightText } from "@/units";
import { useEngineStore } from "@/store";
import { useReduceMotion } from "@/use-reduce-motion";

import { canSwapDay, openSwappedWorkout, SwapSheet, type SwapAnchor } from "@/components/swap-sheet";
import { Check, Close, Info, Swap } from "@/icons";

import { armRest, cancelRestChime, claimRestChime } from "./notify";
import { ShareBox } from "./share-box";
import { ShareWorkoutButton } from "./share-card";

type Feel = "Good" | "Normal" | "Rough";
type Rest = { over: boolean; seconds: number; why: string; end: number };

const FEEL: { value: Feel; label: string; knob: string }[] = [
  { value: "Good", label: copy.workout.thriving, knob: "#3fa88c" },
  { value: "Normal", label: copy.workout.normal, knob: theme.muted },
  { value: "Rough", label: copy.workout.rough, knob: "#e07a55" },
];

const TAG_ICON: Record<string, string> = { up: "↑", hold: "=", down: "↓", collapse: "!" };
const TAG_NAME: Record<string, string> = {
  up: copy.workout.tagUp,
  down: copy.workout.tagDown,
  hold: copy.workout.tagHeld,
  collapse: copy.workout.tagFatigue,
};

const STRETCH: Record<string, [string, string][]> = {
  lower: [
    [copy.workout.hip, copy.workout.side45],
    [copy.workout.pigeon, copy.workout.side45],
    [copy.workout.hamstring, copy.workout.side45],
    [copy.workout.adductor, copy.workout.reps8],
    [copy.workout.calf, copy.workout.side30],
  ],
  upper: [
    [copy.workout.pec, copy.workout.side45],
    [copy.workout.lat, copy.workout.seconds45],
    [copy.workout.shoulder, copy.workout.side30],
    [copy.workout.needle, copy.workout.side6],
    [copy.workout.child, copy.workout.seconds60],
  ],
  full: [
    [copy.workout.hip, copy.workout.side45],
    [copy.workout.hamstring, copy.workout.side45],
    [copy.workout.pec, copy.workout.side45],
    [copy.workout.lat, copy.workout.seconds45],
    [copy.workout.child, copy.workout.seconds60],
  ],
};

function skipNote(slot: { skip?: string; flag?: string }): string {
  const k = slot.skip || "";
  if (slot.flag) return slot.flag;
  if (k === "Trimmed · no supersets") return copy.workout.cutSupersets;
  if (k.startsWith("Trimmed for a 45")) return copy.workout.cut45;
  if (k.startsWith("Trimmed for a 30")) return copy.workout.cut30;
  if (k === "Not needed this week") return copy.workout.cardioCovered;
  if (k.startsWith("Skipped · ")) return fill(copy.workout.skippedFor, k.slice(10));
  return k;
}

function exDone(dayId: string, day: any, planned: any, index: number): boolean {
  const slot = day.slots[index];
  const planSlot = planned.slots[index];
  if (!planSlot || planSlot.skip) return true;
  if (engine.wk.done?.[dayId]) return true;
  const state = engine.get(dayId, index);
  if (slot.cardio) return !!state.cdone;
  return (state.log || []).filter((row: any) => row.d).length >= planSlot.sets;
}

function candidates(day: any, planned: any): number[] {
  return engine.slotOrder(day).filter((index: number) => !planned.slots[index].skip);
}

function activeIndex(dayId: string, day: any, planned: any): number {
  const open = candidates(day, planned);
  const saved = (engine.wk.active || {})[dayId];
  if (saved === -1) return -1;
  if (saved != null && day.slots[saved] && planned.slots[saved] && planned.slots[saved].skip !== "hidden") return saved;
  const next = open.find((index) => !exDone(dayId, day, planned, index));
  if (next != null) return next;
  return open.length ? open[open.length - 1] : -1;
}

function displayOrder(day: any, planned: any): number[] {
  const order = engine.slotOrder(day) as number[];
  const optional = (index: number) =>
    !day.slots[index].cardio && planned.slots[index]?.skip && planned.slots[index].skip !== "hidden";
  return [
    ...order.filter((index) => !day.slots[index].cardio && !optional(index)),
    ...order.filter(optional),
    ...order.filter((index) => day.slots[index].cardio),
  ].filter((index) => planned.slots[index]?.skip !== "hidden");
}

function nextOpen(dayId: string, day: any, planned: any, index: number): number | undefined {
  const open = candidates(day, planned);
  const at = open.indexOf(index);
  return (
    open.slice(at + 1).find((item) => !exDone(dayId, day, planned, item)) ??
    open.find((item) => !exDone(dayId, day, planned, item) && item !== index)
  );
}

function cardioField(name: string): { label: string; placeholder: string } {
  const rows: [RegExp, string, string][] = [
    [/incline walk|treadmill hike/i, copy.workout.incline, copy.workout.inclinePh],
    [/stair/i, copy.workout.level, copy.workout.stairPh],
    [/bike/i, copy.workout.resistance, copy.workout.bikePh],
    [/rower/i, copy.workout.damper, copy.workout.rowerPh],
    [/elliptical/i, copy.workout.resistance, copy.workout.ellipticalPh],
    [/sled/i, copy.workout.load, copy.workout.loadPh],
    [/outdoor walk/i, "", ""],
  ];
  const match = rows.find(([pattern]) => pattern.test(name));
  return match ? { label: match[1], placeholder: match[2] } : { label: copy.workout.setting, placeholder: "" };
}

function focusSlot(dayId: string, index: number) {
  engine.wk.active = { ...(engine.wk.active || {}), [dayId]: index };
  engine.save();
}

function loggedLine(name: string, weight: number, reps: number): string {
  if (engine.isBW(name)) {
    const left = weight > 0 ? fill(copy.workout.bwPlusShort, toDisplay(weight)) : "BW";
    return `${left} × ${reps}`;
  }
  return `${toDisplay(weight)} × ${reps}`;
}

export function WorkoutScreen({ id }: { id: string }) {
  const version = useEngineStore((state) => state.version);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<number, number>>({});
  const listY = useRef(0);
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const restOver = useRef<boolean | null>(null);
  const leftWhileCounting = useRef(false);
  const [info, setInfo] = useState(false);
  const [sheet, setSheet] = useState<null | "done" | number>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [customName, setCustomName] = useState("");
  const [cat, setCat] = useState("");
  const [picker, setPicker] = useState<null | { index: number } | "add" | "cat">(null);
  const [resetAsk, setResetAsk] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapAnchor, setSwapAnchor] = useState<SwapAnchor | null>(null);
  const swapRef = useRef<any>(null);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.navigate("/");
  }

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setRest(engine.restView());
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [version]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && restOver.current === false) leftWhileCounting.current = true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!rest) {
      restOver.current = null;
      leftWhileCounting.current = false;
      return;
    }
    if (restOver.current === false && rest.over) {
      haptic.success();
      if (!leftWhileCounting.current && AppState.currentState === "active" && claimRestChime(rest.end)) {
        void cancelRestChime();
      }
    }
    if (!rest.over) leftWhileCounting.current = false;
    restOver.current = rest.over;
  }, [rest]);

  useEffect(() => {
    const view = engine.restView();
    if (view && !view.over && !engine.wk.rest?.noteId) void armRest(view.seconds);
  }, [id]);

  const plan = engine.plan();
  const day = engine.DAYS.find((item: any) => item.id === id);
  if (!day || !plan.days[id]) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="button" onPress={leave} style={styles.back}>
          <Text style={styles.backText}>{copy.workouts.back}</Text>
        </Pressable>
      </View>
    );
  }

  const planned = plan.days[id];
  const readOnly = !!engine.wk.done?.[id];
  const current = activeIndex(id, day, planned);
  const order = displayOrder(day, planned);
  const firstOptional = order.find(
    (index) => !day.slots[index].cardio && planned.slots[index]?.skip && planned.slots[index].skip !== "hidden",
  );
  const review = readOnly ? (engine.wk.review || {})[id] : null;
  const timer = (engine.wk.wt || {})[id];
  const stretches = /^Lower/.test(day.title) ? STRETCH.lower : /^Upper/.test(day.title) ? STRETCH.upper : STRETCH.full;
  const stretchOn = engine.wk.stretch === "Yes";
  const stretchDone = !!(engine.wk.stretchDone || {})[id];
  const stretchOpen = (engine.wk.stretchOpen || {})[id] ?? false;

  function scrollTo(index: number) {
    const y = offsets.current[index];
    if (y == null) return;
    scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 8), animated: !reduceMotion });
  }

  function showLines(lines: string[], pulse = true) {
    const cap = engine.wk.guide === "Less" ? 2 : 5;
    const next = lines.filter(Boolean).slice(0, cap);
    if (!next.length) return;
    useNotice.getState().show(next, { pulse, variant: "plain" });
  }

  function setFeel(value: Feel) {
    if (readOnly || planned.today === value) return;
    haptic.selection();
    const before = engine.plan();
    engine.wk.today = { ...(engine.wk.today || {}), [id]: value };
    engine.save();
    showLines(engine.dayDiff(before, engine.plan(), id));
  }

  async function skipRest() {
    haptic.selection();
    await cancelRestChime();
    engine.clearRest();
  }

  async function nudgeRest(delta: number) {
    haptic.selection();
    const next = engine.adjustRest(delta);
    if (next) await armRest(next.secs);
  }

  function finishDay() {
    if (engine.wk.done?.[id]) return;
    engine.markDone(id);
    const goingUp = ((engine.wk.review || {})[id]?.items || []).some((item: { tag?: string }) => item.tag === "up");
    haptic.success();
    if (goingUp) setTimeout(() => haptic.success(), 180);
    setTimeout(() => haptic.doubleTap(), 420);
    setSheet("done");
  }

  function resetDay() {
    haptic.warning();
    if (engine.wk.done?.[id]) engine.markDone(id);
    delete engine.slots[id];
    if (engine.wk.wt) delete engine.wk.wt[id];
    if (engine.wk.lockSets) delete engine.wk.lockSets[id];
    void cancelRestChime();
    engine.clearRest();
    engine.save();
    setResetAsk(false);
    showLines([copy.workout.dayReset, copy.workout.logsCleared], false);
  }

  function commitSet(
    index: number,
    setIndex: number,
    draft: { weight: string | null; reps: string | null; placeholderLb: number; placeholderReps: string },
  ) {
    if (readOnly) return;
    const state = engine.get(id, index);
    const log = (state.log || []).slice();
    while (log.length <= setIndex) log.push({});
    const row = { ...(log[setIndex] || {}) };
    const was = !!row.d;
    let weight = row.w || "";
    if (draft.weight !== null) weight = draft.weight.trim() === "" ? "" : fromDisplay(draft.weight.trim());
    if (!String(weight).trim() && draft.placeholderLb > 0) weight = String(draft.placeholderLb);
    let reps = row.r || "";
    if (draft.reps !== null) reps = draft.reps.trim();
    if (!String(reps).trim() && +draft.placeholderReps > 0) reps = String(+draft.placeholderReps);
    log[setIndex] = { ...row, w: weight, r: reps, d: !was };
    if (!was) haptic.tap();
    if (!was) {
      const timers = { ...(engine.wk.wt || {}) };
      if (!timers[id]?.start) timers[id] = { start: Date.now() };
      engine.wk.wt = timers;
    }
    const wasDone = !!engine.wk.done?.[id];
    engine.set(id, index, "log", log);
    if (wasDone) engine.resyncDone(id);
    if (!was) {
      const previousNote = engine.wk.rest?.noteId;
      const started = engine.beginRest(id, index, setIndex);
      if (started && previousNote && engine.wk.rest) engine.wk.rest.noteId = previousNote;
      if (started) void armRest(started.secs);
    }
    if (!was && !wasDone && engine.dayComplete(id)) {
      finishDay();
      return;
    }
    if (!was) {
      const sets = engine.plan().days[id].slots[index].sets;
      const ticks = (engine.get(id, index).log || []).filter((row: any) => row.d).length;
      if (ticks === sets) setSheet(index);
    }
  }

  function writeField(index: number, setIndex: number, field: "w" | "r", value: string) {
    const state = engine.get(id, index);
    const log = (state.log || []).slice();
    while (log.length <= setIndex) log.push({});
    const row = { ...(log[setIndex] || {}) };
    log[setIndex] = { ...row, [field]: field === "w" ? (value.trim() === "" ? "" : fromDisplay(value.trim())) : value.trim() };
    engine.set(id, index, "log", log);
    if (engine.wk.done?.[id]) engine.resyncDone(id);
  }

  function addSet(index: number) {
    const state = engine.get(id, index);
    const log = (state.log || []).slice();
    const sets = engine.plan().days[id].slots[index].sets || 0;
    while (log.length < sets) log.push({});
    log.push({});
    engine.set(id, index, "log", log);
  }

  function applyNudge(index: number, weight: number | null) {
    const state = engine.get(id, index);
    const log = (state.log || []).slice();
    const ticks = log.filter((row: any) => row.d).length;
    if (weight != null) {
      const stored = String(weight);
      for (let setIndex = 0; setIndex < log.length; setIndex++) {
        if (!log[setIndex].d) log[setIndex] = { ...log[setIndex], w: stored };
      }
      const sets = engine.plan().days[id].slots[index].sets || 0;
      while (log.length < sets) log.push({ w: stored });
      engine.set(id, index, "log", log);
    }
    engine.set(id, index, "nudged", ticks);
  }

  function finishCardio(index: number) {
    const planSlot = engine.plan().days[id].slots[index];
    const state = engine.get(id, index);
    if (!state.act && planSlot.min) engine.set(id, index, "act", String(planSlot.min));
    engine.set(id, index, "cdone", true);
    if (!engine.wk.done?.[id] && engine.dayComplete(id)) {
      finishDay();
      return;
    }
    const next = nextOpen(id, day, engine.plan().days[id], index);
    if (next != null) {
      focusSlot(id, next);
      scrollTo(next);
    }
  }

  function addExercise() {
    const custom = pick === engine.CUSTOM;
    const name = custom ? customName.trim() : pick;
    const category = custom ? cat || engine.catOf(customName) : engine.catOf(pick);
    if (!name || !category) return;
    engine.addExtra(id, name, category);
    const updated = engine.DAYS.find((item: any) => item.id === id);
    if (updated) focusSlot(id, updated.slots.length - 1);
    setAdding(false);
    setPick("");
    setCustomName("");
    setCat("");
    showLines([
      fill(copy.workout.addedToast, name),
      fill(copy.workout.countsWeek, String(engine.XCAT[category][0]).toLowerCase()),
    ]);
  }

  const timerLabel = !timer?.start
    ? null
    : timer.end
      ? fill(copy.workout.minutes, Math.round((timer.end - timer.start) / 60000))
      : clock((now - timer.start) / 1000);
  const feelQuestion = copy.workout.feel.split("{…}")[0];

  const summary = engine.daySummary(id) as any[];
  const upIndex = typeof sheet === "number" ? sheet : null;
  const upReview = upIndex != null ? engine.review(day, day.slots[upIndex], upIndex, plan) : null;
  const upName = upIndex != null ? engine.exName(day, day.slots[upIndex], upIndex) : "";
  const upFollowing = upIndex != null ? nextOpen(id, day, planned, upIndex) : undefined;
  const guessCat = pick === engine.CUSTOM ? cat || engine.catOf(customName) || "" : engine.catOf(pick);
  const canAdd = pick === engine.CUSTOM ? !!(customName.trim() && guessCat) : !!pick;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: (rest ? 96 : 32) + insets.bottom,
          paddingHorizontal: 16,
          gap: 14,
        }}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={leave} style={styles.back}>
            <Text style={styles.backText}>{copy.workouts.back}</Text>
          </Pressable>
          <ShareBox tag={`lift-${id}`} style={styles.dayHead}>
            <Text accessibilityRole="header" style={styles.title}>
              {day.title}
            </Text>
            {timerLabel ? <Text style={styles.timer}>{timerLabel}</Text> : null}
            {canSwapDay(id) ? (
              <Pressable
                ref={swapRef}
                accessibilityRole="button"
                onPress={() => {
                  swapRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                    setSwapAnchor({ x, y, width, height });
                    setSwapOpen(true);
                  });
                }}
                style={styles.swapPill}
              >
                <Swap size={16} color={theme.text} />
                <Text style={styles.swapPillText}>{copy.workouts.swapWorkout}</Text>
              </Pressable>
            ) : null}
          </ShareBox>
        </View>

        <View style={styles.panel}>
          <View style={styles.feelHead}>
            <Text style={styles.question}>{feelQuestion}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.whatThisDoes}
              hitSlop={13}
              onPress={() => setInfo(true)}
              style={styles.info}
            >
              <Info size={16} color="#c9d3cf" />
            </Pressable>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={feelQuestion}
            style={styles.feelRow}
          >
            <View style={styles.feelTrack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            {FEEL.map((option) => {
              const on = planned.today === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: readOnly }}
                  accessibilityLabel={option.label}
                  disabled={readOnly}
                  onPress={() => setFeel(option.value)}
                  style={styles.feelStop}
                >
                  <View style={styles.knobSlot}>
                    <View style={[styles.knob, on ? styles.knobOn : null, { backgroundColor: on ? option.knob : "#3a4743" }]} />
                  </View>
                  <Text style={[styles.feelLabel, on ? styles.feelLabelOn : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {planned.restSuggest ? <Text style={styles.flag}>{copy.workout.restFlag}</Text> : null}
          {planned.autoRough ? (
            <Text style={styles.note}>
              <Text style={styles.noteStrong}>{copy.workout.shortened}</Text>
              {` ${copy.workout.shortenedWhy}`}
            </Text>
          ) : null}
          {day.id === plan.nextId && engine.wk.upNext === day.id && engine.wk.missedNote ? (
            <Text style={styles.note}>
              <Text style={styles.noteStrong}>{copy.workout.upNext}</Text>
              {` · ${engine.wk.missedNote.why}`}
            </Text>
          ) : null}
        </View>

        {review?.items?.length ? (
          <View style={styles.panel}>
            <Text style={styles.section}>{copy.workout.nextTime}</Text>
            {review.items.map((item: any) => (
              <Text key={item.n} style={styles.reviewLine}>
                <Text accessibilityLabel={TAG_NAME[item.tag] || item.tag}>{TAG_ICON[item.tag] || ""}</Text>
                {` ${item.n} · `}
                <Text style={styles.mono}>{weightText(copy.workout.pounds, item.w)}</Text>
                {` · ${item.why}`}
              </Text>
            ))}
            {review.note ? <Text style={styles.note}>{review.note}</Text> : null}
          </View>
        ) : null}

        <View
          style={styles.list}
          onLayout={(event) => {
            listY.current = event.nativeEvent.layout.y;
          }}
        >
        {order.map((index) => {
          const slot = day.slots[index];
          const planSlot = planned.slots[index];
          const optional = !slot.cardio && planSlot.skip && planSlot.skip !== "hidden";
          const name = engine.exName(day, slot, index);
          const done = exDone(id, day, planned, index);
          if (index === firstOptional) {
            return (
              <View
                key={`label-${index}`}
                onLayout={(event) => {
                  offsets.current[index] = event.nativeEvent.layout.y;
                }}
              >
                <Text style={styles.optionalLabel}>{copy.workout.optional}</Text>
                {current === index ? (
                  <ExerciseCard
                    id={id}
                    index={index}
                    day={day}
                    plan={plan}
                    readOnly={readOnly}
                    onLayout={() => {}}
                    onCollapse={() => focusSlot(id, -1)}
                    onCommit={commitSet}
                    onField={writeField}
                    onAddSet={() => addSet(index)}
                    onNudge={(weight) => applyNudge(index, weight)}
                    onChoose={(choice) => {
                      engine.set(id, index, "choice", choice);
                    }}
                    onCustom={(value) => engine.set(id, index, "custom", value)}
                    onOpenPicker={() => setPicker({ index })}
                    onSide={(side) => engine.set(id, index, "side", side)}
                    onFinishCardio={() => finishCardio(index)}
                    onMinutesBlur={(before) => showLines(engine.diffFx(before, engine.fx(engine.plan())))}
                    onRemove={() => {
                      const extras = (engine.wk.extra || {})[id] || [];
                      engine.removeExtra(id, index - (day.slots.length - extras.length));
                    }}
                  />
                ) : (
                  <CollapsedRow
                    label={fill(copy.workout.optionalLabel, slot.label)}
                    name={name}
                    done={done}
                    optional
                    onPress={() => {
                      focusSlot(id, index);
                      scrollTo(index);
                    }}
                  />
                )}
              </View>
            );
          }
          if (current !== index) {
            const label = slot.extra
              ? fill(copy.workout.added, slot.label)
              : slot.ss && engine.wk.ss !== "No"
                ? `${slot.label} · ${slot.ss}`
                : slot.label;
            return (
              <CollapsedRow
                key={index}
                label={optional ? fill(copy.workout.optionalLabel, slot.label) : label}
                name={name}
                done={done}
                optional={!!optional}
                onPress={() => {
                  focusSlot(id, index);
                  scrollTo(index);
                }}
              />
            );
          }
          return (
            <ExerciseCard
              key={index}
              id={id}
              index={index}
              day={day}
              plan={plan}
              readOnly={readOnly}
              onLayout={(y) => {
                offsets.current[index] = y;
              }}
              onCollapse={() => focusSlot(id, -1)}
              onCommit={commitSet}
              onField={writeField}
              onAddSet={() => addSet(index)}
              onNudge={(weight) => applyNudge(index, weight)}
              onChoose={(choice) => engine.set(id, index, "choice", choice)}
              onCustom={(value) => engine.set(id, index, "custom", value)}
              onOpenPicker={() => setPicker({ index })}
              onSide={(side) => engine.set(id, index, "side", side)}
              onFinishCardio={() => finishCardio(index)}
              onMinutesBlur={(before) => showLines(engine.diffFx(before, engine.fx(engine.plan())))}
              onRemove={() => {
                const extras = (engine.wk.extra || {})[id] || [];
                engine.removeExtra(id, index - (day.slots.length - extras.length));
              }}
            />
          );
        })}
        </View>

        {readOnly ? null : adding ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.slotLabel}>{copy.workout.addExercise}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setAdding(false)} style={styles.iconHit}>
                <Close />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setPicker("add")} style={styles.picker}>
              <Text style={styles.pickerText} numberOfLines={1}>
                {pick || copy.workout.chooseExercise}
              </Text>
              <Text style={styles.pickerChevron}>▾</Text>
            </Pressable>
            {pick === engine.CUSTOM ? (
              <>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder={copy.workout.exerciseName}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>{copy.workout.countsAs}</Text>
                <Pressable accessibilityRole="button" onPress={() => setPicker("cat")} style={styles.picker}>
                  <Text style={styles.pickerText} numberOfLines={1}>
                    {guessCat ? engine.XCAT[guessCat][0] : copy.workout.choose}
                  </Text>
                  <Text style={styles.pickerChevron}>▾</Text>
                </Pressable>
              </>
            ) : null}
            {guessCat ? (
              <Text style={styles.hint}>
                {fill(copy.workout.countsLine, String(engine.XCAT[guessCat][0]).toLowerCase(), engine.XCAT[guessCat][1])}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAdd }}
              disabled={!canAdd}
              onPress={addExercise}
              style={[styles.primary, !canAdd ? styles.disabled : null]}
            >
              <Text style={styles.primaryText}>{fill(copy.workout.addTo, day.tab)}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{copy.workout.addExerciseBtn}</Text>
          </Pressable>
        )}

        {stretchOn ? (
          <View style={styles.stretch}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${stretchOpen ? copy.workout.collapse : copy.workout.expand}`}
              onPress={() => {
                engine.wk.stretchOpen = { ...(engine.wk.stretchOpen || {}), [id]: !stretchOpen };
                engine.save();
              }}
              style={styles.cardHead}
            >
              <Text style={styles.slotLabel}>{copy.workout.stretch}</Text>
              <Text style={styles.pill}>{stretchDone ? copy.workout.done : copy.workout.stretchMin}</Text>
            </Pressable>
            {stretchOpen ? (
              <>
                {stretches.map(([name, time]) => (
                  <View key={name} style={styles.stretchRow}>
                    <Text style={styles.body}>{name}</Text>
                    <Text style={styles.monoMuted}>{time}</Text>
                  </View>
                ))}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    engine.wk.stretchDone = { ...(engine.wk.stretchDone || {}), [id]: !stretchDone };
                    engine.save();
                  }}
                  style={stretchDone ? styles.secondary : styles.primary}
                >
                  <Text style={stretchDone ? styles.secondaryText : styles.primaryText}>
                    {stretchDone ? copy.workout.stretched : copy.workout.doneStretching}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: readOnly }}
          disabled={readOnly}
          onPress={finishDay}
          style={[styles.primary, readOnly ? styles.doneButton : null]}
        >
          <Text style={[styles.primaryText, readOnly ? styles.doneButtonText : null]}>
            {readOnly ? copy.workout.dayDone : copy.workout.markDone}
          </Text>
        </Pressable>
        {readOnly ? <ShareWorkoutButton id={id} label={copy.workout.shareWorkout} wide /> : null}

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => setResetAsk(true)} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>{copy.workout.resetDay}</Text>
          </Pressable>
          <Text style={styles.footerSaved}>{copy.workout.saved}</Text>
        </View>
      </ScrollView>

      {rest ? (
        <View style={[styles.rest, rest.over ? styles.restOver : null, { paddingBottom: insets.bottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.workout.minus15}
            onPress={() => void nudgeRest(-15)}
            style={styles.restZone}
          >
            <Text style={[styles.restZoneText, rest.over ? styles.restClockOver : null]}>{copy.workout.minus15}</Text>
          </Pressable>
          <View style={styles.restMid}>
            <Text style={[styles.restClock, rest.over ? styles.restClockOver : null]}>
              {rest.over ? fill(copy.workout.goOver, clock(rest.seconds)) : fill(copy.workout.rest, clock(rest.seconds))}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void skipRest()} style={styles.skip}>
              <Text style={[styles.skipText, rest.over ? styles.restClockOver : null]}>{copy.workout.skip}</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.workout.plus15}
            onPress={() => void nudgeRest(15)}
            style={[styles.restZone, styles.restZoneEnd]}
          >
            <Text style={[styles.restZoneText, rest.over ? styles.restClockOver : null]}>{copy.workout.plus15}</Text>
          </Pressable>
        </View>
      ) : null}

      <SheetFrame visible={resetAsk} onClose={() => setResetAsk(false)} label={copy.you.cancel}>
          <View style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
            <Text style={styles.section}>{copy.you.areYouSure}</Text>
            <Text accessibilityRole="header" style={styles.confirmTitle}>
              {fill(copy.workout.resetTitle, day.tab || copy.workout.thisDay)}
            </Text>
            <Text style={styles.body}>{copy.workout.resetBody}</Text>
            <View style={styles.confirmRow}>
              <Pressable accessibilityRole="button" onPress={() => setResetAsk(false)} style={[styles.secondary, styles.confirmBtn]}>
                <Text style={styles.secondaryText}>{copy.you.cancel}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={resetDay} style={[styles.primary, styles.confirmBtn]}>
                <Text style={styles.primaryText}>{copy.workout.resetDay}</Text>
              </Pressable>
            </View>
          </View>
      </SheetFrame>

      <SheetFrame visible={info} onClose={() => setInfo(false)}>
          <View style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
            <Text style={styles.body}>{copy.workout.feelInfo}</Text>
            <Pressable accessibilityRole="button" onPress={() => setInfo(false)} style={styles.primary}>
              <Text style={styles.primaryText}>{copy.close}</Text>
            </Pressable>
          </View>
      </SheetFrame>

      <SwapSheet
        id={swapOpen ? id : null}
        anchor={swapAnchor}
        onClose={() => {
          setSwapOpen(false);
          setSwapAnchor(null);
        }}
        onWorkout={(nextId) => {
          setSwapOpen(false);
          openSwappedWorkout(nextId);
        }}
      />

      <SheetFrame visible={sheet != null} onClose={() => setSheet(null)}>
          <View style={[styles.sheet, { marginBottom: insets.bottom + 12 }]}>
            {sheet === "done" ? (
              <>
                <View style={styles.sheetTop}>
                  <Text style={styles.section}>
                    {`${day.tab} · ${day.title}${timer?.start && timer.end ? ` ${fill(copy.workout.minDot, Math.max(1, Math.round((timer.end - timer.start) / 60000)))}` : ""}`}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setSheet(null)} style={styles.iconHit}>
                    <Close />
                  </Pressable>
                </View>
                <View style={styles.doneHead}>
                  <View style={styles.checkCircle}>
                    <Check size={28} color={theme.green.accent} draw />
                  </View>
                  <Rise delay={60}>
                    <Text accessibilityRole="header" style={styles.doneTitle}>
                      {copy.workout.doneTitle}
                    </Text>
                  </Rise>
                </View>
                {summary.length ? (
                  summary.map((row, rowIndex) => {
                    const item = (review?.items || (engine.wk.review || {})[id]?.items || []).find((entry: any) => entry.n === row.n);
                    const value = row.cardio
                      ? row.min
                        ? fill(copy.workout.minutes, row.min)
                        : copy.workout.done
                      : loggedLine(row.n, row.w, row.r);
                    return (
                      <Rise key={row.n} delay={120 + rowIndex * 60}>
                        <View style={styles.summaryRow}>
                          <Text style={[styles.body, styles.summaryName]}>{row.n}</Text>
                          <Text style={[styles.mono, item?.tag === "up" ? styles.up : null]}>
                            {value}
                            {item ? (
                              <Text accessibilityLabel={TAG_NAME[item.tag] || item.tag}>{` ${TAG_ICON[item.tag] || ""}`}</Text>
                            ) : null}
                          </Text>
                        </View>
                      </Rise>
                    );
                  })
                ) : (
                  <Rise delay={120}>
                    <Text style={styles.hint}>{copy.workout.noSetsLogged}</Text>
                  </Rise>
                )}
                {(engine.wk.review || {})[id]?.note ? (
                  <Rise delay={120 + summary.length * 60}>
                    <Text style={styles.hint}>{(engine.wk.review || {})[id].note}</Text>
                  </Rise>
                ) : null}
                <Rise delay={180 + summary.length * 60}>
                <View style={styles.doneActions}>
                  <ShareWorkoutButton id={id} label={copy.workout.share} />
                  <Pressable accessibilityRole="button" onPress={leave} style={[styles.primary, styles.doneClose]}>
                    <Text style={styles.primaryText}>{copy.workout.backWorkouts}</Text>
                  </Pressable>
                </View>
                </Rise>
              </>
            ) : (
              <>
                <View style={styles.sheetTop}>
                  <Text style={styles.section}>{fill(copy.workout.exDone, upName)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setSheet(null)} style={styles.iconHit}>
                    <Close />
                  </Pressable>
                </View>
                {upReview ? (
                  <Text style={styles.body}>
                    <Text accessibilityLabel={TAG_NAME[upReview.tag] || ""}>{TAG_ICON[upReview.tag] || ""}</Text>
                    {` ${copy.workout.nextTime} `}
                    <Text style={styles.mono}>{weightText(copy.workout.pounds, upReview.w)}</Text>
                    {` · ${upReview.why}`}
                  </Text>
                ) : null}
                {upFollowing != null ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      focusSlot(id, upFollowing);
                      setSheet(null);
                      scrollTo(upFollowing);
                    }}
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>
                      {fill(copy.workout.upNextBtn, engine.exName(day, day.slots[upFollowing], upFollowing))}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
      </SheetFrame>

      <PickerModal
        open={picker != null}
        title={picker === "cat" ? copy.workout.countsAs : copy.workout.chooseExercise}
        onClose={() => setPicker(null)}
        groups={
          picker === "cat"
            ? (engine.XGROUPS as [string, string[]][]).map(([label, keys]) => ({
                label,
                options: keys.map((key) => ({ value: key, label: engine.XCAT[key][0] })),
              }))
            : picker === "add"
              ? exerciseGroups()
              : picker && typeof picker === "object"
                ? [{ label: "", options: [...day.slots[picker.index].opts, engine.CUSTOM].map((option: string) => ({ value: option, label: option === engine.CUSTOM ? copy.workout.custom : option })) }]
                : []
        }
        selected={picker === "cat" ? guessCat : picker === "add" ? pick : picker && typeof picker === "object" ? (engine.get(id, picker.index).choice ?? "") : ""}
        onSelect={(value) => {
          if (picker === "add") {
            setPick(value);
            if (value !== engine.CUSTOM) setCat("");
          } else if (picker === "cat") setCat(value);
          else if (picker && typeof picker === "object") engine.set(id, picker.index, "choice", value);
          setPicker(null);
        }}
      />
    </View>
  );
}

function exerciseGroups(): { label: string; options: { value: string; label: string }[] }[] {
  const used = new Set<string>();
  const groups = (engine.XGROUPS as [string, string[]][]).map(([label, keys]) => {
    const options: { value: string; label: string }[] = [];
    keys.forEach((key) =>
      (engine.L[key] || []).forEach((name: string) => {
        if (!used.has(name)) {
          used.add(name);
          options.push({ value: name, label: name });
        }
      }),
    );
    return { label, options };
  });
  return [...groups, { label: "", options: [{ value: engine.CUSTOM, label: copy.workout.custom }] }];
}

function CollapsedRow({
  label,
  name,
  done,
  optional,
  onPress,
}: {
  label: string;
  name: string;
  done: boolean;
  optional?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${done ? copy.workout.done : copy.workout.start} ${name}`}
      onPress={onPress}
      style={[styles.collapsed, done ? styles.collapsedDone : null, optional && !done ? styles.collapsedOptional : null]}
    >
      <View style={styles.collapsedText}>
        <Text style={styles.slotLabel}>{label}</Text>
        <Text style={[styles.exercise, done ? styles.doneName : null, optional && !done ? styles.optionalName : null]}>{name}</Text>
      </View>
      <Text style={[styles.mark, done ? styles.markOn : null]}>{done ? "✓" : "›"}</Text>
    </Pressable>
  );
}

function ExerciseCard(props: {
  id: string;
  index: number;
  day: any;
  plan: any;
  readOnly: boolean;
  onLayout: (y: number) => void;
  onCollapse: () => void;
  onCommit: (index: number, setIndex: number, draft: { weight: string | null; reps: string | null; placeholderLb: number; placeholderReps: string }) => void;
  onField: (index: number, setIndex: number, field: "w" | "r", value: string) => void;
  onAddSet: () => void;
  onNudge: (weight: number | null) => void;
  onChoose: (choice: string) => void;
  onCustom: (value: string) => void;
  onOpenPicker: () => void;
  onSide: (side: string) => void;
  onFinishCardio: () => void;
  onMinutesBlur: (before: any) => void;
  onRemove: () => void;
}) {
  const { id, index, day, plan, readOnly } = props;
  const slot = day.slots[index];
  const planSlot = plan.days[id].slots[index];
  const state = engine.get(id, index);
  const name = engine.exName(day, slot, index);
  const log = state.log || [];
  const ticks = log.filter((row: any) => row.d).length;
  const finished = slot.cardio ? !!state.cdone || readOnly : ticks >= planSlot.sets;
  const rows = Math.max(planSlot.sets || 0, log.length);
  const choice = state.choice ?? engine.defChoice(day, slot, index);
  const suggestion = slot.cardio ? null : engine.suggest(day, slot, index, false, plan);
  const guess = suggestion ? null : engine.startingGuess(name);
  const carry = (engine.wk.next || {})[name];
  const showCarry = carry && carry.t !== (engine.wk.doneT || {})[id];
  const nudge = readOnly || slot.cardio ? null : engine.offerNudge(id, index);
  const bodyweight = engine.isBW(name);
  const side = state.side || engine.sideDefault(name);
  const previousSide = engine.lastSide(name);
  const field = slot.cardio ? cardioField(name) : null;
  const interval = slot.cardio && (engine.INTERVAL as string[]).includes(name) && !planSlot.steady;
  const anyTicked = log.some((row: any) => row.d);
  const beforeFx = useRef<any>(null);

  const pill = slot.cardio
    ? readOnly
      ? fill(copy.workout.kcal, engine.r5(planSlot.doneK || 0))
      : planSlot.min
        ? fill(copy.workout.minutes, planSlot.min)
        : copy.workout.optional
    : finished
      ? copy.workout.done
      : fill(copy.workout.setOf, Math.min(ticks + 1, planSlot.sets), planSlot.sets);

  const label = slot.extra
    ? fill(copy.workout.added, slot.label)
    : slot.ss && engine.wk.ss !== "No"
      ? `${slot.label} ${fill(copy.workout.superset, slot.ss)}`
      : slot.label;

  return (
    <View
      onLayout={(event) => props.onLayout(event.nativeEvent.layout.y)}
      style={[styles.card, styles.current]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${copy.workout.collapse} ${name}`}
        onPress={props.onCollapse}
        style={styles.cardHead}
      >
        <Text style={[styles.slotLabel, styles.slotLabelOn]}>{label}</Text>
        <Text style={styles.pill}>{pill}</Text>
      </Pressable>
      {slot.cardio ? null : (
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: rows }, (_, setIndex) => (
            <View
              key={setIndex}
              style={[
                styles.bar,
                setIndex < ticks ? styles.barOn : null,
                setIndex === ticks && !finished ? styles.barNow : null,
              ]}
            />
          ))}
        </View>
      )}
      {slot.extra ? (
        <View style={styles.cardHead}>
          <Text style={styles.exercise}>{name}</Text>
          {!readOnly && !anyTicked ? (
            <Pressable accessibilityRole="button" onPress={props.onRemove} style={styles.secondaryInline}>
              <Text style={styles.secondaryText}>{copy.workout.remove}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={slot.label}
            disabled={readOnly}
            onPress={props.onOpenPicker}
            style={styles.picker}
          >
            <Text style={styles.pickerText} numberOfLines={1}>
              {choice === engine.CUSTOM ? copy.workout.custom : choice}
            </Text>
            <Text style={styles.pickerChevron}>▾</Text>
          </Pressable>
          {choice === engine.CUSTOM ? (
            <TextInput
              editable={!readOnly}
              value={state.custom || ""}
              onChangeText={props.onCustom}
              placeholder={copy.workout.exerciseName}
              placeholderTextColor={theme.muted}
              style={styles.input}
            />
          ) : null}
        </>
      )}

      {slot.cardio && field ? (
        <>
          {planSlot.flag ? (
            <Text style={styles.note}>
              <Text style={styles.noteStrong}>{copy.workout.lowered}</Text>
              {` · ${planSlot.flag}`}
            </Text>
          ) : null}
          {planSlot.steady ? (
            <Text style={styles.note}>
              <Text style={styles.noteStrong}>{copy.workout.easyPace}</Text>
              {` · ${planSlot.steady}`}
            </Text>
          ) : null}
          {planSlot.min ? (
            <Text style={styles.hint}>
              {fill(
                copy.workout.cardioLine,
                planSlot.min,
                interval ? copy.workout.intervals : copy.workout.steady,
                planSlot.kcal ? fill(copy.workout.kcalDot, engine.r5(planSlot.kcal)) : "",
              )}
            </Text>
          ) : null}
          <View style={styles.cardioFields}>
            <View style={styles.cardioField}>
              <Text style={styles.fieldLabel}>{copy.workout.minutesDone}</Text>
              <TextInput
                editable={!readOnly}
                value={state.act || ""}
                onFocus={() => {
                  beforeFx.current = engine.fx(engine.plan());
                }}
                onChangeText={(value) => engine.set(id, index, "act", value.replace(/[^\d]/g, ""))}
                onEndEditing={() => props.onMinutesBlur(beforeFx.current)}
                keyboardType="number-pad"
                placeholder={planSlot.min ? String(planSlot.min) : ""}
                placeholderTextColor={theme.muted}
                style={styles.input}
              />
            </View>
            {field.label ? (
              <View style={styles.cardioField}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  editable={!readOnly}
                  value={state.load || ""}
                  onChangeText={(value) => engine.set(id, index, "load", value)}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
              </View>
            ) : null}
          </View>
          {readOnly || state.cdone ? null : (
            <Pressable accessibilityRole="button" onPress={props.onFinishCardio} style={styles.primary}>
              <Text style={styles.primaryText}>{copy.workout.finishCardio}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <>
          {planSlot.skip ? <Text style={styles.hint}>{skipNote(planSlot)}</Text> : null}
          {!readOnly && guess ? (
            <Text style={styles.carry}>
              {`${copy.workout.guess} `}
              <Text style={styles.carryStrong}>{weightText(copy.workout.pounds, guess.w)}</Text>
              {` ${fill(copy.workout.fromAt, guess.from, guess.fromW)}`}
            </Text>
          ) : null}
          {showCarry ? <Carry name={name} carry={carry} /> : null}
          {nudge ? (
            <View style={styles.nudge}>
              <Text style={styles.body}>
                {nudge.dir === "up"
                  ? fill(copy.workout.easySet, nudge.reps)
                  : fill(copy.workout.toughSet, nudge.reps)}{" "}
                <Text style={styles.carryStrong}>{weightText(copy.workout.pounds, nudge.weight)}</Text>{" "}
                {nudge.dir === "up" ? copy.workout.forRest : copy.workout.stayRange}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => props.onNudge(nudge.weight)} style={styles.secondaryInline}>
                <Text style={styles.secondaryText}>{fill(copy.workout.use, toDisplay(nudge.weight))}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.workout.keepWeight}
                onPress={() => props.onNudge(null)}
                style={styles.iconHit}
              >
                <Close />
              </Pressable>
            </View>
          ) : null}
          {engine.showsSide(name) ? (
            <View style={styles.sideRow}>
              <Text style={styles.body}>{copy.workout.startOn}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${copy.workout.startOn} ${side}`}
                disabled={readOnly}
                onPress={() => props.onSide(side === copy.workout.left ? copy.workout.right : copy.workout.left)}
                style={styles.secondaryInline}
              >
                <Text style={styles.secondaryText}>{side}</Text>
              </Pressable>
              {previousSide ? <Text style={styles.hint}>{fill(copy.workout.lastTime, previousSide)}</Text> : null}
            </View>
          ) : null}
          {Array.from({ length: rows }, (_, setIndex) => (
            <SetRow
              key={setIndex}
              index={index}
              setIndex={setIndex}
              row={log[setIndex] || {}}
              previous={setIndex > 0 ? log[setIndex - 1] : null}
              suggestion={suggestion}
              guess={guess}
              bodyweight={bodyweight}
              current={setIndex === ticks && !finished}
              done={finished}
              readOnly={readOnly}
              total={rows}
              fallbackReps={String(engine.range(slot.reps)[0])}
              onCommit={(draft) => props.onCommit(index, setIndex, draft)}
              onField={(fieldName, value) => props.onField(index, setIndex, fieldName, value)}
            />
          ))}
          {readOnly ? null : (
            <Pressable accessibilityRole="button" onPress={props.onAddSet} style={styles.addSet}>
              <Text style={styles.secondaryText}>{copy.workout.plusSet}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

function Carry({ name, carry }: { name: string; carry: any }) {
  const verb = carry.tag === "up" ? copy.workout.goUp : carry.tag === "down" ? copy.workout.easeTo : copy.workout.stayAt;
  if (engine.isBW(name) && !(carry.w > 0)) {
    return (
      <Text style={styles.carry}>
        <Text accessibilityLabel={TAG_NAME[carry.tag] || ""}>{TAG_ICON[carry.tag] || ""}</Text>
        {` `}
        <Text style={styles.carryStrong}>{carry.tag === "up" ? copy.workout.up : copy.workout.same}</Text>
        {` · ${carry.why}`}
      </Text>
    );
  }
  const weight = engine.isBW(name) ? weightText(copy.workout.bwPlus, carry.w) : weightText(copy.workout.pounds, carry.w);
  return (
    <Text style={styles.carry}>
      <Text accessibilityLabel={TAG_NAME[carry.tag] || ""}>{TAG_ICON[carry.tag] || ""}</Text>
      {` ${verb} `}
      <Text style={styles.carryStrong}>{weight}</Text>
      {` · ${carry.why}`}
    </Text>
  );
}

function SetRow({
  index,
  setIndex,
  row,
  previous,
  suggestion,
  guess,
  bodyweight,
  current,
  done,
  readOnly,
  total,
  fallbackReps,
  onCommit,
  onField,
}: {
  index: number;
  setIndex: number;
  row: any;
  previous: any;
  suggestion: any;
  guess: any;
  bodyweight: boolean;
  current: boolean;
  done: boolean;
  readOnly: boolean;
  total: number;
  fallbackReps: string;
  onCommit: (draft: { weight: string | null; reps: string | null; placeholderLb: number; placeholderReps: string }) => void;
  onField: (field: "w" | "r", value: string) => void;
}) {
  const previousLb = previous && +previous.w > 0 ? +previous.w : 0;
  const suggestedLb = suggestion && suggestion.w ? +suggestion.w : guess ? +guess.w : 0;
  const placeholderLb = bodyweight
    ? previousLb || (suggestion && suggestion.w ? +suggestion.w : 0)
    : previousLb || (suggestion ? +suggestion.w || 0 : suggestedLb);
  const placeholderWeight = done
    ? bodyweight
      ? "BW"
      : "lb"
    : placeholderLb
      ? String(toDisplay(placeholderLb))
      : bodyweight
        ? "BW"
        : "lb";
  const placeholderReps = done ? "" : suggestion && suggestion.r ? String(suggestion.r) : fallbackReps;
  const shownWeight = row.w ? String(toDisplay(+row.w)) : "";
  const shownReps = row.r ? String(row.r) : "";
  const setLabel = fill(copy.workout.setOf, setIndex + 1, total);

  return (
    <View style={[styles.setRow, current ? styles.setNow : null]}>
      <Text style={styles.setNumber}>{setIndex + 1}</Text>
      {readOnly ? (
        <Text style={[styles.mono, styles.setValue]}>{shownWeight}</Text>
      ) : (
        <DialValue
          label={bodyweight ? copy.workout.addedWeightTitle : copy.you.weight}
          accessibilityLabel={bodyweight ? copy.workout.addedWeight : setLabel}
          value={shownWeight}
          placeholder={placeholderWeight}
          spec={liftWeightDial(usingKg())}
          start={shownWeight ? undefined : placeholderLb > 0 ? toDisplay(placeholderLb) : undefined}
          accent={theme.green.accentFill}
          onChange={(value) => onField("w", value)}
          style={[styles.setInput, row.d ? styles.setInputDone : null, current ? styles.setInputNow : null]}
        />
      )}
      <Text style={styles.unit}>{unitWord(bodyweight)}</Text>
      {readOnly ? (
        <Text style={[styles.mono, styles.setValue]}>{shownReps}</Text>
      ) : (
        <DialValue
          label={copy.workout.reps}
          accessibilityLabel={setLabel}
          value={shownReps}
          placeholder={placeholderReps}
          spec={repsDial}
          start={shownReps ? undefined : Number(placeholderReps) || undefined}
          accent={theme.green.accentFill}
          onChange={(value) => onField("r", value)}
          style={[styles.setInput, row.d ? styles.setInputDone : null, current ? styles.setInputNow : null]}
        />
      )}
      <SetBounce on={!!row.d}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={setLabel}
          accessibilityState={{ selected: !!row.d, disabled: readOnly }}
          disabled={readOnly}
          onPress={() =>
            onCommit({
              weight: null,
              reps: null,
              placeholderLb: done ? 0 : placeholderLb,
              placeholderReps,
            })
          }
          style={[styles.check, row.d ? styles.checkOn : null]}
        >
          <Text style={[styles.checkText, row.d ? styles.checkTextOn : null]}>✓</Text>
        </Pressable>
      </SetBounce>
    </View>
  );
}

function PickerModal({
  open,
  title,
  groups,
  selected,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  groups: { label: string; options: { value: string; label: string }[] }[];
  selected: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <SheetFrame visible={open} onClose={onClose}>
        <View style={styles.pickerSheet}>
          <Text style={styles.section}>{title}</Text>
          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {groups.map((group) => (
              <View key={group.label || "all"}>
                {group.label ? <Text style={styles.optionalLabel}>{group.label}</Text> : null}
                {group.options.map((option) => (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option.value === selected }}
                    onPress={() => onSelect(option.value)}
                    style={styles.pickerOption}
                  >
                    <Text style={[styles.body, option.value === selected ? styles.pickerOn : null]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.green.background },
  header: { gap: 0 },
  back: { minHeight: 40, paddingVertical: 6, justifyContent: "center", alignSelf: "flex-start" },
  backText: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  dayHead: { alignSelf: "stretch", gap: 4 },
  title: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 26,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timer: { color: theme.muted, fontFamily: theme.fonts.monoMedium, fontSize: 13, marginTop: 2 },
  panel: { backgroundColor: theme.green.surface, borderRadius: theme.radii.tile, padding: 12, gap: 10 },
  feelHead: { flexDirection: "row", alignItems: "center" },
  question: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  info: {
    width: 18,
    height: 18,
    marginLeft: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  feelRow: { flexDirection: "row", alignItems: "flex-start" },
  feelTrack: {
    position: "absolute",
    left: "16.67%",
    right: "16.67%",
    top: 14,
    height: 4,
    borderRadius: 2,
    backgroundImage: "linear-gradient(90deg, #237a64, #2c3833 50%, #c96a48)",
  },
  feelStop: { flex: 1, alignItems: "center", gap: 4 },
  knobSlot: { height: 32, alignItems: "center", justifyContent: "center" },
  knob: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: theme.green.surface },
  knobOn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  feelLabel: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14 },
  feelLabelOn: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  flag: { color: theme.text, backgroundColor: "#3a3018", borderRadius: 8, padding: 8, overflow: "hidden", fontFamily: theme.fonts.body, fontSize: 13 },
  note: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 13 },
  noteStrong: { color: "#e7b94a", fontFamily: theme.fonts.bodySemi },
  section: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  reviewLine: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 14 },
  optionalLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 6,
  },
  list: { gap: 10 },
  collapsed: {
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.tile,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  collapsedDone: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#2c3833" },
  collapsedOptional: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: "#2c3833" },
  collapsedText: { flex: 1, gap: 2 },
  slotLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  slotLabelOn: { color: theme.green.accent },
  exercise: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16 },
  doneName: { color: theme.muted, fontFamily: theme.fonts.bodyMedium },
  optionalName: { color: "#c9d3cf" },
  mark: { color: theme.muted, fontSize: 20, fontFamily: theme.fonts.body },
  markOn: { color: theme.green.accent },
  card: { backgroundColor: theme.green.surface, borderRadius: theme.radii.tile, padding: 12, gap: 10 },
  current: {
    borderWidth: 2,
    borderColor: theme.green.accent,
    padding: 11,
    shadowColor: "#6fd0b4",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44 },
  pill: {
    color: "#fff",
    backgroundColor: theme.green.accentFill,
    fontFamily: theme.fonts.monoMedium,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
    overflow: "hidden",
  },
  bars: { flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#2c3833" },
  barOn: { backgroundColor: theme.green.accentFill },
  barNow: { backgroundColor: "#9fcfc1" },
  picker: {
    minHeight: 44,
    borderRadius: theme.radii.small,
    backgroundColor: theme.green.background,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  pickerText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 16, flex: 1 },
  pickerChevron: { color: theme.muted, fontSize: 12 },
  input: {
    minHeight: 44,
    borderRadius: theme.radii.small,
    backgroundColor: theme.green.background,
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  fieldLabel: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cardioFields: { flexDirection: "row", gap: 8 },
  cardioField: { flex: 1, gap: 3 },
  hint: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 13 },
  carry: {
    color: theme.muted,
    backgroundColor: "rgba(111,208,180,0.12)",
    borderRadius: 10,
    padding: 10,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    overflow: "hidden",
  },
  carryStrong: { color: theme.text, fontFamily: theme.fonts.bodySemi },
  nudge: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 4 },
  setNow: { backgroundColor: "#1d3530" },
  setNumber: { width: 22, textAlign: "center", color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 13 },
  setInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radii.small,
    backgroundColor: theme.green.background,
    color: theme.text,
    fontFamily: theme.fonts.mono,
    fontSize: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  setInputDone: { backgroundColor: "#1d3530" },
  setInputNow: { borderColor: "#3fa88c" },
  setValue: { flex: 1, fontSize: 16 },
  unit: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12, width: 28 },
  check: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.small,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.green.background,
    borderWidth: 1,
    borderColor: "#2c3833",
  },
  checkOn: { backgroundColor: theme.green.accentFill, borderColor: theme.green.accentFill },
  checkText: { color: theme.muted, fontSize: 18 },
  checkTextOn: { color: "#fff" },
  primary: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: theme.green.accentFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#fff", fontFamily: theme.fonts.bodySemi, fontSize: 15 },
  secondary: {
    minHeight: 48,
    borderRadius: theme.radii.tile,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryInline: {
    minHeight: 44,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 14 },
  addSet: {
    alignSelf: "flex-start",
    borderRadius: theme.radii.small,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  resetBtn: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: theme.radii.small,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  resetBtnText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  footerSaved: { color: theme.muted, fontFamily: theme.fonts.body, fontSize: 12 },
  confirmTitle: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 20 },
  confirmRow: { flexDirection: "row", gap: 8 },
  confirmBtn: { flex: 1 },
  disabled: { opacity: 0.4 },
  doneButton: { backgroundColor: theme.green.surface },
  doneButtonText: { color: theme.muted },
  stretch: { borderRadius: theme.radii.card, borderWidth: 1, borderColor: "rgba(168,160,156,0.35)", padding: 12, gap: 8 },
  stretchRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  body: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 15, flexShrink: 1 },
  mono: { color: theme.text, fontFamily: theme.fonts.mono, fontSize: 14 },
  monoMuted: { color: theme.muted, fontFamily: theme.fonts.mono, fontSize: 13 },
  up: { color: theme.fuel },
  rest: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 64,
    backgroundColor: theme.green.surface,
    flexDirection: "row",
    alignItems: "stretch",
  },
  restOver: { backgroundColor: theme.green.accentFill },
  restZone: { flex: 1, minWidth: 72, justifyContent: "center", paddingLeft: 16 },
  restZoneEnd: { alignItems: "flex-end", paddingLeft: 0, paddingRight: 16 },
  restMid: { alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  restZoneText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 12, opacity: 0.7 },
  restClock: { color: theme.text, fontFamily: theme.fonts.monoMedium, fontSize: 17, lineHeight: 20 },
  restClockOver: { color: "#fff" },
  skip: { minHeight: 32, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  skipText: {
    color: theme.muted,
    fontFamily: theme.fonts.bodySemi,
    fontSize: 13,
    textDecorationLine: "underline",
    textDecorationColor: theme.muted,
  },
  swapPill: {
    alignSelf: "flex-start",
    minHeight: 36,
    marginTop: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swapPillText: { color: theme.text, fontFamily: theme.fonts.bodySemi, fontSize: 13 },
  doneActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  doneClose: { flex: 1 },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.tile,
    padding: 12,
    gap: 4,
  },
  toastText: { color: theme.text, fontFamily: theme.fonts.body, fontSize: 14 },
  dim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#232e2a",
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  doneHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(111,208,180,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    color: theme.text,
    fontFamily: theme.fonts.display,
    fontSize: 30,
    textTransform: "uppercase",
    flex: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,160,156,0.25)",
  },
  summaryName: { flex: 1 },
  iconHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pickerSheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    maxHeight: "70%",
    backgroundColor: theme.green.surface,
    borderRadius: theme.radii.card,
    padding: 16,
    gap: 8,
  },
  pickerList: { flexGrow: 0 },
  pickerOption: { minHeight: 44, justifyContent: "center" },
  pickerOn: { color: theme.green.accent, fontFamily: theme.fonts.bodySemi },
});
