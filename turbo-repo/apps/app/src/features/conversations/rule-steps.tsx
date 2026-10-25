"use client";

import { HiArrowDown, HiArrowUp, HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  FIELD,
  FIELD_ERROR,
  FieldError,
} from "@/features/symptoms/maintainer/ui/response-block";
import Select from "@/features/symptoms/maintainer/ui/select";
import AudienceList, { ICON_BUTTON } from "./audience-list";
import type {
  ConversationTemplate,
  EventField,
  OnReply,
  RuleChannel,
  RuleStep,
} from "./conversations-types";
import type { StepIssues } from "./rule-findings";
import { isConnectionChannel } from "./channel-types";
import { useConnectionChannel } from "./conversations-api";
import { emptyStep, REPLY_CHANNELS, STEP_CHANNELS } from "./rule-model";
import { moved, useRowKeys } from "./row-keys";

const minutes = (value: string) =>
  value ? Math.max(0, Math.round(Number(value))) : 0;

const NO_TEXTS: I18nRecord = {};

function StepActions({
  index,
  last,
  d,
  onMove,
  onRemove,
}: Readonly<{
  index: number;
  last: boolean;
  d: I18nRecord;
  onMove: (by: number) => void;
  onRemove: () => void;
}>) {
  return (
    <span className="ml-auto flex items-center">
      <button
        type="button"
        aria-label={tr("moveUp", d)}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className={ICON_BUTTON}
      >
        <HiArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tr("moveDown", d)}
        disabled={last}
        onClick={() => onMove(1)}
        className={ICON_BUTTON}
      >
        <HiArrowDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={tr("removeStep", d)}
        onClick={onRemove}
        className={`${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
      >
        <HiX className="h-4 w-4" />
      </button>
    </span>
  );
}

/** The connection a step on a connection channel calls, from that channel's connections. */
function ConnectionSelect({
  channel,
  value,
  invalid,
  readOnly,
  d,
  onChange,
}: Readonly<{
  channel: string;
  value: string | undefined;
  invalid: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (connection: string | undefined) => void;
}>) {
  const { data } = useConnectionChannel(channel);
  const connections = data?.connections ?? [];
  const known = !value || connections.some((c) => c.id === value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{tr("stepConnection", d)}</span>
      <Select
        aria-label={tr("stepConnection", d)}
        className={`${FIELD} ${invalid ? FIELD_ERROR : ""}`}
        wrapperClassName="min-w-44 flex-1"
        disabled={readOnly}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{tr("pickConnection", d)}</option>
        {!known && <option value={value}>{value}</option>}
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function StepRow({
  step,
  index,
  count,
  templates,
  fields,
  issues,
  readOnly,
  d,
  fieldDict = NO_TEXTS,
  onSet,
  onMove,
  onRemove,
}: Readonly<{
  step: RuleStep;
  index: number;
  count: number;
  templates: ConversationTemplate[];
  fields: EventField[];
  issues: StepIssues | undefined;
  readOnly: boolean;
  d: I18nRecord;
  fieldDict?: I18nRecord;
  onSet: (patch: Partial<RuleStep>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}>) {
  const replies = REPLY_CHANNELS.has(step.channel);
  const knownTemplate =
    step.template === "" || templates.some((t) => t.key === step.template);
  const custom = Array.isArray(step.to);
  const viaConnection = isConnectionChannel(step.channel);
  const templateError = issues?.template ? FIELD_ERROR : "";
  const channelError = issues?.channel ? FIELD_ERROR : "";
  return (
    <li
      aria-label={tr("stepN", d, { n: String(index + 1) })}
      className="flex gap-3 px-3 py-3"
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {index === 0 ? tr("stepAfterFirst", d) : tr("stepAfter", d)}
          </span>
          <input
            type="number"
            min={0}
            aria-label={tr("stepAfterLabel", d)}
            className={`${FIELD} w-16`}
            disabled={readOnly}
            value={step.after}
            onChange={(e) => onSet({ after: minutes(e.target.value) })}
          />
          <span>{tr("stepMinBy", d)}</span>
          <Select
            aria-label={tr("stepChannel", d)}
            className={`${FIELD} ${channelError}`}
            disabled={readOnly}
            value={step.channel}
            onChange={(e) => {
              const channel = e.target.value as RuleChannel;
              // A connection belongs to one channel: a Slack webhook is not a Teams one.
              onSet(
                REPLY_CHANNELS.has(channel)
                  ? { channel, connection: undefined }
                  : { channel, connection: undefined, waitForReply: 0 }
              );
            }}
          >
            {STEP_CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {trDynamic(c.label, d)}
              </option>
            ))}
          </Select>
          <span>{tr("stepWithTemplate", d)}</span>
          <Select
            aria-label={tr("stepTemplate", d)}
            className={`${FIELD} ${templateError}`}
            wrapperClassName="min-w-44 flex-1"
            disabled={readOnly}
            value={step.template}
            onChange={(e) => onSet({ template: e.target.value })}
          >
            <option value="">
              {viaConnection
                ? tr("stepTemplateOptional", d)
                : tr("pickTemplate", d)}
            </option>
            {!knownTemplate && (
              <option value={step.template}>{step.template}</option>
            )}
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </Select>
          {!readOnly && (
            <StepActions
              index={index}
              last={index === count - 1}
              d={d}
              onMove={onMove}
              onRemove={onRemove}
            />
          )}
        </div>
        {viaConnection && (
          <ConnectionSelect
            channel={step.channel}
            value={step.connection}
            invalid={issues?.connection ?? false}
            readOnly={readOnly}
            d={d}
            onChange={(connection) => onSet({ connection })}
          />
        )}
        <div
          className={
            viaConnection ? "hidden" : "flex flex-wrap items-center gap-2"
          }
        >
          <span>{tr("stepToLabel", d)}</span>
          <Select
            aria-label={tr("stepToLabel", d)}
            className={FIELD}
            disabled={readOnly}
            value={custom ? "custom" : "audience"}
            onChange={(e) =>
              onSet({
                to:
                  e.target.value === "custom"
                    ? [{ role: "tower_lead" }]
                    : "audience",
              })
            }
          >
            <option value="audience">{tr("stepToAudience", d)}</option>
            <option value="custom">{tr("stepToCustom", d)}</option>
          </Select>
        </div>
        {!viaConnection && Array.isArray(step.to) && (
          <AudienceList
            entries={step.to}
            fields={fields}
            errors={issues?.entries}
            readOnly={readOnly}
            d={d}
            fieldDict={fieldDict}
            label={tr("stepToLabel", d)}
            onChange={(to) => onSet({ to })}
          />
        )}
        {replies ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>{tr("stepWait", d)}</span>
            <input
              type="number"
              min={0}
              aria-label={tr("stepWaitLabel", d)}
              className={`${FIELD} w-16`}
              disabled={readOnly}
              value={step.waitForReply}
              onChange={(e) => onSet({ waitForReply: minutes(e.target.value) })}
            />
            <span>{tr("stepWaitMin", d)}</span>
            {step.waitForReply > 0 && (
              <>
                <span className="ml-2">{tr("stepOnReply", d)}</span>
                <Select
                  aria-label={tr("stepOnReply", d)}
                  className={FIELD}
                  disabled={readOnly}
                  value={step.onReply}
                  onChange={(e) =>
                    onSet({ onReply: e.target.value as OnReply })
                  }
                >
                  <option value="stop">{tr("onReplyStop", d)}</option>
                  <option value="continue">{tr("onReplyContinue", d)}</option>
                </Select>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("stepNoReplies", d)}
          </p>
        )}
        {(issues?.messages ?? []).map((e) => (
          <FieldError key={e} text={e} />
        ))}
      </div>
    </li>
  );
}

/** "Pasos": the messages in order, each after a pause, maybe waiting for a reply. */
export default function RuleSteps({
  steps,
  templates,
  fields,
  errors = {},
  readOnly,
  d,
  fieldDict = NO_TEXTS,
  onChange,
}: Readonly<{
  steps: RuleStep[];
  templates: ConversationTemplate[];
  fields: EventField[];
  /** The validator's findings by step index. */
  errors?: Record<number, StepIssues>;
  readOnly: boolean;
  d: I18nRecord;
  /** The selectables field texts, for the contact book conditions. */
  fieldDict?: I18nRecord;
  onChange: (steps: RuleStep[]) => void;
}>) {
  const rows = useRowKeys(steps.length);
  const set = (i: number, patch: Partial<RuleStep>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="flex flex-col gap-2">
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noSteps", d)}
        </p>
      )}
      {steps.length > 0 && (
        <ol
          aria-label={tr("sectionSteps", d)}
          className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800"
        >
          {steps.map((s, i) => (
            <StepRow
              key={rows.keys[i]}
              step={s}
              index={i}
              count={steps.length}
              templates={templates}
              fields={fields}
              issues={errors[i]}
              readOnly={readOnly}
              d={d}
              fieldDict={fieldDict}
              onSet={(patch) => set(i, patch)}
              onMove={(by) => {
                rows.move(i, by);
                onChange(moved(steps, i, by));
              }}
              onRemove={() => {
                rows.remove(i);
                onChange(steps.filter((_, j) => j !== i));
              }}
            />
          ))}
        </ol>
      )}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => onChange([...steps, emptyStep()])}
        >
          <HiPlus className="h-4 w-4" />
          {tr("addStep", d)}
        </button>
      )}
    </div>
  );
}
