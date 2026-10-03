"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Preview, SamplePreview } from "./maintainer-api";

const navClass =
  "rounded border border-gray-300 px-1.5 text-xs disabled:opacity-40 dark:border-gray-600";

function valueText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function mark(holds: boolean | null) {
  if (holds === true)
    return {
      sign: "✓",
      cls: "text-green-600 dark:text-green-400",
      key: "clauseHolds",
    };
  if (holds === false)
    return {
      sign: "✕",
      cls: "text-red-600 dark:text-red-400",
      key: "clauseFails",
    };
  return {
    sign: "!",
    cls: "text-yellow-700 dark:text-yellow-400",
    key: "clauseError",
  };
}

/** "Abre un caso · medida 22 → Código negro", or why it does not. */
export function verdict(s: SamplePreview, d: I18nRecord): string {
  if (s.error) return s.error;
  if (!s.activates) return tr("verdictNoCase", d);
  const level = s.level
    ? trDynamic(`levelName${s.level}`, d)
    : tr("verdictNoLevel", d);
  if (s.measure === null) return tr("verdictCaseLevel", d, { level });
  return tr("verdictCaseMeasure", d, { measure: String(s.measure), level });
}

/** One sample at a time: each activation condition with ✓ or ✕ and the values it read, then the verdict. */
export default function ClauseBreakdown({
  preview,
  index: shown,
  d,
}: Readonly<{
  preview: Preview | undefined;
  /** The sample to show, when something else picks it; the breakdown then has no ‹ ›. */
  index?: number;
  d: I18nRecord;
}>) {
  const [index, setIndex] = useState(0);
  const samples = preview?.samples ?? [];
  if (samples.length === 0) return null;
  const at = Math.min(shown ?? index, samples.length - 1);
  const sample = samples[at] as SamplePreview;
  const clauses = sample.clauses ?? [];
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium uppercase tracking-wide">
          {tr("clauseByClause", d)}
        </span>
        {shown === undefined && (
          <>
            <span className="ml-auto">
              {tr("sampleOf", d, {
                n: String(at + 1),
                total: String(samples.length),
              })}
            </span>
            <button
              type="button"
              aria-label={tr("previousSample", d)}
              className={navClass}
              disabled={at === 0}
              onClick={() => setIndex(at - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={tr("nextSample", d)}
              className={navClass}
              disabled={at === samples.length - 1}
              onClick={() => setIndex(at + 1)}
            >
              ›
            </button>
          </>
        )}
      </div>
      {clauses.length === 0 ? (
        <p className="text-xs text-gray-500">{tr("noClauses", d)}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {clauses.map((c) => {
            const m = mark(c.holds);
            return (
              <li key={c.text} className="flex flex-wrap items-baseline gap-2">
                <span
                  aria-hidden
                  className={`w-4 text-center font-semibold ${m.cls}`}
                >
                  {m.sign}
                </span>
                <span className="sr-only">{trDynamic(m.key, d)}</span>
                <code className="text-xs">{c.text}</code>
                <span className="text-xs text-gray-500">
                  {c.error ??
                    Object.entries(c.values)
                      .map(([path, v]) => `${path} = ${valueText(v)}`)
                      .join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-900/50">
        {verdict(sample, d)}
      </p>
    </div>
  );
}
