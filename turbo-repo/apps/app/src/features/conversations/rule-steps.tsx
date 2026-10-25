"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HiEye, HiEyeOff, HiPlus, HiTrash } from "react-icons/hi";
import SortableRows from "@/features/common/components/sortable-rows";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { FieldError } from "@/features/symptoms/maintainer/ui/response-block";
import { PillNumber, PillSelect } from "@/features/symptoms/maintainer/ui/pill";
import { channelLogo } from "./channel-icon";
import type {
  ConversationTemplate,
  MetaTemplate,
  OnReply,
  RecipientGroup,
  RuleChannel,
  RuleStep,
} from "./conversations-types";
import type { StepIssues } from "./rule-findings";
import { useConnectionChannel, useOrgMetaTemplates } from "./conversations-api";
import TemplatePicker, { TemplatePreview } from "./template-picker";
import {
  emptyStep,
  groupLabel,
  REPLY_CHANNELS,
  STEP_CHANNELS,
  writesToGroups,
} from "./rule-model";
import { moved, useRowKeys } from "./row-keys";
import { COMMUNICATIONS_PAGE } from "./rules-tab";
import { channelSection } from "./communications-sections";

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

/** How the next step follows step `i`: right away, if nobody replies within N, after N either way, or after N. */
export type GapMode = "now" | "stop" | "continue" | "after";

/** Minutes a gap gets when it stops being immediate. */
const DEFAULT_GAP = 5;

export function gapMode(steps: RuleStep[], i: number): GapMode {
  const replies = REPLY_CHANNELS.has(steps[i].channel);
  const total = gapMinutes(steps, i);
  if (total === 0 && (!replies || steps[i].onReply === "continue"))
    return "now";
  return replies ? steps[i].onReply : "after";
}

/** The steps with the gap after step `i` set to `mode`; "now" is 0 minutes whether or not someone replies. */
export function withGapMode(
  steps: RuleStep[],
  i: number,
  mode: GapMode
): RuleStep[] {
  const total = gapMinutes(steps, i);
  const minutes = mode === "now" ? 0 : total || DEFAULT_GAP;
  const onReply: OnReply = mode === "stop" ? "stop" : "continue";
  return withGap(steps, i, minutes).map((s, j) =>
    j === i && REPLY_CHANNELS.has(s.channel) ? { ...s, onReply } : s
  );
}

/**
 * The connection a step on a connection channel calls, from that channel's connections. Without any, it
 * links to the channel's page, where one is created; the list reloads when the tab is back in focus.
 */
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
  const lang = useParams<{ lang?: string }>()?.lang ?? "es";
  const connections = data?.connections ?? [];
  const known = !value || connections.some((c) => c.id === value);
  const label = STEP_CHANNELS.find((c) => c.value === channel)?.label;
  if (data && connections.length === 0 && !value)
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {tr("noConnections", d, {
          channel: label ? trDynamic(label, d) : channel,
        })}{" "}
        <Link
          href={`/${lang}${COMMUNICATIONS_PAGE}?section=${encodeURIComponent(channelSection(channel))}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-600 hover:underline dark:text-blue-500"
        >
          {tr("createConnection", d)}
        </Link>
      </span>
    );
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

/** A channel's logo at text size, in the logos' gray. */
function ChannelGlyph({ channel }: Readonly<{ channel: string }>) {
  const Logo = channelLogo(channel);
  return (
    <Logo
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-gray-400"
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
    <fieldset
      className={`flex min-w-0 flex-wrap items-center gap-1 rounded-full border-0 p-0 ${invalid ? "ring-1 ring-red-500 ring-offset-2 dark:ring-offset-gray-800" : ""}`}
    >
      <legend className="sr-only">{tr("stepGroups", d)}</legend>
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
    </fieldset>
  );
}

function StepCard({
  step,
  handle,
  templates,
  groups,
  meta,
  issues,
  readOnly,
  d,
  onSet,
  onRemove,
}: Readonly<{
  step: RuleStep;
  handle: ReactNode;
  templates: ConversationTemplate[];
  groups: RecipientGroup[];
  meta: MetaTemplate[];
  issues: StepIssues | undefined;
  readOnly: boolean;
  d: I18nRecord;
  onSet: (patch: Partial<RuleStep>) => void;
  onRemove: () => void;
}>) {
  const viaConnection = !writesToGroups(step.channel);
  const [previewing, setPreviewing] = useState(false);
  const template = templates.find((t) => t.key === step.template);
  const emptyLabel = viaConnection
    ? tr("stepTemplateOptional", d)
    : tr("pickTemplate", d);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {handle}
      <PillSelect
        ariaLabel={tr("stepChannel", d)}
        icon={<ChannelGlyph channel={step.channel} />}
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
      <TemplatePicker
        value={step.template}
        templates={templates}
        channel={step.channel}
        meta={meta}
        emptyLabel={emptyLabel}
        invalid={issues?.template ?? false}
        readOnly={readOnly}
        d={d}
        onChange={(key) => onSet({ template: key })}
      />
      {template && (
        <button
          type="button"
          aria-label={
            previewing ? tr("hideTemplate", d) : tr("showTemplate", d)
          }
          aria-pressed={previewing}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          onClick={() => setPreviewing(!previewing)}
        >
          {previewing ? (
            <HiEyeOff className="h-4 w-4" />
          ) : (
            <HiEye className="h-4 w-4" />
          )}
        </button>
      )}
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
      {!readOnly && (
        <button
          type="button"
          aria-label={tr("removeStep", d)}
          onClick={onRemove}
          className="ml-auto text-gray-400 hover:text-red-500"
        >
          <HiTrash className="h-4 w-4" />
        </button>
      )}
      {(issues?.messages ?? []).length > 0 && (
        <div className="flex w-full flex-col gap-0.5">
          {(issues?.messages ?? []).map((e) => (
            <FieldError key={e} text={e} />
          ))}
        </div>
      )}
      {template && previewing && (
        <div className="w-full border-t border-gray-100 pt-2 dark:border-gray-700">
          <TemplatePreview
            template={template}
            channel={step.channel}
            meta={meta}
            d={d}
          />
        </div>
      )}
    </div>
  );
}

/** The wait between a step and the next, on the line that joins them. */
function Gap({
  step,
  mode,
  total,
  readOnly,
  d,
  onGap,
  onMode,
}: Readonly<{
  step: RuleStep;
  mode: GapMode;
  total: number;
  readOnly: boolean;
  d: I18nRecord;
  onGap: (minutes: number) => void;
  onMode: (mode: GapMode) => void;
}>) {
  const replies = REPLY_CHANNELS.has(step.channel);
  const options = replies
    ? [
        { value: "now", label: tr("gapNow", d) },
        { value: "stop", label: tr("gapNoReply", d) },
        { value: "continue", label: tr("gapAnyway", d) },
      ]
    : [
        { value: "now", label: tr("gapNow", d) },
        { value: "after", label: tr("gapAfter", d) },
      ];
  return (
    <div className="ml-4 flex flex-wrap items-center gap-2 border-l-2 border-dashed border-gray-300 py-2 pl-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-400">
      <PillSelect
        ariaLabel={tr("gapWhen", d)}
        disabled={readOnly}
        value={mode}
        onChange={(v) => onMode(v as GapMode)}
        options={options}
      />
      {mode !== "now" && (
        <PillNumber
          ariaLabel={tr("gapMinutes", d)}
          disabled={readOnly}
          value={total}
          unit="min"
          onChange={(v) => onGap(minutes(v))}
        />
      )}
      {mode === "stop" && (
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
  const { data: meta } = useOrgMetaTemplates(
    steps.some((s) => s.channel === "whatsapp" || s.channel === "preferred")
  );
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
                  handle={handle}
                  templates={templates}
                  groups={groups}
                  meta={meta ?? []}
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
                    mode={gapMode(steps, i)}
                    total={gapMinutes(steps, i)}
                    readOnly={readOnly}
                    d={d}
                    onGap={(m) => onChange(withGap(steps, i, m))}
                    onMode={(mode) => onChange(withGapMode(steps, i, mode))}
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
