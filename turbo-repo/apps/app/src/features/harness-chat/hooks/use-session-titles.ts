"use client";

import {
  useCallback,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Session } from "../harness-chat-types";
import type { FirstExchange } from "../session-title";
import {
  autoTitleThread,
  createThread,
  renameThread,
  type ThreadKind,
} from "../harness-thread-store";

/**
 * Session titles and their storage: the first-message placeholder, the title
 * generated after the first answer, and renames. `kind` goes with the
 * placeholder's upsert, which is what creates a chat thread.
 */
export function useSessionTitles({
  sessionsRef,
  setSessions,
  kind,
}: {
  sessionsRef: RefObject<Session[]>;
  setSessions: Dispatch<SetStateAction<Session[]>>;
  kind?: ThreadKind;
}) {
  // Titles already written upstream. The watcher fires on every message
  // change; without this every one of them would be a PATCH.
  const persistedTitles = useRef(new Map<string, string>());
  // Sessions whose title is settled: loaded with one, generated, renamed or
  // forked. The first-message placeholder only fills an untitled session.
  const titledIds = useRef(new Set<string>());
  // Sessions a generated title was already asked for, so it is asked once.
  const autoTitled = useRef(new Set<string>());
  // The placeholder title's write, which a generated title must land after or
  // the late upsert would put the placeholder back.
  const placeholderWrites = useRef(new Map<string, Promise<unknown>>());

  const markTitled = useCallback((id: string) => {
    titledIds.current.add(id);
  }, []);

  const forget = useCallback((id: string) => {
    persistedTitles.current.delete(id);
    titledIds.current.delete(id);
  }, []);

  const setSessionTitle = useCallback(
    (id: string, title: string, titleEdited: boolean) => {
      titledIds.current.add(id);
      persistedTitles.current.set(id, title);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, title, titleEdited: s.titleEdited || titleEdited }
            : s
        )
      );
    },
    [setSessions]
  );

  const updateSessionTitle = useCallback(
    (id: string, title: string | null) => {
      if (!title || titledIds.current.has(id)) return;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx === -1 || prev[idx].title === title) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], title };
        return next;
      });
      // An upsert, so this doubles as "make sure the thread row exists" — the
      // title arrives with the first user message, which may still be racing
      // its own append.
      if (persistedTitles.current.get(id) !== title) {
        // Recorded up front so the watcher's next call does not re-send it,
        // and dropped again if the write failed — otherwise one lost request
        // leaves the thread permanently untitled while its messages save fine.
        persistedTitles.current.set(id, title);
        const write = createThread({
          id,
          title,
          ...(kind ? { kind } : {}),
        }).then((saved) => {
          if (!saved) persistedTitles.current.delete(id);
        });
        placeholderWrites.current.set(id, write);
      }
    },
    [setSessions, kind]
  );

  // After the first answer, a generated title replaces the first-message
  // placeholder — unless the person has named the thread, which the store
  // enforces too.
  const autoTitleSession = useCallback(
    (id: string, exchange: FirstExchange) => {
      const session = sessionsRef.current.find((s) => s.id === id);
      if (!session?.owned || session.titleEdited || autoTitled.current.has(id))
        return;
      autoTitled.current.add(id);
      const placeholder =
        placeholderWrites.current.get(id) ?? Promise.resolve();
      void placeholder
        .then(() => autoTitleThread(id, exchange))
        .then((saved) => {
          if (!saved?.title) return;
          // A rename made while this was in flight wins; the store kept it too.
          const current = sessionsRef.current.find((s) => s.id === id);
          if (current?.titleEdited && !saved.titleEdited) return;
          setSessionTitle(id, saved.title, saved.titleEdited ?? false);
        });
    },
    [sessionsRef, setSessionTitle]
  );

  const renameSession = useCallback(
    (id: string, title: string) => {
      const previous = sessionsRef.current.find((s) => s.id === id);
      setSessionTitle(id, title, true);
      void renameThread(id, title).then((ok) => {
        if (ok || !previous) return;
        // Undone in full: left behind, these would stop the first message
        // from titling a thread that was never stored.
        if (previous.title === null) {
          titledIds.current.delete(id);
          persistedTitles.current.delete(id);
        } else {
          persistedTitles.current.set(id, previous.title);
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  title: previous.title,
                  titleEdited: previous.titleEdited,
                }
              : s
          )
        );
      });
    },
    [sessionsRef, setSessionTitle, setSessions]
  );

  return {
    markTitled,
    forget,
    updateSessionTitle,
    autoTitleSession,
    renameSession,
  };
}
