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
  /** Opens the panel and starts a new chat, sending `text` as the first message. */
  openWithMessage(text: string): void;
  /** Set once by `openWithMessage`; consumed (and cleared) by HarnessChat. */
  pendingMessage: string | null;
  clearPendingMessage(): void;
  /**
   * Opens the panel and adds `label` as an attachment chip on the CURRENT
   * chat's composer — like attaching a file, not sending a message. The
   * user is left to write their own message around it (or remove it).
   */
  attachReference(label: string): void;
  /** Set once by `attachReference`; consumed (and cleared) by HarnessChat. */
  pendingAttachment: string | null;
  clearPendingAttachment(): void;
}

const HarnessChatContext = createContext<HarnessChatContextProps | null>(
  null
);

export function HarnessChatProvider({ children }: Readonly<PropsWithChildren>) {
  const [isOpen, setIsOpen] = useState(true);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((s) => !s), []);
  const openWithMessage = useCallback((text: string) => {
    setIsOpen(true);
    setPendingMessage(text);
  }, []);
  const clearPendingMessage = useCallback(() => setPendingMessage(null), []);
  const attachReference = useCallback((label: string) => {
    setIsOpen(true);
    setPendingAttachment(label);
  }, []);
  const clearPendingAttachment = useCallback(() => setPendingAttachment(null), []);

  const value = useMemo<HarnessChatContextProps>(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      openWithMessage,
      pendingMessage,
      clearPendingMessage,
      attachReference,
      pendingAttachment,
      clearPendingAttachment,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      openWithMessage,
      pendingMessage,
      clearPendingMessage,
      attachReference,
      pendingAttachment,
      clearPendingAttachment,
    ]
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
