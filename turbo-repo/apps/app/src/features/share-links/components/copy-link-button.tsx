"use client";

import { useState } from "react";
import { HiCheck, HiLink } from "react-icons/hi2";
import { toast } from "sonner";
import { copyShareLink, type LinkTargetType } from "../share-links-api";

interface CopyLinkButtonProps {
  readonly targetType: LinkTargetType;
  readonly targetId: string;
  readonly lang: string;
  readonly label: string;
  readonly copiedMessage: string;
  readonly failedMessage: string;
  readonly className?: string;
}

/** Gets the organization link to a story or thread and copies it. */
export function CopyLinkButton({
  targetType,
  targetId,
  lang,
  label,
  copiedMessage,
  failedMessage,
  className,
}: CopyLinkButtonProps) {
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");

  async function copy() {
    setState("busy");
    try {
      await copyShareLink(targetType, targetId, lang);
      setState("copied");
      toast.success(copiedMessage);
      window.setTimeout(() => setState("idle"), 2_000);
    } catch {
      setState("idle");
      toast.error(failedMessage);
    }
  }

  const Icon = state === "copied" ? HiCheck : HiLink;
  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={state === "busy"}
      className={
        className ??
        "flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
