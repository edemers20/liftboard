import { describe, it, expect } from "vitest";
import * as E from "../src/engine.js";

/* The web copy of packages/engine's strengthTrend (C2). The web passes its own weekStartOf from src/main.js. */

const mem = (seed = {}) => { const m = new Map(Object.entries(seed)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY = 864e5;
const weekStartOf = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const wed = (() => { const d = new Date(2026, 8, 1, 12); while (d.getDay() !== 3) d.setDate(d.getDate() + 1); return d.getTime(); })();
const tops = rows => rows.map(([i, w, r = 6]) => ({ t: wed + i * 7 * DAY, w, r }));
const seed = (hist, week = {}) => E.init(mem({
  "liftboard.week.v2": JSON.stringify({ setupDone: true, mig1: 1, mig2: 1, mig3: 1, mig4: 1, mig5: 1, mig6: 1, mode: "Maintain", ...week }),
  "liftboard.hist.v1": JSON.stringify(hist),
}));

describe("strength trend (web)", () => {
  it("matches the native rule: Up past +2%, nothing before 3 weeks, core left out", () => {
    seed({ "Bench Press": tops([[0, 100], [1, 100], [2, 100], [3, 110], [4, 110], [5, 110]]), "Plank": tops([[0, 20], [1, 20], [2, 20]]) });
    const T = E.strengthTrend(weekStartOf);
    expect(T.lower).toBe(null);
    expect(T.upper.label).toBe("up");
    expect(T.upper.pct).toBeCloseTo(0.1, 5);
    expect(T.upper.spark).toHaveLength(6);
    expect(T.upper.spark[5]).toBeCloseTo(T.upper.pct, 10);
    seed({ "Back Squat (Barbell)": tops([[0, 100], [1, 100]]) });
    expect(E.strengthTrend(weekStartOf)).toEqual({ upper: null, lower: null });
  });
  it("Holding is good on a cut, and Down needs two smoothed weeks below the band", () => {
    seed({ "Bench Press": tops([[0, 100], [1, 100], [2, 100], [3, 100]]) }, { mode: "Deficit only" });
    expect(E.strengthTrend(weekStartOf).upper).toMatchObject({ label: "holding", good: true });
    seed({ "Back Squat (Barbell)": tops([[0, 100], [1, 100], [2, 100], [3, 95], [4, 95], [5, 95]]) });
    expect(E.strengthTrend(weekStartOf).lower.label).toBe("down");
  });
});
