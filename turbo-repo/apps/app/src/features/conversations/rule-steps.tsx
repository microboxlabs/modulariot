"use client";

import type { ReactNode } from "react";
import { HiPlus, HiX } from "react-icons/hi";
import SortableRows from "@/features/common/components/sortable-rows";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { FieldError } from "@/features/symptoms/maintainer/ui/response-block";
import { PillNumber, PillSelect } from "@/features/symptoms/maintainer/ui/pill";
import { ICON_BUTTON } from "./audience-list";
import ChannelIcon from "./channel-icon";
import type {
  ConversationTemplate,
  OnReply,
  RecipientGroup,
  RuleChannel,
  RuleStep,
} from "./conversations-types";
import type { StepIssues } from "./rule-findings";
import { useConnectionChannel } from "./conversations-api";
import {
  emptyStep,
  groupLabel,
  REPLY_CHANNELS,
  STEP_CHANNELS,
  writesToGroups,
} from "./rule-model";
import { moved, useRowKeys } from "./row-keys";

const minutes = (value: number | null) =>
  value ? Math.max(0, Math.round(value)) : 0;

const ERROR_PILL = "!border-red-500";

/** Minutes between step `i` and the next: step i's wait for a reply plus the next step's own delay. */
export function gapMinutes(steps: RuleStep[], i: number): number {
  return (steps[i]?.waitForReply ?? 0) + (steps[i + 1]?.after ?? 0);
}

/**
 * The steps with the gap after step `i` set to `total` minutes: kept as step i's wait when it can get a
 * reply, else as the next step's delay. The engine waits the sum either way.
 */
export function withGap(
  steps: RuleStep[],
  i: number,
  total: number
): RuleStep[] {
  const replies = REPLY_CHANNELS.has(steps[i].channel);
  return steps.map((s, j) => {
    if (j === i) return { ...s, waitForReply: replies ? total : 0 };
    if (j === i + 1) return { ...s, after: replies ? 0 : total };
    return s;
  });
}

/** The connection a step on a connection channel calls, from that channel's connections. */
function ConnectionPill({
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
    <PillSelect
      ariaLabel={tr("stepConnection", d)}
      className={invalid ? ERROR_PILL : ""}
      disabled={readOnly}
      value={value ?? ""}
      onChange={(v) => onChange(v || undefined)}
      options={[
        { value: "", label: tr("pickConnection", d) },
        ...(known ? [] : [{ value: value ?? "", label: value ?? "" }]),
        ...connections.map((c) => ({ value: c.id, label: c.name })),
      ]}
    />
  );
}

function chipClass(on: boolean) {
  if (on)
    return "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-200";
  return "border-gray-300 text-gray-600 hover:border-blue-400 dark:border-gray-600 dark:text-gray-300";
}

/** The groups a step writes to, as chips that toggle; ids no group has show in red. */
function GroupChips({
  to,
  groups,
  invalid,
  readOnly,
  d,
  onChange,
}: Readonly<{
  to: string[];
  groups: RecipientGroup[];
  invalid: boolean;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (to: string[]) => void;
}>) {
  const unknown = to.filter((id) => !groups.some((g) => g.id === id));
  if (groups.length === 0 && unknown.length === 0) {
    return (
      <span className="text-xs text-red-600 dark:text-red-400">
        {tr("stepNoGroups", d)}
      </span>
    );
  }
  const toggle = (id: string) =>
    onChange(to.includes(id) ? to.filter((x) => x !== id) : [...to, id]);
  return (
    <span
      role="group"
      aria-label={tr("stepGroups", d)}
      className={`flex flex-wrap items-center gap-1 rounded-full ${invalid ? "ring-1 ring-red-500 ring-offset-2 dark:ring-offset-gray-800" : ""}`}
    >
      {groups.map((g, i) => (
        <button
          key={g.id}
          type="button"
          aria-pressed={to.includes(g.id)}
          disabled={readOnly}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium disabled:cursor-not-allowed ${chipClass(to.includes(g.id))}`}
          onClick={() => toggle(g.id)}
        >
          {groupLabel(g, i, d)}
        </button>
      ))}
      {unknown.map((id) => (
        <button
          key={id}
          type="button"
          title={tr("stepUnknownGroupHint", d)}
          disabled={readOnly}
          className="rounded-full border border-red-400 px-2.5 py-0.5 font-mono text-xs text-red-600 dark:text-red-400"
          onClick={() => toggle(id)}
        >
          {id} ✕
        </button>
      ))}
    </span>
  );
}

function StepCard({
  step,
  index,
  handle,
  templates,
  groups,
  issues,
  readOnly,
  d,
  onSet,
  onRemove,
}: Readonly<{
  step: RuleStep;
  index: number;
  handle: ReactNode;
  templates: ConversationTemplate[];
  groups: RecipientGroup[];
  issues: StepIssues | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onSet: (patch: Partial<RuleStep>) => void;
  onRemove: () => void;
}>) {
  const viaConnection = !writesToGroups(step.channel);
  const knownTemplate =
    step.template === "" || templates.some((t) => t.key === step.template);
  const emptyLabel = viaConnection
    ? tr("stepTemplateOptional", d)
    : tr("pickTemplate", d);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <span className="flex h-7 w-4 shrink-0 items-center">{handle}</span>
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300"
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          <ChannelIcon channel={step.channel} size={7} />
          <PillSelect
            ariaLabel={tr("stepChannel", d)}
            className={issues?.channel ? ERROR_PILL : ""}
            disabled={readOnly}
            value={step.channel}
            onChange={(v) => onSet({ channel: v as RuleChannel })}
            options={STEP_CHANNELS.map((c) => ({
              value: c.value,
              label: trDynamic(c.label, d),
            }))}
          />
          <span>{tr("stepWithTemplate", d)}</span>
          <PillSelect
            ariaLabel={tr("stepTemplate", d)}
            className={issues?.template ? ERROR_PILL : ""}
            disabled={readOnly}
            value={step.template}
            onChange={(template) => onSet({ template })}
            options={[
              { value: "", label: emptyLabel },
              ...(knownTemplate
                ? []
                : [{ value: step.template, label: step.template }]),
              ...templates.map((t) => ({ value: t.key, label: t.name })),
            ]}
          />
          <span aria-hidden className="text-gray-400">
            →
          </span>
          {viaConnection ? (
            <ConnectionPill
              channel={step.channel}
              value={step.connection}
              invalid={issues?.connection ?? false}
              readOnly={readOnly}
              d={d}
              onChange={(connection) => onSet({ connection })}
            />
          ) : (
            <GroupChips
              to={step.to}
              groups={groups}
              invalid={issues?.groups ?? false}
              readOnly={readOnly}
              d={d}
              onChange={(to) => onSet({ to })}
            />
          )}
        </div>
        {(issues?.messages ?? []).map((e) => (
          <FieldError key={e} text={e} />
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("removeStep", d)}
          onClick={onRemove}
          className={`${ICON_BUTTON} shrink-0 hover:text-red-600 dark:hover:text-red-400`}
        >
          <HiX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** The wait between a step and the next, on the line that joins them. */
function Gap({
  step,
  total,
  readOnly,
  d,
  onGap,
  onReply,
}: Readonly<{
  step: RuleStep;
  total: number;
  readOnly: boolean;
  d: I18nRecord;
  onGap: (minutes: number) => void;
  onReply: (onReply: OnReply) => void;
}>) {
  const replies = REPLY_CHANNELS.has(step.channel);
  return (
    <div className="ml-[3.1rem] flex flex-wrap items-center gap-2 border-l-2 border-dashed border-gray-300 py-2 pl-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
      {replies ? (
        <PillSelect
          ariaLabel={tr("gapWhen", d)}
          disabled={readOnly}
          value={step.onReply}
          onChange={(v) => onReply(v as OnReply)}
          options={[
            { value: "stop", label: tr("gapNoReply", d) },
            { value: "continue", label: tr("gapAnyway", d) },
          ]}
        />
      ) : (
        <span>{tr("gapAfter", d)}</span>
      )}
      <PillNumber
        ariaLabel={tr("gapMinutes", d)}
        disabled={readOnly}
        value={total}
        unit="min"
        onChange={(v) => onGap(minutes(v))}
      />
      {replies && step.onReply === "stop" && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("gapStopHint", d)}
        </span>
      )}
    </div>
  );
}

/** When the first step goes: as the event arrives, or some minutes later. */
function Start({
  after,
  readOnly,
  d,
  onChange,
}: Readonly<{
  after: number;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (after: number) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <span>{tr("startOnEvent", d)}</span>
      <PillSelect
        ariaLabel={tr("startWhen", d)}
        disabled={readOnly}
        value={after > 0 ? "later" : "now"}
        onChange={(v) => onChange(v === "later" ? 5 : 0)}
        options={[
          { value: "now", label: tr("startNow", d) },
          { value: "later", label: tr("startLater", d) },
        ]}
      />
      {after > 0 && (
        <PillNumber
          ariaLabel={tr("stepAfterLabel", d)}
          disabled={readOnly}
          value={after}
          unit="min"
          onChange={(v) => onChange(minutes(v))}
        />
      )}
    </div>
  );
}

/** After the last step, how long a reply still counts. */
function TailWait({
  wait,
  readOnly,
  d,
  onChange,
}: Readonly<{
  wait: number;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (wait: number) => void;
}>) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span>{tr("tailWait", d)}</span>
      <PillNumber
        ariaLabel={tr("stepWaitLabel", d)}
        disabled={readOnly}
        value={wait}
        unit="min"
        onChange={(v) => onChange(minutes(v))}
      />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {tr("tailWaitHint", d)}
      </span>
    </div>
  );
}

/** The steps after `channel` changed on step `i`: no connection, and the gaps keep their minutes. */
function withChannel(
  steps: RuleStep[],
  i: number,
  channel: RuleChannel
): RuleStep[] {
  const gap = gapMinutes(steps, i);
  let next = steps.map((s, j) =>
    j === i ? { ...s, channel, connection: undefined } : s
  );
  if (i + 1 < steps.length) next = withGap(next, i, gap);
  else if (!REPLY_CHANNELS.has(channel))
    next = next.map((s, j) => (j === i ? { ...s, waitForReply: 0 } : s));
  return next;
}

/** "Pasos": the messages in order; each next one goes when nobody answered, or after some minutes. */
export default function RuleSteps({
  steps,
  groups,
  templates,
  errors = {},
  readOnly,
  d,
  onChange,
}: Readonly<{
  steps: RuleStep[];
  groups: RecipientGroup[];
  templates: ConversationTemplate[];
  /** The validator's findings by step index. */
  errors?: Record<number, StepIssues>;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (steps: RuleStep[]) => void;
}>) {
  const rows = useRowKeys(steps.length);
  const set = (i: number, patch: Partial<RuleStep>) => {
    if (patch.channel && patch.channel !== steps[i].channel) {
      onChange(withChannel(steps, i, patch.channel));
      return;
    }
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };
  const first = steps[0];
  const last = steps.at(-1);
  return (
    <div className="flex flex-col gap-2">
      {first && (
        <Start
          after={first.after}
          readOnly={readOnly}
          d={d}
          onChange={(after) => set(0, { after })}
        />
      )}
      {steps.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noSteps", d)}
        </p>
      )}
      {steps.length > 0 && (
        <ol aria-label={tr("sectionSteps", d)} className="flex flex-col">
          <SortableRows
            items={steps}
            keys={rows.keys}
            readOnly={readOnly}
            handleLabel={tr("dragStep", d)}
            as="li"
            rowClassName="rounded-lg"
            rowLabel={(i) => tr("stepN", d, { n: String(i + 1) })}
            onMove={(from, to) => {
              rows.move(from, to - from);
              onChange(moved(steps, from, to - from));
            }}
            renderRow={(s, i, handle) => (
              <>
                <StepCard
                  step={s}
                  index={i}
                  handle={handle}
                  templates={templates}
                  groups={groups}
                  issues={errors[i]}
                  readOnly={readOnly}
                  d={d}
                  onSet={(patch) => set(i, patch)}
                  onRemove={() => {
                    rows.remove(i);
                    onChange(steps.filter((_, j) => j !== i));
                  }}
                />
                {i < steps.length - 1 && (
                  <Gap
                    step={s}
                    total={gapMinutes(steps, i)}
                    readOnly={readOnly}
                    d={d}
                    onGap={(m) => onChange(withGap(steps, i, m))}
                    onReply={(onReply) => set(i, { onReply })}
                  />
                )}
              </>
            )}
          />
        </ol>
      )}
      {last && REPLY_CHANNELS.has(last.channel) && (
        <TailWait
          wait={last.waitForReply}
          readOnly={readOnly}
          d={d}
          onChange={(waitForReply) => set(steps.length - 1, { waitForReply })}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() =>
            onChange([...steps, emptyStep(groups[0] ? [groups[0].id] : [])])
          }
        >
          <HiPlus className="h-4 w-4" />
          {tr("addStep", d)}
        </button>
      )}
    </div>
  );
}
