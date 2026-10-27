"use client";

import { useState } from "react";
import { HiCheckCircle, HiExclamation, HiXCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Panel } from "@/features/symptoms/maintainer/symptom-side-panels";
import type { EventField, RuleFinding } from "./conversations-types";
import { ruleFindingText } from "./rule-findings";

/** The server's review of the last saved draft; null before the first save. */
export function RuleReviewPanel({
  findings,
  d,
}: Readonly<{ findings: RuleFinding[] | null; d: I18nRecord }>) {
  if (!findings) {
    return (
      <Panel title={tr("review", d)}>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("reviewPending", d)}
        </p>
      </Panel>
    );
  }
  const errors = findings.filter((f) => f.severity === "ERROR");
  const warnings = findings.filter((f) => f.severity === "WARNING");
  const ok = errors.length === 0;
  return (
    <Panel title={tr("review", d)}>
      <p
        className={`flex items-center gap-1.5 text-sm font-medium ${ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
      >
        {ok ? (
          <HiCheckCircle aria-hidden className="h-4 w-4" />
        ) : (
          <HiXCircle aria-hidden className="h-4 w-4" />
        )}
        {ok && tr("publishable", d)}
        {errors.length === 1 && tr("notPublishableOne", d)}
        {errors.length > 1 &&
          tr("notPublishable", d, { count: String(errors.length) })}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {[...errors, ...warnings].map((f) => (
          <li
            key={`${f.section}-${f.code ?? f.message}`}
            className="flex gap-1.5 text-xs text-gray-700 dark:text-gray-300"
          >
            <HiExclamation
              aria-hidden
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${f.severity === "ERROR" ? "text-red-500" : "text-yellow-500"}`}
            />
            {ruleFindingText(f, d)}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The event's variables; a click copies `{{name}}` for a template. */
export function VariablesPanel({
  variables,
  d,
}: Readonly<{ variables: EventField[]; d: I18nRecord }>) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`{{${name}}}`);
      setCopied(name);
    } catch {
      setCopied(null);
    }
  };
  return (
    <Panel title={tr("variables", d)}>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {tr("variablesHint", d)}
      </p>
      {variables.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("noVariables", d)}
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {variables.map((v) => (
          <li key={v.name}>
            <button
              type="button"
              title={v.description ?? undefined}
              onClick={() => void copy(v.name)}
              className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="shrink-0 font-mono text-gray-900 dark:text-gray-100">
                {`{{${v.name}}}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">
                {v.label}
              </span>
              {copied === v.name && (
                <span
                  role="status"
                  className="shrink-0 text-[10px] text-green-700 dark:text-green-400"
                >
                  {tr("copied", d)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
