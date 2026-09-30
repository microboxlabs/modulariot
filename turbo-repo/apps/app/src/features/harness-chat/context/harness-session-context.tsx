"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type FC,
  type ReactNode,
} from "react";

/** The chat session a message belongs to, and when its current run started. */
export interface HarnessSession {
  threadId: string;
  /** Epoch ms the harness started the current run, once known. */
  runStartedAt: () => number | null;
  subscribeRunClock: (listener: () => void) => () => void;
}

const HarnessSessionContext = createContext<HarnessSession | null>(null);

export const HarnessSessionProvider: FC<{
  session: HarnessSession;
  children: ReactNode;
}> = ({ session, children }) => (
  <HarnessSessionContext.Provider value={session}>
    {children}
  </HarnessSessionContext.Provider>
);

export function useHarnessThreadId(): string | null {
  return useContext(HarnessSessionContext)?.threadId ?? null;
}

const noSubscription = () => () => {};

export function useRunStartedAt(): number | null {
  const session = useContext(HarnessSessionContext);
  return useSyncExternalStore(
    session?.subscribeRunClock ?? noSubscription,
    () => session?.runStartedAt() ?? null,
    () => null
  );
}
