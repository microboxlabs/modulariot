"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import ActivationForm, { useActivationForm } from "./activation-form";
import ClauseBreakdown from "./clause-breakdown";
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

/** The prototype's amber border on a card that differs from the published version. */
const CHANGED_CARD = "!border-amber-300 dark:!border-amber-600/60";

const cardClass =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";

/** Variables a level rule adds to the source: the measure and how long it has held. */
export function levelFields(d: I18nRecord): CelField[] {
  return [
    { path: "medida", detail: tr("fieldMeasure", d) },
    { path: "sostenido_s", detail: tr("fieldHeld", d) },
  ];
}

/** The case a lifecycle rule reads. */
export function caseFields(d: I18nRecord): CelField[] {
  return [
    { path: "caso.condicion_s", detail: tr("fieldCaseCondition", d) },
    { path: "caso.normal_s", detail: tr("fieldCaseNormal", d) },
    { path: "caso.edad_h", detail: tr("fieldCaseAge", d) },
    { path: "caso.nivel", detail: tr("fieldCaseLevel", d) },
    { path: "caso.cerrado_por_operador", detail: tr("fieldCaseClosed", d) },
  ];
}

function Section({
  title,
  describe,
  actions,
  changed = false,
  d,
  children,
}: Readonly<{
  title: string;
  describe?: { section: string; rule: string; sourceKey: string | null };
  actions?: React.ReactNode;
  /** Something in the section differs from the published version. */
  changed?: boolean;
  d: I18nRecord;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className={`${cardClass} ${changed ? CHANGED_CARD : ""}`}
      data-changed={changed || undefined}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h2>
        {actions && <span className="ml-auto">{actions}</span>}
        {describe && (
          <span className={actions ? "" : "ml-auto"}>
            <RuleDescriptionToggle
              open={open}
              onToggle={() => setOpen((o) => !o)}
              d={d}
            />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {describe && open && (
          <RuleDescription
            section={describe.section}
            rule={describe.rule}
            sourceKey={describe.sourceKey}
            d={d}
          />
        )}
        {children}
      </div>
    </section>
  );
}

/** ☰ form / { } expression, as in the prototype. */
function ModeToggle({
  mode,
  d,
  onChange,
}: Readonly<{
  mode: EditMode;
  d: I18nRecord;
  onChange: (mode: EditMode) => void;
}>) {
  const button = (m: EditMode, label: string, title: string) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={mode === m}
      className={`rounded-md px-2 py-0.5 text-xs ${mode === m ? "bg-gray-100 font-medium dark:bg-gray-700" : "text-gray-500"}`}
      onClick={() => onChange(m)}
    >
      {label}
    </button>
  );
  return (
    <span className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
      {button("form", "☰", tr("formMode", d))}
      {button("expr", "{ }", tr("exprMode", d))}
    </span>
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
  const before = new Map((published.levels ?? []).map((l) => [l.icu, l]));
  const after = new Map((draft.levels ?? []).map((l) => [l.icu, l]));
  for (const icu of new Set([...before.keys(), ...after.keys()])) {
    if (changedPaths(after.get(icu), before.get(icu)).size > 0) out.add(icu);
  }
  return out;
}

/** The measure in form mode: its name, unit and expression, edited under { }. */
function MeasureText({
  measure,
  d,
}: Readonly<{
  measure: {
    expression: string | null;
    label: string | null;
    unit: string | null;
  };
  d: I18nRecord;
}>) {
  if (!measure.expression) {
    return <span className="text-sm text-gray-500">{tr("noMeasure", d)}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
      {measure.label && <b>{measure.label}</b>}
      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-700">
        {measure.expression}
      </code>
      {measure.unit && <span className="text-gray-500">{measure.unit}</span>}
    </span>
  );
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
  const activation = spec.activation ?? "";
  const { form, update } = useActivationForm(activation, fields, (value) =>
    onChange({ ...spec, activation: value })
  );
  return (
    <Section
      title={tr("sectionActivation", d)}
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
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("activationHint", d)}
          </p>
          <CelEditor
            readOnly={readOnly}
            ariaLabel={tr("sectionActivation", d)}
            value={activation}
            fields={sourceFields}
            problems={problems}
            onChange={(value) => onChange({ ...spec, activation: value })}
          />
          <ClauseBreakdown preview={preview} d={d} />
        </>
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
  connections,
  lang,
  d,
  onChange,
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
  connections: IntegrationConnection[];
  lang: string;
  d: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const [levelsMode, setLevelsMode] = useState<EditMode>("form");
  const levelsChanged = changedLevels(spec, published);
  const [lifeMode, setLifeMode] = useState<EditMode>("form");
  const activation = problemsFor(findings, "activation");
  const measure = problemsFor(findings, "measure");
  const open = problemsFor(findings, "lifecycle.open");
  const close = problemsFor(findings, "lifecycle.close");
  const recurrence = problemsFor(findings, "recurrence");
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
  const measureValue = spec.measure ?? {
    expression: "",
    label: null,
    unit: null,
  };

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
        title={tr("sectionLevels", d)}
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {tr("measure", d)}
          </span>
          {levelsMode === "form" ? (
            <MeasureText measure={measureValue} d={d} />
          ) : (
            <CelEditor
              singleLine
              readOnly={readOnly}
              ariaLabel={tr("measure", d)}
              value={measureValue.expression ?? ""}
              fields={sourceFields}
              problems={measure}
              onChange={(expression) =>
                onChange({ ...spec, measure: { ...measureValue, expression } })
              }
            />
          )}
          <Problems items={measure} />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {ICU_LEVELS.map((meta) => (
            <LevelRow
              key={meta.icu}
              changed={levelsChanged.has(meta.icu)}
              spec={spec}
              icu={meta.icu}
              mode={levelsMode}
              fields={levelRuleFields}
              findings={findings}
              readOnly={readOnly}
              connections={connections}
              lang={lang}
              d={d}
              onChange={onChange}
            />
          ))}
        </div>
      </Section>

      <Section
        title={tr("sectionLifecycle", d)}
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
          <>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {tr("opens", d)}
            </span>
            <CelEditor
              singleLine
              readOnly={readOnly}
              ariaLabel={tr("opens", d)}
              value={lifecycle.open ?? ""}
              fields={lifecycleFields}
              problems={open}
              onChange={(value) =>
                onChange({ ...spec, lifecycle: { ...lifecycle, open: value } })
              }
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {tr("closes", d)}
            </span>
            <CelEditor
              singleLine
              readOnly={readOnly}
              ariaLabel={tr("closes", d)}
              value={lifecycle.close ?? ""}
              fields={lifecycleFields}
              problems={close}
              onChange={(value) =>
                onChange({ ...spec, lifecycle: { ...lifecycle, close: value } })
              }
            />
          </>
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
        <Problems items={open} />
        <Problems items={close} />
      </Section>

      <Section
        title={tr("sectionRecurrence", d)}
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
