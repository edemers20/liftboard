import { describe, it, expect, beforeEach } from "vitest";
import * as E from "../src/engine.js";

/* Ported from packages/engine/tests (Nov 16). The web keeps its week model in src/main.js, so the
   one check that read weekModel() reads the saved session instead. */

const mem = (seed = {}) => { const m = new Map(Object.entries(seed)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const fresh = (patch = {}) => { E.init(mem()); Object.assign(E.wk, { setupDone: true }, patch); E.syncDays(); return E.plan(); };

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
    const t = Date.now() - 26 * 3600e3;
    E.logAct("pAct", 0, "75", Date.now());
    E.logAct("pAct", 1, "60", t);
    expect(E.cnt("pickle")).toBe(1);
    expect(E.wk.adays).toEqual([1]);
    const saved = E.wk.sessions.find(s => s.t === t);
    expect(saved).toMatchObject({ k: "pickle", min: 60 });
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
