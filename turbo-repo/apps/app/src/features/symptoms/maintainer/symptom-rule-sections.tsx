"use client";

import { useState } from "react";
import { ToggleSwitch } from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ConditionIcon from "../components/condition-icon";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import type {
  Finding,
  Level,
  LevelResponse,
  SymptomSpec,
} from "./maintainer-api";
import LevelNotices from "./level-notices";
import LevelResponseOptions from "./level-response-options";
import LevelSteps from "./level-steps";
import RecurrenceForm from "./recurrence-form";
import RuleDescription, { RuleDescriptionToggle } from "./rule-description";
import { ICU_LEVELS } from "./symptom-labels";

const cardClass =
  "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
const inputClass =
  "w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white";

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

const EMPTY_RESPONSE: LevelResponse = {
  operator: false,
  slaMinutes: null,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: true,
};

/** The server's findings for one section, as editor problems. */
export function problemsFor(
  findings: Finding[] | undefined,
  section: string
): CelProblem[] {
  return (findings ?? [])
    .filter((f) => f.section === section)
    .map((f) => ({
      position: Math.max(0, f.position),
      message: f.message,
      severity: f.severity === "ERROR" ? "error" : "warning",
    }));
}

function Section({
  title,
  describe,
  d,
  children,
}: Readonly<{
  title: string;
  describe?: { section: string; rule: string; sourceKey: string | null };
  d: I18nRecord;
  children: React.ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <section className={cardClass}>
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {title}
        </h2>
        {describe && (
          <span className="ml-auto">
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

function Problems({ items }: Readonly<{ items: CelProblem[] }>) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((p) => (
        <li
          key={`${p.position}-${p.message}`}
          className={`text-xs ${p.severity === "error" ? "text-red-600 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}
        >
          {p.message}
        </li>
      ))}
    </ul>
  );
}

function levelOf(spec: SymptomSpec, icu: number): Level {
  return (
    (spec.levels ?? []).find((l) => l.icu === icu) ?? {
      icu,
      applies: false,
      when: "",
      response: EMPTY_RESPONSE,
    }
  );
}

function withLevel(spec: SymptomSpec, level: Level): SymptomSpec {
  const others = (spec.levels ?? []).filter((l) => l.icu !== level.icu);
  return { ...spec, levels: [...others, level].sort((a, b) => a.icu - b.icu) };
}

function LevelRow({
  spec,
  icu,
  condition,
  fields,
  findings,
  readOnly,
  connections,
  lang,
  d,
  rootDict,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  icu: number;
  condition: string;
  fields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  connections: IntegrationConnection[];
  lang: string;
  d: I18nRecord;
  rootDict: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
  const level = levelOf(spec, icu);
  const response = level.response ?? EMPTY_RESPONSE;
  const set = (patch: Partial<Level>) =>
    onChange(withLevel(spec, { ...level, ...patch }));
  const setResponse = (patch: Partial<LevelResponse>) =>
    set({ response: { ...response, ...patch } });
  const problems = problemsFor(findings, `levels.${icu}`);

  return (
    <div
      className={`flex flex-col gap-2 py-3 ${level.applies ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-3">
        <ConditionIcon condition={condition} dict={rootDict} size="h-8 w-8" />
        <ToggleSwitch
          checked={level.applies}
          disabled={readOnly}
          label={tr("levelApplies", d)}
          onChange={(applies) =>
            set({ applies, when: level.when || "medida > 0" })
          }
        />
        {level.applies && (
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <ToggleSwitch
              checked={response.operator}
              disabled={readOnly}
              label={tr("operator", d)}
              onChange={(operator) =>
                setResponse({
                  operator,
                  slaMinutes: operator ? (response.slaMinutes ?? 5) : null,
                })
              }
            />
            {response.operator && (
              <label className="flex items-center gap-1">
                <span>SLA</span>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  disabled={readOnly}
                  value={response.slaMinutes ?? ""}
                  onChange={(e) =>
                    setResponse({
                      slaMinutes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
                <span>min</span>
              </label>
            )}
          </div>
        )}
      </div>
      {level.applies && (
        <>
          <CelEditor
            singleLine
            readOnly={readOnly}
            ariaLabel={tr("levelRule", d)}
            value={level.when ?? ""}
            fields={fields}
            problems={problems}
            onChange={(when) => set({ when })}
          />
          <Problems items={problems} />
          {response.operator && (
            <LevelSteps
              steps={response.steps ?? []}
              slaMinutes={response.slaMinutes}
              readOnly={readOnly}
              d={d}
              onChange={(steps) => setResponse({ steps })}
            />
          )}
          <LevelNotices
            notices={response.notices ?? []}
            connections={connections}
            lang={lang}
            readOnly={readOnly}
            d={d}
            onChange={(notices) => setResponse({ notices })}
          />
          <LevelResponseOptions
            response={response}
            readOnly={readOnly}
            d={d}
            onChange={setResponse}
          />
        </>
      )}
    </div>
  );
}

/** Activation, measure with levels, and lifecycle, each as CEL with the server's findings in place. */
export default function SymptomRuleSections({
  spec,
  sourceFields,
  findings,
  readOnly,
  connections,
  lang,
  d,
  rootDict,
  onChange,
}: Readonly<{
  spec: SymptomSpec;
  sourceFields: CelField[];
  findings: Finding[] | undefined;
  readOnly: boolean;
  connections: IntegrationConnection[];
  lang: string;
  d: I18nRecord;
  rootDict: I18nRecord;
  onChange: (spec: SymptomSpec) => void;
}>) {
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
  const measureValue = spec.measure ?? {
    expression: "",
    label: null,
    unit: null,
  };

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={tr("sectionActivation", d)}
        d={d}
        describe={{
          section: "activation",
          rule: spec.activation ?? "",
          sourceKey: spec.source,
        }}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tr("activationHint", d)}
        </p>
        <CelEditor
          readOnly={readOnly}
          ariaLabel={tr("sectionActivation", d)}
          value={spec.activation ?? ""}
          fields={sourceFields}
          problems={activation}
          onChange={(value) => onChange({ ...spec, activation: value })}
        />
        <Problems items={activation} />
      </Section>

      <Section
        title={tr("sectionLevels", d)}
        d={d}
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
          <Problems items={measure} />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {ICU_LEVELS.map((meta) => (
            <LevelRow
              key={meta.icu}
              spec={spec}
              icu={meta.icu}
              condition={meta.condition}
              fields={levelRuleFields}
              findings={findings}
              readOnly={readOnly}
              connections={connections}
              lang={lang}
              d={d}
              rootDict={rootDict}
              onChange={onChange}
            />
          ))}
        </div>
      </Section>

      <Section
        title={tr("sectionLifecycle", d)}
        d={d}
        describe={{
          section: "lifecycle",
          rule: lifecycleText,
          sourceKey: spec.source,
        }}
      >
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
        <Problems items={open} />
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
        <Problems items={close} />
        <ToggleSwitch
          checked={lifecycle.levelDown ?? false}
          disabled={readOnly}
          label={tr("levelDown", d)}
          onChange={(levelDown) =>
            onChange({ ...spec, lifecycle: { ...lifecycle, levelDown } })
          }
        />
      </Section>

      <Section title={tr("sectionRecurrence", d)} d={d}>
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
