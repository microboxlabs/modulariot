"use client";

import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { HiPencil, HiCheck, HiXMark } from "react-icons/hi2";

interface HeaderCellProps {
  /** The name as it came out of the file — stable across renames. */
  original: string;
  /** Current effective/mapped name shown to the user. */
  displayName: string;
  /** Names the RPC schema expects (surfaced as a datalist so users can jump
   *  straight to `p_patente` instead of typing it). */
  expectedNames: string[];
  /** Commit a rename. Pass the original back to untangle the mapping. */
  onRename: (original: string, target: string) => void;
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
  onRename,
}: Readonly<HeaderCellProps>) {
  const [editing, setEditing] = useState(false);
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
            title="Save"
            aria-label="Save"
          >
            <HiCheck className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
            title="Cancel"
            aria-label="Cancel"
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

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex flex-col items-start gap-0.5 border-r border-gray-200 p-2 text-left hover:bg-gray-200/60 dark:border-gray-700 dark:hover:bg-gray-700/60"
      title={
        mapped
          ? `Click to edit. Original: ${original}`
          : "Click to rename this column"
      }
    >
      <span className="flex w-full items-center gap-1">
        <span className="truncate font-semibold">{displayName}</span>
        <HiPencil className="ml-auto h-3 w-3 flex-none text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      {mapped && (
        <span className="truncate text-[10px] font-normal italic text-gray-500 dark:text-gray-400">
          was: {original}
        </span>
      )}
    </button>
  );
});
