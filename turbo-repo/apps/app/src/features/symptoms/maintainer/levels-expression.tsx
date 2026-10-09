"use client";

import { useMemo, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import CelEditor, { type CelField } from "./cel-editor";
import { verdict } from "./clause-breakdown";
import { levelOf, withLevel } from "./level-row";
import type {
  Finding,
  Preview,
  SourceField,
  SymptomSpec,
} from "./maintainer-api";
import { Problems, problemsFor } from "./rule-problems";
import SampleTree, { unsupportedPaths, useSourceSamples } from "./sample-tree";
import { ICU_LEVELS } from "./symptom-labels";
import { LevelIcon } from "./ui/level-icon";

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";

/**
 * "Qué tan grave es" in { } mode: a sample beside the measure and each level's
 * threshold as CEL, with a ✓ on the level the sample reaches.
 */
export default function LevelsExpression({
  spec,
  preview,
  fields,
  sourceFields,
  levelFields,
  findings,
  readOnly,
  d,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  /** The preview of the spec on screen; undefined while it is being made. */
  preview: Preview | undefined;
  fields: SourceField[];
  sourceFields: CelField[];
  /** The source fields plus `medida` and `sostenido_s`. */
  levelFields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const samples = useSourceSamples(preview, spec.source);
  const notInEngine = useMemo(() => unsupportedPaths(fields), [fields]);
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(0, samples.length - 1));
  const shown = preview?.samples[at];
  const measure = spec.measure ?? { expression: "", label: null, unit: null };
  const measureProblems = problemsFor(findings, "measure");
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <SampleTree
        samples={samples.map((s) => s.sample)}
        index={at}
        notInEngine={notInEngine}
        readOnly={readOnly}
        d={d}
        onIndex={setIndex}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <span className={labelClass}>{tr("measureCelLabel", d)}</span>
        <CelEditor
          singleLine
          readOnly={readOnly}
          ariaLabel={tr("measureCelLabel", d)}
          value={measure.expression ?? ""}
          fields={sourceFields}
          problems={measureProblems}
          onChange={(expression) =>
            onChange({ ...spec, measure: { ...measure, expression } })
          }
        />
        <Problems items={measureProblems} />
        <span className={labelClass}>{tr("levelsCelLabel", d)}</span>
        {ICU_LEVELS.map(({ icu }) => {
          const level = levelOf(spec, icu);
          if (!level.applies) return null;
          const name = trDynamic(`levelName${icu}`, d);
          const reached = shown?.activates && shown.level === icu;
          const problems = problemsFor(findings, `levels.${icu}`);
          return (
            <div key={icu} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <LevelIcon icu={icu} label={name} />
                <div className="min-w-0 flex-1">
                  <CelEditor
                    singleLine
                    readOnly={readOnly}
                    ariaLabel={`${tr("levelsCelLabel", d)} · ${name}`}
                    value={level.when ?? ""}
                    fields={levelFields}
                    problems={problems}
                    onChange={(when) =>
                      onChange(withLevel(spec, { ...level, when }))
                    }
                  />
                </div>
                <span
                  className={`w-4 text-center ${reached ? "font-semibold text-green-600 dark:text-green-400" : "text-gray-300 dark:text-gray-600"}`}
                >
                  <span aria-hidden>{reached ? "✓" : "·"}</span>
                  {reached && (
                    <span className="sr-only">{tr("levelReached", d)}</span>
                  )}
                </span>
              </div>
              <Problems items={problems} />
            </div>
          );
        })}
        {shown && (
          <p
            className={`rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-900/50 ${shown.activates && !shown.error ? "font-medium text-green-700 dark:text-green-400" : ""}`}
          >
            {verdict(shown, d)}
          </p>
        )}
      </div>
    </div>
  );
}
