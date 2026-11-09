"use client";

import { ToggleSwitch } from "flowbite-react";
import SymptomRulesCard from "@/features/conversations/symptom-rules-card";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { whoOf } from "../control-tower/step-who";
import { useState } from "react";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import {
  CaseTimelinePreview,
  CloseRules,
  type LifecycleRules,
} from "./close-section";
import type { EditMode } from "./level-row";
import ModeToggle from "./ui/mode-toggle";
import LevelSteps, {
  type AudienceDicts,
  type StepErrors,
  WhoEditor,
} from "./level-steps";
import type { Finding, LevelResponse } from "./maintainer-api";
import { findingProblem, findingText, Problems } from "./rule-problems";
import { PillNumber, PillSelect } from "./ui/pill";
import {
  FIELD_ERROR,
  FieldError,
  FieldRow,
  ResponseBlock,
} from "./ui/response-block";

/** What the operator must record to close a case, as stored in the spec. */
const EVIDENCE = [
  { value: "call_result", label: "evidenceCallResult" },
  { value: "note", label: "evidenceNote" },
  { value: "photo", label: "evidencePhoto" },
];

/** Findings shown beside their control while the operator block is open. */
const PLACED = new Set(["operatorNeedsSla", "stepNoContact", "stepNoMinutes"]);

/** The condition that limits which cases reach the operators, and its checks. */
export interface OperatorCondition {
  fields: CelField[];
  problems: CelProblem[];
}

/** Findings with no visible control to sit beside, listed above the blocks. */
function unplaced(findings: Finding[], response: LevelResponse): Finding[] {
  if (!response.operator) return findings;
  return findings.filter((f) => !PLACED.has(f.code ?? ""));
}

function stepErrors(findings: Finding[], d: I18nRecord): StepErrors {
  const out: StepErrors = {};
  for (const f of findings) {
    const n = Number(f.params?.n);
    if (!Number.isInteger(n)) continue;
    const errors = (out[n - 1] ??= {});
    if (f.code === "stepNoContact") errors.contact = findingText(f, d);
    if (f.code === "stepNoMinutes") errors.minutes = findingText(f, d);
  }
  return out;
}

function Check({
  checked,
  label,
  hint,
  readOnly,
  onChange,
}: Readonly<{
  checked: boolean;
  label: string;
  hint: string;
  readOnly: boolean;
  onChange: (checked: boolean) => void;
}>) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-col">
        <span className="text-gray-900 dark:text-white">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
    </label>
  );
}

/** "Solo cuando…": the operator's condition, under "Requiere operador". */
export function OperatorWhen({
  value,
  condition,
  readOnly,
  d,
  onChange,
}: Readonly<{
  value: string | null | undefined;
  condition: OperatorCondition;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (operatorWhen: string | null) => void;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {tr("operatorWhenLabel", d)}
      </span>
      <CelEditor
        singleLine
        readOnly={readOnly}
        ariaLabel={tr("operatorWhenLabel", d)}
        placeholder={tr("operatorWhenPlaceholder", d)}
        value={value ?? ""}
        fields={condition.fields}
        problems={condition.problems}
        onChange={onChange}
      />
      <Problems items={condition.problems} />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {tr("operatorWhenHint", d)}
      </span>
    </div>
  );
}

function OperatorBlock({
  response,
  findings,
  condition,
  cases,
  audience,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  findings: Finding[];
  condition: OperatorCondition;
  /** The symptom and level whose recent cases fill the script's preview. */
  cases: { symptomName: string; icu: number } | undefined;
  audience: AudienceDicts;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  const slaError = findings.find((f) => f.code === "operatorNeedsSla");
  const escalation = whoOf({
    who: response.escalateWho,
    role: response.escalateTo,
    scope: response.escalateScope,
  });
  return (
    <ResponseBlock
      number={2}
      title={tr("operatorTitle", d)}
      subtitle={tr("operatorSub", d)}
      aside={
        <ToggleSwitch
          checked={response.operator}
          disabled={readOnly}
          label={tr("requiresOperator", d)}
          onChange={(operator) =>
            onChange({
              operator,
              slaMinutes: operator ? (response.slaMinutes ?? 5) : null,
              operatorWhen: operator ? response.operatorWhen : null,
            })
          }
        />
      }
    >
      {response.operator ? (
        <>
          <OperatorWhen
            value={response.operatorWhen}
            condition={condition}
            readOnly={readOnly}
            d={d}
            onChange={(operatorWhen) => onChange({ operatorWhen })}
          />
          <div className="flex flex-col gap-1">
            <FieldRow label={tr("attendWithin", d)}>
              <PillNumber
                ariaLabel={tr("attendWithin", d)}
                className={slaError ? FIELD_ERROR : ""}
                disabled={readOnly}
                value={response.slaMinutes}
                unit="min"
                onChange={(slaMinutes) => onChange({ slaMinutes })}
              />
            </FieldRow>
            {slaError && (
              <div className="sm:pl-[10.75rem]">
                <FieldError text={findingText(slaError, d)} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr("escalateToLabel", d)}
            </span>
            <WhoEditor
              who={escalation}
              audience={audience}
              readOnly={readOnly}
              onChange={(who) =>
                onChange({
                  escalateWho: who || null,
                  escalateTo: null,
                  escalateScope: null,
                })
              }
            />
          </div>
          <LevelSteps
            steps={response.steps ?? []}
            slaMinutes={response.slaMinutes}
            errors={stepErrors(findings, d)}
            audience={audience}
            cases={cases}
            readOnly={readOnly}
            d={d}
            onChange={(steps) => onChange({ steps })}
          />
          <Check
            checked={response.ignorable}
            label={tr("ignorable", d)}
            hint={tr("ignorableHint", d)}
            readOnly={readOnly}
            onChange={(ignorable) => onChange({ ignorable })}
          />
          <Check
            checked={response.consequence ?? false}
            label={tr("consequence", d)}
            hint={tr("consequenceHint", d)}
            readOnly={readOnly}
            onChange={(consequence) => onChange({ consequence })}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("nobodyHandles", d)}
        </p>
      )}
    </ResponseBlock>
  );
}

function CloseBlock({
  response,
  rules,
  cases,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  rules?: LifecycleRules;
  /** The symptom and level whose recent cases fill the timeline preview. */
  cases: { symptomName: string; icu: number } | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  const value = response.evidence?.[0] ?? "";
  const known = value === "" || EVIDENCE.some((e) => e.value === value);
  const [mode, setMode] = useState<EditMode>("form");
  return (
    <ResponseBlock
      number={3}
      title={tr("closeTitle", d)}
      subtitle={tr("closeSub", d)}
      aside={rules && <ModeToggle mode={mode} d={d} onChange={setMode} />}
    >
      {response.operator && (
        <FieldRow label={tr("closeRequires", d)}>
          <PillSelect
            ariaLabel={tr("closeRequires", d)}
            disabled={readOnly}
            value={value}
            onChange={(next) => onChange({ evidence: next ? [next] : [] })}
            options={[
              { value: "", label: tr("evidenceNothing", d) },
              ...(known ? [] : [{ value, label: value }]),
              ...EVIDENCE.map((e) => ({
                value: e.value,
                label: trDynamic(e.label, d),
              })),
            ]}
          />
        </FieldRow>
      )}
      {rules && (
        <CloseRules
          rules={rules}
          mode={mode}
          readOnly={readOnly}
          d={d}
          onExpr={() => setMode("expr")}
        />
      )}
      {cases && (
        <CaseTimelinePreview
          symptomName={cases.symptomName}
          icu={cases.icu}
          d={d}
        />
      )}
    </ResponseBlock>
  );
}

/** The symptom and level whose conversation rules the response lists. */
export interface ResponseSymptom {
  key: string;
  name: string;
  icu: number;
  /** The Comunicaciones page's dictionary, which the rule cards read. */
  rulesDict: I18nRecord;
}

/**
 * What the tower does at one level: the messages its conversation rules send
 * (#2003), the operator's SLA and steps, and what closing the case takes.
 */
export default function LevelResponseDetail({
  response,
  findings,
  symptom,
  rules,
  operatorCondition = { fields: [], problems: [] },
  audience,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  /** The fields "Solo cuando…" reads (the source's) and its findings. */
  operatorCondition?: OperatorCondition;
  /** The symptom's close and note rules; absent where they are not edited. */
  rules?: LifecycleRules;
  /** The texts of the "contacts from the book" condition the steps use. */
  audience: AudienceDicts;
  /** Absent for a template, which has no rules. */
  symptom?: ResponseSymptom;
  /** The findings of this level's response. */
  findings: Finding[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <Problems
        items={unplaced(findings, response).map((f) => findingProblem(f, d))}
      />
      {symptom ? (
        <SymptomRulesCard
          symptomKey={symptom.key}
          symptomName={symptom.name}
          icu={symptom.icu}
          canWrite={!readOnly}
          d={d}
          rulesDict={symptom.rulesDict}
        />
      ) : (
        <ResponseBlock
          number={1}
          title={tr("communicationsTitle", d)}
          subtitle={tr("communicationsSub", d)}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("communicationsSoon", d)}
          </p>
        </ResponseBlock>
      )}
      <OperatorBlock
        response={response}
        findings={findings}
        condition={operatorCondition}
        cases={
          symptom ? { symptomName: symptom.name, icu: symptom.icu } : undefined
        }
        audience={audience}
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />
      <CloseBlock
        response={response}
        rules={rules}
        cases={
          symptom ? { symptomName: symptom.name, icu: symptom.icu } : undefined
        }
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />
    </div>
  );
}
