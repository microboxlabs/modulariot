"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Select, ToggleSwitch } from "flowbite-react";
import {
  HiInformationCircle,
  HiLightningBolt,
  HiPlus,
  HiTrash,
  HiPencilAlt,
  HiCheckCircle,
  HiExclamationCircle,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  channelKey,
  findTarget,
  targetKey,
  unmappedRequiredFields,
  type ChannelDraft,
  type DispatchTarget,
  type EventBinding,
  type ReviewTrigger,
} from "./review-binding.types";
import { checkTemplate } from "./review-template-validation";

interface ReviewConfigTabProps {
  readonly enabled: boolean;
  readonly onEnabledChange: (value: boolean) => void;
  /** Channels the org can bind, from `/dispatch-targets`. */
  readonly targets: readonly DispatchTarget[];
  /** The channels currently attached to this column (own, editable). */
  readonly channels: readonly ChannelDraft[];
  /** The org's own stored bindings, for the job-registry summary. */
  readonly stored: readonly EventBinding[];
  /** Channels defined by a parent org: shown for context, not editable here. */
  readonly inherited: readonly EventBinding[];
  readonly onAddChannel: (target: DispatchTarget) => void;
  readonly onDetachChannel: (channelKey: string) => void;
  readonly onTriggerChange: (channelKey: string, trigger: ReviewTrigger) => void;
  readonly onEditMapping: (channelKey: string) => void;
  readonly dict: I18nRecord;
}

export function ReviewConfigTab({
  enabled,
  onEnabledChange,
  targets,
  channels,
  stored,
  inherited,
  onAddChannel,
  onDetachChannel,
  onTriggerChange,
  onEditMapping,
  dict,
}: Readonly<ReviewConfigTabProps>) {
  const attached = new Set(
    channels.map((channel) => channelKey(channel.connectionId, channel.operationId))
  );
  const available = targets.filter((target) => !attached.has(targetKey(target)));

  return (
    <div className="flex flex-col gap-6">
      {inherited.length > 0 && (
        <InheritedChannels inherited={inherited} targets={targets} dict={dict} />
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
              <div className="flex flex-col gap-3">
                {channels.length === 0 ? (
                  <Alert color="gray" icon={HiInformationCircle}>
                    <span className="text-xs">{tr("channel.none", dict)}</span>
                  </Alert>
                ) : (
                  channels.map((channel) => (
                    <ChannelRow
                      key={channelKey(channel.connectionId, channel.operationId)}
                      channel={channel}
                      target={findTarget(
                        targets,
                        channel.connectionId,
                        channel.operationId
                      )}
                      onTriggerChange={onTriggerChange}
                      onDetach={onDetachChannel}
                      onEditMapping={onEditMapping}
                      dict={dict}
                    />
                  ))
                )}

                <AddChannelMenu
                  available={available}
                  allAttached={available.length === 0}
                  onAdd={onAddChannel}
                  dict={dict}
                />
              </div>
            )}
          </Section>

          {channels.length > 0 && <JobPanel stored={stored} dict={dict} />}
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
 * One attached channel: a connection + the operation to call on it, with its own
 * trigger and a shortcut into its mapping. The credential is not chosen here — a
 * connection already carries one, so the channel picks how it authenticates.
 */
function ChannelRow({
  channel,
  target,
  onTriggerChange,
  onDetach,
  onEditMapping,
  dict,
}: Readonly<{
  channel: ChannelDraft;
  target: DispatchTarget | undefined;
  onTriggerChange: (channelKey: string, trigger: ReviewTrigger) => void;
  onDetach: (channelKey: string) => void;
  onEditMapping: (channelKey: string) => void;
  dict: I18nRecord;
}>) {
  const key = channelKey(channel.connectionId, channel.operationId);
  const broken = Object.values(channel.templates).some(
    (template) => checkTemplate(template).status === "invalid"
  );
  const missing = unmappedRequiredFields(target, channel.templates).length;
  const mappingReady = Boolean(target) && missing === 0 && !broken;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {target?.connectionName ?? channel.connectionId}
            </span>
            {target && <Badge color="gray">{target.providerType}</Badge>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {target ? (
              <>
                <span>{target.operationName}</span>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-gray-700">
                  {target.method} {target.path}
                </code>
              </>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                {tr("channel.unknown", dict)}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDetach(key)}
          aria-label={tr("channel.detach", dict)}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          <HiTrash className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Select
          sizing="sm"
          className="flex-1"
          value={channel.trigger}
          onChange={(e) => onTriggerChange(key, e.target.value as ReviewTrigger)}
        >
          <option value="on_reject">{tr("trigger.onReject", dict)}</option>
          <option value="on_review">{tr("trigger.onReview", dict)}</option>
        </Select>
        <Button
          type="button"
          color={mappingReady ? "light" : "warning"}
          size="xs"
          onClick={() => onEditMapping(key)}
          disabled={!target}
        >
          {mappingReady ? (
            <HiCheckCircle className="mr-1 h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          ) : (
            <HiExclamationCircle className="mr-1 h-3.5 w-3.5" />
          )}
          {tr("channel.mapping", dict)}
        </Button>
      </div>
    </div>
  );
}

/** The "+ add channel" affordance: a menu of channels not already attached. */
function AddChannelMenu({
  available,
  allAttached,
  onAdd,
  dict,
}: Readonly<{
  available: readonly DispatchTarget[];
  allAttached: boolean;
  onAdd: (target: DispatchTarget) => void;
  dict: I18nRecord;
}>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (allAttached) {
    return (
      <p className="text-xs text-gray-400">{tr("channel.allAttached", dict)}</p>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        color="light"
        size="sm"
        className="w-full"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <HiPlus className="mr-1 h-4 w-4" />
        {tr("channel.add", dict)}
      </Button>
      {open && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-600 dark:bg-gray-800">
          {available.map((target) => (
            <button
              key={targetKey(target)}
              type="button"
              onClick={() => {
                onAdd(target);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="flex w-full items-center gap-2">
                <HiPencilAlt className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-100">
                  {target.connectionName}
                </span>
                <Badge color="gray" className="ml-auto">
                  {target.providerType}
                </Badge>
              </span>
              <code className="ml-5 truncate font-mono text-[10px] text-gray-400">
                {target.method} {target.path}
              </code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Channels inherited from a parent org: live and visible, but not this org's to edit. */
function InheritedChannels({
  inherited,
  targets,
  dict,
}: Readonly<{
  inherited: readonly EventBinding[];
  targets: readonly DispatchTarget[];
  dict: I18nRecord;
}>) {
  const org = inherited[0]?.ownerOrgSlug ?? "";
  return (
    <Alert color="info" icon={HiInformationCircle}>
      <div className="flex flex-col gap-1">
        <span className="text-xs">{tr("config.inherited", dict, { org })}</span>
        <ul className="flex flex-col gap-0.5">
          {inherited.map((binding) => {
            const target = findTarget(
              targets,
              binding.connectionId,
              binding.operationId
            );
            return (
              <li
                key={binding.id}
                className="text-[11px] text-gray-600 dark:text-gray-300"
              >
                • {target?.connectionName ?? binding.connectionId}
                {target ? (
                  <code className="ml-1 font-mono opacity-70">
                    {target.method} {target.path}
                  </code>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </Alert>
  );
}

function JobPanel({
  stored,
  dict,
}: Readonly<{ stored: readonly EventBinding[]; dict: I18nRecord }>) {
  const armed = stored.filter((binding) => binding.enabled).length;
  const latest = stored.reduce<EventBinding | undefined>((newest, binding) => {
    if (!newest) return binding;
    return binding.updatedAt > newest.updatedAt ? binding : newest;
  }, undefined);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        <HiLightningBolt className="h-4 w-4 text-primary-500" />
        {tr("job.title", dict)}
      </div>
      {latest ? (
        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span>
            <Badge color={armed > 0 ? "success" : "gray"}>
              {trDynamic("job.channelSummary", dict, {
                count: String(stored.length),
                armed: String(armed),
              })}
            </Badge>
          </span>
          <span>
            {tr("job.lastUpdated", dict)}: {new Date(latest.updatedAt).toLocaleString()}
            {latest.updatedBy ? ` · ${latest.updatedBy}` : ""}
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
