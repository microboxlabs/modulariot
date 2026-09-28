"use client";

import { useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { LuActivity } from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import type { RunSummary } from "@microboxlabs/miot-harness-client";
import { stepKeyOf } from "@/app/api/harness/chat/stream/step-labels";
import {
  useHarnessChatTr,
  type TrFn,
} from "../context/harness-chat-i18n-context";
import { isRunning } from "../hooks/use-harness-activity";
import { formatElapsed } from "../run-progress";

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

function stepOf(run: RunSummary, tr: TrFn): string {
  const key = run.last_step?.tool ? stepKeyOf(run.last_step.tool) : null;
  return key
    ? tr(`harnessChat.stream.steps.${key}`)
    : tr("harnessChat.ui.activity.working");
}

function statusLabel(run: RunSummary, tr: TrFn): string {
  if (run.status === "completed")
    return tr("harnessChat.ui.activity.statusCompleted");
  if (run.status === "interrupted")
    return tr("harnessChat.ui.activity.statusInterrupted");
  return tr("harnessChat.ui.activity.statusFailed");
}

/** Briefs can repeat; their order within the run is stable. */
function withKeys(run: RunSummary) {
  return run.delegates.map((delegate, position) => ({
    ...delegate,
    key: `${run.run_id}:${position}`,
  }));
}

function msBetween(from: string | null, to: string | number | null): number {
  if (!from || to === null) return 0;
  const end = typeof to === "number" ? to : Date.parse(to);
  return end - Date.parse(from);
}

export const ActivityList: FC<{
  runs: RunSummary[];
  failed: boolean;
  titleOf: (conversationId: string | null) => string | null;
  onOpen: (conversationId: string) => void;
}> = ({ runs, failed, titleOf, onOpen }) => {
  const tr = useHarnessChatTr();
  const running = runs.filter(isRunning);
  const recent = runs.filter((run) => !isRunning(run));
  const now = useNow(running.length > 0);

  if (failed) {
    return (
      <p className="px-3 py-4 text-xs text-gray-500">
        {tr("harnessChat.ui.activity.loadFailed")}
      </p>
    );
  }
  if (runs.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-gray-500">
        {tr("harnessChat.ui.activity.empty")}
      </p>
    );
  }

  const row = (run: RunSummary, live: boolean) => {
    const title =
      titleOf(run.conversation_id) ?? tr("harnessChat.ui.activity.untitled");
    const conversationId = run.conversation_id;
    const elapsed = live
      ? msBetween(run.started_at, now)
      : msBetween(run.started_at, run.finished_at);
    return (
      <li key={run.run_id}>
        <button
          type="button"
          disabled={!conversationId}
          onClick={() => conversationId && onOpen(conversationId)}
          className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-700"
        >
          <span className="flex w-full items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-100">
              {title}
            </span>
            <time className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {formatElapsed(elapsed)}
            </time>
          </span>
          {live ? (
            <span className="flex items-center gap-2 text-[11px]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 motion-safe:animate-pulse dark:bg-amber-400"
              />
              <output className="min-w-0 truncate animate-harness-shimmer">
                {stepOf(run, tr)}
              </output>
            </span>
          ) : (
            <span
              className={twMerge(
                "text-[11px]",
                run.status === "completed"
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {statusLabel(run, tr)}
            </span>
          )}
        </button>
        {live && run.delegates.length > 0 && (
          <ul
            aria-label={tr("harnessChat.ui.activity.delegates")}
            className="ml-5 flex flex-col gap-0.5 pb-1"
          >
            {withKeys(run).map((delegate) => (
              <li
                key={delegate.key}
                className={twMerge(
                  "truncate text-[10px] text-gray-500 dark:text-gray-400",
                  delegate.status === "running" && "animate-harness-shimmer"
                )}
              >
                {delegate.brief}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex max-h-96 flex-col gap-2 overflow-y-auto p-1.5">
      {running.length > 0 && (
        <section>
          <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {tr("harnessChat.ui.activity.running")}
          </h3>
          <ul>{running.map((run) => row(run, true))}</ul>
        </section>
      )}
      {recent.length > 0 && (
        <section>
          <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {tr("harnessChat.ui.activity.recent")}
          </h3>
          <ul>{recent.map((run) => row(run, false))}</ul>
        </section>
      )}
    </div>
  );
};

/** The header button with the running count, and the list under it. */
export const ActivityButton: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runningCount: number;
  className: string;
  children: ReactNode;
}> = ({ open, onOpenChange, runningCount, className, children }) => {
  const tr = useHarnessChatTr();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={tr("harnessChat.ui.activity.open")}
        aria-expanded={open}
        className={twMerge(className, "relative")}
      >
        <LuActivity className="h-3.5 w-3.5" />
        {runningCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold leading-none text-white">
            {runningCount}
          </span>
        )}
      </button>
      {open && (
        <dialog
          open
          aria-label={tr("harnessChat.ui.activity.title")}
          className="absolute left-auto right-0 top-8 z-30 m-0 w-72 rounded-lg border border-gray-200 bg-white p-0 text-inherit shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {children}
        </dialog>
      )}
    </div>
  );
};
