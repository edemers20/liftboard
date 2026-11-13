import { copy, fill } from "@/copy";
import { engine } from "@/store";

const L2K = 2.20462;

export function usingKg(): boolean {
  return engine.wk.units === "kg";
}

/** Stored pounds shown in the unit the person picked. */
export function toDisplay(lb: number): number {
  return usingKg() ? Math.round(+lb / L2K * 10) / 10 : +lb;
}

/** Typed display value back to stored pounds. */
export function fromDisplay(value: string): string {
  if (!usingKg() || value === "" || Number.isNaN(+value)) return value;
  return String(Math.round(+value * L2K * 100) / 100);
}

export function weightText(template: string, lb: number): string {
  const shown = fill(template, toDisplay(lb));
  return usingKg() ? shown.replace(/\blb\b/g, "kg") : shown;
}

export function unitWord(bodyweight: boolean): string {
  const word = bodyweight ? copy.workout.plusLb : "lb";
  return usingKg() ? word.replace(/\blb\b/g, "kg") : word;
}

export function clock(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
