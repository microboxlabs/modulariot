"use client";

import { useMemo } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import CelEditor, { type CelField } from "./cel-editor";
import { verdict } from "./clause-breakdown";
import type {
  Finding,
  Preview,
  SourceField,
  SymptomSpec,
} from "./maintainer-api";
import { Problems, problemsFor } from "./rule-problems";
import SampleTree, { unsupportedPaths, useSourceSamples } from "./sample-tree";

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";

/**
 * "Qué tan grave es" in { } mode: a sample beside the measure and the level
 * the sample reaches. Each level's threshold is edited in its own row.
 */
export default function LevelsExpression({
  spec,
  preview,
  index,
  fields,
  sourceFields,
  findings,
  readOnly,
  d,
  onIndex,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  /** The preview of the spec on screen; undefined while it is being made. */
  preview: Preview | undefined;
  /** The sample shown, also marked on the level rows. */
  index: number;
  fields: SourceField[];
  sourceFields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onIndex: (index: number) => void;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const samples = useSourceSamples(preview, spec.source);
  const notInEngine = useMemo(() => unsupportedPaths(fields), [fields]);
  const shown = preview?.samples[index];
  const measure = spec.measure ?? { expression: "", label: null, unit: null };
  const measureProblems = problemsFor(findings, "measure", d);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <SampleTree
        samples={samples.map((s) => s.sample)}
        index={index}
        notInEngine={notInEngine}
        readOnly={readOnly}
        d={d}
        onIndex={onIndex}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <span className={labelClass}>{tr("measureCelLabel", d)}</span>
        <CelEditor
          singleLine
          readOnly={readOnly}
          ariaLabel={tr("measureCelLabel", d)}
          placeholder={tr("noMeasure", d)}
          value={measure.expression ?? ""}
          fields={sourceFields}
          problems={measureProblems}
          onChange={(expression) =>
            onChange({
              ...spec,
              measure: { ...measure, expression: expression.trim() || null },
            })
          }
        />
        <Problems items={measureProblems} />
        {shown && !(shown.error && measureProblems.length > 0) && (
          <p
            className={`rounded bg-gray-50 px-2 py-1 text-sm dark:bg-gray-900/50 ${shown.activates && !shown.error ? "font-medium text-green-700 dark:text-green-400" : ""}`}
          >
            {verdict(shown, d)}
          </p>
        )}
      </div>
    </div>
  );
}
