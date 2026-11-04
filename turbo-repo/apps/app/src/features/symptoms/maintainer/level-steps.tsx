"use client";

import { type ReactNode, useState } from "react";
import { HiPencil, HiPlus, HiTrash } from "react-icons/hi";
import SortableRows from "@/features/common/components/sortable-rows";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ChannelGlyph } from "@/features/conversations/channel-icon";
import ContactsAudience from "@/features/conversations/contacts-audience";
import { TRIP_FIELDS, whoOf } from "../control-tower/step-who";
import { moveRow } from "./condition-form";
import type { Step } from "./maintainer-api";
import ScriptModal from "./script-modal";
import { PillNumber, PillSelect } from "./ui/pill";
import { FIELD_ERROR, FieldError } from "./ui/response-block";

/** How the operator reaches the person in a step. */
export const STEP_CHANNELS = [
  { key: "call", label: "stepCall" },
  { key: "whatsapp", label: "channelWhatsapp" },
  { key: "teams", label: "channelTeams" },
  { key: "email", label: "channelEmail" },
];

/** The validator's messages for each step, by step index. */
export type StepErrors = Record<number, { contact?: string; minutes?: string }>;

const SCRIPT_SHOWN = 72;

function scriptShown(script: string | null): string | null {
  const text = script?.trim();
  if (!text) return null;
  return text.length > SCRIPT_SHOWN ? `${text.slice(0, SCRIPT_SHOWN)}…` : text;
}

const errorClass = (error: string | undefined) => (error ? FIELD_ERROR : "");

/**
 * The dictionaries the "contacts from the book" condition reads: the
 * Comunicaciones page's texts and the selectables field's.
 */
export interface AudienceDicts {
  d: I18nRecord;
  fieldDict: I18nRecord;
}

/**
 * Who a step or the escalation contacts, with the communication rules'
 * condition editor: clauses or CEL over `contact` and the trip's RUTs.
 */
export function WhoEditor({
  who,
  audience,
  readOnly,
  onChange,
}: Readonly<{
  who: string;
  audience: AudienceDicts;
  readOnly: boolean;
  onChange: (who: string) => void;
}>) {
  return (
    <ContactsAudience
      condition={who}
      fields={TRIP_FIELDS}
      readOnly={readOnly}
      d={audience.d}
      fieldDict={audience.fieldDict}
      onChange={onChange}
    />
  );
}

/** A step written from its condition only; the older role and scope are dropped. */
export const withWho = (who: string): Partial<Step> => ({
  who,
  role: null,
  scope: null,
});

function StepItem({
  step,
  index,
  count,
  errors,
  audience,
  readOnly,
  d,
  handle,
  onSet,
  onRemove,
  onScript,
}: Readonly<{
  step: Step;
  index: number;
  count: number;
  errors: StepErrors[number] | undefined;
  audience: AudienceDicts;
  readOnly: boolean;
  d: I18nRecord;
  /** The drag handle from SortableRows; none when the list cannot be reordered. */
  handle: ReactNode;
  onSet: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onScript: () => void;
}>) {
  const last = index === count - 1;
  const shown = scriptShown(step.script);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        {handle}
        {/* The same pills as a communication rule's step. */}
        <PillSelect
          ariaLabel={tr("stepChannel", d)}
          icon={<ChannelGlyph channel={step.channel ?? "call"} />}
          disabled={readOnly}
          value={step.channel ?? "call"}
          onChange={(channel) => onSet({ channel })}
          options={STEP_CHANNELS.map((c) => ({
            value: c.key,
            label: trDynamic(c.label, d),
          }))}
        />
        <span>{last ? tr("stepWithin", d) : tr("stepIfNot", d)}</span>
        <PillNumber
          ariaLabel={tr("stepBudget", d)}
          className={errorClass(errors?.minutes)}
          disabled={readOnly}
          value={step.budgetMinutes}
          unit="min"
          onChange={(budgetMinutes) => onSet({ budgetMinutes })}
        />
        {!last && <span>{tr("stepThen", d)}</span>}
        {!readOnly && (
          <button
            type="button"
            aria-label={tr("removeStep", d)}
            className="ml-auto text-gray-400 hover:text-red-500"
            onClick={onRemove}
          >
            <HiTrash className="h-4 w-4" />
          </button>
        )}
      </div>
      <WhoEditor
        who={whoOf(step)}
        audience={audience}
        readOnly={readOnly}
        onChange={(who) => onSet(withWho(who))}
      />
      <FieldError text={errors?.contact} />
      <FieldError text={errors?.minutes} />
      <button
        type="button"
        className="flex items-center gap-1.5 self-start text-left text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
        onClick={onScript}
      >
        <HiPencil className="h-3.5 w-3.5 shrink-0" />
        <span className="text-gray-500 dark:text-gray-400">
          {tr("stepScriptLabel", d)}
        </span>
        {shown ? (
          <span className="text-gray-700 dark:text-gray-300">{shown}</span>
        ) : (
          <span className="text-blue-600 dark:text-blue-400">
            {tr("stepScriptWrite", d)}
          </span>
        )}
      </button>
    </div>
  );
}

function BudgetBar({
  used,
  sla,
  d,
}: Readonly<{ used: number; sla: number; d: I18nRecord }>) {
  const over = used > sla;
  const width = sla > 0 ? Math.min(100, (used / sla) * 100) : 100;
  return (
    <span className="ml-auto flex items-center gap-2 text-xs">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <span
          className={`block h-full rounded-full ${over ? "bg-amber-500" : "bg-blue-600"}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span
        className={
          over
            ? "text-amber-700 dark:text-amber-400"
            : "text-gray-500 dark:text-gray-400"
        }
      >
        {tr("stepsBudget", d, { used: String(used), sla: String(sla) })}
      </span>
    </span>
  );
}

/**
 * The operator's ladder for one level: who to contact and how, the script to
 * read, and how long to wait before the next step. The treatment screen
 * suggests the steps in this order.
 */
export default function LevelSteps({
  steps,
  slaMinutes,
  errors = {},
  audience,
  sample,
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: Step[];
  slaMinutes: number | null;
  errors?: StepErrors;
  /** The texts of the "contacts from the book" condition each step uses. */
  audience: AudienceDicts;
  /** A source sample the script preview is filled from. */
  sample?: Record<string, unknown>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: Step[]) => void;
}>) {
  const [editing, setEditing] = useState<number | null>(null);
  // Steps have no id of their own: each keeps one here, moved and removed with it.
  const [ids, setIds] = useState(() => steps.map(() => crypto.randomUUID()));
  let keys = ids;
  if (ids.length !== steps.length) {
    // Steps added, or the list replaced from outside: keep the ids that still have a step.
    keys = steps.map((_, i) => ids[i] ?? crypto.randomUUID());
    setIds(keys);
  }
  const set = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (from: number, to: number) => {
    setIds(moveRow(keys, from, to));
    onChange(moveRow(steps, from, to));
  };
  const remove = (i: number) => {
    setIds(keys.filter((_, j) => j !== i));
    onChange(steps.filter((_, j) => j !== i));
  };
  const budget = steps.reduce((sum, s) => sum + (s.budgetMinutes ?? 0), 0);
  const editingStep = editing === null ? undefined : steps[editing];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {tr("steps", d)}
        </span>
        {slaMinutes != null && steps.length > 0 && (
          <BudgetBar used={budget} sla={slaMinutes} d={d} />
        )}
      </div>
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noSteps", d)}
        </p>
      )}
      {steps.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          <SortableRows
            as="li"
            items={steps}
            keys={keys}
            readOnly={readOnly}
            handleLabel={tr("dragStep", d)}
            rowClassName="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            rowTestId="step-row"
            rowLabel={(i) => tr("stepN", d, { n: String(i + 1) })}
            onMove={move}
            renderRow={(s, i, handle) => (
              <StepItem
                step={s}
                index={i}
                count={steps.length}
                errors={errors[i]}
                audience={audience}
                readOnly={readOnly}
                d={d}
                handle={handle}
                onSet={(patch) => set(i, patch)}
                onRemove={() => remove(i)}
                onScript={() => setEditing(i)}
              />
            )}
          />
        </ol>
      )}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([
              ...steps,
              {
                role: null,
                who: "",
                channel: "call",
                budgetMinutes: 1,
                script: "",
              },
            ])
          }
        >
          <HiPlus className="h-4 w-4" />
          {tr("addStep", d)}
        </button>
      )}
      {editing !== null && editingStep && (
        <ScriptModal
          open
          step={editing + 1}
          script={editingStep.script ?? ""}
          sample={sample}
          readOnly={readOnly}
          d={d}
          templateDict={audience.d}
          onChange={(script) => set(editing, { script })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
