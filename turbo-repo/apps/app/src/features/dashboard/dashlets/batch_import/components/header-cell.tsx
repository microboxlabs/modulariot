"use client";

import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { HiPencil, HiCheck, HiXMark, HiAdjustmentsHorizontal } from "react-icons/hi2";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { TransformStep } from "../engine/transforms";
import { TransformsPopover } from "./transforms-popover";

interface HeaderCellProps {
  /** The name as it came out of the file — stable across renames. */
  original: string;
  /** Current effective/mapped name shown to the user. */
  displayName: string;
  /** Names the RPC schema expects (surfaced as a datalist so users can jump
   *  straight to `p_patente` instead of typing it). */
  expectedNames: string[];
  /** RPC schema type for the *effective* column name, used to filter the
   *  transforms picker to ones that make sense for the column's type. */
  expectedType?: string;
  /** RPC schema format ("date", "date-time", …) for the effective column.
   *  Drives whether the popover surfaces the date-scoped transform kinds and
   *  the per-column display-format input. */
  expectedFormat?: string;
  /** Transforms currently applied to this column (post-rename name). */
  transforms: readonly TransformStep[];
  /** Per-column display-only date format (dayjs tokens). Empty string when
   *  unset. Only meaningful when `expectedFormat` is "date" / "date-time". */
  dateDisplayFormat: string;
  /** Commit a rename. Pass the original back to untangle the mapping. */
  onRename: (original: string, target: string) => void;
  /** Replace the transforms list for this column (mapped name). */
  onTransformsChange: (target: string, steps: TransformStep[]) => void;
  /** Set or clear (pass empty string) the display-only format for this
   *  column. Display formats do not modify the value sent to the server. */
  onDateDisplayFormatChange: (target: string, value: string) => void;
  dictionary: I18nRecord;
}

/**
 * Inline-editable column header. Click the pencil (or double-click the name)
 * to remap this column to a different field name — e.g. rename "Patente" to
 * "p_patente" so the row validates without touching the source CSV. A small
 * "was: X" note surfaces when the current name diverges from what the file
 * actually provided, so the mapping is never hidden from the user.
 */
export const HeaderCell = memo(function HeaderCell({
  original,
  displayName,
  expectedNames,
  expectedType,
  expectedFormat,
  transforms,
  dateDisplayFormat,
  onRename,
  onTransformsChange,
  onDateDisplayFormatChange,
  dictionary,
}: Readonly<HeaderCellProps>) {
  const [editing, setEditing] = useState(false);
  const [showTransforms, setShowTransforms] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (editing) {
      setDraft(displayName);
      // Select on open so retyping is a single gesture.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, displayName]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== displayName) {
      onRename(original, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(displayName);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const mapped = displayName !== original;
  const saveLabel = tr("common.save", dictionary);
  const cancelLabel = tr("common.cancel", dictionary);

  if (editing) {
    return (
      <div className="flex flex-col gap-1 border-r border-gray-200 p-1.5 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            list={listId}
            className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-blue-500 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={commit}
            className="text-green-600 hover:text-green-700 dark:text-green-400"
            title={saveLabel}
            aria-label={saveLabel}
          >
            <HiCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
            title={cancelLabel}
            aria-label={cancelLabel}
          >
            <HiXMark className="h-4 w-4" />
          </button>
        </div>
        {expectedNames.length > 0 && (
          <datalist id={listId}>
            {expectedNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  const transformCount = transforms.length;
  const transformsLabel = tr(
    "dashboard.dashlets.batchImport.transforms.title",
    dictionary,
  );

  return (
    <div
      className="group relative flex flex-col items-start gap-0.5 border-r border-gray-200 p-2 text-left dark:border-gray-700"
    >
      <span className="flex w-full items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-blue-700 dark:hover:text-blue-400"
          title={
            mapped
              ? tr(
                  "dashboard.dashlets.batchImport.editColumnOriginal",
                  dictionary,
                  { original },
                )
              : tr("dashboard.dashlets.batchImport.renameColumn", dictionary)
          }
        >
          <span className="truncate font-semibold">{displayName}</span>
          <HiPencil className="h-3 w-3 flex-none text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        <button
          type="button"
          onClick={() => setShowTransforms((v) => !v)}
          className={`relative inline-flex h-6 w-6 flex-none items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            transformCount > 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
          }`}
          title={transformsLabel}
          aria-label={transformsLabel}
        >
          <HiAdjustmentsHorizontal className="h-3.5 w-3.5" />
          {transformCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold leading-none text-white">
              {transformCount}
            </span>
          )}
        </button>
      </span>
      {mapped && (
        <span className="truncate text-[10px] font-normal italic text-gray-500 dark:text-gray-400">
          {tr("dashboard.dashlets.batchImport.was", dictionary)}: {original}
        </span>
      )}
      {showTransforms && (
        <TransformsPopover
          target={displayName}
          expectedType={expectedType}
          expectedFormat={expectedFormat}
          steps={transforms}
          dateDisplayFormat={dateDisplayFormat}
          onChange={(steps) => onTransformsChange(displayName, steps)}
          onDateDisplayFormatChange={(value) =>
            onDateDisplayFormatChange(displayName, value)
          }
          onClose={() => setShowTransforms(false)}
          dictionary={dictionary}
        />
      )}
    </div>
  );
});
