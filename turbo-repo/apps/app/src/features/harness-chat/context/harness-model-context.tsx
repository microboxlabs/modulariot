"use client";

import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";

/** The conversation model picked for this session; null is the harness default. */
interface HarnessModelContextValue {
  model: string | null;
  onChange: (model: string | null) => void;
}

const HarnessModelContext = createContext<HarnessModelContextValue>({
  model: null,
  onChange: () => {},
});

export const HarnessModelProvider: FC<{
  model: string | null;
  onChange: (model: string | null) => void;
  children: ReactNode;
}> = ({ model, onChange, children }) => {
  const value = useMemo(() => ({ model, onChange }), [model, onChange]);
  return <HarnessModelContext.Provider value={value}>{children}</HarnessModelContext.Provider>;
};

export function useHarnessModel(): HarnessModelContextValue {
  return useContext(HarnessModelContext);
}
