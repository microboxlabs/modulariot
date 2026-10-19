"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import type { CasePreview, Preview, SymptomSpec } from "./maintainer-api";
import { Problems } from "./rule-problems";
import SampleTree from "./sample-tree";

type Lifecycle = NonNullable<SymptomSpec["lifecycle"]>;

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";

/** What the lifecycle does on one case moment, or why it could not run. */
export function caseOutcome(c: CasePreview, d: I18nRecord): string {
  if (c.error) return c.error;
  return c.outcome ? trDynamic(`caseOutcome_${c.outcome}`, d) : "";
}

/**
 * "Ciclo del caso" in { } mode: a few case moments as a tree beside the open
 * and close rules, and what the rules do on the moment shown.
 */
export default function LifecycleExpression({
  lifecycle,
  preview,
  fields,
  openProblems,
  closeProblems,
  readOnly,
  d,
  onChange,
}: Readonly<{
  lifecycle: Lifecycle;
  /** The preview of the spec on screen; undefined while it is being made. */
  preview: Preview | undefined;
  fields: CelField[];
  openProblems: CelProblem[];
  closeProblems: CelProblem[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (lifecycle: Lifecycle) => void;
}>) {
  // The moments are the same for every spec, so the tree keeps the last ones while a preview loads.
  const [cached, setCached] = useState(preview);
  if (preview && preview !== cached) setCached(preview);
  const cases = cached?.cases ?? [];
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(0, cases.length - 1));
  const shown = preview?.cases?.[at];
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <SampleTree
        samples={cases.map((c) => c.sample)}
        labels={cases.map((c) => trDynamic(`caseScenario_${c.scenario}`, d))}
        index={at}
        readOnly={readOnly}
        d={d}
        onIndex={setIndex}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <span className={labelClass}>{tr("opensCelLabel", d)}</span>
        <CelEditor
          singleLine
          readOnly={readOnly}
          ariaLabel={tr("opensCelLabel", d)}
          value={lifecycle.open ?? ""}
          fields={fields}
          problems={openProblems}
          onChange={(open) => onChange({ ...lifecycle, open })}
        />
        <Problems items={openProblems} />
        <span className={labelClass}>{tr("closesCelLabel", d)}</span>
        <CelEditor
          singleLine
          readOnly={readOnly}
          ariaLabel={tr("closesCelLabel", d)}
          value={lifecycle.close ?? ""}
          fields={fields}
          problems={closeProblems}
          onChange={(close) => onChange({ ...lifecycle, close })}
        />
        <Problems items={closeProblems} />
        {shown && (
          <p className="rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-900/50">
            {caseOutcome(shown, d)}
          </p>
        )}
      </div>
    </div>
  );
}
