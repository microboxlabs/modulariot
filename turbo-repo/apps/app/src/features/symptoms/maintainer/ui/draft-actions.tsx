"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { HiOutlineCloudUpload, HiOutlineReply } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { BumpBadge } from "./badges";
import { MUTED } from "./card";
import { CHANGED_DOT } from "./changed";

const ICON_BUTTON =
  "flex h-[30px] w-[30px] items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40";

function changesLabel(n: number, d: I18nRecord) {
  if (n === 0) return tr("draftNoChanges", d);
  if (n === 1) return tr("draftOneChange", d);
  return tr("draftChanges", d, { n: String(n) });
}

/**
 * The draft's part of a sheet header: a chip with the number of changes that
 * opens a small panel (version they make, errors, saved, see changes), and
 * the discard and publish icons. `d` holds the draft texts both editors share.
 */
export default function DraftActions({
  changes,
  nextVersion,
  bump,
  errors,
  saving,
  saveError,
  notice,
  canReview = true,
  canPublish,
  d,
  onReview,
  onDiscard,
  discardDisabled = false,
}: Readonly<{
  /** Null while the changes are not known yet. */
  changes: number | null;
  nextVersion: string | null;
  bump: "MAJOR" | "MINOR" | "PATCH" | null;
  errors: number;
  saving: boolean;
  saveError: string | null;
  /** A line for the panel, such as the plan failing to load. */
  notice?: ReactNode;
  canReview?: boolean;
  canPublish: boolean;
  d: I18nRecord;
  onReview: () => void;
  /** Absent when there is no version to go back to. */
  onDiscard?: () => void;
  discardDisabled?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const failed = saveError !== null || errors > 0;
  const status = saving ? tr("saving", d) : tr("saved", d);

  return (
    <section
      aria-label={tr("draftBarLabel", d)}
      className="flex items-center gap-2"
    >
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          title={status}
          className="flex h-[30px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-900 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          onClick={() => setOpen(!open)}
        >
          <span
            className={`h-2 w-2 rounded-full ${saving ? "animate-pulse bg-blue-500" : CHANGED_DOT}`}
          />
          {changes === null ? tr("draftBarLabel", d) : changesLabel(changes, d)}
          {failed && (
            <span className="rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {errors > 0 ? errors : "!"}
            </span>
          )}
        </button>
        {open && (
          <dialog
            open
            aria-label={tr("draftBarLabel", d)}
            className="absolute top-full right-0 left-auto z-40 m-0 mt-1 flex w-72 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-gray-600 dark:bg-gray-700"
          >
            {nextVersion && bump && (
              <div className="flex items-center gap-2">
                <span className={`text-xs ${MUTED}`}>
                  {tr("nextVersion", d)}
                </span>
                <span className="font-mono text-gray-900 dark:text-white">
                  {nextVersion}
                </span>
                <BumpBadge bump={bump} d={d} />
              </div>
            )}
            {notice}
            {errors > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {errors === 1
                  ? tr("oneError", d)
                  : tr("errorsCount", d, { n: String(errors) })}
              </span>
            )}
            {saveError && (
              <span
                role="alert"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {saveError}
              </span>
            )}
            <span className={`text-xs ${MUTED}`}>{status}</span>
            <button
              type="button"
              disabled={!canReview}
              className="self-start text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              onClick={() => {
                setOpen(false);
                onReview();
              }}
            >
              {tr("seeChanges", d)}
            </button>
          </dialog>
        )}
      </div>
      {onDiscard && (
        <button
          type="button"
          title={tr("discard", d)}
          aria-label={tr("discard", d)}
          disabled={discardDisabled}
          className={`${ICON_BUTTON} border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700`}
          onClick={onDiscard}
        >
          <HiOutlineReply className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        title={tr("publish", d)}
        aria-label={tr("publish", d)}
        disabled={!canPublish}
        className={`${ICON_BUTTON} border-blue-700 bg-blue-700 text-white hover:bg-blue-800 dark:border-blue-600 dark:bg-blue-600`}
        onClick={onReview}
      >
        <HiOutlineCloudUpload className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
