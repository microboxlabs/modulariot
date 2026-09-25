"use client";

import { createContext, useContext, type FC, type ReactNode } from "react";

/**
 * True for a thread someone else owns and shared. The transcript is readable,
 * but nothing that would run or rewrite it is: storage refuses a reader's
 * writes, so a run started here would answer into a thread that forgets it on
 * the next reload — and it would be the reader's turn appended to someone
 * else's conversation.
 */
const ReadOnlyContext = createContext(false);

export const HarnessReadOnlyProvider: FC<{ readOnly: boolean; children: ReactNode }> = ({
  readOnly,
  children,
}) => <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;

export const useHarnessReadOnly = (): boolean => useContext(ReadOnlyContext);
