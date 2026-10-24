import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import EmailChannelCard from "@/features/settings-admin/email/email-channel-card";
import WhatsAppChannelCard from "@/features/settings-admin/whatsapp/whatsapp-channel-card";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import ChannelIcon from "./channel-icon";
import type { ChannelType } from "./channel-types";

function ModeCard({
  title,
  body,
  badge,
}: Readonly<{ title: string; body: string; badge: string }>) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {badge}
        </span>
      </div>
      <p className={`text-sm ${MUTED}`}>{body}</p>
    </div>
  );
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
  if (channelKey === "whatsapp") {
    return <WhatsAppChannelCard orgSlug={orgSlug} dict={orgsDict} />;
  }
  if (channelKey === "email") {
    return (
      <EmailChannelCard
        orgSlug={orgSlug}
        dict={orgsDict}
        credentialsDict={settingsDict?.credentials as I18nRecord}
      />
    );
  }
  return null;
}

/**
 * Comunicaciones › WhatsApp or Correo. In an organization: the platform's account, which
 * it gets included, and its own account. In the platform scope: the platform's account.
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
    <div className="flex flex-col gap-4">
      <ChannelHeader channelKey={channel.key} d={d} />
      <ModeCard
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
      />
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
        {tr("channelOwnTitle", d)}
      </h3>
      <p className={`-mt-2 text-sm ${MUTED}`}>
        {trDynamic(`channelOwnBody_${channel.key}`, d)}
      </p>
      {account ?? (
        <ModeCard
          title={tr("channelOwnTitle", d)}
          body={tr("channelOwnOwnersOnly", d)}
          badge={tr("channelNotConfigured", d)}
        />
      )}
    </div>
  );
}
