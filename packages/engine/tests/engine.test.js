import { describe, it, expect, beforeEach } from "vitest";
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
    expect(E.DAYS[4].title).toBe("Lower · Glute & Hamstring");
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
    expect(E.restPlan(d.slots[0], "Hip Thrust (Barbell)", 1, d).why).toBe("+15s · cut");
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
    expect(week.miss).toEqual(["Upper · Press", "Lower · Quad & Glute"]);
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
    expect(week.nextTitle).toBe("Lower · Hinge & Glute");
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
