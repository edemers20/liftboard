import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as E from "../engine.js";

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
    const light = E.review(d1(), d1().slots[2], 2, P);
    expect(light.why).toMatch(/too light/);
    expect(light.r).toBe(8);
    expect(light.w).toBeGreaterThan(30);
  });
  it("names the next rep target beside the weight", () => {
    fresh({ focus: "Lower" });
    E.slots.d1 = { 0: { log: [{ w: 135, r: 8 }] } };
    const next = E.review(d1(), d1().slots[0], 0, E.plan());
    expect(next.w).toBe(135);
    expect(next.r).toBe(9);
  });
  it("says what moves up next time, and leaves holds out of that line", () => {
    fresh({ focus: "Lower" });
    E.slots.d1 = { 0: { log: [{ w: 135, r: 10 }] }, 2: { log: [{ w: 40, r: 8 }] } };
    const line = E.markDone("d1").find(text => text.startsWith("Next time"));
    expect(line).toBe("Next time: 1 moving up.");
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
  it("pace stored as % of body weight follows weight", () => {
    fresh({ mode: "Deficit only", weight: 138, ratePct: 0.5 });
    expect(E.rateLb()).toBeCloseTo(0.69, 2);
    E.wk.weight = 200; expect(E.rateLb()).toBe(1);
  });
  it("activities can be logged on an earlier date", () => {
    fresh({ acts: { lift: true, pickle: true }, pickle: 2 });
    const t = Date.now() - 864e5; E.logAct("pAct", 0, "60", t);
    expect(E.wk.sessions.find(s => s.k === "pickle").t).toBe(t);
  });
  it("leftover lifts carry the rotation forward on every goal", () => {
    fresh({ focus: "Lower", mode: "Recomp" }); E.wk.done = { d1: 1, d2: 1 }; E.newWeek();
    expect(E.wk.upNext).toBe("d3");
    fresh({ focus: "Lower", mode: "Deficit only" }); E.wk.done = { d1: 1, d2: 1 }; E.newWeek();
    expect(E.wk.upNext).toBe("d3");
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
  it("an in-season sport with no weekly count is not planned three times", () => {
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", season: "In-season", days: 3, pickle: "0" });
    expect(E.cnt("pickle")).toBe(0);
    const planned = E.plan();
    expect(planned.sessions).toBe(E.DAYS.length);
    E.wk.pickle = "";
    expect(E.cnt("pickle")).toBe(0);
    expect(E.plan().sessions).toBe(E.DAYS.length);
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", season: "In-season", days: 3 });
    delete E.wk.pickle;
    expect(E.cnt("pickle")).toBe(0);
    expect(E.plan().sessions).toBe(E.DAYS.length);
    expect(E.DAYS.length).toBe(3);
  });
  it("turning a sport off promotes the other to primary", () => {
    const w = E.fixSports({ acts: { tennis: true }, mainSport: "golf", sport2: "tennis", season: "In-season" });
    expect(w.mainSport).toBe("tennis"); expect(w.sport2).toBe(""); expect(w.season).toBe("In-season");
  });
});

describe("up to 7 of anything", () => {
  it.each(["Lower", "Upper", "Balanced"])("%s focus builds 6 and 7 unique lift days", f => {
    for (const n of [6, 7]) { fresh({ focus: f, days: n }); const ids = E.split(); expect(ids.length).toBe(n); expect(new Set(ids).size).toBe(n); }
  });
  it("6th and 7th lift days run a set lighter and get flagged", () => {
    const P = fresh({ focus: "Lower", days: 7 });
    const d6 = E.DAYS[5], s6 = d6.slots.findIndex(s => s.main);
    expect(P.days[d6.id].slots[s6].why.some(w => w.includes("days 6–7 of 7"))).toBe(true);
    expect(P.notes.some(n => n.startsWith("7 lift days"))).toBe(true);
  });
  it("a packed week raises recovery load and warns", () => {
    const P = fresh({ acts: { lift: true, pickle: true, yoga: true }, days: 4, pickle: "7", yoga: "2" });
    expect(P.sessions).toBe(13);
    expect(P.factors.some(f => f.includes("13 sessions"))).toBe(true);
    expect(P.notes.some(n => n.includes("close to daily"))).toBe(true);
  });
});

describe("maintain goal", () => {
  it("eats what you burn with no cardio target", () => {
    const P = fresh({ mode: "Maintain" });
    expect(P.math.target).toBe(0); expect(P.math.cardioTarget).toBe(0);
    expect(Math.round(P.math.intake)).toBe(Math.round(P.math.tdee));
  });
});

describe("muscle priorities and weekly balance", () => {
  const setup = (patch) => { E.init(mem()); Object.assign(E.wk, { setupDone: true, mig1: 1, mig2: 1, mig3: 1, mode: "Recomp", time: 60, ss: "Yes" }, patch); E.syncDays(); return E.plan(); };
  const finish = (P, d, skip = []) => { d.slots.forEach((s, i) => { const A = P.days[d.id].slots[i]; if (s.cardio || A.skip || skip.includes(s.label)) return; E.set(d.id, i, "log", Array.from({ length: A.sets }, () => ({ w: "50", r: "10", d: true }))); }); E.markDone(d.id); return E.plan(); };
  it("any shoulder sport protects rear delts and cuff; climbing lowers back and biceps", () => {
    for (const a of ["pickle", "tennis", "volleyball", "golf"]) { setup({ acts: { lift: true, [a]: true }, mainSport: a, [a]: "1" }); const p = E.musclePriority().P; expect(p.rdelts).toBeGreaterThan(p.sdelts); expect(p.cuff).toBeGreaterThan(1); }
    setup({ acts: { lift: true, climb: true }, climb: "2" }); const c = E.musclePriority().P; expect(c.back).toBe(2); expect(c.biceps).toBe(0);
    setup({ acts: { lift: true, run: true }, mainSport: "run", run: "3" }); const r = E.musclePriority().P; expect(r.hams).toBe(4); expect(r.calves).toBe(2);
  });
  it("focus raises its muscles for any focus", () => {
    setup({ focus: "Upper" }); let p = E.musclePriority().P; expect(p.chest).toBe(5); expect(p.glutes).toBe(3);
    setup({ focus: "Lower" }); p = E.musclePriority().P; expect(p.glutes).toBe(5); expect(p.chest).toBe(3);
    setup({ focus: "Balanced" }); p = E.musclePriority().P; expect(p.glutes).toBe(3); expect(p.chest).toBe(3);
  });
  it("time trims drop the lowest-priority accessories, not fixed ones", () => {
    const P = setup({ focus: "Lower", days: 4, time: 45, acts: { lift: true, pickle: true }, mainSport: "pickle", pickle: "2" });
    const d2 = E.DAYS[1], rear = d2.slots.findIndex(s => s.label === "Rear delts"), arms = d2.slots.findIndex(s => s.label === "Arms");
    expect(P.days[d2.id].slots[rear].skip).toBe(""); expect(P.days[d2.id].slots[arms].skip).toMatch(/^Trimmed/);
  });
  it("nothing is pulled back or dropped before a skip", () => {
    const P = setup({ focus: "Lower", days: 4, time: 45 });
    expect(P.balance).toEqual([]); expect(P.ledger.every(x => x.status !== "behind")).toBe(true);
  });
  it("after a skipped day: covered repeats go optional and a short muscle gets a set back", () => {
    let P = setup({ focus: "Lower", days: 4, acts: { lift: true, pickle: true }, mainSport: "pickle", pickle: "2" });
    P = finish(P, E.DAYS[0]); P = finish(P, E.DAYS[1], ["Rear delts", "Arms"]);
    const d3 = E.DAYS[2], d4 = E.DAYS[3];
    expect(P.days[d3.id].slots[d3.slots.findIndex(s => s.label === "Side delts")].skip).toMatch(/^Covered/);
    expect(P.days[d4.id].slots[d4.slots.findIndex(s => s.label === "Rear delts")].why.some(w => w.includes("rear delts behind"))).toBe(true);
    expect(P.ledger.find(x => x.m === "rdelts").status).toBe("behind");
  });
});

describe("fat-loss pace guardrails", () => {
  const base = { mig1: 1, mig2: 1, mig3: 1, sex: "Female", weight: 138, height: 63, days: 4, focus: "Lower" };
  it("Lose fat, keep muscle caps at 0.7% of body weight, not a flat 0.5 lb", () => {
    let P = fresh({ ...base, mode: "Recomp", rate: 1.5 });
    expect(P.math.rateEff).toBeCloseTo(0.97, 2);
    expect(P.notes.some(n => n.includes("caps loss at 1.0 lb/week"))).toBe(true);
    P = fresh({ ...base, mode: "Recomp", rate: 0.75 });
    expect(P.math.rateEff).toBe(0.75);
    expect(P.notes.some(n => n.includes("hold muscle"))).toBe(true);
    expect(P.notes.some(n => n.includes("period"))).toBe(true);
  });
  it("default 0.5 lb/week stays muscle-friendly with no pace warnings", () => {
    const P = fresh({ ...base, mode: "Recomp", rate: 0.5 });
    expect(P.math.fast).toBe(false);
    expect(P.notes.some(n => n.includes("period") || n.includes("hold muscle"))).toBe(false);
  });
  it("raises food to the energy floor and says the loss will be slower", () => {
    const P = fresh({ ...base, mode: "Deficit only", rate: 2, share: 0 });
    expect(P.math.eaRaise).toBeGreaterThan(0);
    expect(P.math.ea).toBeGreaterThanOrEqual(29.9);
    expect(P.notes.some(n => n.startsWith("Food raised"))).toBe(true);
  });
  it("suggests Maintain after 8 fast weeks in a row", () => {
    const weeks = Array.from({ length: 8 }, () => ({ fast: true }));
    const P = fresh({ ...base, mode: "Recomp", rate: 0.9, weeks });
    expect(P.notes.some(n => n.includes("8 weeks at a faster pace"))).toBe(true);
  });
});

describe("days 5–7 don't copy earlier days", () => {
  const exs = d => d.slots.map((s, i) => s.cardio ? null : E.exName(d, s, i)).filter(Boolean);
  it.each(["Lower", "Upper", "Balanced"])("%s focus, 5 days: day 5 shares no default exercise with days 1–4", focus => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus, days: 5 });
    const early = new Set(E.DAYS.slice(0, 4).flatMap(exs));
    const d5 = exs(E.DAYS[4]);
    expect(d5.filter(x => early.has(x))).toEqual([]);
  });
  it("lower focus day 5 is the glute & hamstring day", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 5 });
    expect(E.DAYS[4].title).toBe("Lower (Glute & Hamstring)");
    expect(exs(E.DAYS[4])[0]).toBe("Sumo Deadlift");
  });
  it("days 1–4 keep their usual defaults", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 5 });
    expect(exs(E.DAYS[0])[0]).toBe("Hip Thrust (Barbell)");
    expect(exs(E.DAYS[3]).includes("Overhead Press (Barbell)")).toBe(true);
  });
});

describe("food you can act on", () => {
  const P = n => fresh({ mig1: 1, mig2: 1, mig3: 1, sex: "Female", weight: 138, height: 63, mode: "Recomp", rate: 0.5, days: n, weeks: [{ intake: 1800 }] });
  it("an extra lift day shows up as eating more vs everyday burn and vs last week", () => {
    const a = P(4).math, b = P(5).math;
    expect(Math.abs(b.everyday - a.everyday)).toBeLessThan(10);
    expect(b.vsEveryday - a.vsEveryday).toBeGreaterThan(15);
    expect(b.vsLast).toBeGreaterThan(a.vsLast);
  });
});

describe("session log for History", () => {
  it("finishing a lift day logs a session; reopening it takes it back", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4 });
    const id = E.DAYS[0].id;
    E.markDone(id);
    expect(E.wk.sessions.filter(s => s.k === "lift" && s.id === id).length).toBe(1);
    E.markDone(id);
    expect(E.wk.sessions.filter(s => s.k === "lift").length).toBe(0);
  });
  it("entering activity minutes dates the session; clearing removes it", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, acts: { lift: true, pickle: true }, mainSport: "pickle", pickle: "2" });
    E.logAct("pAct", 0, "80");
    expect(E.wk.sessions.find(s => s.k === "pickle").min).toBe(80);
    E.logAct("pAct", 0, "90");
    expect(E.wk.sessions.filter(s => s.k === "pickle").length).toBe(1);
    E.logAct("pAct", 0, "");
    expect(E.wk.sessions.filter(s => s.k === "pickle").length).toBe(0);
  });
  it("backfills past lift days from lift history once", () => {
    E.init(mem({ "liftboard.week.v2": JSON.stringify({ setupDone: true, mig1: 1, mig2: 1, mig3: 1 }), "liftboard.hist.v1": JSON.stringify({ "Hip Thrust (Barbell)": [{ w: 135, r: 8, t: 1000 }, { w: 140, r: 8, t: 2000 }], "Leg Curl (Seated)": [{ w: 60, r: 10, t: 2000 }] }) }));
    expect(E.wk.sessions.map(s => s.t)).toEqual([1000, 2000]);
  });
});

describe("cut-aware overload", () => {
  const setup = (mode, rate) => { fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4, mode, rate, weight: 138 }); return E.DAYS[0]; };
  const hist = (n, rows) => { rows.forEach((x, k) => { (E.exHist[n] = E.exHist[n] || []).push({ ...x, t: k + 1 }); }); };
  it("on a cut, two misses keep the weight instead of dropping 10%", () => {
    const d = setup("Deficit only", 0.5), s = d.slots[0], n = E.exName(d, s, 0);
    hist(n, [{ w: 145, r: 5 }, { w: 145, r: 5 }]);
    const t = E.suggest(d, s, 0, false, E.plan());
    expect(t.w).toBe(145); expect(t.why).toMatch(/hold/);
  });
  it("on a cut, three misses ease 5%", () => {
    const d = setup("Deficit only", 0.5), s = d.slots[0], n = E.exName(d, s, 0);
    hist(n, [{ w: 140, r: 5 }, { w: 140, r: 5 }, { w: 140, r: 5 }]);
    expect(E.suggest(d, s, 0, false, E.plan()).w).toBeLessThan(140);
    expect(E.suggest(d, s, 0, false, E.plan()).w).toBeGreaterThanOrEqual(130);
  });
  it("not cutting (recomp at 0.5 lb): two misses still rebuild 10%", () => {
    const d = setup("Recomp", 0.5), s = d.slots[0], n = E.exName(d, s, 0);
    hist(n, [{ w: 140, r: 5 }, { w: 140, r: 5 }]);
    expect(E.cutting()).toBe(false);
    expect(E.suggest(d, s, 0, false, E.plan()).why).toBe("rebuild");
  });
  it("on a cut, an accessory you missed loses a set; a goal note explains", () => {
    const d = setup("Deficit only", 0.5); const i = d.slots.findIndex(s => !s.main && !s.cardio);
    const n = E.exName(d, d.slots[i], i), before = E.plan().days[d.id].slots[i].sets;
    hist(n, [{ w: 30, r: 4 }]);
    const P = E.plan();
    expect(P.days[d.id].slots[i].sets).toBe(before - 1);
    expect(P.notes.some(x => x.startsWith("On a cut, preserving strength"))).toBe(true);
  });
});

describe("added exercises", () => {
  it("categorizes, counts toward the weekly ledger, and is never trimmed", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4, time: 30 });
    const id = E.DAYS[1].id, len = E.DAYS[1].slots.length;
    const before = (E.plan().ledger.find(x => x.m === "biceps") || { left: 0 }).left;
    E.addExtra(id, "Hammer Curl (Dumbbell)");
    const d = E.DAYS[1];
    expect(d.slots.length).toBe(len + 1);
    expect(d.slots[len].label).toBe("Arms");
    const P = E.plan();
    expect(P.days[id].slots[len].skip).toBe("");
    expect(P.ledger.find(x => x.m === "biceps").left).toBeGreaterThan(before);
    expect(E.slotOrder(d).at(-1)).toBe(d.slots.findIndex(s => s.cardio));
  });
  it("guesses a category for a custom name", () => {
    expect(E.catOf("Banded frog pump")).toBe("lightGlute");
    expect(E.catOf("Nordic curl")).toBe("ham");
    expect(E.catOf("Cable crunch")).toBe("core");
  });
  it("finishing the day records the extra with its top set; a new week clears it", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4 });
    const id = E.DAYS[0].id; E.addExtra(id, "Cable Kickback", "lightGlute");
    const i = E.DAYS[0].slots.length - 1;
    E.set(id, i, "log", [{ w: 20, r: 12, d: true }, { w: 25, r: 10, d: true }]);
    E.markDone(id);
    const ex = E.wk.sessions.at(-1).ex;
    expect(ex.find(x => x.n === "Cable Kickback")).toMatchObject({ w: 25, r: 10, sets: 2, extra: true });
    E.newWeek();
    expect(E.DAYS[0].slots.some(s => s.extra)).toBe(false);
  });
});

describe("next-time notes carry over", () => {
  it("finishing a day saves a note per exercise; reopening the day removes it", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4 });
    const d = E.DAYS[0], n = E.exName(d, d.slots[0], 0);
    E.set(d.id, 0, "log", [{ w: 135, r: 10, d: true }]);
    E.markDone(d.id);
    expect(E.wk.next[n]).toMatchObject({ tag: "up" });
    E.markDone(d.id);
    expect(E.wk.next[n]).toBeUndefined();
  });
});

describe("bodyweight exercises", () => {
  it("library has bodyweight options and detects them", () => {
    expect(E.L.chest).toContain("Push-Up");
    expect(E.L.core).toContain("Plank");
    expect(E.isBW("Push-Up")).toBe(true);
    expect(E.isBW("Assisted Pull-Up")).toBe(false);
    expect(E.isBW("Hip Thrust (Barbell)")).toBe(false);
  });
  it("a bodyweight set counts with reps only, and progresses by reps", () => {
    fresh({ mig1: 1, mig2: 1, mig3: 1, focus: "Lower", days: 4 });
    const id = E.DAYS[0].id; E.addExtra(id, "Push-Up", "chest");
    const d = E.DAYS[0], i = d.slots.length - 1;
    E.set(id, i, "log", [{ w: "", r: 12, d: true }]);
    E.markDone(id);
    expect(E.exHist["Push-Up"].at(-1)).toMatchObject({ w: 0, r: 12 });
    expect(E.wk.sessions.at(-1).ex.find(x => x.n === "Push-Up")).toMatchObject({ w: 0, r: 12 });
    expect(E.wk.next["Push-Up"].tag).toBe("up");
  });
});

describe("yoga and pilates effort", () => {
  it("effort sets calories; light classes don't count as core work", () => {
    const k = eff => fresh({ mig1: 1, mig2: 1, mig3: 1, acts: { lift: true, pilates: true }, pilates: "2", peff: eff }).math.otherK;
    expect(k("Hard")).toBeGreaterThan(k("Moderate"));
    expect(k("Moderate")).toBeGreaterThan(k("Light"));
    const P = fresh({ mig1: 1, mig2: 1, mig3: 1, acts: { lift: true, pilates: true }, pilates: "2", peff: "Light" });
    const Q = fresh({ mig1: 1, mig2: 1, mig3: 1, acts: { lift: true, pilates: true }, pilates: "2", peff: "Moderate" });
    expect(P.priority.P.core).toBeGreaterThan(Q.priority.P.core);
  });
});

describe("rest, starting weights and the day queue", () => {
  const lower = () => { fresh({ focus: "Lower" }); return E.DAYS[0]; };
  it("rests a main lift 2:30 plus 30s on the first set", () => {
    const d = lower();
    expect(E.restPlan(d.slots[0], "Hip Thrust (Barbell)", 0, d)).toMatchObject({ base: 150, bump: 30 });
    expect(E.beginRest(d.id, 0, 0).secs).toBe(180);
  });
  it("adds 15s on a cut and caps a remembered tweak between 30s and 5:00", () => {
    fresh({ focus: "Lower", mode: "Deficit only" });
    const d = E.DAYS[0];
    expect(E.restPlan(d.slots[0], "Hip Thrust (Barbell)", 1, d).why).toBe("+15s (cut)");
    E.beginRest(d.id, 0, 0);
    for (let n = 0; n < 20; n++) E.adjustRest(-15);
    expect(E.wk.restFor["Hip Thrust (Barbell)"]).toBe(30);
    E.wk.rest.end = Date.now() + 1000;
    expect(E.adjustRest(-15).secs).toBeGreaterThanOrEqual(4.9);
  });
  it("uses a 20s transition once a superset is actually alternating", () => {
    fresh({ focus: "Lower" });
    const d = E.DAYS.find(x => x.id === "d2");
    const a2 = d.slots.findIndex(s => s.ss === "A2");
    const a1 = d.slots.findIndex(s => s.ss === "A1");
    E.set(d.id, a2, "log", [{ d: true, w: "40", r: "10" }]);
    expect(E.restPlan(d.slots[a1], "Lat Pulldown (Wide)", 0, d)).toMatchObject({ base: 20, fixed: 1 });
  });
  it("drops the rest bar after it has been over for 5 minutes", () => {
    const d = lower();
    E.beginRest(d.id, 0, 0);
    E.wk.rest.end = Date.now() - 301000;
    expect(E.restView()).toBeNull();
    expect(E.wk.rest).toBeNull();
  });
  it("guesses a first weight from a related lift and offers a nudge past the top", () => {
    fresh({ focus: "Lower" });
    E.exHist["Hip Thrust (Barbell)"] = [{ w: 135, r: 8, t: 1 }];
    expect(E.startingGuess("Glute Bridge (Barbell)")).toEqual({ w: 120, from: "Hip Thrust (Barbell)", fromW: 135 });
    expect(E.startingGuess("Hip Thrust (Barbell)")).toBeNull();
    E.set("d1", 1, "log", [{ w: "95", r: "12", d: true }]);
    expect(E.offerNudge("d1", 1)).toMatchObject({ dir: "up", reps: 12 });
    expect(E.showsSide("Bulgarian Split Squat")).toBe(true);
    expect(E.showsSide("Hip Thrust (Barbell)")).toBe(false);
  });
  it("queues the first lift on Monday and can pin one onto a Sunday", () => {
    fresh({ focus: "Balanced", days: 3 });
    const mon = new Date(2026, 10, 2, 12).getTime();
    expect(E.dayBoard(0, mon).plannedId).toBe("fa");
    const sun = new Date(2026, 10, 8, 15).getTime();
    expect(E.dayBoard(0, sun).plannedId).toBeNull();
    E.moveLiftToToday("fa", sun);
    expect(E.dayBoard(0, sun).plannedId).toBe("fa");
  });
  it("is complete only when every required set and the finisher are done", () => {
    const d = lower();
    expect(E.dayComplete(d.id)).toBe(false);
    const P = E.plan();
    d.slots.forEach((s, i) => {
      const A = P.days[d.id].slots[i];
      if (!A || A.skip || s.cardio) return;
      E.set(d.id, i, "log", Array.from({ length: A.sets }, () => ({ w: "100", r: "8", d: true })));
    });
    const ci = d.slots.findIndex(s => s.cardio);
    if (ci >= 0 && !E.plan().days[d.id].slots[ci].skip) E.set(d.id, ci, "cdone", true);
    expect(E.dayComplete(d.id)).toBe(true);
  });
});

describe("week start", () => {
  it("keeps this week and uses the new day when the next week begins", () => {
    fresh({ wkStart: "Mon" });
    const now = Date.now();
    const before = E.weekStartOf(now).getTime();
    E.setWeekStart("Sun");
    expect(E.wk.wkStart).toBe("Sun");
    expect(E.weekRuleAt(now)).toBe("Mon");
    expect(E.weekStartOf(now).getTime()).toBe(before);
    const next = new Date(before);
    next.setDate(next.getDate() + 7);
    expect(E.weekRuleAt(next.getTime())).toBe("Sun");
    expect(E.weekStartOf(next.getTime()).getTime()).toBe(next.getTime());
    E.setWeekStart("Mon");
    expect(E.wk.wkStart).toBe("Mon");
    expect(E.weekRuleAt(now)).toBe("Mon");
    expect(E.weekStartOf(now).getTime()).toBe(before);
    expect(E.weekRuleAt(next.getTime())).toBe("Mon");
    expect(E.weekStartOf(next.getTime()).getTime()).toBe(next.getTime());
  });

  it("applies the chosen day from the moment a new week starts", () => {
    fresh({ wkStart: "Mon" });
    const now = Date.now();
    const before = E.weekStartOf(now).getTime();
    E.setWeekStart("Sun");
    E.newWeek(now);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    expect(E.weekRuleAt(now)).toBe("Sun");
    expect(E.weekStartOf(now).getTime()).toBe(today.getTime());
    const earlier = new Date(before);
    earlier.setDate(earlier.getDate() - 1);
    expect(E.weekRuleAt(earlier.getTime())).toBe("Mon");
  });
});

describe("swapping a workout within its family", () => {
  it("offers same-family workouts not already in the week, and the swap sticks", () => {
    fresh({ focus: "Lower", days: 4 });
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "d3", "x"]);
    expect(E.swapOptions("d3").map(t => t.id)).toEqual(["d3", "g2", "lf"]);
    expect(E.swapOptions("d2").map(t => t.id)).toEqual(["d2", "u3"]);
    E.wk.upNext = "d3";
    expect(E.swapDay("d3", "g2")).toBe(true);
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "g2", "x"]);
    expect(E.wk.upNext).toBe("g2");
    E.syncDays();
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "g2", "x"]);
    expect(E.swapOptions("g2").map(t => t.id)).toEqual(["d3", "g2", "lf"]);
    E.swapDay("g2", "d3");
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "d3", "x"]);
    expect(E.wk.alt).toEqual({});
  });
  it("never doubles a workout already in the week", () => {
    fresh({ focus: "Lower", days: 5, alt: { d3: "g2" } });
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "d3", "x", "g2"]);
  });
  it("pins today's lift to the workout chosen in the swap sheet", () => {
    fresh({ focus: "Lower", days: 3 });
    const id = E.split()[0];
    E.moveLiftToToday(id);
    expect(E.dayBoard(0).plannedId).toBe(id);
    const alt = E.swapOptions(id).map((d) => d.id).find((x) => x !== id);
    expect(alt).toBeTruthy();
    expect(E.swapDay(id, alt)).toBe(true);
    expect(E.wk.pinToday).toEqual({ d: E.dayKey(), id: alt });
    expect(E.dayBoard(0).plannedId).toBe(alt);
  });
});

describe("swapping with another planned lift", () => {
  const mem2 = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  /** Lower 4 days lifts on Mon, Wed, Fri and Sun: d1, d2, d3, x. */
  function setup(now) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const store = mem2();
    E.init(store);
    Object.assign(E.wk, { setupDone: true, focus: "Lower", days: 4, wkStart: "Mon", weekStart: E.weekStartOf(now).getTime() });
    E.syncDays();
    E.save();
    return store;
  }
  afterEach(() => vi.useRealTimers());

  it("a swap on a card this week sticks after the app reopens", () => {
    const mon = new Date(2026, 10, 16, 9).getTime();
    const store = setup(mon);
    expect(E.dayBoard(2, mon).plannedId).toBe("d2");
    expect(E.plannedSwaps("d2", 0, mon)).toEqual(["d1", "d3", "x"]);
    expect(E.swapWeek("d2", "x")).toBe(true);
    expect(E.dayBoard(2, mon).plannedId).toBe("x");
    E.init(store);
    expect(E.dayBoard(2, mon).plannedId).toBe("x");
    expect(E.dayBoard(6, mon).plannedId).toBe("d2");
  });

  const cards = (off, now) => [0, 2, 4, 6].map(i => E.weekModel(off, now).plan[i]);

  it("a card next week swaps within next week only, and it survives a reload", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    const store = setup(now);
    const thisWeek = E.weekModel(0, now).todo.slice();
    expect(cards(1, now)).toEqual(["d1", "d2", "d3", "x"]);
    expect(E.plannedSwaps("d1", 1, now)).toEqual(["d2", "d3", "x"]);
    expect(E.swapWeek("d1", "d3", 1, now)).toBe(true);
    expect(E.dayBoard(7, now).plannedId).toBe("d3");
    expect(cards(1, now)).toEqual(["d3", "d2", "d1", "x"]);
    expect(E.weekModel(0, now).todo).toEqual(thisWeek);
    expect(E.wk.weekOrder).toBeFalsy();
    expect(cards(2, now)).toEqual(["d1", "d2", "d3", "x"]);
    E.init(store);
    expect(cards(1, now)).toEqual(["d3", "d2", "d1", "x"]);
  });

  it("each later week keeps its own order", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d2", "x", 2, now);
    expect(cards(1, now)).toEqual(["d1", "d2", "d3", "x"]);
    expect(cards(2, now)).toEqual(["d1", "x", "d3", "d2"]);
    expect(cards(3, now)).toEqual(["d1", "d2", "d3", "x"]);
  });

  it("swapping back to the usual order stores nothing", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d1", "d3", 1, now);
    E.swapWeek("d3", "d1", 1, now);
    expect(E.wk.futureOrder).toEqual({});
  });

  it("when that week starts, its order becomes the week's order and older orders go", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    const store = setup(now);
    E.swapWeek("d1", "x", 1, now);
    E.swapWeek("d1", "d2", 2, now);
    const mon = new Date(2026, 10, 23, 9).getTime();
    vi.setSystemTime(mon);
    E.wk.done = { d1: 1, d2: 1, d3: 1, x: 1 };
    E.newWeek(E.weekStartOf(mon).getTime());
    E.init(store);
    expect(cards(0, mon)).toEqual(["x", "d2", "d3", "d1"]);
    const after = E.weekStartOf(mon); after.setDate(after.getDate() + 7);
    expect(Object.keys(E.wk.futureOrder)).toEqual([String(after.getTime())]);
    expect(cards(1, mon)).toEqual(["d2", "d1", "d3", "x"]);
  });

  it("a lift carried over from last week only leads if the chosen order still puts it first", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d1", "d2", 1, now);
    const mon = new Date(2026, 10, 23, 9).getTime();
    vi.setSystemTime(mon);
    E.wk.done = { d1: 1, d2: 1, d3: 1 };
    E.newWeek(E.weekStartOf(mon).getTime());
    expect(E.weekModel(0, mon).todo).toEqual(["d2", "d1", "d3", "x"]);
    expect(E.wk.upNext).toBe("");
    expect(E.wk.missedNote).toBeNull();
  });

  it("a same-group swap renames the lift inside saved orders", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d1", "d3", 1, now);
    expect(E.swapDay("d3", "g2")).toBe(true);
    expect(cards(1, now)).toEqual(["g2", "d2", "d1", "x"]);
  });

  it("a changed plan reconciles the order, and a different split drops it", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d1", "x", 1, now);
    Object.assign(E.wk, { days: 3 }); E.syncDays();
    expect(E.DAYS.map(d => d.id)).toEqual(["d1", "d2", "d3"]);
    expect(E.weekModel(1, now).todo).toEqual(["d2", "d3", "d1"]);
    Object.assign(E.wk, { focus: "Balanced", days: 3 }); E.syncDays();
    expect(E.weekModel(1, now).todo).toEqual(["fa", "fb", "fc"]);
  });

  it("changing the week's start day clears orders for later weeks", () => {
    const now = new Date(2026, 10, 16, 9).getTime();
    setup(now);
    E.swapWeek("d1", "x", 1, now);
    E.setWeekStart("Sun");
    expect(E.wk.futureOrder).toEqual({});
  });

  it("past weeks can't be swapped", () => {
    const sun = new Date(2026, 10, 22, 9).getTime();
    setup(sun);
    expect(E.plannedSwaps("d1", -1, sun)).toEqual([]);
    expect(E.swapWeek("d1", "d2", -1, sun)).toBe(false);
  });

  it("after Mark week as finished, next week's cards are the plan's week and can swap", () => {
    const mon = new Date(2026, 10, 16, 9).getTime();
    setup(mon);
    E.finishWeek(mon);
    expect(E.plannedSwaps("d1", 0, mon)).toEqual([]);
    const card = E.dayBoard(7, mon);
    expect(card.wOff).toBe(1);
    expect(card.plannedId).toBe("d1");
    expect(E.plannedSwaps("d1", 1, mon)).toEqual(["d2", "d3", "x"]);
    expect(E.swapWeek("d1", "d3")).toBe(true);
    expect(E.dayBoard(7, mon).plannedId).toBe("d3");
  });

  it("skips lifts already started", () => {
    const mon = new Date(2026, 10, 16, 9).getTime();
    setup(mon);
    E.set("d3", 0, "log", [{ w: "100", r: "5", d: true }]);
    expect(E.plannedSwaps("d2", 0, mon)).toEqual(["d1", "x"]);
  });
});

describe("finishing a week early", () => {
  it("opens next week's plan and undo keeps sessions logged since", () => {
    const start = new Date(2026, 10, 2);
    start.setHours(0, 0, 0, 0);
    fresh({ focus: "Balanced", days: 3, weekStart: start.getTime() });
    const mon = new Date(2026, 10, 2, 12).getTime();
    expect(E.dayBoard(0, mon).plannedId).toBe("fa");
    const summary = E.finishWeek(mon);
    expect(summary.planned).toBe(3);
    expect(E.earlyDone(mon)).toBe(true);
    expect(E.planOff(mon)).toBe(1);
    expect(E.dayBoard(0, mon).plannedId).toBeNull();
    expect(Object.keys(E.weekModel(1, mon).plan).length).toBeGreaterThan(0);
    E.wk.sessions = (E.wk.sessions || []).concat([{ t: mon + 1000, k: "pickle", min: 30 }]);
    expect(E.undoFinish()).toBe(true);
    expect(E.earlyDone(mon)).toBe(false);
    expect(E.hasFinishSnap()).toBe(false);
    expect(E.wk.sessions.some((session) => session.k === "pickle")).toBe(true);
  });
});

describe("week actuals from the log", () => {
  it("counts logged minutes, not the plan, and nets out resting burn", () => {
    fresh({ weight: "138", pickle: 2 });
    const start = Date.UTC(2026, 10, 2, 5), D = 864e5;
    E.wk.sessions = [
      { t: start + 1 * D, k: "pickle", min: 90 },
      { t: start + 3 * D, k: "lift", id: "d1", min: 125, ex: [{ n: "Hip Thrust (Barbell)", w: 185, r: 8 }, { n: "Incline Walk", cardio: 1, min: 80 }] },
      { t: start + 9 * D, k: "pickle", min: 60 }
    ];
    const A = E.weekActuals(start);
    expect(A.sport).toBe(90);
    expect(A.lifts).toBe(1);
    // 138 lb = 62.6 kg; pickleball (4.5-1)*3.5*62.6/200*90 = 345, incline walk (6.5-1)*3.5*62.6/200*80 = 482,
    // lifting 125 - 80 finisher = 45 min at (5-1)*3.5*62.6/200 = 197
    expect(A.burn).toBeGreaterThan(1005);
    expect(A.burn).toBeLessThan(1040);
  });
});

describe("lift calories", () => {
  const D = 864e5;
  it("uses session length until there are 3 timed lifts", () => {
    fresh({ weight: "138", time: 60 });
    // 60 min at (5-1)*3.5*62.6/200 = 4.38 kcal/min = 263 → 265
    expect(E.liftKcal()).toBe(265);
  });
  it("averages the lifting minutes of recent timed lifts, finishers excluded", () => {
    fresh({ weight: "138", time: 60 });
    E.wk.sessions = [45, 45, 75].map((m, i) => ({ t: i * D, k: "lift", id: "d1", min: m, ex: i === 2 ? [{ n: "Incline Walk", cardio: 1, min: 30 }] : [] }));
    // 45, 45, 45 lifting minutes → 197 → 195
    expect(E.liftKcal()).toBe(195);
  });
  it("is worked out weekly, not on every change", () => {
    fresh({ weight: "138", time: 60 });
    E.plan();
    const before = E.wk.liftKAuto;
    E.wk.time = 30; E.plan();
    expect(E.wk.liftKAuto).toBe(before);
    E.newWeek(Date.now());
    expect(E.wk.liftKAuto).toBeLessThan(before);
  });
});

describe("estimated 1RM, PRs and the week streak", () => {
  const atNoon = (year, month, day) => new Date(year, month, day, 12).getTime();

  it("rounds the Epley estimate from the top set", () => {
    fresh();
    expect(E.e1rm(155, 8)).toBe(196);
    expect(E.e1rm(100, 8)).toBe(127);
    expect(E.e1rm(110, 3)).toBe(121);
  });

  it("keeps one top set per week and ignores a higher estimate that is not a heavier set or more reps", () => {
    fresh();
    const first = E.weekStartOf(atNoon(2026, 0, 15)).getTime();
    const week = (n) => { const d = new Date(first); d.setDate(d.getDate() + 7 * n); d.setHours(12, 0, 0, 0); return d.getTime(); };
    E.exHist["Hip Thrust (Barbell)"] = [
      { w: 135, r: 8, t: week(0) },
      { w: 140, r: 6, t: week(0) + 864e5 },
      { w: 140, r: 8, t: week(1) },
      { w: 145, r: 5, t: week(2) },
    ];
    const tops = E.weekTops("Hip Thrust (Barbell)");
    expect(tops.map(row => [row.w, row.r, row.pr])).toEqual([[140, 6, ""], [140, 8, "reps"], [145, 5, "top"]]);
    expect(tops[1].wasW).toBe(140);
    expect(tops[1].wasR).toBe(6);
    expect(tops[2].wasW).toBe(140);
    expect(tops[2].wasR).toBe(8);
    expect(tops[2].e1).toBe(E.e1rm(145, 5));
    expect(tops[2].e1).toBeLessThan(tops[1].e1);

    E.exHist["Hack Squat"] = [
      { w: 100, r: 10, t: week(0) },
      { w: 110, r: 5, t: week(1) },
      { w: 105, r: 8, t: week(2) },
    ];
    const hack = E.weekTops("Hack Squat");
    expect(hack[1].pr).toBe("top");
    expect(hack[2].pr).toBe("");
    expect(hack[2].e1).toBeGreaterThan(hack[1].e1);
    expect(E.recentPrs().some(pr => pr.name === "Hack Squat" && pr.t === week(2))).toBe(false);
    expect(E.recentPrs()[0]).toMatchObject({ name: "Hip Thrust (Barbell)", kind: "top", w: 145, r: 5 });
  });

  it("counts more reps at the same or a heavier weight, and ignores a lighter set with a higher estimate", () => {
    fresh();
    const first = E.weekStartOf(atNoon(2026, 0, 15)).getTime();
    const week = (n) => { const d = new Date(first); d.setDate(d.getDate() + 7 * n); d.setHours(12, 0, 0, 0); return d.getTime(); };
    E.exHist["Overhead Press (Barbell)"] = [
      { w: 100, r: 8, t: week(0) },
      { w: 120, r: 5, t: week(1) },
      { w: 110, r: 10, t: week(2) },
      { w: 95, r: 12, t: week(3) },
    ];
    const rows = E.weekTops("Overhead Press (Barbell)");
    expect(rows[2]).toMatchObject({ w: 110, r: 10, pr: "reps", wasW: 100, wasR: 8 });
    expect(rows[3].pr).toBe("");
    expect(rows[3].e1).toBeGreaterThan(rows[0].e1);
  });

  it("gives bodyweight exercises no estimate, leaves them out of trends, and counts more reps as a PR", () => {
    fresh();
    const t = atNoon(2026, 0, 12);
    E.exHist["Push-Up"] = [{ w: 0, r: 12, t }, { w: 0, r: 15, t: t + 8 * 864e5 }];
    const rows = E.weekTops("Push-Up");
    expect(rows.map(row => row.e1)).toEqual([null, null]);
    expect(rows[0].pr).toBe("");
    expect(rows[1]).toMatchObject({ pr: "reps", w: 0, r: 15, wasW: 0, wasR: 12 });
    expect(E.liftTrends().some(row => row.name === "Push-Up")).toBe(false);
    expect(E.recentPrs().some(pr => pr.name === "Push-Up" && pr.kind === "reps")).toBe(true);
  });

  it("charts the last 8 weeks, newest training first", () => {
    fresh();
    const first = E.weekStartOf(atNoon(2026, 0, 15)).getTime();
    const points = [];
    for (let i = 0; i < 9; i++) {
      const d = new Date(first); d.setDate(d.getDate() + 7 * i); d.setHours(12, 0, 0, 0);
      points.push({ w: 100 + i * 5, r: 8, t: d.getTime() });
    }
    E.exHist["Romanian Deadlift (Barbell)"] = points;
    E.exHist["Hip Thrust (Barbell)"] = [points[0]];
    const trend = E.liftTrends().find(row => row.name === "Romanian Deadlift (Barbell)");
    expect(E.liftTrends()[0].name).toBe("Romanian Deadlift (Barbell)");
    expect(trend.rows).toHaveLength(8);
    expect(trend.rows[0].w).toBe(105);
    expect(trend.rows[7].w).toBe(140);
    expect(trend.rows[7].pr).toBe("top");
  });

  it("counts a finished week, and a counted week, back from the last one closed", () => {
    fresh();
    expect(E.weekStreak()).toBe(0);
    E.wk.weeks = [
      { start: 1, lifts: 2, planned: 2 },
      { start: 2, lifts: 1, planned: 2 },
      { start: 3, lifts: 2, planned: 2 },
      { start: 4, lifts: 2, planned: 2 },
    ];
    expect(E.weekStreak()).toBe(2);
    expect(E.weekCompleted(E.wk.weeks[1])).toBe(false);
    expect(E.countWeek(2)).toBe(true);
    expect(E.weekStreak()).toBe(4);
    expect(E.countWeek(2)).toBe(false);
    expect(E.weekStreak()).toBe(2);
    expect(E.countWeek(4)).toBe(false);
    expect(E.wk.weeks[3].counted).toBeUndefined();
    E.wk.weeks = [{ start: 1, lifts: 2, planned: 2 }, { start: 2, lifts: 0, planned: 2 }];
    expect(E.weekStreak()).toBe(0);
    E.wk.weeks = [{ start: 1, lifts: 0, planned: 0 }];
    expect(E.weekCompleted(E.wk.weeks[0])).toBe(false);
    expect(E.countWeek(99)).toBe(false);
  });

  it("saves missed workouts and muscle sets when the week closes", () => {
    fresh({ focus: "Lower", days: 3 });
    E.slots.d1 = { 0: { log: [{ w: 135, r: 8, d: 1 }, { w: 135, r: 8, d: 1 }] } };
    E.markDone("d1");
    E.newWeek();
    const week = E.wk.weeks.at(-1);
    expect(week.lifts).toBe(1);
    expect(week.planned).toBe(3);
    expect(week.miss).toEqual(["Upper (Press)", "Lower (Quad & Glute)"]);
    const glutes = week.muscles.find(row => row.name === "Glutes");
    expect(glutes.done).toBeGreaterThan(0);
    expect(glutes.planned).toBeGreaterThan(0);
    expect(week.sets).toBe(2);
  });

  it("saves PRs and lifts that go up, and skips a lighter set with a higher estimate", () => {
    fresh({ focus: "Lower", days: 3 });
    const start = E.weekStartOf(Date.now()).getTime();
    E.wk.weekStart = start;
    E.exHist["Hip Thrust (Barbell)"] = [{ w: 135, r: 8, t: start - 864e5 }];
    E.exHist["Hack Squat"] = [{ w: 100, r: 10, t: start - 864e5 }];
    E.wk.sessions = [{ t: start + 3600000, k: "pickle", min: 40 }];
    E.slots.d1 = { 0: { log: [{ w: 140, r: 10, d: true }] } };
    const upper = E.DAYS.find(d => d.id === "d2");
    const side = upper.slots.findIndex(s => s.label === "Side delts");
    E.set("d2", side, "log", [{ w: 15, r: 12, d: true }]);
    E.slots.d3 = { 0: { log: [{ w: 90, r: 15, d: true }] } };
    E.markDone("d1");
    E.markDone("d2");
    E.markDone("d3");
    E.newWeek(start + 7 * 864e5);
    const week = E.wk.weeks.at(-1);
    expect(week.lifts).toBe(3);
    expect(week.sets).toBe(3);
    expect(week.prs).toEqual([expect.objectContaining({ n: "Hip Thrust (Barbell)", kind: "top", w: 140, r: 10, wasW: 135, wasR: 8 })]);
    expect(week.prs.some(pr => pr.n === "Hack Squat")).toBe(false);
    expect(E.e1rm(90, 15)).toBeGreaterThan(E.e1rm(100, 10));
    const thrust = week.ups.find(row => row.n === "Hip Thrust (Barbell)");
    expect(thrust.toW).toBeGreaterThan(thrust.fromW);
    expect(week.muscles.some(row => row.name === "Delts")).toBe(true);
    expect(week.muscles.some(row => row.name === "Side delts")).toBe(false);
    expect(week.nextTitle).toBe("Lower (Hinge & Glute)");
    const report = E.pendingWeekReport();
    expect(report.completed).toBe(true);
    expect(report.streak).toBe(1);
    expect(report.activities).toEqual([{ k: "pickle", n: 1, min: 40 }]);
    expect(report.sport).toBe(40);
    expect(E.dismissWeekReport()).toBe(true);
    expect(E.pendingWeekReport()).toBe(null);
  });

  it("leaves muscle bars out of a week closed before they were saved", () => {
    fresh();
    E.wk.weeks = [{ start: 5, lifts: 1, planned: 2 }];
    E.wk.reportPending = 5;
    const report = E.pendingWeekReport();
    expect(report.muscles).toBe(null);
    expect(report.sets).toBe(null);
    expect(report.prs).toEqual([]);
    expect(report.completed).toBe(false);
  });
});

describe("logged activity effort", () => {
  it("scales calorie rate for a session, and leaves class efforts alone", () => {
    fresh({ weight: "138", acts: { lift: true, pickle: true, yoga: true, spin: true } });
    const base = E.sessionKcal({ k: "pickle", min: 90 });
    expect(E.sessionKcal({ k: "pickle", min: 90, eff: "Easy" })).toBeCloseTo(base * 0.85, 5);
    expect(E.sessionKcal({ k: "pickle", min: 90, eff: "Hard" })).toBeCloseTo(base * 1.15, 5);
    expect(E.sessionKcal({ k: "pickle", min: 90, eff: "Moderate" })).toBeCloseTo(base, 5);
    expect(E.sessionKcal({ k: "yoga", min: 60, eff: "Hard" })).toBe(E.sessionKcal({ k: "yoga", min: 60 }));
    expect(E.sessionKcal({ k: "spin", min: 45, eff: "Easy" })).toBe(E.sessionKcal({ k: "spin", min: 45 }));
  });

  it("scales this week's sport calories from the logged session", () => {
    fresh({ weight: 150, acts: { lift: true, pickle: true }, pickle: "1" });
    E.wk.weekStart = 0;
    E.logAct("pAct", 0, "75", 1_700_000_000_000);
    const mid = E.plan().math.otherK;
    E.wk.sessions = E.wk.sessions.map(session => ({ ...session, eff: "Hard" }));
    const hard = E.plan().math.otherK;
    E.wk.sessions = E.wk.sessions.map(session => ({ ...session, eff: "Easy" }));
    const easy = E.plan().math.otherK;
    expect(hard).toBeCloseTo(mid * 1.15, 5);
    expect(easy).toBeCloseTo(mid * 0.85, 5);
  });

  it("counts a logged zone 2 session in the week's burn", () => {
    fresh({ weight: "138" });
    const start = Date.UTC(2026, 10, 2, 5);
    const session = { t: start + 864e5, k: "zone2", min: 45 };
    E.wk.sessions = [session];
    const raw = E.sessionKcal(session);
    expect(raw).toBeGreaterThan(0);
    expect(E.weekActuals(start).burn).toBe(Math.round(raw / 5) * 5);
    expect(E.sessionKcal({ ...session, eff: "Easy" })).toBeCloseTo(raw * 0.85, 5);
    expect(E.sessionKcal({ ...session, eff: "Hard" })).toBeCloseTo(raw * 1.15, 5);
  });

  it("a hard activity this week adds 1 to recovery load", () => {
    const calm = fresh({ acts: { lift: true, pickle: true }, pickle: "1" }).score;
    fresh({ acts: { lift: true, pickle: true }, pickle: "1" });
    const start = E.weekStartOf(Date.now()).getTime();
    E.wk.sessions = [{ t: start + 3600000, k: "pickle", min: 60, eff: "Hard" }];
    const hard = E.plan();
    expect(hard.score).toBe(calm + 1);
    expect(hard.factors).toContain("hard activity");
    E.wk.sessions = [{ t: start + 3600000, k: "yoga", min: 60, eff: "Hard" }];
    expect(E.plan().score).toBe(calm);
    E.wk.sessions = [{ t: start - 8 * 864e5, k: "pickle", min: 60, eff: "Hard" }];
    expect(E.plan().score).toBe(calm);
  });
});

describe("workout titles", () => {
  it("uses parentheses on upper and lower days, and leaves the others", () => {
    fresh();
    const titles = Object.fromEntries(E.ALL.map(day => [day.id, day.title]));
    expect(titles.d1).toBe("Lower (Hinge & Glute)");
    expect(titles.d2).toBe("Upper (Press)");
    expect(titles.d3).toBe("Lower (Quad & Glute)");
    expect(titles.x).toBe("Upper (Pull)");
    expect(titles.g2).toBe("Lower (Glute & Hamstring)");
    expect(titles.u3).toBe("Upper (Delts & Arms)");
    expect(titles.fa).toBe("Full Body A");
    expect(titles.lf).toBe("Lower");
  });
  it("rewrites saved middle-dot titles once, and leaves the rest", () => {
    expect(E.wTitle("Upper · Pull")).toBe("Upper (Pull)");
    expect(E.wTitle("Lower")).toBe("Lower");
    expect(E.wTitle("Full Body B")).toBe("Full Body B");
    E.init(mem({ "liftboard.week.v2": JSON.stringify({
      setupDone: true, mig1: 1, mig2: 1, mig4: 1, mig5: 1, mig6: 1,
      sessions: [
        { t: 1, k: "lift", title: "Lower · Hinge & Glute" },
        { t: 2, k: "lift", title: "Full Body A" },
        { t: 3, k: "run", title: "Run" },
      ],
      weeks: [{ start: 1, miss: ["Upper · Press", "Lower"], missed: ["Upper · Delts & Arms"], nextTitle: "Lower · Quad & Glute" }],
    }) }));
    expect(E.wk.sessions.map(session => session.title)).toEqual(["Lower (Hinge & Glute)", "Full Body A", "Run"]);
    expect(E.wk.weeks[0].miss).toEqual(["Upper (Press)", "Lower"]);
    expect(E.wk.weeks[0].missed).toEqual(["Upper (Delts & Arms)"]);
    expect(E.wk.weeks[0].nextTitle).toBe("Lower (Quad & Glute)");
  });
});

describe("changes and watch as headlines", () => {
  it("summarises a cause's set changes", () => {
    const C = E.changeItems({ "lower body focus": ["lower accessories +1 set", "unilateral +1 set", "side delts −1 set", "rear delts −1 set"] });
    expect(C[0]).toMatchObject({ cause: "Lower body focus", summary: "2 sets added and 2 sets cut" });
    expect(C[0].items).toHaveLength(4);
  });
  it("keeps a single non-set change as its own summary", () => {
    expect(E.changeItems({ "pre-season ramp": ["one 45-min zone 2 session"] })[0].summary).toBe("One 45-min zone 2 session");
  });
  it("merges notes that share a headline and drops removed ones", () => {
    const W = E.watchItems(["On a cut, preserving strength is the goal.", "At this pace, expect to hold muscle and strength rather than build.", "12 sessions this week. Stack activities.", "A 600 kcal/day food deficit is steep."]);
    expect(W.map((x) => x.h)).toEqual(["Need more fuel", "Strength first"]);
    expect(W[1].t).toBe("At this pace, expect to hold muscle and strength rather than build.");
  });
  it("puts safety notes first", () => {
    const W = E.watchItems(["Protein 110–140 g daily.", "Eating ~1300 kcal/day is too low. Slow the rate."]);
    expect(W[0]).toMatchObject({ h: "Need more fuel", safe: true });
    expect(W[1]).toMatchObject({ h: "Protein", t: "110–140 g daily." });
  });
  it("asks to keep intense activity easy during a ramp", () => {
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", season: "Off-season", ramp: "Yes", pickle: "1" });
    const start = E.weekStartOf(Date.now()).getTime();
    E.wk.sessions = [{ t: start + 3600000, k: "pickle", min: 60, eff: "Hard" }];
    expect(E.plan().notes.some((note) => note === "Keep intense activity easy during ramp-up.")).toBe(true);
  });
});

describe("section 20 logic", () => {
  it("a finisher and an optional row are not done when only the required lifts are logged", () => {
    const P0 = fresh({ focus: "Lower", mode: "Build", time: 45 });
    const d = E.DAYS[0];
    d.slots.forEach((s, i) => {
      const A = P0.days[d.id].slots[i];
      if (s.cardio || !A || A.skip) return;
      E.set(d.id, i, "log", Array.from({ length: A.sets }, () => ({ w: 100, r: 8, d: true })));
    });
    const P = E.plan();
    const fin = d.slots.findIndex((s) => s.cardio);
    expect(fin).toBeGreaterThan(-1);
    expect(E.rowDone(d.id, fin, P)).toBe(false);
    const opt = d.slots.findIndex((s, i) => !s.cardio && P.days[d.id].slots[i].skip && P.days[d.id].slots[i].skip !== "hidden");
    expect(opt).toBeGreaterThan(-1);
    expect(E.rowDone(d.id, opt, P)).toBe(false);
    expect(E.countsInDay(d.id, opt, P)).toBe(false);
    expect(E.dayComplete(d.id)).toBe(false);
  });
  it("Rough keeps an accessory and the sets already logged", () => {
    fresh({ focus: "Lower", time: 60 });
    const d = E.DAYS[0];
    const i = d.slots.findIndex((s) => s.trim && !s.cardio && !s.main);
    expect(i).toBeGreaterThan(-1);
    E.set(d.id, i, "log", [{ w: 40, r: 15, d: true }, { w: 40, r: 15, d: true }, { w: 40, r: 15, d: true }]);
    E.wk.today = { d1: "Rough" };
    E.wk.wt = { d1: { start: Date.now() } };
    const A = E.plan().days.d1.slots[i];
    expect(A.skip || "").toBe("");
    expect(A.sets).toBeGreaterThanOrEqual(3);
    expect((E.get("d1", i).log || []).filter((row) => row.d)).toHaveLength(3);
  });
  it("Keep holds the weight you were using and does not ask again", () => {
    fresh({ focus: "Lower", mode: "Maintain" });
    const d = E.DAYS[0];
    const slot = d.slots[1];
    const name = E.exName(d, slot, 1);
    E.exHist[name] = [{ w: 100, r: 5 }, { w: 100, r: 5 }];
    E.set(d.id, 1, "log", [{ w: "100", r: "5", d: true }]);
    const dropped = E.suggest(d, slot, 1, true, E.plan());
    expect(dropped.w).toBeLessThan(100);
    E.keepWeight(d.id, 1, 100);
    expect(E.suggest(d, slot, 1, true, E.plan()).w).toBe(100);
    expect(E.offerNudge(d.id, 1)).toBeNull();
  });
  it("supersets and lower-body focus leave the changes list after the week rolls", () => {
    fresh({ focus: "Lower", ss: "No", time: 60 });
    const first = E.changeItems(E.plan().G, E.wk.lastChanges || null);
    expect(first.some((row) => /superset/i.test(row.cause))).toBe(true);
    expect(first.some((row) => /lower body focus/i.test(row.cause))).toBe(true);
    E.newWeek();
    const next = E.changeItems(E.plan().G, E.wk.lastChanges || null);
    expect(next.some((row) => /superset/i.test(row.cause))).toBe(false);
    expect(next.some((row) => /lower body focus/i.test(row.cause))).toBe(false);
  });
});

describe("time moved", () => {
  const D = 864e5;
  it("adds lift and activity minutes, using session length for untimed lifts", () => {
    fresh({ time: 60 });
    E.wk.sessions = [{ t: D, k: "lift", id: "d1", min: 75 }, { t: 2 * D, k: "lift", id: "d2" }, { t: 3 * D, k: "pickle", min: 90 }, { t: 4 * D, k: "pickle", min: 75 }, { t: 5 * D, k: "pilates", min: 50 }];
    expect(E.hoursMoved()).toBe(6); // 75+60+90+75+50 = 350 min
    const top = E.mostPlayed(0);
    expect(top).toMatchObject({ k: "pickle", n: 2, hours: 3 }); // 165 min
  });
});

describe("weekly activity counts", () => {
  it("a sport's weekly count defaults to 0, not 3", () => {
    expect(E.DEF.pickle).toBe("0");
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle" });
    expect(E.cnt("pickle")).toBe(0);
  });
  it("a sport that is turned off counts 0 even with a saved count", () => {
    fresh({ acts: { lift: true, pickle: false }, pickle: "3" });
    expect(E.cnt("pickle")).toBe(0);
  });
  it("the plan counts each planned session of a sport that is on", () => {
    const on = fresh({ days: 3, acts: { lift: true, pickle: true }, mainSport: "pickle", pickle: "3" });
    expect(on.sessions).toBe(6);
    const off = fresh({ days: 3, acts: { lift: true, pickle: false }, pickle: "3" });
    expect(off.sessions).toBe(3);
  });
  it("a new week keeps the weekly count and clears the logged sessions", () => {
    fresh({ acts: { lift: true, pickle: true }, mainSport: "pickle", pickle: "3", pAct: ["75", "75", "75"] });
    E.newWeek();
    expect(E.cnt("pickle")).toBe(3);
    expect(E.wk.pAct).toEqual([]);
  });
});

describe("usual activity days are the saved plan", () => {
  const two = { days: 3, ldays: [0, 2, 4], acts: { lift: true, pickle: true, yoga: true }, mainSport: "pickle", pickle: "3", yoga: "1", adays: [1, 3, 5, 6] };
  it("carry over to a new week as they are, with the weekly counts", () => {
    fresh(two);
    E.newWeek();
    expect(E.wk.adays).toEqual([1, 3, 5, 6]);
    expect([E.cnt("pickle"), E.cnt("yoga")]).toEqual([3, 1]);
  });
  it("unchecking a day saves it and drops a session from the activity planned most often", () => {
    fresh(two);
    E.setActivityDay(6, false);
    expect(E.wk.adays).toEqual([1, 3, 5]);
    expect([E.cnt("pickle"), E.cnt("yoga")]).toEqual([2, 1]);
    E.newWeek();
    expect(E.wk.adays).toEqual([1, 3, 5]);
    expect(E.cnt("pickle")).toBe(2);
  });
  it("on a tie the main sport keeps its sessions", () => {
    fresh({ ...two, pickle: "2", yoga: "2" });
    E.setActivityDay(1, false);
    expect([E.cnt("pickle"), E.cnt("yoga")]).toEqual([2, 1]);
  });
  it("checking a day adds a session to the main sport", () => {
    fresh({ ...two, adays: [1, 3, 5] , pickle: "2" });
    E.setActivityDay(6, true);
    expect(E.wk.adays).toEqual([1, 3, 5, 6]);
    expect(E.cnt("pickle")).toBe(3);
  });
  it("logging past the plan counts toward the week but doesn't change the saved count", () => {
    const P = fresh({ ...two, pAct: ["75", "75", "75", "75"] });
    expect(E.cnt("pickle")).toBe(3);
    expect(E.sessN("pickle")).toBe(4);
    expect(P.sessions).toBe(3 + 4 + 1);
  });
  it("onboarding counts become that many activity days, on days without a lift first", () => {
    fresh({ ...two, adays: [] });
    E.fitActivityDays();
    expect(E.wk.adays).toEqual([1, 3, 5, 6]);
    E.wk.pickle = "1";
    E.fitActivityDays();
    expect(E.wk.adays).toEqual([1, 3]);
  });
});

describe("extra activity sessions", () => {
  const base = { days: 3, acts: { lift: true, pickle: true }, pickle: "1", adays: [1] };
  it("an extra session on a past, unplanned day is saved on that date, shows in the week and leaves the count alone", () => {
    fresh(base);
    const M = E.weekModel(0);
    const t = M.dates[0] + 12 * 3600e3;
    E.logAct("pAct", 0, "75", Date.now());
    E.logAct("pAct", 1, "60", t);
    expect(E.cnt("pickle")).toBe(1);
    expect(E.wk.adays).toEqual([1]);
    const saved = E.wk.sessions.find(s => s.t === t);
    expect(saved).toMatchObject({ k: "pickle", min: 60 });
    expect(E.weekModel(0).byDay[0].some(s => s.k === "pickle" && s.t === t)).toBe(true);
    expect(E.sessN("pickle")).toBe(2);
  });
  it("counts toward the week's fuel", () => {
    const one = fresh({ ...base, pAct: ["75"] }).math.intake;
    const two = fresh({ ...base, pAct: ["75", "75"] }).math.intake;
    expect(two).toBeGreaterThan(one);
  });
  it("a deleted extra session counts nothing", () => {
    const kept = fresh({ ...base, pAct: ["75", "75"] }).math.intake;
    const gap = fresh({ ...base, pAct: ["75", "", "75"] }).math.intake;
    expect(gap).toBe(kept);
  });
  it("still counts after the activity is turned off", () => {
    const on = fresh({ days: 3, acts: { lift: true, pickle: true }, pickle: "0", pAct: ["75"] }).math.intake;
    const off = fresh({ days: 3, acts: { lift: true, pickle: false }, pickle: "0", pAct: ["75"] }).math.intake;
    const none = fresh({ days: 3, acts: { lift: true, pickle: false }, pickle: "0" }).math.intake;
    expect(off).toBe(on);
    expect(off).toBeGreaterThan(none);
  });
});

describe("activity order and the suggestion (planned activities only)", () => {
  const acts = { lift: true, pickle: true, tennis: true, yoga: true, spin: true };
  const counts = { pickle: "1", tennis: "1", yoga: "1", spin: "1" };
  it("main sport, then the second sport, then the rest in the fixed order for activities from before the order was saved", () => {
    fresh({ acts, ...counts, mainSport: "tennis", sport2: "pickle" });
    expect(E.plannedActs()).toEqual(["tennis", "pickle", "yoga", "spin"]);
    expect(E.suggestedAct()).toBe("tennis");
  });
  it("activities turned on in Settings follow in the order they were added, after older ones", () => {
    fresh({ acts: { lift: true, yoga: true }, yoga: "1", spin: "1", climb: "1" });
    E.wk.acts = { ...E.wk.acts, spin: true }; E.noteAct("spin", true);
    E.wk.acts = { ...E.wk.acts, climb: true }; E.noteAct("climb", true);
    expect(E.plannedActs()).toEqual(["yoga", "spin", "climb"]);
    E.noteAct("spin", false); E.noteAct("spin", true);
    expect(E.plannedActs()).toEqual(["yoga", "climb", "spin"]);
    expect(E.suggestedAct()).toBe("yoga");
  });
  it("an activity with 0 sessions is not planned and is never the suggestion", () => {
    fresh({ acts, mainSport: "pickle", pickle: "0", tennis: "0", yoga: "2", spin: "0" });
    expect(E.plannedActs()).toEqual(["yoga"]);
    expect(E.suggestedAct()).toBe("yoga");
    fresh({ acts: { lift: true, yoga: true }, yoga: "0" });
    expect(E.plannedActs()).toEqual([]);
    expect(E.suggestedAct()).toBe("");
  });
  it("one-offs and activities that are off are not planned", () => {
    fresh({ acts: { lift: true, run: true, yoga: true, pickle: false }, run: "1", yoga: "1", pickle: "2", adhoc: { run: true } });
    expect(E.plannedActs()).toEqual(["yoga"]);
  });
  it("checking an activity day with nothing planned gives the main sport a session", () => {
    fresh({ acts, mainSport: "pickle", pickle: "0", tennis: "0", yoga: "0", spin: "0", adays: [] });
    E.setActivityDay(2, true);
    expect(E.wk.pickle).toBe("1");
    expect(E.plannedActs()).toEqual(["pickle"]);
  });
  it("in season the season sports lead, main first, even if the second was added earlier", () => {
    fresh({ acts, ...counts, mainSport: "pickle", sport2: "tennis", season: "In-season", days: 2, actOrder: ["tennis", "spin", "pickle"] });
    expect(E.inSeason()).toBe(true);
    expect(E.plannedActs().slice(0, 2)).toEqual(["pickle", "tennis"]);
    expect(E.suggestedAct()).toBe("pickle");
  });
  it("a deload week keeps the same order", () => {
    const setup = { acts, ...counts, mainSport: "pickle", sport2: "tennis", actOrder: ["spin"] };
    fresh(setup);
    const normal = E.plannedActs();
    fresh({ ...setup, deload: "Yes" });
    expect(E.plannedActs()).toEqual(normal);
    expect(E.suggestedAct()).toBe("pickle");
  });
});

describe("turning an activity off trims its activity days", () => {
  it("keeps no more days than planned sessions, dropping from the end of the week", () => {
    fresh({ acts: { lift: true, pickle: true, yoga: true }, mainSport: "pickle", pickle: "2", yoga: "1", adays: [0, 2, 4] });
    E.wk.acts = { ...E.wk.acts, yoga: false }; E.wk.yoga = "0";
    E.trimActivityDays();
    expect(E.wk.adays).toEqual([0, 2]);
    E.wk.acts = { ...E.wk.acts, pickle: false }; E.wk.pickle = "0";
    E.trimActivityDays();
    expect(E.wk.adays).toEqual([]);
  });
});

describe("adding a session to the week", () => {
  it("raises the saved count and adds a day without a lift first", () => {
    fresh({ acts: { lift: true, yoga: true }, yoga: "0", days: 3, ldays: [0, 2, 4], adays: [] });
    E.addWeekly("yoga");
    expect(E.wk.yoga).toBe("1");
    expect(E.wk.adays).toEqual([1]);
    expect(E.plannedActs()).toEqual(["yoga"]);
  });
  it("turns a one-off into a planned activity", () => {
    fresh({ acts: { lift: true, run: true }, run: 0, adhoc: { run: true }, adays: [] });
    E.addWeekly("run");
    expect(E.wk.adhoc.run).toBeUndefined();
    expect(E.plannedActs()).toEqual(["run"]);
    expect(E.wk.actOrder).toContain("run");
  });
  it("asks once per activity per week", () => {
    fresh({ acts: { lift: true, yoga: true }, weekStart: 1000 });
    expect(E.askedWeekly("yoga")).toBe(false);
    E.markAskedWeekly("yoga");
    expect(E.askedWeekly("yoga")).toBe(true);
    expect(E.askedWeekly("spin")).toBe(false);
    E.wk.weekStart = 2000;
    expect(E.askedWeekly("yoga")).toBe(false);
  });
});

describe("plan() is a read: it never saves", () => {
  it("takes the started-day lock in memory without saving, so a render can't update the store", () => {
    fresh();
    const id = E.DAYS[0].id;
    let saves = 0;
    E.setSaveHook(() => { saves++; });
    E.wk.wt = { [id]: { start: Date.now() } };
    const first = E.plan();
    expect(saves).toBe(0);
    expect(E.wk.lockSets[id]).toEqual(first.days[id].slots.map(A => A && A.sets != null ? A.sets : null));
    E.wk.today = { [id]: "Rough" };
    E.plan();
    expect(saves).toBe(0);
    expect(E.wk.lockFeel[id]).toBe("Rough");
    E.setSaveHook(() => {});
  });

  it("keeps the started counts once the caller saves the lock", () => {
    fresh();
    const id = E.DAYS[0].id;
    E.wk.wt = { [id]: { start: Date.now() } };
    const sets = E.plan().days[id].slots.map(A => A && A.sets);
    E.save();
    expect(E.plan().days[id].slots.map(A => A && A.sets)).toEqual(sets);
  });
});

describe("deleting a set in this workout (st.drop)", () => {
  const firstLift = () => { const d = E.DAYS.find(day => day.slots.some(s => !s.cardio)); return { id: d.id, i: d.slots.findIndex(s => !s.cardio) }; };

  it("lowers that day's set count only, and the plan can't refill it", () => {
    fresh();
    const { id, i } = firstLift();
    const before = E.plan().days[id].slots[i].sets;
    const others = E.DAYS.filter(d => d.id !== id).map(d => E.plan().days[d.id].slots.map(A => A && A.sets));
    E.set(id, i, "drop", 1);
    expect(E.plan().days[id].slots[i].sets).toBe(before - 1);
    expect(E.DAYS.filter(d => d.id !== id).map(d => E.plan().days[d.id].slots.map(A => A && A.sets))).toEqual(others);
    E.set(id, i, "drop", 0);
    expect(E.plan().days[id].slots[i].sets).toBe(before);
  });

  it("never drops below the sets already ticked, and holds through the started-day lock", () => {
    fresh();
    const { id, i } = firstLift();
    const before = E.plan().days[id].slots[i].sets;
    E.wk.wt = { [id]: { start: Date.now() } };
    E.plan();
    E.set(id, i, "log", Array.from({ length: before - 1 }, () => ({ d: true, w: "100", r: "8" })));
    E.set(id, i, "drop", before);
    expect(E.plan().days[id].slots[i].sets).toBe(before - 1);
  });

  it("clears with the logs when a finished day rolls into a new week", () => {
    fresh();
    const { id, i } = firstLift();
    const before = E.plan().days[id].slots[i].sets;
    E.set(id, i, "drop", 1);
    E.wk.done = { [id]: true };
    E.newWeek(Date.now());
    expect(E.get(id, i).drop).toBeUndefined();
    expect(E.plan().days[id].slots[i].sets).toBe(before);
  });
});

describe("upper and lower strength trend (C2)", () => {
  const DAY = 864e5;
  const wed = (() => { const d = new Date(2026, 8, 1, 12); while (d.getDay() !== 3) d.setDate(d.getDate() + 1); return d.getTime(); })();
  const at = i => wed + i * 7 * DAY;
  const tops = (rows) => rows.map(([i, w, r = 6]) => ({ t: at(i), w, r }));
  const seed = (hist, week = {}) => E.init(mem({
    "liftboard.week.v2": JSON.stringify({ setupDone: true, mig1: 1, mig2: 1, mig3: 1, mig4: 1, mig5: 1, mig6: 1, wkStart: "Mon", mode: "Maintain", ...week }),
    "liftboard.hist.v1": JSON.stringify(hist),
  }));
  const flat = (name, weeks, w) => tops(Array.from({ length: weeks }, (_, i) => [i, w]));

  it("shows nothing before a half has 3 weeks of data", () => {
    seed({ "Bench Press": tops([[0, 100], [0, 100], [1, 100]]) });
    expect(E.strengthTrend()).toEqual({ upper: null, lower: null });
  });
  it("is Up past +2% of each exercise's first-3-session baseline, smoothed over 3 weeks", () => {
    seed({ "Bench Press": tops([[0, 100], [1, 100], [2, 100], [3, 110], [4, 110], [5, 110]]) });
    const { upper, lower } = E.strengthTrend();
    expect(lower).toBe(null);
    expect(upper.label).toBe("up");
    expect(upper.pct).toBeCloseTo(0.1, 5);
    expect(upper.weeks).toBe(6);
    expect(upper.rel).toBe(null);
  });
  it("gives a weekly spark that rises with the lifts and ends at the percent", () => {
    seed({ "Bench Press": tops([[0, 100], [1, 100], [2, 100], [3, 110], [4, 110], [5, 110]]) });
    const { spark, pct } = E.strengthTrend().upper;
    expect(spark).toHaveLength(6);
    spark.slice(0, 3).forEach(v => expect(v).toBeCloseTo(0, 5));
    expect(spark[3]).toBeCloseTo(0.1 / 3, 5);
    expect(spark[5]).toBeCloseTo(pct, 10);
    seed({ "Bench Press": tops(Array.from({ length: 20 }, (_, i) => [i, 100 + i])) });
    expect(E.strengthTrend().upper.spark).toHaveLength(12);
  });
  it("only says Down after two smoothed weeks in a row below the band", () => {
    const hist = { "Back Squat (Barbell)": tops([[0, 100], [1, 100], [2, 100], [3, 95], [4, 95]]) };
    seed(hist);
    expect(E.strengthTrend().lower.label).toBe("holding");
    hist["Back Squat (Barbell)"].push(...tops([[5, 95]]));
    seed(hist);
    expect(E.strengthTrend().lower.label).toBe("down");
    expect(E.strengthTrend().lower.good).toBe(false);
  });
  it("takes the best session in a week and weights exercises by that week's sets", () => {
    const sessions = [{ t: at(3), k: "lift", ex: [{ n: "Back Squat (Barbell)", sets: 5, w: 110, r: 6 }, { n: "Hip Thrust (Barbell)", sets: 1, w: 90, r: 6 }] }];
    seed({
      "Back Squat (Barbell)": tops([[0, 100], [1, 100], [2, 100], [3, 90], [3, 110]]),
      "Hip Thrust (Barbell)": tops([[0, 100], [1, 100], [2, 100], [3, 90]]),
    }, { sessions });
    const lower = E.strengthTrend().lower;
    expect(lower.pct).toBeCloseTo((0 + 0 + (0.1 * 5 - 0.1 * 1) / 6) / 3, 5);
  });
  it("leaves out core, carries and bodyweight work", () => {
    seed({ "Plank": flat("Plank", 4, 20), "Farmer Carry": flat("Farmer Carry", 4, 50), "Pull-Up": flat("Pull-Up", 4, 0) });
    expect(E.strengthTrend()).toEqual({ upper: null, lower: null });
  });
  it("Holding counts as good on a cut", () => {
    seed({ "Bench Press": flat("Bench Press", 4, 100) }, { mode: "Deficit only" });
    expect(E.strengthTrend().upper).toMatchObject({ label: "holding", good: true });
    seed({ "Bench Press": flat("Bench Press", 4, 100) });
    expect(E.strengthTrend().upper).toMatchObject({ label: "holding", good: false });
  });
  it("compares against bodyweight when a weigh-in near the start exists", () => {
    const weeks = [{ start: at(0) - 2 * DAY, w: 160 }, { start: at(4) - 2 * DAY, w: 152 }];
    seed({ "Bench Press": tops([[0, 100], [1, 100], [2, 100], [3, 110], [4, 110], [5, 110]]) }, { weeks, weight: 150 });
    expect(E.strengthTrend().upper.rel).toBeCloseTo(1.1 * 160 / 150 - 1, 5);
  });
});
