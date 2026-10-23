"use client";

import { ToggleSwitch } from "flowbite-react";
import { HiChevronRight } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { NumberValue } from "./activation-form";
import CelEditor, { type CelField } from "./cel-editor";
import {
  type Bound,
  type LevelThresholds,
  type LowerOp,
  type Range,
  type UpperOp,
  compileThresholds,
  DEFAULT_LEVEL_RULE,
  parseThresholds,
} from "./level-thresholds";
import type {
  Finding,
  Level,
  LevelResponse,
  SymptomSpec,
} from "./maintainer-api";
import { Problems, problemsFor } from "./rule-problems";
import { CHANGED_ROW } from "./ui/changed";
import { LevelIcon } from "./ui/level-icon";
import Select from "./ui/select";

export type EditMode = "form" | "expr";

export const EMPTY_RESPONSE: LevelResponse = {
  operator: false,
  slaMinutes: null,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: true,
};

const pillClass =
  "rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

/** The level as stored, or an empty one that does not apply. */
export function levelOf(spec: SymptomSpec, icu: number): Level {
  return (
    (spec.levels ?? []).find((l) => l.icu === icu) ?? {
      icu,
      applies: false,
      when: "",
      response: EMPTY_RESPONSE,
    }
  );
}

/** The spec with `level` in place of the level of the same ICU, levels in order. */
export function withLevel(spec: SymptomSpec, level: Level): SymptomSpec {
  const others = (spec.levels ?? []).filter((l) => l.icu !== level.icu);
  return { ...spec, levels: [...others, level].sort((a, b) => a.icu - b.icu) };
}

function BoundInput<Op extends string>({
  bound,
  ops,
  label,
  readOnly,
  onChange,
}: Readonly<{
  bound: Bound<Op>;
  ops: Op[];
  label: string;
  readOnly: boolean;
  onChange: (bound: Bound<Op>) => void;
}>) {
  const symbol: Record<string, string> = {
    ">": ">",
    ">=": "≥",
    "==": "=",
    "<": "<",
    "<=": "≤",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Select
        aria-label={`${label} · operador`}
        className={pillClass}
        disabled={readOnly}
        value={bound.op}
        onChange={(e) => onChange({ ...bound, op: e.target.value as Op })}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {symbol[op]}
          </option>
        ))}
      </Select>
      <NumberValue
        value={bound.value}
        unit={null}
        label={label}
        readOnly={readOnly}
        onChange={(value) => onChange({ ...bound, value })}
      />
    </span>
  );
}

function RangeInputs({
  range,
  name,
  unit,
  lowerOps,
  readOnly,
  d,
  onChange,
}: Readonly<{
  range: Range;
  lowerOps: LowerOp[];
  name: string;
  unit: string | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (range: Range) => void;
}>) {
  if (!range.lower && !range.upper) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-gray-500 dark:text-gray-400">{name}</span>
      {range.lower && (
        <BoundInput<LowerOp>
          bound={range.lower}
          ops={lowerOps}
          label={`${name} ${tr("from", d)}`}
          readOnly={readOnly}
          onChange={(lower) =>
            onChange({
              lower,
              upper: lower.op === "==" ? null : range.upper,
            })
          }
        />
      )}
      {range.lower && range.upper && (
        <span className="text-gray-500 dark:text-gray-400">{tr("and", d)}</span>
      )}
      {range.upper && (
        <BoundInput<UpperOp>
          bound={range.upper}
          ops={["<", "<="]}
          label={`${name} ${tr("upTo", d)}`}
          readOnly={readOnly}
          onChange={(upper) => onChange({ ...range, upper })}
        />
      )}
      {unit && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{unit}</span>
      )}
    </span>
  );
}

/** A level's thresholds as inline inputs: the measure range, then the hold time. */
export function ThresholdInputs({
  thresholds,
  measureName = null,
  unit,
  readOnly,
  d,
  onChange,
}: Readonly<{
  thresholds: LevelThresholds;
  /** The measure's name, shown in place of "medida". */
  measureName?: string | null;
  unit: string | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (thresholds: LevelThresholds) => void;
}>) {
  const { measure, held } = thresholds;
  const none = !measure.lower && !measure.upper && !held.lower && !held.upper;
  if (none)
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {tr("always", d)}
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
      <RangeInputs
        range={measure}
        name={measureName ?? tr("measureWord", d)}
        unit={unit}
        lowerOps={[">", ">=", "=="]}
        readOnly={readOnly}
        d={d}
        onChange={(m) => onChange({ ...thresholds, measure: m })}
      />
      <RangeInputs
        range={held}
        name={tr("heldWord", d)}
        unit="s"
        lowerOps={[">", ">="]}
        readOnly={readOnly}
        d={d}
        onChange={(h) => onChange({ ...thresholds, held: h })}
      />
    </span>
  );
}

export function ResponseSummary({
  response,
  d,
}: Readonly<{ response: LevelResponse; d: I18nRecord }>) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs ${response.operator ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}
    >
      {response.operator
        ? tr("operatorSla", d, { minutes: String(response.slaMinutes ?? "") })
        : tr("noOperator", d)}
    </span>
  );
}

/** The rule column of a level: inline thresholds in form mode, CEL otherwise or when the form cannot show it. */
function LevelRule({
  level,
  mode,
  measureName,
  unit,
  fields,
  problems,
  readOnly,
  d,
  onChange,
}: Readonly<{
  level: Level;
  mode: EditMode;
  measureName: string | null;
  unit: string | null;
  fields: CelField[];
  problems: ReturnType<typeof problemsFor>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (when: string) => void;
}>) {
  const thresholds = mode === "form" ? parseThresholds(level.when) : null;
  if (thresholds) {
    return (
      <ThresholdInputs
        thresholds={thresholds}
        measureName={measureName}
        unit={unit}
        readOnly={readOnly}
        d={d}
        onChange={(t) => onChange(compileThresholds(t))}
      />
    );
  }
  if (mode === "form" && !level.when?.trim()) {
    return (
      <span className="text-sm text-red-600 dark:text-red-400">
        {tr("levelRuleMissing", d)}
      </span>
    );
  }
  if (mode === "form") {
    return (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
        {level.when}
      </code>
    );
  }
  return (
    <div className="min-w-0 flex-1">
      <CelEditor
        singleLine
        readOnly={readOnly}
        ariaLabel={tr("levelRule", d)}
        value={level.when ?? ""}
        fields={fields}
        problems={problems}
        onChange={onChange}
      />
    </div>
  );
}

/** One level: its icon, rule and a summary of the response, which is set up under "Respuesta". */
export default function LevelRow({
  spec,
  changed = false,
  reached = false,
  icu,
  mode,
  fields,
  findings,
  readOnly,
  d,
  onChange,
  onConfigureResponse,
}: Readonly<{
  spec: SymptomSpec;
  /** The level differs from the published version. */
  changed?: boolean;
  /** The previewed sample reaches this level; marked with a ✓. */
  reached?: boolean;
  icu: number;
  mode: EditMode;
  fields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
  onConfigureResponse: (icu: number) => void;
}>) {
  const level = levelOf(spec, icu);
  const response = level.response ?? EMPTY_RESPONSE;
  const set = (patch: Partial<Level>) =>
    onChange(withLevel(spec, { ...level, ...patch }));
  const problems = problemsFor(findings, `levels.${icu}`, d);
  const responseProblems = problemsFor(findings, `levels.${icu}.response`, d);
  const name = trDynamic(`levelName${icu}`, d);

  return (
    <div
      className={`last:rounded-b-lg ${changed ? CHANGED_ROW : ""}`}
      data-changed={changed || undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <LevelIcon
          icu={icu}
          label={name}
          size="h-8 w-8"
          empty={!level.applies}
        />
        <span className="w-36 font-medium text-gray-900 dark:text-white">
          {name}
        </span>
        <ToggleSwitch
          checked={level.applies}
          disabled={readOnly}
          label={tr("levelApplies", d)}
          onChange={(applies) =>
            set({
              applies,
              when:
                level.when ||
                (spec.measure?.expression ? DEFAULT_LEVEL_RULE : "true"),
            })
          }
        />
        {level.applies && (
          <LevelRule
            level={level}
            mode={mode}
            measureName={
              spec.measure?.expression ? (spec.measure.label ?? null) : null
            }
            unit={spec.measure?.expression ? (spec.measure.unit ?? null) : null}
            fields={fields}
            problems={problems}
            readOnly={readOnly}
            d={d}
            onChange={(when) => set({ when })}
          />
        )}
        {reached && (
          <span className="font-semibold text-green-600 dark:text-green-400">
            <span aria-hidden>✓</span>
            <span className="sr-only">{tr("levelReached", d)}</span>
          </span>
        )}
        {level.applies && (
          <span className="ml-auto flex items-center gap-3">
            <ResponseSummary response={response} d={d} />
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              onClick={() => onConfigureResponse(icu)}
            >
              {tr("configureResponse", d)}
              <HiChevronRight className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>
      {level.applies && (
        <div className="px-4 pb-2">
          <Problems items={[...problems, ...responseProblems]} />
        </div>
      )}
    </div>
  );
}
