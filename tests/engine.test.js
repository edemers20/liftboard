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
    expect(E.suggest(E.DAYS[0], E.DAYS[0].slots[0], 0, false, E.plan()).why).toBe("same weight in-season");
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

describe("your plan", () => {
  it("exposes the protein range per lb of bodyweight", () => { expect(fresh({ weight: 138 }).math.protein).toEqual([110, 140]); });
});

describe("pilates", () => {
  it("counts classes toward this week's cardio", () => {
    const a = fresh({ acts: { lift: true, pilates: true }, pilates: "0" });
    const b = fresh({ acts: { lift: true, pilates: true }, pilates: "2" });
    expect(b.math.otherK - a.math.otherK).toBeGreaterThan(0);
  });
});

describe("rep targets", () => {
  it("suggests a rep target alongside the weight", () => {
    const P = fresh({ focus: "Lower", days: 3 });
    const d = E.DAYS[0], s = d.slots[0], n = E.exName(d, s, 0), [lo] = [8];
    E.exHist[n] = [{ w: 135, r: 8 }];
    const t = E.suggest(d, s, 0, false, P);
    expect(t.w).toBe(135);
    expect(t.r).toBeGreaterThan(0);
  });
});

describe("finishing a day", () => {
  const logDay = () => { const d = E.DAYS[0]; E.set(d.id, 0, "log", [{ w: "135", r: "10", d: true }, { w: "135", r: "9", d: true }]); return d; };
  it("keeps the set logs on screen and writes the top set to history", () => {
    fresh({ focus: "Lower", days: 3 }); const d = logDay(); const n = E.exName(d, d.slots[0], 0);
    E.markDone(d.id);
    expect(E.get(d.id, 0).log.length).toBe(2);
    expect(E.exHist[n].at(-1)).toMatchObject({ w: 135, r: 9 });
  });
  it("reopening the day takes its history back out", () => {
    fresh({ focus: "Lower", days: 3 }); const d = logDay(); const n = E.exName(d, d.slots[0], 0); const before = (E.exHist[n] || []).length;
    E.markDone(d.id); E.markDone(d.id);
    expect((E.exHist[n] || []).length).toBe(before);
  });
  it("editing a finished day updates its history entry", () => {
    fresh({ focus: "Lower", days: 3 }); const d = logDay(); const n = E.exName(d, d.slots[0], 0);
    E.markDone(d.id); E.set(d.id, 0, "log", [{ w: "135", r: "10", d: true }, { w: "140", r: "8", d: true }]); E.resyncDone(d.id);
    expect(E.exHist[n].at(-1)).toMatchObject({ w: 140, r: 8 });
    expect(E.exHist[n].filter(x => x.t === E.wk.doneT[d.id]).length).toBe(1);
  });
  it("a new week clears finished days' logs", () => {
    fresh({ focus: "Lower", days: 3 }); const d = logDay(); E.markDone(d.id); E.newWeek();
    expect(E.get(d.id, 0).log.length).toBe(0);
  });
});

describe("two in-season sports and zero lift days", () => {
  it("0 lifting days means no lift tabs", () => { fresh({ days: 0 }); expect(E.split()).toEqual([]); });
  it("support lifts cover both in-season sports", () => {
    const P = fresh({ acts: { lift: true, golf: true, run: true }, mainSport: "golf", sport2: "run", season: "In-season", days: 2 });
    const shown = E.DAYS.flatMap(d => d.slots.filter((s, i) => s.support && P.days[d.id].slots[i].skip !== "hidden").map(s => s.label));
    expect(shown.some(l => /calf|calves/i.test(l))).toBe(true);
    expect(shown.some(l => /cuff/i.test(l))).toBe(true);
  });
  it("turning a sport off promotes the other to primary", () => {
    const w = E.fixSports({ acts: { tennis: true }, mainSport: "golf", sport2: "tennis", season: "In-season" });
    expect(w.mainSport).toBe("tennis"); expect(w.sport2).toBe(""); expect(w.season).toBe("In-season");
  });
});
