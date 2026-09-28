"use client";

import { useState, type FC, type ReactNode } from "react";
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuX,
} from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import { MarkdownContent } from "@/features/common/utils/markdown-components";
import { useHarnessChatTr } from "../context/harness-chat-i18n-context";
import { formatDuration, loadRunActivity, sqlOf } from "../run-activity";
import type { RunActivity, RunActivityStep } from "../run-activity-types";

type Load =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; activity: RunActivity };

const toText = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2);

/**
 * "N steps · 42 s" under a reply; opens into what the agent ran, each step
 * with its arguments and a preview of its result. Fetched on first open.
 */
export const RunActivityRow: FC<{ runId: string }> = ({ runId }) => {
  const tr = useHarnessChatTr();
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle" });

  const fetchActivity = () => {
    if (load.state === "loading" || load.state === "ready") return;
    setLoad({ state: "loading" });
    loadRunActivity(runId).then(
      (activity) => setLoad({ state: "ready", activity }),
      () => setLoad({ state: "error" })
    );
  };

  const toggle = () => {
    if (!open) fetchActivity();
    setOpen((o) => !o);
  };

  let summary = tr("harnessChat.ui.activity.label");
  if (load.state === "ready") {
    const { stepCount, durationMs } = load.activity;
    const duration = durationMs === null ? "–" : formatDuration(durationMs);
    summary =
      stepCount === 1
        ? tr("harnessChat.ui.activity.summaryOne", { duration })
        : tr("harnessChat.ui.activity.summary", {
            count: String(stepCount),
            duration,
          });
  }

  return (
    <div className="flex max-w-[90%] flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        onPointerEnter={fetchActivity}
        aria-expanded={open}
        className="flex w-fit items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <span className="tabular-nums">{summary}</span>
        <LuChevronDown
          className={twMerge(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <ActivityPanel load={load} />}
    </div>
  );
};

const ActivityPanel: FC<{ load: Load }> = ({ load }) => {
  const tr = useHarnessChatTr();
  const note = "px-2 py-1.5 text-[10px] text-gray-400 dark:text-gray-500";
  if (load.state === "idle" || load.state === "loading") {
    return <p className={note}>{tr("harnessChat.ui.activity.loading")}</p>;
  }
  if (load.state === "error") {
    return <p className={note}>{tr("harnessChat.ui.activity.failed")}</p>;
  }
  const { activity } = load;
  const { usage } = activity;
  return (
    <div className="rounded-md border border-gray-200 bg-white py-1 dark:border-gray-700 dark:bg-gray-800/50">
      {activity.steps.length === 0 ? (
        <p className={note}>{tr("harnessChat.ui.activity.empty")}</p>
      ) : (
        <StepList steps={activity.steps} />
      )}
      {(usage.inputTokens > 0 || usage.models.length > 0) && (
        <p className="border-t border-gray-100 px-2 pt-1 text-[10px] tabular-nums text-gray-400 dark:border-gray-700 dark:text-gray-500">
          {[
            tr("harnessChat.ui.activity.tokens", {
              input: usage.inputTokens.toLocaleString(),
              output: usage.outputTokens.toLocaleString(),
            }),
            ...usage.models,
          ].join(" · ")}
        </p>
      )}
    </div>
  );
};

const StepList: FC<{ steps: RunActivityStep[]; nested?: boolean }> = ({
  steps,
  nested,
}) => (
  <ol
    className={twMerge(
      "flex flex-col",
      nested && "ml-3 border-l border-gray-200 pl-1 dark:border-gray-700"
    )}
  >
    {steps.map((step) => (
      <StepRow key={step.id} step={step} />
    ))}
  </ol>
);

const StepRow: FC<{ step: RunActivityStep }> = ({ step }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-0.5 text-left text-[11px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50"
      >
        <LuChevronRight
          className={twMerge(
            "h-3 w-3 shrink-0 text-gray-400 transition-transform",
            open && "rotate-90"
          )}
        />
        <StatusIcon ok={step.ok} />
        <span className="min-w-0 truncate">{step.label}</span>
        {step.label !== step.tool && (
          <span className="min-w-0 truncate font-mono text-[10px] text-gray-400 dark:text-gray-500">
            {step.tool}
          </span>
        )}
        <span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {step.ms === null ? "" : formatDuration(step.ms)}
        </span>
      </button>
      {open && <StepDetails step={step} />}
      {step.steps && step.steps.length > 0 && (
        <StepList steps={step.steps} nested />
      )}
    </li>
  );
};

const StatusIcon: FC<{ ok: boolean | null }> = ({ ok }) => {
  const tr = useHarnessChatTr();
  if (ok === true) {
    return (
      <LuCheck
        aria-label={tr("harnessChat.ui.activity.result")}
        className="h-3 w-3 shrink-0 text-emerald-500"
      />
    );
  }
  if (ok === false) {
    return (
      <LuX
        aria-label={tr("harnessChat.ui.activity.error")}
        className="h-3 w-3 shrink-0 text-red-500"
      />
    );
  }
  return (
    <span
      aria-label={tr("harnessChat.ui.activity.unfinished")}
      className="h-2 w-2 shrink-0 rounded-full border border-gray-400 dark:border-gray-500"
    />
  );
};

const StepDetails: FC<{ step: RunActivityStep }> = ({ step }) => {
  const tr = useHarnessChatTr();
  const sql = sqlOf(step.args);
  const truncated = ` (${tr("harnessChat.ui.activity.truncated")})`;
  return (
    <div className="ml-7 mr-2 mb-1 flex flex-col gap-1.5 text-[10px]">
      {step.error && (
        <p className="whitespace-pre-wrap break-words text-red-600 dark:text-red-400">
          {step.error}
        </p>
      )}
      {step.args === null ? (
        <p className="text-gray-400 dark:text-gray-500">
          {tr("harnessChat.ui.activity.noArguments")}
        </p>
      ) : (
        <Section
          title={
            tr("harnessChat.ui.activity.arguments") +
            (step.argsTruncated ? truncated : "")
          }
          copyText={sql ?? toText(step.args)}
        >
          {sql ? (
            <>
              <div className="text-[10px] [&_pre]:my-0 [&_pre]:max-h-60 [&_pre]:overflow-auto">
                <MarkdownContent>
                  {"````sql\n" + sql + "\n````"}
                </MarkdownContent>
              </div>
              {Object.keys(step.args as object).length > 1 && (
                <Code text={toText(withoutSql(step.args))} />
              )}
            </>
          ) : (
            <Code text={toText(step.args)} />
          )}
        </Section>
      )}
      {step.preview !== null && step.preview !== undefined && (
        <Section
          title={
            tr("harnessChat.ui.activity.result") +
            (step.previewTruncated ? truncated : "")
          }
          copyText={toText(step.preview)}
        >
          <Code text={toText(step.preview)} />
        </Section>
      )}
    </div>
  );
};

function withoutSql(args: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).filter(
      ([key]) => key !== "sql"
    )
  );
}

const Section: FC<{ title: string; copyText: string; children: ReactNode }> = ({
  title,
  copyText,
  children,
}) => {
  const tr = useHarnessChatTr();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <section className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
        <span className="font-medium">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-0.5 rounded px-1 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <LuCopy className="h-2.5 w-2.5" />
          {copied
            ? tr("harnessChat.ui.activity.copied")
            : tr("harnessChat.ui.activity.copy")}
        </button>
      </div>
      {children}
    </section>
  );
};

const Code: FC<{ text: string }> = ({ text }) => (
  <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded border border-gray-200 bg-gray-50 px-1.5 py-1 font-mono text-[10px] leading-snug text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
    {text}
  </pre>
);
