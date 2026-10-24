import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
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

/** Comunicaciones › one channel: the platform's account and the organization's own. */
export default function ChannelPanel({
  channel,
  d,
}: Readonly<{ channel: ChannelType; d: I18nRecord }>) {
  return (
    <div className="flex flex-col gap-4">
      <ChannelHeader channelKey={channel.key} d={d} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
        <ModeCard
          title={tr("channelOwnTitle", d)}
          body={trDynamic(`channelOwnBody_${channel.key}`, d)}
          badge={tr("channelNotConfigured", d)}
        />
      </div>
    </div>
  );
}
