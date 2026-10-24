"use client";

import { useState } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import EmailChannelCard from "@/features/settings-admin/email/email-channel-card";
import WhatsAppChannelCard from "@/features/settings-admin/whatsapp/whatsapp-channel-card";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import ChannelIcon from "./channel-icon";
import type { ChannelType } from "./channel-types";
import { mutate } from "swr";
import {
  accountsKey,
  setChannelAccountMode,
  useChannelAccounts,
} from "./conversations-api";
import type { ChannelAccountMode } from "./conversations-types";
import OwnTemplatesPanel from "./own-templates-panel";

const BADGE = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

/** One of the two accounts the rules can send from, as a radio. */
function ModeOption({
  title,
  body,
  badge,
  tone,
  checked,
  disabled,
  onSelect,
}: Readonly<{
  title: string;
  body: string;
  badge: string;
  tone: keyof typeof BADGE;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled && !checked}
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-lg border p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-gray-400 bg-gray-50 dark:border-gray-500 dark:bg-gray-700/60"
          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/40"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            checked
              ? "border-gray-900 dark:border-white"
              : "border-gray-400 dark:border-gray-500"
          }`}
        >
          {checked && (
            <span className="h-2 w-2 rounded-full bg-gray-900 dark:bg-white" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}
        >
          {badge}
        </span>
      </span>
      <span className={`text-sm ${MUTED}`}>{body}</span>
    </button>
  );
}

/** Which account the organization's rules send this channel from. Owners choose; OWN needs a connection. */
function SendFrom({
  channel,
  canConfigure,
  d,
}: Readonly<{ channel: ChannelType; canConfigure: boolean; d: I18nRecord }>) {
  const { data: accounts, error } = useChannelAccounts();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const account = accounts?.find((a) => a.channel === channel.key);
  // Nothing is checked until the accounts load.
  const mode = account?.mode;
  const ownConnected = account?.ownConnected ?? false;

  const choose = async (next: ChannelAccountMode) => {
    if (!account || next === mode || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await setChannelAccountMode(channel.key, next);
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message ? e.message : tr("channelModeFailed", d)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("channelSendFrom", d)}
        </h3>
        <p className={`text-sm ${MUTED}`}>{tr("channelSendFromHint", d)}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={tr("channelSendFrom", d)}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <ModeOption
          title={tr("channelPlatformTitle", d)}
          body={
            channel.platformOffered
              ? tr("channelPlatformBody", d)
              : tr("channelPlatformNone", d)
          }
          badge={
            channel.platformOffered
              ? tr("channelPlatformIncluded", d)
              : tr("channelNotOffered", d)
          }
          tone="gray"
          checked={mode === "PLATFORM"}
          disabled={
            !canConfigure || saving || !account || !channel.platformOffered
          }
          onSelect={() => void choose("PLATFORM")}
        />
        <ModeOption
          title={tr("channelOwnTitle", d)}
          body={trDynamic(`channelOwnBody_${channel.key}`, d)}
          badge={
            ownConnected
              ? tr("channelOwnConnected", d)
              : tr("channelOwnNotConnected", d)
          }
          tone={ownConnected ? "green" : "gray"}
          checked={mode === "OWN"}
          disabled={!canConfigure || saving || !account || !ownConnected}
          onSelect={() => void choose("OWN")}
        />
      </div>
      {canConfigure && !ownConnected && mode === "PLATFORM" && (
        <p className={`text-sm ${MUTED}`}>{tr("channelOwnConnectFirst", d)}</p>
      )}
      {!ownConnected && mode === "OWN" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("channelOwnMissing", d)}
        </p>
      )}
      {(saveError || error) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {saveError ??
            (error instanceof Error && error.message
              ? error.message
              : tr("loadFailed", d))}
        </p>
      )}
    </section>
  );
}

/** The own WhatsApp account's templates, once that account is connected. */
function OwnTemplates({ d }: Readonly<{ d: I18nRecord }>) {
  const { data: accounts } = useChannelAccounts();
  const connected = accounts?.some(
    (a) => a.channel === "whatsapp" && a.ownConnected
  );
  return connected ? <OwnTemplatesPanel d={d} /> : null;
}

/** A channel panel's heading: its logo, name and what it does. */
export function ChannelHeader({
  channelKey,
  d,
}: Readonly<{ channelKey: string; d: I18nRecord }>) {
  return (
    <div className="flex items-center gap-3">
      <ChannelIcon channel={channelKey} size={9} />
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {trDynamic(`channel_${channelKey}`, d)}
        </h2>
        <p className={`text-sm ${MUTED}`}>
          {trDynamic(`channelHint_${channelKey}`, d)}
        </p>
      </div>
    </div>
  );
}

/** The account of the active scope for this channel: its card with edit and test. */
function AccountCard({
  channelKey,
  orgSlug,
  settingsDict,
}: Readonly<{
  channelKey: string;
  orgSlug: string;
  settingsDict: I18nRecord;
}>) {
  const orgsDict = settingsDict?.organizations as I18nRecord;
  // "Send from" offers OWN only once the organization's own account exists.
  const refreshAccounts = () => void mutate(accountsKey);
  if (channelKey === "whatsapp") {
    return (
      <WhatsAppChannelCard
        orgSlug={orgSlug}
        dict={orgsDict}
        onChanged={refreshAccounts}
      />
    );
  }
  if (channelKey === "email") {
    return (
      <EmailChannelCard
        orgSlug={orgSlug}
        dict={orgsDict}
        credentialsDict={settingsDict?.credentials as I18nRecord}
        onChanged={refreshAccounts}
      />
    );
  }
  return null;
}

/**
 * Comunicaciones › WhatsApp or Correo. In an organization: which account the rules send from, the
 * organization's own account and, for WhatsApp, its templates. In the platform scope: the platform's account.
 */
export default function ChannelPanel({
  channel,
  d,
  settingsDict,
  orgSlug,
  platformScope,
  canConfigure,
}: Readonly<{
  channel: ChannelType;
  d: I18nRecord;
  /** `pages.userSettings`: the account cards read the organizations and credentials subtrees. */
  settingsDict: I18nRecord;
  orgSlug: string | null;
  platformScope: boolean;
  canConfigure: boolean;
}>) {
  const account =
    orgSlug && canConfigure ? (
      <AccountCard
        channelKey={channel.key}
        orgSlug={orgSlug}
        settingsDict={settingsDict}
      />
    ) : null;

  if (platformScope) {
    return (
      <div className="flex flex-col gap-4">
        <ChannelHeader channelKey={channel.key} d={d} />
        <p className={`text-sm ${MUTED}`}>
          {tr("channelPlatformScopeHint", d)}
        </p>
        {account}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ChannelHeader channelKey={channel.key} d={d} />
      <SendFrom channel={channel} canConfigure={canConfigure} d={d} />
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
          {tr("channelOwnTitle", d)}
        </h3>
        {account ?? (
          <p className={`text-sm ${MUTED}`}>{tr("channelOwnOwnersOnly", d)}</p>
        )}
        {account && channel.key === "whatsapp" && <OwnTemplates d={d} />}
      </section>
    </div>
  );
}
