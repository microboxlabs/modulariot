"use client";

import { useState } from "react";
import { HiPlus, HiX } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  CHANNEL_TYPES,
  channelType,
  recipientHint,
  type ChannelType,
} from "./channel-types";
import type { Notice } from "./maintainer-api";
import { ChannelIcon } from "./ui/channel-icon";
import {
  FIELD,
  FIELD_ERROR,
  FieldError,
  ResponseBlock,
} from "./ui/response-block";
import Select from "./ui/select";

/**
 * When a level's notice goes out. "reach" is the case opening at this level
 * or rising to it; "open" and "level_up" are each of those alone.
 */
const WHEN = [
  { key: "reach", label: "whenReach" },
  { key: "open", label: "whenOpen" },
  { key: "level_up", label: "whenLevelUp" },
  { key: "sla_expired", label: "whenSlaExpired" },
  { key: "close", label: "whenClose" },
];

function ChannelPicker({
  d,
  onPick,
  onClose,
}: Readonly<{
  d: I18nRecord;
  onPick: (type: ChannelType) => void;
  onClose: () => void;
}>) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = CHANNEL_TYPES.filter(
    (c) => !q || trDynamic(c.label, d).toLowerCase().includes(q)
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          aria-label={tr("noticeSearch", d)}
          className={`${FIELD} flex-1`}
          placeholder={tr("noticeSearch", d)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <button
          type="button"
          aria-label={tr("close", d)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          onClick={onClose}
        >
          <HiX className="h-4 w-4" />
        </button>
      </div>
      {shown.length === 0 && (
        <p className="px-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("noticeNoMatch", d)}
        </p>
      )}
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {shown.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
          >
            <ChannelIcon channel={c.key} size={7} />
            {trDynamic(c.label, d)}
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-gray-500 dark:text-gray-400">
        {tr("noticeChannelHint", d)}
      </p>
    </div>
  );
}

function NoticeRow({
  notice,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  notice: Notice;
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<Notice>) => void;
  onRemove: () => void;
}>) {
  const type = channelType(notice.channel);
  const hint = recipientHint(notice.channel);
  const asksRecipient = type?.recipient !== "none";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelIcon
          channel={notice.channel}
          label={type ? trDynamic(type.label, d) : notice.channel}
        />
        <Select
          aria-label={tr("noticeChannel", d)}
          className={`${FIELD} ${type ? "" : FIELD_ERROR}`}
          wrapperClassName="min-w-36"
          disabled={readOnly}
          value={notice.channel}
          onChange={(e) => onChange({ channel: e.target.value })}
        >
          {!type && <option value={notice.channel}>{notice.channel}</option>}
          {CHANNEL_TYPES.map((c) => (
            <option key={c.key} value={c.key}>
              {trDynamic(c.label, d)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={tr("noticeWhen", d)}
          className={FIELD}
          disabled={readOnly}
          value={notice.when}
          onChange={(e) => onChange({ when: e.target.value })}
        >
          {WHEN.map((w) => (
            <option key={w.key} value={w.key}>
              {trDynamic(w.label, d)}
            </option>
          ))}
        </Select>
        {asksRecipient && (
          <input
            aria-label={tr("noticeRecipient", d)}
            className={`${FIELD} min-w-40 flex-1`}
            disabled={readOnly}
            placeholder={trDynamic(hint, d)}
            value={notice.recipient ?? ""}
            onChange={(e) => onChange({ recipient: e.target.value })}
          />
        )}
        {!readOnly && (
          <button
            type="button"
            aria-label={tr("removeNotice", d)}
            onClick={onRemove}
            className="ml-auto rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
          >
            <HiX className="h-4 w-4" />
          </button>
        )}
      </div>
      {!type && (
        <div className="pl-8">
          <FieldError
            text={tr("noticeUnknownChannel", d, { channel: notice.channel })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The automatic notices of one level. A notice names a channel type; it goes
 * out through the organization's channel of that type, run by the platform
 * or by the organization's own account.
 */
export default function LevelNotices({
  notices,
  readOnly,
  d,
  onChange,
}: Readonly<{
  notices: Notice[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (notices: Notice[]) => void;
}>) {
  const [picking, setPicking] = useState(false);
  const set = (i: number, patch: Partial<Notice>) =>
    onChange(notices.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const add = (type: ChannelType) => {
    onChange([
      ...notices,
      { when: "reach", channel: type.key, channelId: null, recipient: "" },
    ]);
    setPicking(false);
  };

  return (
    <ResponseBlock title={tr("notices", d)}>
      {notices.length === 0 && !picking && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noNotices", d)}
        </p>
      )}
      {notices.map((n, i) => (
        <NoticeRow
          key={`${n.channel}-${i}`}
          notice={n}
          readOnly={readOnly}
          d={d}
          onChange={(patch) => set(i, patch)}
          onRemove={() => onChange(notices.filter((_, j) => j !== i))}
        />
      ))}
      {!readOnly && picking && (
        <ChannelPicker d={d} onPick={add} onClose={() => setPicking(false)} />
      )}
      {!readOnly && !picking && (
        <button
          type="button"
          className="flex items-center gap-1 self-start text-sm text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => setPicking(true)}
        >
          <HiPlus className="h-4 w-4" />
          {tr("addNoticeButton", d)}
        </button>
      )}
    </ResponseBlock>
  );
}
