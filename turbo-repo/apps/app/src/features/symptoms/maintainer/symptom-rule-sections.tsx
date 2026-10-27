"use client";

import { useMemo, useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import ActivationForm, { useActivationForm } from "./activation-form";
import ClauseBreakdown from "./clause-breakdown";
import LevelsExpression from "./levels-expression";
import MeasureFields from "./measure-fields";
import { levelsUseMeasure, withoutMeasure } from "./measure-form";
import LifecycleExpression from "./lifecycle-expression";
import SampleTree, {
  firstOpening,
  unsupportedPaths,
  useSourceSamples,
} from "./sample-tree";
import { SourceHelp, SourceSelect } from "./source-select";
import { changedPaths, isChanged } from "./ui/changed";
import {
  type Finding,
  type Preview,
  type SourceField,
  type SymptomSpec,
  useDataSources,
} from "./maintainer-api";
import LevelRow, { type EditMode } from "./level-row";
import LifecycleFormFields, { LevelDownSelect } from "./lifecycle-form-fields";
import { parseClose, parseOpen } from "./lifecycle-form";
import RecurrenceForm from "./recurrence-form";
import { Problems, problemsFor } from "./rule-problems";
import RuleDescription, { RuleDescriptionToggle } from "./rule-description";
import { ICU_LEVELS } from "./symptom-labels";
import ModeToggle from "./ui/mode-toggle";
import NumberedSection from "./ui/section";

/** Variables a level rule adds to the source: the measure and how long it has held. */
export function levelFields(d: I18nRecord): CelField[] {
  return [
    { path: "measure", detail: tr("fieldMeasure", d) },
    { path: "held_s", detail: tr("fieldHeld", d) },
  ];
}

/** The case a lifecycle rule reads. */
export function caseFields(d: I18nRecord): CelField[] {
  return [
    { path: "case.condition_s", detail: tr("fieldCaseCondition", d) },
    { path: "case.normal_s", detail: tr("fieldCaseNormal", d) },
    { path: "case.age_h", detail: tr("fieldCaseAge", d) },
    { path: "case.level", detail: tr("fieldCaseLevel", d) },
    { path: "case.closed_by_operator", detail: tr("fieldCaseClosed", d) },
  ];
}

function Section({
  number,
  title,
  subtitle,
  describe,
  actions,
  changed = false,
  d,
  children,
}: Readonly<{
  /** The card's place on the sheet, shown in a badge before the title. */
  number: number;
  title: string;
  subtitle: string;
  describe?: { section: string; rule: string; sourceKey: string | null };
  actions?: React.ReactNode;
  /** Something in the section differs from the published version. */
  changed?: boolean;
  d: I18nRecord;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <NumberedSection
      number={number}
      title={title}
      subtitle={subtitle}
      changed={changed}
      actions={
        (actions || describe) && (
          <>
            {actions}
            {describe && (
              <RuleDescriptionToggle
                open={open}
                onToggle={() => setOpen((o) => !o)}
                d={d}
              />
            )}
          </>
        )
      }
    >
      {describe && open && (
        <RuleDescription
          section={describe.section}
          rule={describe.rule}
          sourceKey={describe.sourceKey}
          d={d}
        />
      )}
      {children}
    </NumberedSection>
  );
}

const NOTHING_CHANGED: ReadonlySet<string> = new Set();

/**
 * The ICU levels that differ between the draft and the published spec,
 * matched by ICU rather than by position: adding or removing one level does
 * not mark the others.
 */
export function changedLevels(
  draft: SymptomSpec,
  published: SymptomSpec | null | undefined
): ReadonlySet<number> {
  const out = new Set<number>();
  if (!published) return out;
  // A level that does not apply is compared only by that: the rule it keeps from being on is not a change.
  const levels = (spec: SymptomSpec) =>
    new Map(
      (spec.levels ?? []).map((l) => [
        l.icu,
        l.applies ? l : { icu: l.icu, applies: false },
      ])
    );
  const before = levels(published);
  const after = levels(draft);
  for (const icu of new Set([...before.keys(), ...after.keys()])) {
    const off = { icu, applies: false };
    if (changedPaths(after.get(icu) ?? off, before.get(icu) ?? off).size > 0)
      out.add(icu);
  }
  return out;
}

/** Cuándo se activa: the conditions as a form, or the CEL expression. */
function ActivationSection({
  spec,
  changed,
  preview,
  fields,
  sourceFields,
  problems,
  readOnly,
  d,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  changed: boolean;
  preview: Preview | undefined;
  fields: SourceField[];
  sourceFields: CelField[];
  problems: CelProblem[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const [mode, setMode] = useState<EditMode>("form");
  const [sourceHelp, setSourceHelp] = useState(false);
  const { data: sources } = useDataSources();
  const samples = useSourceSamples(preview, spec.source);
  const [sampleIndex, setSampleIndex] = useState<number | null>(null);
  const sampleAt = Math.min(
    sampleIndex ?? firstOpening(samples),
    Math.max(0, samples.length - 1)
  );
  const notInEngine = useMemo(() => unsupportedPaths(fields), [fields]);
  const activation = spec.activation ?? "";
  const { form, update } = useActivationForm(activation, fields, (value) =>
    onChange({ ...spec, activation: value })
  );
  return (
    <Section
      number={1}
      title={tr("sectionActivation", d)}
      subtitle={tr("sectionActivationSub", d)}
      changed={changed}
      d={d}
      actions={
        <span className="flex items-center gap-3">
          <SourceSelect
            value={spec.source}
            sources={sources ?? []}
            readOnly={readOnly}
            helpOpen={sourceHelp}
            d={d}
            onChange={(source) => onChange({ ...spec, source })}
            onToggleHelp={() => setSourceHelp((o) => !o)}
          />
          <ModeToggle mode={mode} d={d} onChange={setMode} />
        </span>
      }
      describe={{
        section: "activation",
        rule: activation,
        sourceKey: spec.source,
      }}
    >
      {sourceHelp && (
        <SourceHelp
          source={(sources ?? []).find((x) => x.key === spec.source)}
          d={d}
        />
      )}
      {mode === "form" && form && (
        <ActivationForm
          form={form}
          fields={fields}
          readOnly={readOnly}
          d={d}
          onChange={update}
        />
      )}
      {mode === "form" && !form && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {tr("formCannotShow", d)}{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => setMode("expr")}
          >
            {tr("editAsExpression", d)}
          </button>
        </div>
      )}
      {mode === "expr" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <SampleTree
            samples={samples.map((s) => s.sample)}
            index={sampleAt}
            notInEngine={notInEngine}
            readOnly={readOnly}
            d={d}
            onIndex={setSampleIndex}
          />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {tr("celLabel", d)}
            </span>
            <CelEditor
              readOnly={readOnly}
              ariaLabel={tr("celLabel", d)}
              value={activation}
              fields={sourceFields}
              problems={problems}
              onChange={(value) => onChange({ ...spec, activation: value })}
            />
            <ClauseBreakdown preview={preview} index={sampleAt} d={d} />
          </div>
        </div>
      )}
      <Problems items={problems} />
    </Section>
  );
}

export default function SymptomRuleSections({
  spec,
  published,
  changed = NOTHING_CHANGED,
  preview,
  fields,
  sourceFields,
  findings,
  readOnly,
  d,
  onChange,
  onConfigureResponse,
}: Readonly<{
  spec: SymptomSpec;
  /** The version in force, for the per-level marks; null before publishing or while viewing an old version. */
  published?: SymptomSpec | null;
  /** Paths that differ from the published version (see changedPaths). */
  changed?: ReadonlySet<string>;
  preview?: Preview;
  fields: SourceField[];
  sourceFields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
  /** Opens a level's response under "Respuesta". */
  onConfigureResponse: (icu: number) => void;
}>) {
  const [levelsMode, setLevelsMode] = useState<EditMode>("form");
  const levelsChanged = changedLevels(spec, published);
  const levelSamples = useSourceSamples(preview, spec.source);
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
  const levelAt = Math.min(
    levelIndex ?? firstOpening(levelSamples),
    Math.max(0, levelSamples.length - 1)
  );
  const levelShown = preview?.samples[levelAt];
  const reachedLevel =
    levelsMode === "expr" && levelShown?.activates && !levelShown.error
      ? levelShown.level
      : null;
  const [lifeMode, setLifeMode] = useState<EditMode>("form");
  const activation = problemsFor(findings, "activation", d);
  const measure = problemsFor(findings, "measure", d);
  // Overlaps and gaps between levels belong to no single level.
  const levelProblems = problemsFor(findings, "levels", d);
  const open = problemsFor(findings, "lifecycle.open", d);
  const close = problemsFor(findings, "lifecycle.close", d);
  const recurrence = problemsFor(findings, "recurrence", d);
  const levelRuleFields = [...sourceFields, ...levelFields(d)];
  const lifecycleFields = caseFields(d);
  // The levels and the lifecycle are described together, one text per section.
  const levelsText = [
    `medida = ${spec.measure?.expression ?? ""}`,
    ...(spec.levels ?? [])
      .filter((l) => l.applies)
      .map((l) => `nivel ${l.icu}: ${l.when ?? ""}`),
  ].join("\n");
  const lifecycleText = `abre: ${spec.lifecycle?.open ?? ""}\ncierra: ${spec.lifecycle?.close ?? ""}`;
  const lifecycle = spec.lifecycle ?? { open: "", close: "" };
  const lifeFormable =
    parseOpen(lifecycle.open) !== null && parseClose(lifecycle.close) !== null;

  return (
    <div className="flex flex-col gap-4">
      <ActivationSection
        spec={spec}
        changed={
          isChanged(changed, "activation") || isChanged(changed, "source")
        }
        preview={preview}
        fields={fields}
        sourceFields={sourceFields}
        problems={activation}
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />

      <Section
        number={2}
        title={tr("sectionLevels", d)}
        subtitle={tr("sectionLevelsSub", d)}
        changed={isChanged(changed, "measure") || isChanged(changed, "levels")}
        d={d}
        actions={
          <ModeToggle mode={levelsMode} d={d} onChange={setLevelsMode} />
        }
        describe={{
          section: "levels",
          rule: levelsText,
          sourceKey: spec.source,
        }}
      >
        {levelsMode === "form" ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {tr("measure", d)}
            </span>
            <MeasureFields
              measure={spec.measure}
              fields={fields}
              readOnly={readOnly}
              d={d}
              levelsUseMeasure={levelsUseMeasure(spec)}
              onChange={(next) =>
                onChange(
                  next ? { ...spec, measure: next } : withoutMeasure(spec)
                )
              }
              onEditAsExpression={() => setLevelsMode("expr")}
            />
            <Problems items={measure} />
          </div>
        ) : (
          <LevelsExpression
            spec={spec}
            preview={preview}
            index={levelAt}
            fields={fields}
            sourceFields={sourceFields}
            findings={findings}
            readOnly={readOnly}
            d={d}
            onIndex={setLevelIndex}
            onChange={onChange}
          />
        )}
        <Problems items={levelProblems} />
        <div className="-mx-4 -mb-3 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
          {ICU_LEVELS.map((meta) => (
            <LevelRow
              key={meta.icu}
              changed={levelsChanged.has(meta.icu)}
              spec={spec}
              icu={meta.icu}
              mode={levelsMode}
              reached={reachedLevel === meta.icu}
              fields={levelRuleFields}
              findings={findings}
              readOnly={readOnly}
              d={d}
              onChange={onChange}
              onConfigureResponse={onConfigureResponse}
            />
          ))}
        </div>
      </Section>

      <Section
        number={3}
        title={tr("sectionLifecycle", d)}
        subtitle={tr("sectionLifecycleSub", d)}
        changed={isChanged(changed, "lifecycle")}
        d={d}
        actions={<ModeToggle mode={lifeMode} d={d} onChange={setLifeMode} />}
        describe={{
          section: "lifecycle",
          rule: lifecycleText,
          sourceKey: spec.source,
        }}
      >
        {lifeMode === "form" && lifeFormable && (
          <LifecycleFormFields
            lifecycle={lifecycle}
            readOnly={readOnly}
            d={d}
            onChange={(next) => onChange({ ...spec, lifecycle: next })}
          />
        )}
        {lifeMode === "form" && !lifeFormable && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            {tr("lifeCannotShow", d)}{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => setLifeMode("expr")}
            >
              {tr("editAsExpression", d)}
            </button>
          </div>
        )}
        {lifeMode === "expr" && (
          <LifecycleExpression
            lifecycle={lifecycle}
            preview={preview}
            fields={lifecycleFields}
            openProblems={open}
            closeProblems={close}
            readOnly={readOnly}
            d={d}
            onChange={(next) => onChange({ ...spec, lifecycle: next })}
          />
        )}
        {(lifeMode === "expr" || !lifeFormable) && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span>{tr("levelGoesDown", d)}</span>
            <LevelDownSelect
              levelDown={lifecycle.levelDown ?? false}
              readOnly={readOnly}
              d={d}
              onChange={(levelDown) =>
                onChange({ ...spec, lifecycle: { ...lifecycle, levelDown } })
              }
            />
          </label>
        )}
        {lifeMode === "form" && (
          <>
            <Problems items={open} />
            <Problems items={close} />
          </>
        )}
      </Section>

      <Section
        number={4}
        title={tr("sectionRecurrence", d)}
        subtitle={tr("sectionRecurrenceSub", d)}
        changed={isChanged(changed, "recurrence")}
        d={d}
      >
        <RecurrenceForm
          recurrence={spec.recurrence}
          readOnly={readOnly}
          d={d}
          onChange={(value) => onChange({ ...spec, recurrence: value })}
        />
        <Problems items={recurrence} />
      </Section>
    </div>
  );
}
