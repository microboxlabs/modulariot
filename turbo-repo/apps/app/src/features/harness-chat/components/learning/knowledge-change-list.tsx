"use client";

import type { FC } from "react";
import useSWR from "swr";
import { HiArrowsPointingOut } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
import { useHarnessChatTr } from "../../context/harness-chat-i18n-context";
import { fileItemOf, useWorkArea } from "../../context/work-area-context";
import {
  changeKey,
  type KnowledgeChange,
} from "../../extensions/knowledge-change-args";
import { fetchItem } from "../../knowledge-api";
import { DiffView } from "../diff-view";
import {
  badgeClass,
  isDeleteOp,
  LAYER_BADGE,
  layerLabel,
  opLabel,
} from "./labels";

/** The path as a breadcrumb: folders muted, the file name in full. */
export const PathCrumbs: FC<{ path: string; className?: string }> = ({
  path,
  className,
}) => {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop() ?? path;
  return (
    <span
      className={twMerge(
        "flex min-w-0 items-center font-mono text-[11px]",
        className
      )}
      title={path}
    >
      {parts.length > 0 && (
        <span className="truncate text-gray-400 dark:text-gray-500">
          {parts.join(" / ")} /&nbsp;
        </span>
      )}
      <span className="shrink-0 font-medium text-gray-800 dark:text-gray-100">
        {name}
      </span>
    </span>
  );
};

export const ChangeBadges: FC<{ change: KnowledgeChange }> = ({ change }) => {
  const tr = useHarnessChatTr();
  return (
    <>
      {change.op && (
        <span
          className={twMerge(
            badgeClass,
            isDeleteOp(change.op)
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          )}
        >
          {opLabel(change.op, tr)}
        </span>
      )}
      {change.layer && (
        <span
          className={twMerge(
            badgeClass,
            LAYER_BADGE[change.layer] ?? LAYER_BADGE.note
          )}
        >
          {layerLabel(change.layer, tr)}
        </span>
      )}
      {change.version !== null && (
        <span className="shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {tr("harnessChat.learning.change.version", {
            version: String(change.version),
          })}
        </span>
      )}
    </>
  );
};

/** A change that carries its new text but no diff: diffed against what the
 * item says now. */
const DiffAgainstCurrent: FC<{
  change: KnowledgeChange;
  maxHeightClass?: string;
}> = ({ change, maxHeightClass }) => {
  const tr = useHarnessChatTr();
  const { layer, id, target } = change;
  const { data, error, isLoading } = useSWR(
    layer && id ? ["knowledge-item", layer, id, target] : null,
    () => fetchItem(layer as string, id as string, target),
    { revalidateOnFocus: false }
  );
  if (isLoading) {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {tr("harnessChat.learning.change.loadingDiff")}
      </p>
    );
  }
  const current = error ? "" : (data?.content ?? "");
  const next = isDeleteOp(change.op) ? "" : (change.content ?? "");
  return (
    <DiffView
      oldText={current}
      newText={next}
      path={change.path}
      maxHeightClass={maxHeightClass}
    />
  );
};

export const ChangeDiff: FC<{
  change: KnowledgeChange;
  maxHeightClass?: string;
}> = ({ change, maxHeightClass }) => {
  if (change.diff) {
    return (
      <DiffView
        diff={change.diff}
        path={change.path}
        maxHeightClass={maxHeightClass}
      />
    );
  }
  if (
    change.layer &&
    change.id &&
    (change.content !== null || isDeleteOp(change.op))
  ) {
    return (
      <DiffAgainstCurrent change={change} maxHeightClass={maxHeightClass} />
    );
  }
  return null;
};

const expandClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white";

/**
 * Each change with its path, layer and operation over its diff. With a
 * working area, a change that names an item opens it there.
 */
export const KnowledgeChangeList: FC<{
  changes: KnowledgeChange[];
  /** The changes still wait for approval. */
  proposed?: boolean;
}> = ({ changes, proposed = false }) => {
  const tr = useHarnessChatTr();
  const workArea = useWorkArea();
  return (
    <ul className="flex flex-col gap-2">
      {changes.map((change) => {
        const item = workArea ? fileItemOf(change, proposed) : null;
        return (
          <li key={changeKey(change)} className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {change.path && (
                <PathCrumbs path={change.path} className="min-w-0 flex-1" />
              )}
              <ChangeBadges change={change} />
              {item && workArea && (
                <button
                  type="button"
                  className={expandClass}
                  title={tr("harnessChat.learning.change.open")}
                  aria-label={tr("harnessChat.learning.change.open")}
                  onClick={() => workArea.open(item)}
                >
                  <HiArrowsPointingOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {change.reason && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {change.reason}
              </p>
            )}
            <ChangeDiff change={change} maxHeightClass="max-h-72" />
          </li>
        );
      })}
    </ul>
  );
};
