"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { MdDragIndicator } from "react-icons/md";

const KEY_STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

/**
 * Rows reordered by dragging a handle, or with the arrow keys on it. Each row
 * gets its handle from `renderRow`; there is none when the list is read-only
 * or has a single row.
 */
export default function SortableRows<T>({
  items,
  keys,
  readOnly,
  handleLabel,
  as: Row = "div",
  rowClassName = "",
  rowTestId,
  rowLabel,
  onMove,
  renderRow,
}: Readonly<{
  items: readonly T[];
  /** A stable key per item, in the items' order. */
  keys: readonly string[];
  readOnly: boolean;
  handleLabel: string;
  as?: "div" | "li";
  rowClassName?: string;
  rowTestId?: string;
  rowLabel?: (index: number) => string;
  onMove: (from: number, to: number) => void;
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
}>) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // A row moved with the keyboard keeps focus on its handle, once the moved list comes back.
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<{ key: string; index: number } | null>(null);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (keys[pending.index] === pending.key)
      handles.current.get(pending.key)?.focus();
  }, [keys]);
  const sortable = !readOnly && items.length > 1;
  const move = (key: string, to: number, keepFocus = false) => {
    const from = keys.indexOf(key);
    if (from < 0 || from === to || to < 0 || to >= items.length) return;
    if (keepFocus) pendingFocus.current = { key, index: to };
    onMove(from, to);
  };
  const end = () => {
    setDragging(null);
    setOver(null);
  };
  return (
    <>
      {items.map((item, i) => {
        const key = keys[i];
        const handle = sortable && (
          <button
            type="button"
            draggable
            ref={(el) => {
              if (el) handles.current.set(key, el);
              else handles.current.delete(key);
            }}
            aria-label={handleLabel}
            title={handleLabel}
            className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:hover:text-gray-200"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", key);
              const rowEl = e.currentTarget.closest("[data-sortable-row]");
              if (rowEl instanceof HTMLElement)
                e.dataTransfer.setDragImage(rowEl, 12, 12);
              setDragging(key);
            }}
            onDragEnd={end}
            onKeyDown={(e) => {
              const step = KEY_STEP[e.key];
              if (step === undefined) return;
              e.preventDefault();
              move(key, i + step, true);
            }}
          >
            <MdDragIndicator className="h-4 w-4" />
          </button>
        );
        return (
          <Row
            key={key}
            data-sortable-row
            data-testid={rowTestId}
            aria-label={rowLabel?.(i)}
            className={`${rowClassName} ${dragging === key ? "opacity-50" : ""} ${
              over === key && dragging !== key
                ? "ring-2 ring-blue-400 dark:ring-blue-500"
                : ""
            }`}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              setOver(key);
            }}
            onDrop={(e) => {
              if (!dragging) return;
              e.preventDefault();
              move(dragging, i);
              end();
            }}
          >
            {renderRow(item, i, handle)}
          </Row>
        );
      })}
    </>
  );
}
