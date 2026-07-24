"use client";

import type { ReactNode } from "react";
import { Alert, Badge, Select, ToggleSwitch } from "flowbite-react";
import {
  HiInformationCircle,
  HiLightningBolt,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  REVIEW_CHANNELS,
  type ReviewChannelDescriptor,
  type ReviewChannelId,
  type ReviewIntegrationConfig,
  type ReviewTrigger,
} from "./review-integration.types";
import type { ReviewCredentialOption } from "./review-credentials.mock";

interface ReviewConfigTabProps {
  readonly enabled: boolean;
  readonly onEnabledChange: (value: boolean) => void;
  readonly channelId: ReviewChannelId | null;
  readonly onSelectChannel: (channel: ReviewChannelDescriptor) => void;
  readonly credentialId: string | null;
  readonly onCredentialChange: (id: string) => void;
  readonly trigger: ReviewTrigger;
  readonly onTriggerChange: (trigger: ReviewTrigger) => void;
  readonly credentials: readonly ReviewCredentialOption[];
  /** Stored config, for the async-job registration panel. */
  readonly stored: ReviewIntegrationConfig;
  readonly dict: I18nRecord;
}

export function ReviewConfigTab({
  enabled,
  onEnabledChange,
  channelId,
  onSelectChannel,
  credentialId,
  onCredentialChange,
  trigger,
  onTriggerChange,
  credentials,
  stored,
  dict,
}: Readonly<ReviewConfigTabProps>) {
  return (
    <div className="flex flex-col gap-6">
      {/* Enable */}
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
          <Section
            title={tr("channel.title", dict)}
            help={tr("channel.help", dict)}
          >
            <div className="grid grid-cols-1 gap-3">
              {REVIEW_CHANNELS.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  selected={channel.id === channelId}
                  onSelect={() => onSelectChannel(channel)}
                  dict={dict}
                />
              ))}
            </div>
          </Section>

          {channelId && (
            <>
              <Section
                title={tr("credential.title", dict)}
                help={tr("credential.help", dict)}
              >
                <CredentialPicker
                  credentials={credentials}
                  value={credentialId}
                  onChange={onCredentialChange}
                  dict={dict}
                />
              </Section>

              <Section
                title={tr("trigger.title", dict)}
                help={tr("trigger.help", dict)}
              >
                <Select
                  value={trigger}
                  onChange={(e) =>
                    onTriggerChange(e.target.value as ReviewTrigger)
                  }
                >
                  <option value="on_reject">
                    {tr("trigger.onReject", dict)}
                  </option>
                  <option value="on_review">
                    {tr("trigger.onReview", dict)}
                  </option>
                </Select>
              </Section>

              <JobPanel enabled={enabled} stored={stored} dict={dict} />
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
        {help && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ChannelCard({
  channel,
  selected,
  onSelect,
  dict,
}: Readonly<{
  channel: ReviewChannelDescriptor;
  selected: boolean;
  onSelect: () => void;
  dict: I18nRecord;
}>) {
  const Icon = channel.icon;
  const base =
    "flex items-start gap-3 rounded-lg border p-3 text-left transition-all";
  const state = !channel.available
    ? "cursor-not-allowed border-gray-200 opacity-60 dark:border-gray-700"
    : selected
      ? "cursor-pointer border-primary-500 ring-2 ring-primary-200 dark:border-primary-400 dark:ring-primary-900"
      : "cursor-pointer border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!channel.available}
      aria-pressed={selected}
      className={`${base} ${state}`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {trDynamic(channel.nameKey, dict)}
          </span>
          {!channel.available && (
            <Badge color="gray">{tr("channel.comingSoon", dict)}</Badge>
          )}
          {selected && channel.available && (
            <Badge color="indigo">{tr("channel.selected", dict)}</Badge>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
          {trDynamic(channel.descriptionKey, dict)}
        </span>
      </span>
    </button>
  );
}

function CredentialPicker({
  credentials,
  value,
  onChange,
  dict,
}: Readonly<{
  credentials: readonly ReviewCredentialOption[];
  value: string | null;
  onChange: (id: string) => void;
  dict: I18nRecord;
}>) {
  if (credentials.length === 0) {
    return (
      <Alert color="gray" icon={HiInformationCircle}>
        <span className="text-xs">{tr("credential.empty", dict)}</span>
      </Alert>
    );
  }
  const selected = credentials.find((credential) => credential.id === value);
  return (
    <div className="flex flex-col gap-2">
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          {tr("credential.placeholder", dict)}
        </option>
        {credentials.map((credential) => (
          <option key={credential.id} value={credential.id}>
            {credential.name} · {credential.environment}
          </option>
        ))}
      </Select>
      {selected && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-700">
            {selected.summary}
          </code>
          <Badge color={selected.verified ? "success" : "gray"}>
            {selected.verified
              ? tr("credential.verified", dict)
              : tr("credential.unverified", dict)}
          </Badge>
        </div>
      )}
    </div>
  );
}

function JobPanel({
  enabled,
  stored,
  dict,
}: Readonly<{
  enabled: boolean;
  stored: ReviewIntegrationConfig;
  dict: I18nRecord;
}>) {
  const registered = Boolean(stored.registeredJobId);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        <HiLightningBolt className="h-4 w-4 text-primary-500" />
        {tr("job.title", dict)}
      </div>
      {registered ? (
        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span>
            <Badge color={enabled ? "success" : "gray"}>
              {enabled ? tr("job.registered", dict) : tr("job.paused", dict)}
            </Badge>
          </span>
          <span>
            {tr("job.jobId", dict)}:{" "}
            <code className="font-mono">{stored.registeredJobId}</code>
          </span>
          {stored.lastRegisteredAt && (
            <span>
              {tr("job.lastRegistered", dict)}:{" "}
              {new Date(stored.lastRegisteredAt).toLocaleString()}
            </span>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {tr("job.willRegister", dict)}
        </p>
      )}
    </div>
  );
}
