"use client";

import type { ReactNode } from "react";
import { Alert, Badge, Select, ToggleSwitch } from "flowbite-react";
import { HiInformationCircle, HiLightningBolt } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  targetKey,
  type DispatchTarget,
  type EventBinding,
  type ReviewTrigger,
} from "./review-binding.types";

interface ReviewConfigTabProps {
  readonly enabled: boolean;
  readonly onEnabledChange: (value: boolean) => void;
  /** Channels the org can bind, from `/dispatch-targets`. */
  readonly targets: readonly DispatchTarget[];
  readonly selected: DispatchTarget | undefined;
  readonly onSelectTarget: (target: DispatchTarget) => void;
  readonly trigger: ReviewTrigger;
  readonly onTriggerChange: (trigger: ReviewTrigger) => void;
  /** The stored binding, when this column already has one. */
  readonly stored: EventBinding | undefined;
  readonly dict: I18nRecord;
}

export function ReviewConfigTab({
  enabled,
  onEnabledChange,
  targets,
  selected,
  onSelectTarget,
  trigger,
  onTriggerChange,
  stored,
  dict,
}: Readonly<ReviewConfigTabProps>) {
  return (
    <div className="flex flex-col gap-6">
      {stored?.inherited && (
        <Alert color="info" icon={HiInformationCircle}>
          <span className="text-xs">
            {tr("config.inherited", dict, { org: stored.ownerOrgSlug })}
          </span>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {tr("config.enableLabel", dict)}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("config.enableHelp", dict)}
          </p>
        </div>
        <ToggleSwitch checked={enabled} onChange={onEnabledChange} label="" />
      </div>

      {!enabled ? (
        <Alert color="gray" icon={HiInformationCircle}>
          <span className="text-xs">{tr("config.disabledNotice", dict)}</span>
        </Alert>
      ) : (
        <>
          <Section title={tr("channel.title", dict)} help={tr("channel.help", dict)}>
            {targets.length === 0 ? (
              <Alert color="gray" icon={HiInformationCircle}>
                <span className="text-xs">{tr("channel.empty", dict)}</span>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {targets.map((target) => (
                  <TargetCard
                    key={targetKey(target)}
                    target={target}
                    selected={
                      selected !== undefined && targetKey(selected) === targetKey(target)
                    }
                    onSelect={() => onSelectTarget(target)}
                    dict={dict}
                  />
                ))}
              </div>
            )}
          </Section>

          {selected && (
            <>
              <Section title={tr("trigger.title", dict)} help={tr("trigger.help", dict)}>
                <Select
                  value={trigger}
                  onChange={(e) => onTriggerChange(e.target.value as ReviewTrigger)}
                >
                  <option value="on_reject">{tr("trigger.onReject", dict)}</option>
                  <option value="on_review">{tr("trigger.onReview", dict)}</option>
                </Select>
              </Section>

              <JobPanel stored={stored} dict={dict} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Section({
  title,
  help,
  children,
}: Readonly<{ title: string; help?: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {help && <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * A channel is a connection *and* the operation to call on it.
 *
 * The credential is deliberately not chosen here, unlike in the mockup: a connection
 * already carries one, so picking the channel picks how it authenticates. Offering a
 * second choice would let the two disagree.
 */
function TargetCard({
  target,
  selected,
  onSelect,
  dict,
}: Readonly<{
  target: DispatchTarget;
  selected: boolean;
  onSelect: () => void;
  dict: I18nRecord;
}>) {
  const base = "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all";
  const state = selected
    ? "cursor-pointer border-primary-500 ring-2 ring-primary-200 dark:border-primary-400 dark:ring-primary-900"
    : "cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`${base} ${state}`}
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {target.connectionName}
        </span>
        <Badge color="gray">{target.providerType}</Badge>
        {selected && <Badge color="indigo">{tr("channel.selected", dict)}</Badge>}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{target.operationName}</span>
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-gray-700">
          {target.method} {target.path}
        </code>
      </span>
    </button>
  );
}

function JobPanel({
  stored,
  dict,
}: Readonly<{ stored: EventBinding | undefined; dict: I18nRecord }>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        <HiLightningBolt className="h-4 w-4 text-primary-500" />
        {tr("job.title", dict)}
      </div>
      {stored ? (
        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span>
            <Badge color={stored.enabled ? "success" : "gray"}>
              {stored.enabled ? tr("job.armed", dict) : tr("job.paused", dict)}
            </Badge>
          </span>
          <span>
            {tr("job.lastUpdated", dict)}: {new Date(stored.updatedAt).toLocaleString()}
            {stored.updatedBy ? ` · ${stored.updatedBy}` : ""}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("job.willRegister", dict)}
        </p>
      )}
    </div>
  );
}
