import * as engine from "@liftboard/engine";

import { copy, fill } from "@/copy";

/** Everything the Live Activity shows. The widget runtime only sees these props, so the words come in too. */
export type WorkoutActivityProps = {
  id: string;
  title: string;
  exercise: string;
  setLine: string;
  /** When this rest was read, in ms; the countdown's lower bound. */
  restStart: number;
  /** Rest end in ms; 0 when not resting. The activity goes stale then and shows `go`. */
  restEnd: number;
  setsDone: number;
  setsTotal: number;
  finished: boolean;
  restLabel: string;
  goLabel: string;
  doneLabel: string;
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

/** Props for the workout `id`, or null when there's nothing to show. */
export function activityProps(id: string, now = Date.now()): WorkoutActivityProps | null {
  const day = (engine.DAYS as any[]).find((item) => item.id === id);
  const planned = engine.plan().days[id] as Planned | undefined;
  if (!day || !planned) return null;
  const order = countedSlots(id, day, planned);
  const setsTotal = order.reduce((sum, index) => sum + (planned.slots[index]?.sets || 0), 0);
  const setsDone = order.reduce((sum, index) => sum + Math.min(ticks(id, index), planned.slots[index]?.sets || 0), 0);
  const finished = !!engine.wk.done?.[id];
  const index = finished ? -1 : currentSlot(id, day, planned);
  const slot = index >= 0 ? day.slots[index] : null;
  const total = slot ? planned.slots[index]?.sets || 0 : 0;
  const rest = engine.wk.rest as { end?: number; name?: string } | null | undefined;
  const resting = !finished && !!rest?.end && rest.end > now;
  return {
    id,
    title: day.title,
    exercise: resting && rest?.name ? rest.name : slot && !slot.cardio ? engine.exName(day, slot, index) : "",
    setLine: slot && !slot.cardio && total ? fill(copy.workout.setOf, Math.min(ticks(id, index) + 1, total), total) : "",
    restStart: resting ? now : 0,
    restEnd: resting ? rest!.end! : 0,
    setsDone,
    setsTotal,
    finished,
    restLabel: copy.live.rest,
    goLabel: copy.live.go,
    doneLabel: copy.workout.dayDone,
  };
}

/** Same content, ignoring when it was read; an update is only needed when this changes. */
export function activityKey(props: WorkoutActivityProps | null): string {
  if (!props) return "";
  const { restStart: _start, ...rest } = props;
  return JSON.stringify(rest);
}
