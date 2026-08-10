"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface HarnessChatContextProps {
  isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

const HarnessChatContext = createContext<HarnessChatContextProps | null>(
  null
);

export function HarnessChatProvider({ children }: Readonly<PropsWithChildren>) {
  const [isOpen, setIsOpen] = useState(true);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((s) => !s), []);

  const value = useMemo<HarnessChatContextProps>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <HarnessChatContext.Provider value={value}>
      {children}
    </HarnessChatContext.Provider>
  );
}

export function useHarnessChatContext(): HarnessChatContextProps {
  const context = useContext(HarnessChatContext);

  if (!context) {
    throw new Error(
      "useHarnessChatContext must be used within the HarnessChatContext provider!"
    );
  }

  return context;
}
