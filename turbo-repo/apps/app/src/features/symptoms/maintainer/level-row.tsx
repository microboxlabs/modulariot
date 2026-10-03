"use client";

import { useState } from "react";
import { ToggleSwitch } from "flowbite-react";
import { HiChevronDown, HiChevronRight } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import { NumberValue } from "./activation-form";
import CelEditor, { type CelField } from "./cel-editor";
import {
  type Bound,
  type LevelThresholds,
  type LowerOp,
  type Range,
  type UpperOp,
  compileThresholds,
  parseThresholds,
} from "./level-thresholds";
import LevelNotices, { CHANNELS } from "./level-notices";
import LevelResponseOptions from "./level-response-options";
import LevelSteps from "./level-steps";
import type {
  Finding,
  Level,
  LevelResponse,
  SymptomSpec,
} from "./maintainer-api";
import { Problems, problemsFor } from "./rule-problems";
import { ChannelIcon } from "./ui/channel-icon";
import { LevelIcon } from "./ui/level-icon";

export type EditMode = "form" | "expr";

const EMPTY_RESPONSE: LevelResponse = {
  operator: false,
  slaMinutes: null,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: true,
};

const pillClass =
  "rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";
const inputClass =
  "w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

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
    "<": "<",
    "<=": "≤",
  };
  return (
    <span className="inline-flex items-center gap-1">
      <select
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
      </select>
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
  readOnly,
  d,
  onChange,
}: Readonly<{
  range: Range;
  name: string;
  unit: string | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (range: Range) => void;
}>) {
  if (!range.lower && !range.upper) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-gray-500">{name}</span>
      {range.lower && (
        <BoundInput<LowerOp>
          bound={range.lower}
          ops={[">", ">="]}
          label={`${name} ${tr("from", d)}`}
          readOnly={readOnly}
          onChange={(lower) => onChange({ ...range, lower })}
        />
      )}
      {range.lower && range.upper && (
        <span className="text-gray-500">{tr("and", d)}</span>
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
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </span>
  );
}

/** A level's thresholds as inline inputs: the measure range, then the hold time. */
export function ThresholdInputs({
  thresholds,
  unit,
  readOnly,
  d,
  onChange,
}: Readonly<{
  thresholds: LevelThresholds;
  unit: string | null;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (thresholds: LevelThresholds) => void;
}>) {
  const { measure, held } = thresholds;
  const none = !measure.lower && !measure.upper && !held.lower && !held.upper;
  if (none)
    return <span className="text-sm text-gray-500">{tr("always", d)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-200">
      <RangeInputs
        range={measure}
        name={tr("measureWord", d)}
        unit={unit}
        readOnly={readOnly}
        d={d}
        onChange={(m) => onChange({ ...thresholds, measure: m })}
      />
      <RangeInputs
        range={held}
        name={tr("heldWord", d)}
        unit="s"
        readOnly={readOnly}
        d={d}
        onChange={(h) => onChange({ ...thresholds, held: h })}
      />
    </span>
  );
}

function ResponseSummary({
  response,
  d,
}: Readonly<{ response: LevelResponse; d: I18nRecord }>) {
  const channels = [...new Set((response.notices ?? []).map((n) => n.channel))];
  return (
    <span className="flex items-center gap-2 text-xs">
      <span
        className={`rounded-md px-2 py-0.5 ${response.operator ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}
      >
        {response.operator
          ? tr("operatorSla", d, { minutes: String(response.slaMinutes ?? "") })
          : tr("noOperator", d)}
      </span>
      <span className="flex -space-x-1">
        {channels.map((c) => {
          const key = CHANNELS.find((ch) => ch.key === c)?.label;
          const label = key ? trDynamic(key, d) : c;
          return (
            <span
              key={c}
              className="rounded-md ring-2 ring-white dark:ring-gray-800"
            >
              <ChannelIcon channel={c} label={label} size={5} />
              <span className="sr-only">{label}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** The rule column of a level: inline thresholds in form mode, CEL otherwise or when the form cannot show it. */
function LevelRule({
  level,
  mode,
  unit,
  fields,
  problems,
  readOnly,
  d,
  onChange,
}: Readonly<{
  level: Level;
  mode: EditMode;
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

/** What the operator must record to close a case, as stored in the spec. */
export const EVIDENCE = [
  { value: "call_result", label: "evidenceCallResult" },
  { value: "note", label: "evidenceNote" },
  { value: "photo", label: "evidencePhoto" },
];

function EvidenceSelect({
  evidence,
  readOnly,
  d,
  onChange,
}: Readonly<{
  evidence: string[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (evidence: string[]) => void;
}>) {
  const value = evidence[0] ?? "";
  const known = value === "" || EVIDENCE.some((e) => e.value === value);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      <span>{tr("closeRequires", d)}</span>
      <select
        className={pillClass}
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
      >
        <option value="">{tr("evidenceNothing", d)}</option>
        {!known && <option value={value}>{value}</option>}
        {EVIDENCE.map((e) => (
          <option key={e.value} value={e.value}>
            {trDynamic(e.label, d)}
          </option>
        ))}
      </select>
    </label>
  );
}

function OperatorDetail({
  response,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("operatorHandling", d)}
        </span>
        <span className="ml-auto">
          <ToggleSwitch
            checked={response.operator}
            disabled={readOnly}
            label={tr("requiresOperator", d)}
            onChange={(operator) =>
              onChange({
                operator,
                slaMinutes: operator ? (response.slaMinutes ?? 5) : null,
              })
            }
          />
        </span>
      </div>
      {response.operator ? (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span>{tr("attendWithin", d)}</span>
            <input
              type="number"
              min={1}
              className={inputClass}
              disabled={readOnly}
              value={response.slaMinutes ?? ""}
              onChange={(e) =>
                onChange({
                  slaMinutes: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <span>min</span>
          </label>
          <LevelSteps
            steps={response.steps ?? []}
            slaMinutes={response.slaMinutes}
            readOnly={readOnly}
            d={d}
            onChange={(steps) => onChange({ steps })}
          />
          <EvidenceSelect
            evidence={response.evidence ?? []}
            readOnly={readOnly}
            d={d}
            onChange={(evidence) => onChange({ evidence })}
          />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-600">
          {tr("nobodyHandles", d)}
        </p>
      )}
      <LevelResponseOptions
        response={response}
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />
    </div>
  );
}

/** One level: a summary line (icon, thresholds, operator, channels) that opens into notices and operator handling. */
export default function LevelRow({
  spec,
  changed = false,
  showProblems = true,
  icu,
  mode,
  fields,
  findings,
  readOnly,
  connections,
  lang,
  d,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  /** The level differs from the published version. */
  changed?: boolean;
  /** False when the level's problems are shown elsewhere, as under the { } editors. */
  showProblems?: boolean;
  icu: number;
  mode: EditMode;
  fields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  connections: IntegrationConnection[];
  lang: string;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const [open, setOpen] = useState(false);
  const level = levelOf(spec, icu);
  const response = level.response ?? EMPTY_RESPONSE;
  const set = (patch: Partial<Level>) =>
    onChange(withLevel(spec, { ...level, ...patch }));
  const setResponse = (patch: Partial<LevelResponse>) =>
    set({ response: { ...response, ...patch } });
  const problems = problemsFor(findings, `levels.${icu}`);
  const name = trDynamic(`levelName${icu}`, d);

  return (
    <div
      className={`${open ? "bg-gray-50 dark:bg-gray-900/40" : ""} ${changed ? "rounded-md bg-amber-50/70 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:ring-amber-600/60" : ""}`}
      data-changed={changed || undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-3">
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
            set({ applies, when: level.when || "medida > 0" })
          }
        />
        {level.applies && (
          <LevelRule
            level={level}
            mode={mode}
            unit={spec.measure?.unit ?? null}
            fields={fields}
            problems={problems}
            readOnly={readOnly}
            d={d}
            onChange={(when) => set({ when })}
          />
        )}
        {level.applies && (
          <span className="ml-auto flex items-center gap-2">
            <ResponseSummary response={response} d={d} />
            <button
              type="button"
              aria-expanded={open}
              aria-label={
                open ? tr("hideLevelDetail", d) : tr("showLevelDetail", d)
              }
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? (
                <HiChevronDown className="h-4 w-4" />
              ) : (
                <HiChevronRight className="h-4 w-4" />
              )}
            </button>
          </span>
        )}
      </div>
      {level.applies && showProblems && <Problems items={problems} />}
      {level.applies && open && (
        <div className="grid grid-cols-1 gap-5 px-1 pb-4 lg:grid-cols-2">
          <LevelNotices
            notices={response.notices ?? []}
            connections={connections}
            lang={lang}
            readOnly={readOnly}
            d={d}
            onChange={(notices) => setResponse({ notices })}
          />
          <OperatorDetail
            response={response}
            readOnly={readOnly}
            d={d}
            onChange={setResponse}
          />
        </div>
      )}
    </div>
  );
}
