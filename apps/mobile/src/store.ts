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

export const useEngineStore = create<EngineState>((set) => {
  engine.setSaveHook(() => {
    set((state) => ({ version: state.version + 1 }));
  });
  engine.init(storage);

  return {
    version: 0,
    call: (fn) => fn(engine),
  };
});

export { engine };
