"use client";

import { ToggleSwitch } from "flowbite-react";
import {
  HiOutlineChatAlt2,
  HiOutlineCheckCircle,
  HiOutlinePhone,
} from "react-icons/hi";
import SymptomRulesCard from "@/features/conversations/symptom-rules-card";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  storedTarget,
  stepTarget,
  useScopeRoles,
} from "../control-tower/contact-roles";
import CelEditor, { type CelField, type CelProblem } from "./cel-editor";
import LevelSteps, { type StepErrors } from "./level-steps";
import type { Finding, LevelResponse } from "./maintainer-api";
import TargetPicker, { RoleWarning } from "./role-picker";
import { findingProblem, findingText, Problems } from "./rule-problems";
import {
  FIELD,
  FIELD_ERROR,
  FieldError,
  FieldRow,
  ResponseBlock,
} from "./ui/response-block";
import Select from "./ui/select";

/** What the operator must record to close a case, as stored in the spec. */
const EVIDENCE = [
  { value: "call_result", label: "evidenceCallResult" },
  { value: "note", label: "evidenceNote" },
  { value: "photo", label: "evidencePhoto" },
];

/** Findings shown beside their control while the operator block is open. */
const PLACED = new Set(["operatorNeedsSla", "stepNoContact", "stepNoMinutes"]);

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

function OperatorBlock({
  response,
  findings,
  sample,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  findings: Finding[];
  sample: Record<string, unknown> | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  const slaError = findings.find((f) => f.code === "operatorNeedsSla");
  const roles = useScopeRoles();
  const escalation = stepTarget(response.escalateTo, response.escalateScope);
  return (
    <ResponseBlock
      title={tr("operatorTitle", d)}
      icon={<HiOutlinePhone aria-hidden className="h-5 w-5" />}
      aside={
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
      }
    >
      {response.operator ? (
        <>
          <div className="flex flex-col gap-1">
            <FieldRow label={tr("attendWithin", d)}>
              <input
                type="number"
                min={1}
                aria-label={tr("attendWithin", d)}
                className={`${FIELD} w-16 ${slaError ? FIELD_ERROR : ""}`}
                disabled={readOnly}
                value={response.slaMinutes ?? ""}
                onChange={(e) =>
                  onChange({
                    slaMinutes: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <span>min</span>
              <span className="ml-2">{tr("escalateTo", d)}</span>
              <TargetPicker
                label={tr("escalateTo", d)}
                className={FIELD}
                disabled={readOnly}
                target={escalation}
                roles={roles}
                d={d}
                onChange={(next) => {
                  const stored = storedTarget(next);
                  onChange({
                    escalateTo: next ? stored.role : null,
                    escalateScope: stored.scope,
                  });
                }}
              />
            </FieldRow>
            <div className="sm:pl-[10.75rem]">
              <RoleWarning target={escalation} roles={roles} d={d} />
            </div>
            {slaError && (
              <div className="sm:pl-[10.75rem]">
                <FieldError text={findingText(slaError, d)} />
              </div>
            )}
          </div>
          <LevelSteps
            steps={response.steps ?? []}
            slaMinutes={response.slaMinutes}
            errors={stepErrors(findings, d)}
            roles={roles}
            sample={sample}
            readOnly={readOnly}
            d={d}
            onChange={(steps) => onChange({ steps })}
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
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  rules?: LifecycleRules;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<LevelResponse>) => void;
}>) {
  const value = response.evidence?.[0] ?? "";
  const known = value === "" || EVIDENCE.some((e) => e.value === value);
  return (
    <ResponseBlock
      title={tr("closeTitle", d)}
      icon={<HiOutlineCheckCircle aria-hidden className="h-5 w-5" />}
    >
      {response.operator && (
        <FieldRow label={tr("closeRequires", d)}>
          <Select
            aria-label={tr("closeRequires", d)}
            className={FIELD}
            wrapperClassName="min-w-48"
            disabled={readOnly}
            value={value}
            onChange={(e) =>
              onChange({ evidence: e.target.value ? [e.target.value] : [] })
            }
          >
            <option value="">{tr("evidenceNothing", d)}</option>
            {!known && <option value={value}>{value}</option>}
            {EVIDENCE.map((e) => (
              <option key={e.value} value={e.value}>
                {trDynamic(e.label, d)}
              </option>
            ))}
          </Select>
        </FieldRow>
      )}
      {rules && <LifecycleRuleRows rules={rules} readOnly={readOnly} d={d} />}
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
    </ResponseBlock>
  );
}

/**
 * The symptom's close and note rules, the same at every level: shown under
 * "Cierre" so whoever sets up the response decides when a case ends and which
 * GPS events go in its timeline.
 */
export interface LifecycleRules {
  close: string;
  note: string;
  fields: CelField[];
  closeProblems: CelProblem[];
  noteProblems: CelProblem[];
  onChange: (rules: { close: string; note: string | null }) => void;
}

function LifecycleRuleRows({
  rules,
  readOnly,
  d,
}: Readonly<{ rules: LifecycleRules; readOnly: boolean; d: I18nRecord }>) {
  return (
    <>
      <FieldRow label={tr("closesWhen", d)}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CelEditor
            singleLine
            readOnly={readOnly}
            ariaLabel={tr("closesWhen", d)}
            value={rules.close}
            fields={rules.fields}
            problems={rules.closeProblems}
            onChange={(close) => rules.onChange({ close, note: rules.note })}
          />
          <Problems items={rules.closeProblems} />
        </div>
      </FieldRow>
      <FieldRow label={tr("notesWhen", d)}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CelEditor
            singleLine
            readOnly={readOnly}
            ariaLabel={tr("notesWhen", d)}
            placeholder={tr("notesCelPlaceholder", d)}
            value={rules.note}
            fields={rules.fields}
            problems={rules.noteProblems}
            onChange={(note) =>
              rules.onChange({ close: rules.close, note: note || null })
            }
          />
          <Problems items={rules.noteProblems} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr("notesWhenHint", d)}
          </span>
        </div>
      </FieldRow>
    </>
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
  sample,
  symptom,
  rules,
  readOnly,
  d,
  onChange,
}: Readonly<{
  response: LevelResponse;
  /** The symptom's close and note rules; absent where they are not edited. */
  rules?: LifecycleRules;
  /** Absent for a template, which has no rules. */
  symptom?: ResponseSymptom;
  /** The findings of this level's response. */
  findings: Finding[];
  sample: Record<string, unknown> | undefined;
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
          title={tr("communicationsTitle", d)}
          icon={<HiOutlineChatAlt2 aria-hidden className="h-5 w-5" />}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("communicationsSoon", d)}
          </p>
        </ResponseBlock>
      )}
      <OperatorBlock
        response={response}
        findings={findings}
        sample={sample}
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />
      <CloseBlock
        response={response}
        rules={rules}
        readOnly={readOnly}
        d={d}
        onChange={onChange}
      />
    </div>
  );
}
