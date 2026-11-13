import { router } from "expo-router";

/** One-shot handoffs between tabs. Each is used the next time that tab is shown. */
let workoutsDay: number | null = null;
let planView: "week" | "season" | null = null;

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
  router.navigate("/plan");
}

export function takePlanView(): "week" | "season" | null {
  const view = planView;
  planView = null;
  return view;
}
