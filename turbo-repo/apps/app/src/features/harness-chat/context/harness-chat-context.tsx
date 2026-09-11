"use client";

import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/** A prior question + answer (e.g. from the spotlight search) handed off to
 * the chat panel so the conversation can continue from where it left off. */
export interface PendingHarnessConversation {
  userText: string;
  answerText: string;
  /** The harness's conversation id for that answer, when known — lets the
   * next chat message continue the same harness-side conversation instead
   * of starting a fresh one. */
  conversationId?: string;
}

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
  /** Opens the panel and starts a new chat pre-seeded with a prior question +
   * answer, so the user can pick the conversation back up instead of asking
   * the same thing again. Nothing is auto-sent — the user keeps typing from there. */
  openWithConversation(conversation: PendingHarnessConversation): void;
  /** Set once by `openWithConversation`; consumed (and cleared) by HarnessChat. */
  pendingConversation: PendingHarnessConversation | null;
  clearPendingConversation(): void;
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
  const [pendingConversation, setPendingConversation] =
    useState<PendingHarnessConversation | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((s) => !s), []);
  const openWithMessage = useCallback((text: string) => {
    setIsOpen(true);
    setPendingMessage(text);
  }, []);
  const clearPendingMessage = useCallback(() => setPendingMessage(null), []);
  const openWithConversation = useCallback((conversation: PendingHarnessConversation) => {
    setIsOpen(true);
    setPendingConversation(conversation);
  }, []);
  const clearPendingConversation = useCallback(() => setPendingConversation(null), []);
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
      openWithConversation,
      pendingConversation,
      clearPendingConversation,
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
      openWithConversation,
      pendingConversation,
      clearPendingConversation,
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
