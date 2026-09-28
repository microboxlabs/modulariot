"use client";

import { createContext, useContext, type FC, type ReactNode } from "react";
import type { KnowledgeChange } from "../extensions/knowledge-change-args";
import type { ShowLearningEvalArgs } from "../extensions/learning-eval-args";

/** Something a chat card can open next to the chat. */
export type WorkItem =
  | {
      kind: "file";
      layer: string;
      id: string;
      target: string | null;
      path: string;
      /** A change still waiting for approval, shown instead of the history. */
      proposed?: KnowledgeChange;
    }
  | { kind: "eval"; evaluationId: string; card?: ShowLearningEvalArgs }
  | { kind: "layers" }
  | { kind: "changes"; threadId: string };

export type WorkArea = {
  open: (item: WorkItem) => void;
  /** A change a session's tool applied, for that session's `/diff`. */
  recordChange: (threadId: string, change: KnowledgeChange) => void;
};

const WorkAreaContext = createContext<WorkArea | null>(null);

export const WorkAreaProvider: FC<{ value: WorkArea; children: ReactNode }> = ({
  value,
  children,
}) => (
  <WorkAreaContext.Provider value={value}>{children}</WorkAreaContext.Provider>
);

/** The learning workspace's working area; null in the chat panel, whose
 * cards then have nothing to expand into. */
export const useWorkArea = (): WorkArea | null => useContext(WorkAreaContext);

/** A key that tells two opened items apart. */
export function workItemKey(item: WorkItem): string {
  switch (item.kind) {
    case "file":
      return `file:${item.layer}:${item.target ?? ""}:${item.id}:${item.proposed ? "proposed" : ""}`;
    case "eval":
      return `eval:${item.evaluationId}`;
    case "layers":
      return "layers";
    case "changes":
      return `changes:${item.threadId}`;
  }
}

/** The file item for a change, when it names a knowledge item. */
export function fileItemOf(
  change: KnowledgeChange,
  proposed = false
): WorkItem | null {
  if (!change.layer || !change.id) return null;
  return {
    kind: "file",
    layer: change.layer,
    id: change.id,
    target: change.target,
    path: change.path ?? change.id,
    ...(proposed ? { proposed: change } : {}),
  };
}
