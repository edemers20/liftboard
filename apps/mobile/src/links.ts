import { router } from "expo-router";

/** One-shot handoffs between tabs. Each is used the next time that tab is shown. */
let workoutsDay: number | null = null;
let planView: "week" | "season" | null = null;
const planListeners = new Set<(view: "week" | "season") => void>();

export function openWorkoutsDay(offset: number) {
  workoutsDay = offset;
  router.navigate("/");
}

export function takeWorkoutsDay(): number | null {
  const offset = workoutsDay;
  workoutsDay = null;
  return offset;
}

export function openPlan(view: "week" | "season") {
  planView = view;
  planListeners.forEach((fn) => fn(view));
  if (planListeners.size) planView = null;
  router.navigate("/plan");
}

/** Plan is already mounted, so a handoff has to land without waiting for focus. */
export function subscribePlanView(fn: (view: "week" | "season") => void) {
  planListeners.add(fn);
  return () => {
    planListeners.delete(fn);
  };
}

export function takePlanView(): "week" | "season" | null {
  const view = planView;
  planView = null;
  return view;
}
