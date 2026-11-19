import * as engine from "@liftboard/engine";

import { copy, fill } from "@/copy";

/** Format a stored pound weight in the person's units without pulling React Native units helpers. */
function weightLabel(lb: number, bodyweight: boolean): string {
  const kg = engine.wk.units === "kg";
  const shown = kg ? Math.round((+lb / 2.20462) * 10) / 10 : +lb;
  const text = bodyweight ? fill(copy.workout.bwPlus, shown) : fill(copy.workout.pounds, shown);
  return kg ? text.replace(/\blb\b/g, "kg") : text;
}

/** Everything the Live Activity shows. The widget runtime only sees these props, so the words come in too. */
export type WorkoutActivityProps = {
  id: string;
  title: string;
  exercise: string;
  /** Lock Screen meta: `Set 3 of 4 @115 lb` or `Next set @115 lb`. */
  setLine: string;
  /** Compact island trailing when lifting (e.g. `115 lb`). */
  weightCompact: string;
  /** Workout timer start in ms; elapsed counts up from this. */
  workoutStart: number;
  /** When this rest was read, in ms; the countdown's lower bound. */
  restStart: number;
  /** Rest end in ms; 0 when not resting. The activity goes stale then. */
  restEnd: number;
  /** True when rest is running and ≤10s remain (reddish countdown). */
  restUrgent: boolean;
  /** Sets done on the current exercise (for the set bars). */
  setsDone: number;
  /** Sets planned on the current exercise. */
  setsTotal: number;
  /** Index of the current set (0-based); the "now" bar. -1 when none. */
  setNow: number;
  finished: boolean;
  restLabel: string;
  goLabel: string;
  doneLabel: string;
  elapsedLabel: string;
};

/** A workout left open longer than this ends its Live Activity. */
export const MAX_LIVE_MS = 8 * 3600e3;

type Planned = { slots: { sets?: number; skip?: string }[] };

function countedSlots(id: string, day: any, planned: Planned): number[] {
  return (engine.slotOrder(day) as number[]).filter(
    (index) => !day.slots[index].cardio && engine.countsInDay(id, index, { days: { [id]: planned } }),
  );
}

function ticks(id: string, index: number): number {
  return (engine.get(id, index).log || []).filter((row: { d?: boolean }) => row?.d).length;
}

/** The exercise the person is on: the one they opened, else the first not finished. */
export function currentSlot(id: string, day: any, planned: Planned): number {
  const order = countedSlots(id, day, planned);
  const saved = (engine.wk.active || {})[id];
  if (saved === -1) return -1;
  if (saved != null && day.slots[saved] && planned.slots[saved] && planned.slots[saved].skip !== "hidden") return saved;
  const open = order.find((index) => !engine.rowDone(id, index, { days: { [id]: planned } }));
  return open ?? order[order.length - 1] ?? -1;
}

/** Display weight for the current (or next) set on this exercise. */
export function slotWeightLabel(id: string, day: any, planned: Planned, index: number): string {
  if (index < 0) return "";
  const slot = day.slots[index];
  if (!slot || slot.cardio) return "";
  const name = engine.exName(day, slot, index);
  const state = engine.get(id, index);
  const log = (state.log || []) as { w?: string | number; d?: boolean }[];
  const done = log.filter((row) => row?.d).length;
  const row = log[done];
  const previous = done > 0 ? log[done - 1] : null;
  const suggestion = engine.suggest(day, slot, index, false, { days: { [id]: planned } } as any);
  const guess = suggestion ? null : engine.startingGuess(name);
  let lb = 0;
  if (row?.w != null && String(row.w).trim() !== "") lb = Number(row.w) || 0;
  else if (previous?.w != null && String(previous.w).trim() !== "") lb = Number(previous.w) || 0;
  else if (suggestion?.w != null) lb = Number(suggestion.w) || 0;
  else if (guess?.w != null) lb = Number(guess.w) || 0;
  if (engine.isBW(name)) {
    if (!(lb > 0)) return "BW";
    return weightLabel(lb, true);
  }
  if (!(lb > 0)) return "";
  return weightLabel(lb, false);
}

/** `Set 3 of 4 @115 lb` / `Next set @115 lb` / plain set line when weight is unknown. */
export function setMetaLine(setOf: string, weight: string, resting: boolean): string {
  if (!weight) return resting ? copy.live.rest : setOf;
  if (resting) return fill(copy.live.nextSetAt, weight);
  return `${setOf} @${weight}`;
}

/** Props for the workout `id`, or null when there's nothing to show. */
export function activityProps(id: string, now = Date.now()): WorkoutActivityProps | null {
  const day = (engine.DAYS as any[]).find((item) => item.id === id);
  const planned = engine.plan().days[id] as Planned | undefined;
  if (!day || !planned) return null;
  const order = countedSlots(id, day, planned);
  const finished = !!engine.wk.done?.[id];
  const index = finished ? -1 : currentSlot(id, day, planned);
  const slot = index >= 0 ? day.slots[index] : null;
  const total = slot ? planned.slots[index]?.sets || 0 : 0;
  const done = index >= 0 ? Math.min(ticks(id, index), total) : 0;
  const rest = engine.wk.rest as { end?: number; name?: string } | null | undefined;
  const resting = !finished && !!rest?.end && rest.end > now;
  const restLeft = resting && rest?.end ? (rest.end - now) / 1000 : 0;
  const setOf = slot && !slot.cardio && total ? fill(copy.workout.setOf, Math.min(done + 1, total), total) : "";
  const weight = index >= 0 ? slotWeightLabel(id, day, planned, index) : "";
  const workoutStart = ((engine.wk.wt || {}) as Record<string, { start?: number }>)[id]?.start || now;
  return {
    id,
    title: day.title,
    exercise: resting && rest?.name ? rest.name : slot && !slot.cardio ? engine.exName(day, slot, index) : "",
    setLine: setMetaLine(setOf, weight, resting),
    weightCompact: weight || (setOf ? fill(copy.workout.setOf, Math.min(done + 1, total), total) : ""),
    workoutStart,
    restStart: resting ? now : 0,
    restEnd: resting ? rest!.end! : 0,
    restUrgent: resting && restLeft <= 10,
    setsDone: done,
    setsTotal: total,
    setNow: finished || !total ? -1 : Math.min(done, total - 1),
    finished,
    restLabel: copy.live.rest,
    goLabel: copy.live.go,
    doneLabel: copy.workout.dayDone,
    elapsedLabel: copy.live.elapsed,
  };
}

/** Same content, ignoring when it was read; an update is only needed when this changes. */
export function activityKey(props: WorkoutActivityProps | null): string {
  if (!props) return "";
  const { restStart: _start, ...rest } = props;
  return JSON.stringify(rest);
}

/** Day exercise index for the in-app pill (`Exercise 2 of 5`). */
export function exerciseProgress(id: string): { index: number; total: number } | null {
  const day = (engine.DAYS as any[]).find((item) => item.id === id);
  const planned = engine.plan().days[id] as Planned | undefined;
  if (!day || !planned) return null;
  const order = countedSlots(id, day, planned);
  if (!order.length) return null;
  const index = currentSlot(id, day, planned);
  const at = order.indexOf(index);
  return { index: (at >= 0 ? at : order.length - 1) + 1, total: order.length };
}
