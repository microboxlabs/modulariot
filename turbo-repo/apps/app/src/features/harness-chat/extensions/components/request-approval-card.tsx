"use client";

import { useState, type FC } from "react";
import { type ToolCallMessagePartProps } from "@assistant-ui/react";
import { LuCheck, LuClock, LuShieldQuestion, LuX } from "react-icons/lu";
import { twMerge } from "tailwind-merge";
import {
  useHarnessChatTr,
  type TrFn,
} from "../../context/harness-chat-i18n-context";
import { useHarnessReadOnly } from "../../context/harness-read-only-context";
import {
  approvalActionOf,
  approvalSubject,
  storyContentOf,
  visibleEntries,
  type RequestApprovalArgs,
  type RequestApprovalResult,
} from "../request-approval-args";

const PREVIEW_LINES = 20;

type Phase =
  | { state: "idle" }
  | { state: "rejecting" }
  | { state: "sending" }
  | { state: "sent" }
  | { state: "error"; reason: "notPending" | "failed" };

export function approvalTitle(args: RequestApprovalArgs, tr: TrFn): string {
  const action = approvalActionOf(args.tool);
  const verb = action
    ? tr(`harnessChat.ui.approval.actions.${action}`)
    : args.tool;
  const subject = approvalSubject(args.input);
  return subject ? `${verb} «${subject}»` : verb;
}

function approvalUrl(args: RequestApprovalArgs): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/api/harness/chat/runs/${encodeURIComponent(args.runId)}/approvals/${encodeURIComponent(args.approvalId)}`;
}

function display(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const StoryPreview: FC<{ input: Record<string, unknown>; content: string }> = ({
  input,
  content,
}) => {
  const tr = useHarnessChatTr();
  const [open, setOpen] = useState(false);
  const lines = content.split("\n");
  const long = lines.length > PREVIEW_LINES;
  const shown =
    open || !long ? content : lines.slice(0, PREVIEW_LINES).join("\n");
  return (
    <div className="flex flex-col gap-1">
      {typeof input.kind === "string" && (
        <p className="text-gray-500 dark:text-gray-400">
          {tr("harnessChat.ui.approval.kind")}: {input.kind}
        </p>
      )}
      {typeof input.description === "string" && input.description && (
        <p className="text-gray-600 dark:text-gray-300">{input.description}</p>
      )}
      <pre
        aria-label={tr("harnessChat.ui.approval.content")}
        className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-2 font-mono text-[10px] text-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        {shown}
      </pre>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="self-start text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {open
            ? tr("harnessChat.ui.approval.showLess")
            : tr("harnessChat.ui.approval.showAll")}
        </button>
      )}
    </div>
  );
};

const InputList: FC<{ input: Record<string, unknown> }> = ({ input }) => {
  const entries = visibleEntries(input);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{key}</dt>
          <dd
            className="min-w-0 truncate text-gray-700 dark:text-gray-200"
            title={display(value)}
          >
            {display(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const Outcome: FC<{ result: RequestApprovalResult }> = ({ result }) => {
  const tr = useHarnessChatTr();
  const when = result.at ? new Date(result.at) : null;
  const details = [
    result.by ? tr("harnessChat.ui.approval.by", { by: result.by }) : null,
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })
      : null,
  ].filter(Boolean);
  const tone = {
    approved: "text-green-700 dark:text-green-400",
    rejected: "text-red-600 dark:text-red-400",
    expired: "text-gray-500 dark:text-gray-400",
  }[result.status];
  const Icon = { approved: LuCheck, rejected: LuX, expired: LuClock }[
    result.status
  ];
  return (
    <div className="flex flex-col gap-0.5">
      <output className={twMerge("flex items-center gap-1 font-medium", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{tr(`harnessChat.ui.approval.${result.status}`)}</span>
        {details.length > 0 && (
          <span className="font-normal text-gray-400 dark:text-gray-500">
            · {details.join(" · ")}
          </span>
        )}
      </output>
      {result.comment && (
        <p className="italic text-gray-500 dark:text-gray-400">
          “{result.comment}”
        </p>
      )}
    </div>
  );
};

const buttonClass =
  "rounded-md px-2.5 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-40";

/** The approval the run waits for. The decision goes to the harness, and
 * the result comes back on the run's own stream. */
export const RequestApprovalCard: FC<
  ToolCallMessagePartProps<RequestApprovalArgs, RequestApprovalResult>
> = ({ args, result, isError }) => {
  const tr = useHarnessChatTr();
  const readOnly = useHarnessReadOnly();
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [comment, setComment] = useState("");

  if (!args?.approvalId) return null;
  let outcome: RequestApprovalResult | null = null;
  if (result?.status) outcome = result;
  else if (isError) outcome = { status: "expired" };
  const pending = outcome === null;
  const content = args.tool.startsWith("stories_")
    ? storyContentOf(args.input)
    : null;

  const decide = async (decision: "approve" | "deny") => {
    setPhase({ state: "sending" });
    try {
      const res = await fetch(approvalUrl(args), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "deny" && comment.trim()
            ? { decision, comment: comment.trim() }
            : { decision }
        ),
      });
      if (res.ok) setPhase({ state: "sent" });
      else
        setPhase({
          state: "error",
          reason: res.status === 404 ? "notPending" : "failed",
        });
    } catch {
      setPhase({ state: "error", reason: "failed" });
    }
  };

  const busy = phase.state === "sending" || phase.state === "sent";
  const closed = phase.state === "error" && phase.reason === "notPending";

  return (
    <div
      className={twMerge(
        "flex w-full flex-col gap-2 rounded-lg border bg-white p-3 text-xs dark:bg-gray-800",
        pending
          ? "border-amber-300 dark:border-amber-600/60"
          : "border-gray-200 dark:border-gray-700"
      )}
    >
      <div className="flex items-start gap-2">
        <LuShieldQuestion
          aria-hidden
          className={twMerge(
            "mt-0.5 h-4 w-4 shrink-0",
            pending ? "text-amber-500" : "text-gray-400"
          )}
        />
        <div className="min-w-0">
          {pending && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {tr("harnessChat.ui.approval.heading")}
            </p>
          )}
          <p className="font-medium text-gray-800 dark:text-gray-100">
            {approvalTitle(args, tr)}
          </p>
        </div>
      </div>

      {content !== null ? (
        <StoryPreview input={args.input} content={content} />
      ) : (
        <InputList input={args.input} />
      )}
      {args.inputTruncated && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {tr("harnessChat.ui.approval.truncated")}
        </p>
      )}

      {outcome && <Outcome result={outcome} />}

      {pending && !readOnly && !closed && phase.state === "rejecting" && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={tr("harnessChat.ui.approval.commentPlaceholder")}
            className="w-full resize-y rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs text-gray-800 outline-none placeholder:text-gray-400 dark:border-gray-600 dark:text-gray-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPhase({ state: "idle" })}
              className={twMerge(
                buttonClass,
                "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              {tr("harnessChat.ui.approval.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void decide("deny")}
              className={twMerge(
                buttonClass,
                "bg-red-600 text-white hover:bg-red-700"
              )}
            >
              {tr("harnessChat.ui.approval.confirmReject")}
            </button>
          </div>
        </div>
      )}

      {pending && !readOnly && !closed && phase.state !== "rejecting" && (
        <div className="flex items-center justify-end gap-2">
          {phase.state === "error" && (
            <p role="alert" className="mr-auto text-red-600 dark:text-red-400">
              {tr("harnessChat.ui.approval.failed")}
            </p>
          )}
          {busy && (
            <p className="mr-auto text-gray-500 dark:text-gray-400">
              {phase.state === "sent"
                ? tr("harnessChat.ui.approval.sent")
                : tr("harnessChat.ui.approval.sending")}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setPhase({ state: "rejecting" })}
            className={twMerge(
              buttonClass,
              "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            )}
          >
            {tr("harnessChat.ui.approval.reject")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("approve")}
            className={twMerge(
              buttonClass,
              "bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-300"
            )}
          >
            {tr("harnessChat.ui.approval.approve")}
          </button>
        </div>
      )}

      {pending && closed && (
        <p className="text-gray-500 dark:text-gray-400">
          {tr("harnessChat.ui.approval.notPending")}
        </p>
      )}
    </div>
  );
};
