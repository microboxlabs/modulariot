"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@/features/harness-chat/harness-chat-types";
import {
  mergeStoredThreads,
  toSession,
} from "@/features/harness-chat/harness-sessions";
import { readActiveRun } from "@/features/harness-chat/harness-active-run";
import { useSessionTitles } from "@/features/harness-chat/hooks/use-session-titles";
import {
  createThread,
  deleteThread,
  forkThread,
  listThreads,
  revokeShare,
  shareThread,
} from "@/features/harness-chat/harness-thread-store";

export type SessionsStatus = "loading" | "ready" | "failed";

/**
 * A trainer's learning sessions: learning threads only, each created as one
 * before its first message so the store never files it as a chat.
 */
export function useLearningSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mountedIds, setMountedIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<SessionsStatus>("loading");
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const titles = useSessionTitles({
    sessionsRef,
    setSessions,
    kind: "learning",
  });
  const { markTitled, forget } = titles;

  const select = useCallback((id: string) => {
    setActiveId(id);
    setMountedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      return listThreads(signal, "learning").then((threads) => {
        if (signal?.aborted) return;
        if (threads === null) {
          setStatus("failed");
          return;
        }
        for (const thread of threads) {
          if (thread.title) markTitled(thread.id);
        }
        setSessions((prev) => mergeStoredThreads(prev, threads));
        setStatus("ready");
        // A reload in the middle of a run reopens that session.
        const running = threads.find((t) => t.owned && readActiveRun(t.id));
        if (running) select(running.id);
      });
    },
    [markTitled, select]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  /** Creates the learning thread, then opens it; false when the store refused. */
  const create = useCallback(async (): Promise<boolean> => {
    const saved = await createThread({
      id: crypto.randomUUID(),
      kind: "learning",
    });
    if (!saved) return false;
    setSessions((prev) => [toSession(saved), ...prev]);
    select(saved.id);
    return true;
  }, [select]);

  const remove = useCallback(
    (ids: string[]) => {
      const gone = new Set(ids);
      for (const session of sessionsRef.current) {
        if (!gone.has(session.id)) continue;
        forget(session.id);
        if (session.owned) void deleteThread(session.id);
      }
      setSessions((prev) => prev.filter((s) => !gone.has(s.id)));
      setMountedIds((prev) => new Set([...prev].filter((id) => !gone.has(id))));
      setActiveId((current) => (current && gone.has(current) ? null : current));
    },
    [forget]
  );

  const fork = useCallback(
    async (id: string, atMessageId?: string) => {
      const saved = await forkThread(id, atMessageId);
      if (!saved) return;
      markTitled(saved.id);
      setSessions((prev) => [toSession(saved), ...prev]);
      select(saved.id);
    },
    [markTitled, select]
  );

  const share = useCallback(async (id: string, principal: string) => {
    if (!(await shareThread(id, principal))) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id && !s.sharedWith.includes(principal)
          ? { ...s, sharedWith: [...s.sharedWith, principal] }
          : s
      )
    );
  }, []);

  const unshare = useCallback(async (id: string, principal: string) => {
    if (!(await revokeShare(id, principal))) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, sharedWith: s.sharedWith.filter((p) => p !== principal) }
          : s
      )
    );
  }, []);

  return {
    sessions,
    activeId,
    mountedIds,
    status,
    load,
    select,
    create,
    remove,
    fork,
    share,
    unshare,
    rename: titles.renameSession,
    onTitleChange: titles.updateSessionTitle,
    onFirstExchange: titles.autoTitleSession,
  };
}
