"use client";

import { createContext, useContext, type FC, type ReactNode } from "react";
import { useAuiState } from "@assistant-ui/react";

/** The harness run behind a message of this session that has not been
 * reloaded yet, so its metadata does not carry the run id. */
export type HarnessRunLookup = (
  messageId: string,
  isLast: boolean
) => string | null;

const RunLookupContext = createContext<HarnessRunLookup>(() => null);

export const HarnessRunLookupProvider: FC<{
  lookup: HarnessRunLookup;
  children: ReactNode;
}> = ({ lookup, children }) => (
  <RunLookupContext.Provider value={lookup}>
    {children}
  </RunLookupContext.Provider>
);

/** The harness run id of the current assistant message, or null. */
export function useMessageRunId(): string | null {
  const lookup = useContext(RunLookupContext);
  const stored = useAuiState((s) => {
    const runId = s.message.metadata?.custom?.harnessRunId;
    return typeof runId === "string" ? runId : null;
  });
  const messageId = useAuiState((s) => s.message.id);
  const isLast = useAuiState((s) => s.message.isLast);
  return stored ?? lookup(messageId, isLast);
}
