"use client";

import Link from "next/link";
import { HiX } from "react-icons/hi";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Notice } from "./maintainer-api";
import { ChannelIcon } from "./ui/channel-icon";

/** A channel a notice can go out on, and the Integrations provider types that can send it. */
interface Channel {
  key: string;
  label: string;
  providers: string[];
}

export const CHANNELS: Channel[] = [
  {
    key: "teams",
    label: "channelTeams",
    providers: ["CUSTOM_HTTP", "N8N"],
  },
  {
    key: "whatsapp",
    label: "channelWhatsapp",
    providers: ["WHATSAPP"],
  },
  {
    key: "email",
    label: "channelEmail",
    providers: ["EMAIL"],
  },
  {
    key: "app",
    label: "channelApp",
    providers: ["DRIVER_APP"],
  },
  {
    key: "webhook",
    label: "channelWebhook",
    providers: ["CUSTOM_HTTP", "N8N", "GPS_WEBHOOK"],
  },
];

const WHEN = [
  { key: "open", label: "whenOpen" },
  { key: "level_up", label: "whenLevelUp" },
  { key: "sla_expired", label: "whenSlaExpired" },
  { key: "close", label: "whenClose" },
];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white";

function channelOf(key: string): Channel {
  return CHANNELS.find((c) => c.key === key) ?? CHANNELS[4];
}

/**
 * The automatic notices of one level. Each goes out through an Integrations
 * connection, which holds the credentials and the message format; the
 * symptom only says when, through which connection, and to whom.
 */
export default function LevelNotices({
  notices,
  connections,
  lang,
  readOnly,
  d,
  onChange,
}: Readonly<{
  notices: Notice[];
  connections: IntegrationConnection[];
  lang: string;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (notices: Notice[]) => void;
}>) {
  const usable = (channel: string) =>
    connections.filter(
      (c) =>
        channelOf(channel).providers.includes(c.providerType) &&
        c.status !== "INACTIVE"
    );

  const set = (i: number, patch: Partial<Notice>) =>
    onChange(notices.map((n, j) => (j === i ? { ...n, ...patch } : n)));

  const add = (channel: string) => {
    const first = usable(channel)[0];
    onChange([
      ...notices,
      {
        when: "open",
        channel,
        connectionId: first?.id ?? null,
        templateId: first?.templateId ?? null,
        recipient: "",
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {tr("notices", d)}
        </span>
        {!readOnly && (
          <span className="ml-auto flex items-center gap-1">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={tr("addNotice", d, {
                  channel: trDynamic(c.label, d),
                })}
                title={tr("addNotice", d, { channel: trDynamic(c.label, d) })}
                onClick={() => add(c.key)}
                className="opacity-70 hover:opacity-100"
              >
                <ChannelIcon channel={c.key} label={trDynamic(c.label, d)} />
              </button>
            ))}
            <Link
              href={`/${lang}/users/settings/connections`}
              className="ml-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {tr("connectionsLink", d)}
            </Link>
          </span>
        )}
      </div>
      {notices.length === 0 && (
        <p className="text-xs text-gray-500">{tr("noNotices", d)}</p>
      )}
      {notices.map((n, i) => {
        const options = usable(n.channel);
        const key = `${n.channel}-${i}`;
        return (
          <div key={key} className="flex flex-wrap items-center gap-2">
            <ChannelIcon
              channel={n.channel}
              label={trDynamic(channelOf(n.channel).label, d)}
            />
            <select
              aria-label={tr("noticeWhen", d)}
              className={selectClass}
              disabled={readOnly}
              value={n.when}
              onChange={(e) => set(i, { when: e.target.value })}
            >
              {WHEN.map((w) => (
                <option key={w.key} value={w.key}>
                  {trDynamic(w.label, d)}
                </option>
              ))}
            </select>
            <select
              aria-label={tr("noticeConnection", d)}
              className={selectClass}
              disabled={readOnly}
              value={n.connectionId ?? ""}
              onChange={(e) => {
                const conn = options.find((c) => c.id === e.target.value);
                set(i, {
                  connectionId: e.target.value || null,
                  templateId: conn?.templateId ?? null,
                });
              }}
            >
              <option value="">
                {options.length
                  ? tr("pickConnection", d)
                  : tr("noConnections", d)}
              </option>
              {n.connectionId &&
                !options.some((c) => c.id === n.connectionId) && (
                  <option value={n.connectionId}>
                    {tr("configuredConnection", d)}
                  </option>
                )}
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label={tr("noticeRecipient", d)}
              className={`${selectClass} min-w-40 flex-1`}
              disabled={readOnly}
              placeholder={tr("recipientPlaceholder", d)}
              value={n.recipient ?? ""}
              onChange={(e) => set(i, { recipient: e.target.value })}
            />
            {!readOnly && (
              <button
                type="button"
                aria-label={tr("removeNotice", d)}
                onClick={() => onChange(notices.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600"
              >
                <HiX className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
