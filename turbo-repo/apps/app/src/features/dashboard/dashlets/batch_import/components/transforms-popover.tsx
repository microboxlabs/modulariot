"use client";

import { useEffect, useRef, useState } from "react";
import { HiXMark, HiPlus } from "react-icons/hi2";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  TRANSFORM_REGISTRY,
  transformsForType,
  type TransformKind,
  type TransformStep,
} from "../engine/transforms";

interface Props {
  /** The mapped/effective column name these transforms attach to. */
  target: string;
  /** Expected schema type for the column ("string" | "number" | "integer" | …). */
  expectedType: string | undefined;
  /** Expected schema format ("date" | "date-time" | …). When set, switches
   *  the available transform list to date-scoped kinds and reveals the
   *  display-only format input below the transforms list. */
  expectedFormat: string | undefined;
  steps: readonly TransformStep[];
  /** Current display-only format string for date columns (dayjs tokens).
   *  Empty when unset. Display formats are NOT transforms — they only change
   *  rendering, never the value submitted to the server. */
  dateDisplayFormat: string;
  onChange: (next: TransformStep[]) => void;
  /** Update the display-only format. Pass empty string to clear. */
  onDateDisplayFormatChange: (value: string) => void;
  onClose: () => void;
  dictionary: I18nRecord;
}

export function TransformsPopover({
  target,
  expectedType,
  expectedFormat,
  steps,
  dateDisplayFormat,
  onChange,
  onDateDisplayFormatChange,
  onClose,
  dictionary,
}: Readonly<Props>) {
  const ref = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState<TransformKind | null>(null);
  const [arg, setArg] = useState("");

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const available = transformsForType(expectedType, expectedFormat);
  const isDateColumn =
    expectedFormat === "date" || expectedFormat === "date-time";

  const removeAt = (idx: number) => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const addStep = (kind: TransformKind) => {
    if (TRANSFORM_REGISTRY[kind].takesArg) {
      setPicking(kind);
      setArg(kind === "fixed" ? "2" : "");
      return;
    }
    onChange([...steps, { kind }]);
  };

  const commitParameterized = () => {
    if (!picking) return;
    onChange([...steps, { kind: picking, arg: arg.trim() }]);
    setPicking(null);
    setArg("");
  };

  const tk = (k: TransformKind) =>
    tr(`dashboard.dashlets.batchImport.transforms.kinds.${k}`, dictionary);

  return (
    // The document `mousedown` listener uses `ref.current?.contains` to
    // ignore events originating inside the popover, so we don't need a
    // local `stopPropagation` to keep outside-click closing accurate. That
    // also keeps this container free of synthetic interactivity, which
    // would otherwise require ARIA roles (eslint: jsx-a11y/no-static-element-interactions).
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-gray-700 dark:text-gray-200">
          {tr("dashboard.dashlets.batchImport.transforms.title", dictionary)}
        </span>
        <span className="truncate text-[10px] text-gray-500 dark:text-gray-400">
          {target}
        </span>
      </div>

      {steps.length === 0 ? (
        <p className="mb-2 text-gray-500 dark:text-gray-400">
          {tr("dashboard.dashlets.batchImport.transforms.empty", dictionary)}
        </p>
      ) : (
        <ol className="mb-2 flex flex-col gap-1">
          {steps.map((s, i) => (
            <li
              key={`${s.kind}-${i}`}
              className="flex items-center justify-between rounded bg-gray-100 px-2 py-1 dark:bg-gray-700"
            >
              <span>
                <strong className="font-semibold">{tk(s.kind)}</strong>
                {s.arg ? <span className="ml-1 text-gray-500">({s.arg})</span> : null}
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-gray-500 hover:text-red-600 dark:text-gray-400"
                aria-label={tr(
                  "dashboard.dashlets.batchImport.transforms.remove",
                  dictionary,
                )}
              >
                <HiXMark className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {picking ? (
        <div className="flex flex-col gap-2">
          <label className="text-gray-600 dark:text-gray-300">
            {tr(
              `dashboard.dashlets.batchImport.transforms.argLabel.${picking}`,
              dictionary,
            )}
          </label>
          <input
            value={arg}
            onChange={(e) => setArg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitParameterized();
              }
            }}
            inputMode="numeric"
            autoFocus
            className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setPicking(null);
                setArg("");
              }}
              className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {tr("common.cancel", dictionary)}
            </button>
            <button
              type="button"
              onClick={commitParameterized}
              className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
            >
              {tr("dashboard.dashlets.batchImport.transforms.add", dictionary)}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addStep(k)}
              className="inline-flex items-center gap-0.5 rounded border border-gray-300 px-2 py-1 text-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <HiPlus className="h-3 w-3" />
              {tk(k)}
            </button>
          ))}
        </div>
      )}

      {isDateColumn && (
        <div className="mt-3 border-t border-gray-200 pt-2 dark:border-gray-700">
          <label
            htmlFor={`${target}-display-format`}
            className="mb-1 block font-semibold text-gray-700 dark:text-gray-200"
          >
            {tr(
              "dashboard.dashlets.batchImport.transforms.displayFormat",
              dictionary,
            )}
          </label>
          <input
            id={`${target}-display-format`}
            value={dateDisplayFormat}
            onChange={(e) => onDateDisplayFormatChange(e.target.value)}
            placeholder="DD/MM HH:mm"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {tr(
              "dashboard.dashlets.batchImport.transforms.displayFormatHint",
              dictionary,
            )}
          </p>
        </div>
      )}
    </div>
  );
}
