import { describe, it, expect, beforeEach } from "vitest";
import * as E from "../src/engine.js";

const mem = (seed = {}) => { const m = new Map(Object.entries(seed)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const fresh = (patch = {}) => { E.init(mem()); Object.assign(E.wk, { setupDone: true }, patch); E.syncDays(); return E.plan(); };

describe("migration from the single-file version", () => {
  it("keeps an existing user's setup and maps old fields", () => {
    E.init(mem({ "liftboard.week.v2": JSON.stringify({ setupDone: true, mig1: 1, mig2: 1, acts: { pickle: true, climb: true, yoga: true, spin: true }, priority: "Lower build", pickle: "3+" }) }));
    expect(E.wk.mainSport).toBe("pickle");
    expect(E.wk.focus).toBe("Lower");
    expect(E.wk.pickle).toBe("3");
    expect(E.wk.acts.lift).toBe(true);
    expect(E.split()).toEqual(["d1", "d2", "d3"]);
  });
  it("starts a new user on setup with lifting only", () => {
    E.init(mem());
    expect(E.wk.setupDone).toBe(false);
    expect(E.wk.acts).toEqual({ lift: true });
  });
});

describe("splits", () => {
  const cases = [
    ["Lower", 3, ["d1", "d2", "d3"]], ["Upper", 3, ["d2", "lf", "x"]], ["Balanced", 3, ["fa", "fb", "fc"]],
    ["Lower", 5, ["d1", "d2", "d3", "x", "g2"]], ["Upper", 5, ["d2", "d1", "x", "d3", "u3"]], ["Balanced", 1, ["fa"]],
  ];
  it.each(cases)("%s focus, %i days", (focus, days, ids) => { fresh({ focus, days }); expect(E.split()).toEqual(ids); });
  it("in-season uses full-body days and shows sport support lifts", () => {
    const P = fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", season: "In-season", days: 2 });
    expect(E.DAYS.map(d => d.id)).toEqual(["fa", "fb"]);
    expect(P.days.fa.slots[4].skip).toBe(""); // calves visible for pickleball
  });
});

describe("recovery load", () => {
  it("soreness alone changes nothing", () => { const P = fresh({ focus: "Lower", sore: "Legs" }); expect(P.score).toBe(1); expect(P.days.d1.cutD).toBe(false); });
  it("readiness + soreness tips main lifts down a set and holds weights", () => {
    const base = fresh({ focus: "Lower" }).days.d1.slots[0].sets;
    const P = fresh({ focus: "Lower", ready: "Low", sore: "Legs" });
    expect(P.score).toBe(3);
    expect(P.days.d1.slots[0].sets).toBe(base - 1);
    expect(P.days.d2.slots[0].sets).toBe(fresh({ focus: "Lower" }).days.d2.slots[0].sets); // sore legs spares upper mains
  });
  it("a rough day gives the shortened version", () => { const P = fresh({ focus: "Lower", today: { d1: "Rough" } }); expect(P.days.d1.shortD).toBe(true); expect(P.days.d1.slots[3].skip).toMatch(/Skipped/); });
});

describe("progression", () => {
  const d1 = () => E.DAYS[0];
  it("uses ~5% jumps on lower main lifts", () => {
    fresh({ focus: "Lower" });
    E.exHist["Hip Thrust (Barbell)"] = [{ w: 135, r: 10 }];
    expect(E.suggest(d1(), d1().slots[0], 0, false, E.plan()).w).toBe(140);
  });
  it("flags a too-light set and a within-session collapse", () => {
    fresh({ focus: "Lower" });
    E.slots.d1 = { 1: { log: [{ w: 95, r: 12 }, { w: 95, r: 7 }] }, 2: { log: [{ w: 30, r: 14 }] } };
    const P = E.plan();
    expect(E.review(d1(), d1().slots[1], 1, P).tag).toBe("collapse");
    expect(E.review(d1(), d1().slots[2], 2, P).why).toMatch(/too light/);
  });
  it("holds weights in-season", () => {
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", season: "In-season", days: 2 });
    E.exHist["Hip Thrust (Barbell)"] = [{ w: 135, r: 10 }];
    expect(E.suggest(E.DAYS[0], E.DAYS[0].slots[0], 0, false, E.plan()).why).toBe("hold, in-season");
  });
});

describe("week flow", () => {
  it("rep drop-offs on two lifts shorten the next session", () => {
    fresh({ focus: "Lower" });
    E.exHist["Hip Thrust (Barbell)"] = [{ w: 135, r: 10 }]; E.exHist["Romanian Deadlift (Barbell)"] = [{ w: 95, r: 10 }];
    E.slots.d1 = { 0: { log: [{ w: 135, r: 7 }] }, 1: { log: [{ w: 95, r: 7 }] } };
    E.markDone("d1");
    expect(E.plan().days.d2.autoRough).toBe(true);
  });
  it("recomp picks up a missed day; deficit only resets", () => {
    fresh({ focus: "Lower", mode: "Recomp" }); E.wk.done = { d1: 1, d2: 1 }; E.newWeek();
    expect(E.wk.upNext).toBe("d3");
    fresh({ focus: "Lower", mode: "Deficit only" }); E.wk.done = { d1: 1, d2: 1 }; E.newWeek();
    expect(E.wk.upNext).toBe("d1");
  });
  it("new week resets the check-in", () => { fresh({ ready: "Low", sore: "Legs", drink: "3+" }); E.newWeek(); expect([E.wk.ready, E.wk.sore, E.wk.drink]).toEqual(["Normal", "None", "0"]); });
  it("food flips above baseline when activity covers the whole deficit", () => {
    const P = fresh({ acts: { lift: true, pickle: true }, pickle: "5", pmin: 120, rate: 0.25 });
    expect(P.math.food).toBeLessThan(0);
  });
});

describe("toasts only fire on real changes", () => {
  it("no diff for a change that does nothing", () => { fresh(); const a = E.fx(E.plan()); E.wk.sore = "Legs"; expect(E.diffFx(a, E.fx(E.plan()))).toEqual([]); });
});
