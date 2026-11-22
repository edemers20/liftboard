import * as engine from "@liftboard/engine";

/** The set after this rest; `set` is 0 when only the exercise name is known. */
export type UpNext = { set: number; total: number; name: string };

type Planned = { slots: { sets?: number; skip?: string }[] };
type Day = { id: string; slots: { cardio?: boolean }[] };

/**
 * What comes after this rest, for the lock screen alert: the next set of the exercise just ticked,
 * else the first set of the next unfinished exercise. Counts the sets on the list, so a set added
 * with "+ Set" comes before the next exercise.
 */
export function restUpNext(name: string | undefined): UpNext | null {
  if (!name) return null;
  const timers = (engine.wk.wt || {}) as Record<string, { start?: number; end?: number }>;
  const open = Object.keys(timers).filter((id) => timers[id]?.start && !timers[id]?.end);
  const day = (engine.DAYS as Day[]).find((item) => {
    if (open.length && !open.includes(item.id)) return false;
    return item.slots.some((slot, index) => !slot.cardio && engine.exName(item, slot, index) === name);
  });
  const only = { set: 0, total: 0, name };
  if (!day) return only;
  const plan = engine.plan();
  const planned = plan.days[day.id] as Planned | undefined;
  if (!planned) return only;
  const order = engine.slotOrder(day) as number[];
  const index = order.find((slotIndex) => engine.exName(day, day.slots[slotIndex], slotIndex) === name);
  if (index == null) return only;
  const ticks = (slotIndex: number) =>
    ((engine.get(day.id, slotIndex).log || []) as { d?: boolean }[]).filter((row) => row?.d).length;
  const total = engine.setTotal(day.id, index, plan) as number;
  if (total > ticks(index)) return { set: ticks(index) + 1, total, name };
  const next = order.slice(order.indexOf(index) + 1).find((slotIndex) => {
    const slot = day.slots[slotIndex];
    const planSlot = planned.slots[slotIndex];
    if (!slot || slot.cardio || !planSlot || planSlot.skip) return false;
    return ticks(slotIndex) < engine.setTotal(day.id, slotIndex, plan);
  });
  if (next == null) return only;
  return {
    set: ticks(next) + 1,
    total: engine.setTotal(day.id, next, plan) || 1,
    name: engine.exName(day, day.slots[next], next),
  };
}
