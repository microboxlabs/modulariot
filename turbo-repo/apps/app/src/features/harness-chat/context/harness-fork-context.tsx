"use client";

import { createContext, useContext, type FC, type ReactNode } from "react";

/** Forks the current thread: every message, or `atMessageId` and the messages
 * above it. Null where forking is not offered. */
type Fork = ((atMessageId?: string) => void) | null;

const ForkContext = createContext<Fork>(null);

export const HarnessForkProvider: FC<{ onFork: Fork; children: ReactNode }> = ({
  onFork,
  children,
}) => <ForkContext.Provider value={onFork}>{children}</ForkContext.Provider>;

export const useHarnessFork = (): Fork => useContext(ForkContext);
