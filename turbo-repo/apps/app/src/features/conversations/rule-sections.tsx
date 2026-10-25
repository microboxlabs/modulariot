"use client";

import { useMemo, useState } from "react";
import type { JsonValues } from "@/features/common/components/json-code-editor";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { EditMode } from "@/features/symptoms/maintainer/level-row";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import NumberedSection from "@/features/symptoms/maintainer/ui/section";
import type {
  ConversationTemplate,
  EventField,
  RecipientGroup,
  RuleSpec,
  RuleStep,
} from "./conversations-types";
import RecipientGroups from "./recipient-groups";
import type { GroupIssues, StepIssues } from "./rule-findings";
import { groupLabel, normalizeSpec, ROLES, STEP_CHANNELS } from "./rule-model";
import RuleSteps from "./rule-steps";
import SpecCode, { CodeToggle } from "./spec-code";

const flat = (issues: Record<number, { messages: string[] }>) =>
  Object.values(issues).flatMap((i) => i.messages);

/** "A quién": the rule's groups of recipients, as a form or as JSON. */
export function GroupsSection({
  spec,
  fields,
  errors,
  changed,
  readOnly,
  d,
  fieldDict,
  onChange,
}: Readonly<{
  spec: RuleSpec;
  fields: EventField[];
  errors: Record<number, GroupIssues>;
  changed: boolean;
  readOnly: boolean;
  d: I18nRecord;
  fieldDict: I18nRecord;
  onChange: (patch: Partial<RuleSpec>) => void;
}>) {
  const [mode, setMode] = useState<EditMode>("form");
  const [broken, setBroken] = useState(false);
  const values = useMemo<Record<string, JsonValues>>(
    () => ({
      role: {
        options: ROLES.map((r) => ({
          label: r.value,
          detail: trDynamic(r.label, d),
        })),
      },
      channel: {
        options: [{ label: "whatsapp" }, { label: "email" }],
        unknown: (v) => tr("jsonUnknownChannel", d, { value: v }),
      },
      path: {
        options: fields.map((f) => ({ label: f.name, detail: f.label })),
      },
    }),
    [d, fields]
  );
  const messages = Object.values(errors).flatMap((g) => [
    ...g.messages,
    ...Object.values(g.entries).flat(),
  ]);
  return (
    <NumberedSection
      number={2}
      title={tr("sectionAudience", d)}
      subtitle={tr("sectionAudienceSub", d)}
      changed={changed}
      actions={
        <CodeToggle mode={mode} broken={broken} d={d} onChange={setMode} />
      }
    >
      <p className={`text-sm ${MUTED}`}>{tr("groupsHint", d)}</p>
      {mode === "form" ? (
        <RecipientGroups
          groups={spec.groups}
          steps={spec.steps}
          fields={fields}
          errors={errors}
          readOnly={readOnly}
          d={d}
          fieldDict={fieldDict}
          onChange={(groups, steps) => onChange({ groups, steps })}
        />
      ) : (
        <SpecCode<RecipientGroup>
          value={spec.groups}
          values={values}
          messages={messages}
          readOnly={readOnly}
          label={tr("sectionAudience", d)}
          d={d}
          normalize={(list) =>
            normalizeSpec({
              ...spec,
              groups: list as unknown as RecipientGroup[],
            }).groups
          }
          onBroken={setBroken}
          onChange={(groups) => onChange({ groups })}
        />
      )}
    </NumberedSection>
  );
}

/** "Pasos": the escalation, as a ladder of steps or as JSON. */
export function StepsSection({
  spec,
  templates,
  errors,
  changed,
  readOnly,
  d,
  onChange,
}: Readonly<{
  spec: RuleSpec;
  templates: ConversationTemplate[];
  errors: Record<number, StepIssues>;
  changed: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: RuleStep[]) => void;
}>) {
  const [mode, setMode] = useState<EditMode>("form");
  const [broken, setBroken] = useState(false);
  const values = useMemo<Record<string, JsonValues>>(
    () => ({
      channel: {
        options: STEP_CHANNELS.map((c) => ({
          label: c.value,
          detail: trDynamic(c.label, d),
        })),
        unknown: (v) => tr("jsonUnknownChannel", d, { value: v }),
      },
      template: {
        options: templates.map((t) => ({ label: t.key, detail: t.name })),
        unknown: (v) => tr("jsonUnknownTemplate", d, { value: v }),
      },
      to: {
        options: spec.groups.map((g, i) => ({
          label: g.id,
          detail: groupLabel(g, i, d),
        })),
        unknown: (v) => tr("jsonUnknownGroup", d, { value: v }),
      },
      onReply: {
        options: [
          { label: "stop", detail: tr("gapNoReply", d) },
          { label: "continue", detail: tr("gapAnyway", d) },
        ],
        unknown: (v) => tr("jsonUnknownOnReply", d, { value: v }),
      },
    }),
    [d, templates, spec.groups]
  );
  return (
    <NumberedSection
      number={3}
      title={tr("sectionSteps", d)}
      subtitle={tr("sectionStepsSub", d)}
      changed={changed}
      actions={
        <CodeToggle mode={mode} broken={broken} d={d} onChange={setMode} />
      }
    >
      {mode === "form" ? (
        <RuleSteps
          steps={spec.steps}
          groups={spec.groups}
          templates={templates}
          errors={errors}
          readOnly={readOnly}
          d={d}
          onChange={onChange}
        />
      ) : (
        <SpecCode<RuleStep>
          value={spec.steps}
          values={values}
          messages={flat(errors)}
          readOnly={readOnly}
          label={tr("sectionSteps", d)}
          d={d}
          normalize={(list) => normalizeSpec({ ...spec, steps: list }).steps}
          onBroken={setBroken}
          onChange={onChange}
        />
      )}
    </NumberedSection>
  );
}
