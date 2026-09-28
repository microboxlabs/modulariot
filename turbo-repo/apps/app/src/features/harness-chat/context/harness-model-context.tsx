"use client";

import type { RunEffort } from "@microboxlabs/miot-harness-client";
import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";

/** The conversation model and reasoning effort picked for this session; null
 * is the harness default for either. */
interface HarnessModelContextValue {
  model: string | null;
  onChange: (model: string | null) => void;
  effort: RunEffort | null;
  onEffortChange: (effort: RunEffort | null) => void;
}

const noop = () => {};

const HarnessModelContext = createContext<HarnessModelContextValue>({
  model: null,
  onChange: noop,
  effort: null,
  onEffortChange: noop,
});

export const HarnessModelProvider: FC<{
  model: string | null;
  onChange: (model: string | null) => void;
  effort?: RunEffort | null;
  onEffortChange?: (effort: RunEffort | null) => void;
  children: ReactNode;
}> = ({ model, onChange, effort = null, onEffortChange = noop, children }) => {
  const value = useMemo(
    () => ({ model, onChange, effort, onEffortChange }),
    [model, onChange, effort, onEffortChange]
  );
  return <HarnessModelContext.Provider value={value}>{children}</HarnessModelContext.Provider>;
};

export function useHarnessModel(): HarnessModelContextValue {
  return useContext(HarnessModelContext);
}
