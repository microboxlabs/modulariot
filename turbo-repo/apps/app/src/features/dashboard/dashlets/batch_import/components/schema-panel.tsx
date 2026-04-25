"use client";

import { memo, useState } from "react";
import { HiChevronDown, HiChevronRight, HiCheck, HiXMark } from "react-icons/hi2";
import type { IntrospectedParam } from "../engine/types";

interface SchemaPanelProps {
  params: IntrospectedParam[];
  /** Headers currently present in the (mapped) document. A param is considered
   *  "covered" when its name appears here. */
  mappedHeaders: string[];
  labels: {
    title: string;
    required: string;
    optional: string;
    colName: string;
    colType: string;
    colConstraints: string;
    present: string;
    missing: string;
    missingSummary: (missing: number, total: number) => string;
    allMappedSummary: (total: number) => string;
  };
}

function describeType(p: IntrospectedParam): string {
  if (p.enum && p.enum.length > 0) {
    return p.enum.length <= 5 ? p.enum.join(" | ") : `enum[${p.enum.length}]`;
  }
  if (p.format === "date-time") return "date-time";
  if (p.type === "integer") return "integer";
  if (p.type === "number") return "number";
  if (p.type === "boolean") return "boolean";
  return p.type || "string";
}

function describeBounds(p: IntrospectedParam): string | null {
  const parts: string[] = [];
  if (typeof p.minimum === "number") parts.push(`≥ ${p.minimum}`);
  if (typeof p.maximum === "number") parts.push(`≤ ${p.maximum}`);
  if (p.pattern) parts.push(`pattern: ${p.pattern}`);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Shows the schema the RPC expects (name, type, required flag, bounds),
 * plus a live check-mark / cross on each row so users can see at a glance
 * which expected fields are already covered by the current mapping and
 * which are still missing. Collapsed by default once everything is mapped;
 * auto-opens while required fields are still missing.
 */
export const SchemaPanel = memo(function SchemaPanel({
  params,
  mappedHeaders,
  labels,
}: Readonly<SchemaPanelProps>) {
  const presentSet = new Set(mappedHeaders);
  const required = params.filter((p) => p.required);
  const missingRequired = required.filter((p) => !presentSet.has(p.name));
  const autoOpen = missingRequired.length > 0;
  const [open, setOpen] = useState(autoOpen);

  const total = required.length;
  const summary =
    missingRequired.length === 0
      ? labels.allMappedSummary(total)
      : labels.missingSummary(missingRequired.length, total);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 text-xs dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/60"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <HiChevronDown className="h-4 w-4" />
          ) : (
            <HiChevronRight className="h-4 w-4" />
          )}
          {labels.title}
        </span>
        <span
          className={
            missingRequired.length === 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {summary}
        </span>
      </button>
      {open && (
        <div className="max-h-40 overflow-auto border-t border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse bg-transparent">
            <thead className="bg-gray-100 text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <tr>
                <th className="w-8 border-r border-gray-200 px-2 py-1 text-center dark:border-gray-700"></th>
                <th className="border-r border-gray-200 px-2 py-1 text-left dark:border-gray-700">
                  {labels.colName}
                </th>
                <th className="border-r border-gray-200 px-2 py-1 text-left dark:border-gray-700">
                  {labels.colType}
                </th>
                <th className="border-r border-gray-200 px-2 py-1 text-left dark:border-gray-700">
                  {labels.required} / {labels.optional}
                </th>
                <th className="px-2 py-1 text-left">{labels.colConstraints}</th>
              </tr>
            </thead>
            <tbody className="bg-transparent">
              {params.map((p) => {
                const present = presentSet.has(p.name);
                const bounds = describeBounds(p);
                return (
                  <tr
                    key={p.name}
                    className="border-t border-gray-200 bg-transparent text-xs text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    <td className="border-r border-gray-200 px-2 py-1 text-center dark:border-gray-700">
                      {present ? (
                        <HiCheck
                          className="inline h-4 w-4 text-green-600 dark:text-green-400"
                          aria-label={labels.present}
                        />
                      ) : (
                        <HiXMark
                          className={`inline h-4 w-4 ${
                            p.required
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                          aria-label={labels.missing}
                        />
                      )}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1 font-mono text-gray-800 dark:border-gray-700 dark:text-gray-100">
                      {p.name}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1 text-gray-600 dark:border-gray-700 dark:text-gray-400">
                      {describeType(p)}
                    </td>
                    <td className="border-r border-gray-200 px-2 py-1 dark:border-gray-700">
                      {p.required ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          {labels.required}
                        </span>
                      ) : (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {labels.optional}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-500 dark:text-gray-400">
                      {bounds ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
