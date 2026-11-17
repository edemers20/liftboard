import * as engine from "@liftboard/engine";
import { create } from "zustand";

import { storage } from "./storage";

type EngineModule = typeof engine;

type EngineState = {
  /** Bumps after the engine saves, so screens re-render and read the module again. */
  version: number;
  /** Run an engine function. A save inside it bumps version. */
  call: <Result>(fn: (api: EngineModule) => Result) => Result;
};

/**
 * Runs once. Up to two sports can be on, the same as the Sports in season picker. Any other sport is
 * turned off with its weekly count cleared, unless it has sessions logged this week.
 */
function capSports() {
  const wk = engine.wk;
  if (wk.twoSports) return;
  const keep = [wk.mainSport, wk.sport2];
  const logged = (id: string) =>
    ((wk[engine.actKey(id)] || []) as unknown[]).some((value) => String(value ?? "").trim() !== "");
  const on = (engine.SPORTS as string[]).filter((id) => engine.enabled(id));
  if (on.length > 2) {
    const acts = { ...(wk.acts || {}) };
    on.filter((id) => !keep.includes(id) && !logged(id)).forEach((id) => {
      acts[id] = false;
      wk[id] = "0";
    });
    wk.acts = acts;
    engine.fixSports(wk);
    engine.syncDays();
  }
  wk.twoSports = 1;
  engine.save();
}

export const useEngineStore = create<EngineState>((set) => {
  // Before the save hook: the store has no state until this function returns.
  engine.init(storage);
  capSports();
  engine.setSaveHook(() => {
    set((state) => ({ version: state.version + 1 }));
  });

  return {
    version: 0,
    call: (fn) => fn(engine),
  };
});

export { engine };
