import { router } from "expo-router";

export type NudgeAsk = {
  index: number;
  dir: "up" | "down";
  reps: number;
  next: number;
  current: number;
  name: string;
};

export type LegOffer = { activity: string; from: string; toId: string; to: string };

type Job =
  | { kind: "swap"; id: string; wOff?: number; onWorkout?: (id: string) => void }
  | { kind: "leg"; offer: LegOffer; onSwap: (id: string, title: string) => void }
  | { kind: "nudge"; ask: NudgeAsk; onUse: () => void; onKeep?: () => void };

let job: Job | null = null;

export function currentSheet(): Job | null {
  return job;
}

export function clearSheet() {
  job = null;
}

/** Small native form sheet: swap, the leg-day offer, or the weight suggestion. */
export function openFitSheet(next: Job) {
  job = next;
  router.push("/sheet-fit");
}

export function openReportSheet() {
  router.push("/sheet-report");
}
