"use client";

import { useState, type FC } from "react";
import { type ToolCallMessagePartProps } from "@assistant-ui/react";
import { HiArrowTopRightOnSquare, HiCheck, HiLink } from "react-icons/hi2";
import { toast } from "sonner";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import type { ShowShareLinkArgs } from "../show-share-link-args";

const buttonClass =
  "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700";

/** A share link the agent created, with copy and open buttons. */
export const ShowShareLinkCard: FC<
  ToolCallMessagePartProps<ShowShareLinkArgs, Record<string, never>>
> = ({ args }) => {
  const tr = useHarnessChatTr();
  const [copied, setCopied] = useState(false);
  if (!args?.url) return null;

  const heading =
    args.targetType === "thread"
      ? tr("harnessChat.ui.shareLink.thread")
      : tr("harnessChat.ui.shareLink.story");

  async function copy() {
    try {
      await navigator.clipboard.writeText(args.url);
      setCopied(true);
      toast.success(tr("harnessChat.ui.shareLink.copied"));
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      toast.error(tr("harnessChat.ui.shareLink.copyFailed"));
    }
  }

  const CopyIcon = copied ? HiCheck : HiLink;
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-2">
        <HiLink aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {heading}
          </p>
          {args.title && (
            <p className="font-medium text-gray-800 dark:text-gray-100">
              {args.title}
            </p>
          )}
          <a
            href={args.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-blue-600 hover:underline dark:text-blue-400"
          >
            {args.url}
          </a>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {tr("harnessChat.ui.shareLink.access")}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className={buttonClass}
        >
          <CopyIcon className="h-4 w-4" />
          {tr("harnessChat.ui.shareLink.copy")}
        </button>
        <a
          href={args.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          <HiArrowTopRightOnSquare className="h-4 w-4" />
          {tr("harnessChat.ui.shareLink.open")}
        </a>
      </div>
    </div>
  );
};
