import { render } from "ink";
import { createElement } from "react";
import type { ResolvedConfig } from "../config.js";
import { App } from "./App.js";
import type { HarnessClientLike } from "./useSession.js";

export interface RunTuiOptions {
  config: ResolvedConfig;
  client: HarnessClientLike;
}

export interface RunTuiHandle {
  waitUntilExit: () => Promise<void>;
  unmount: () => void;
}

export function runTui(opts: RunTuiOptions): RunTuiHandle {
  const instance = render(
    createElement(App, {
      config: opts.config,
      client: opts.client,
      onExit: () => instance.unmount(),
    }),
  );
  return {
    waitUntilExit: async (): Promise<void> => {
      await instance.waitUntilExit();
    },
    unmount: (): void => instance.unmount(),
  };
}
