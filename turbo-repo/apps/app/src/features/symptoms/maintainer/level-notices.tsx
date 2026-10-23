"use client";

import { useState } from "react";
import Link from "next/link";
import { Link as LinkIcon } from "flowbite-react-icons/outline";
import { HiPlus, HiX } from "react-icons/hi";
import type { IntegrationConnection } from "@/features/integration-config/integration-config.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { Notice } from "./maintainer-api";
import { noticeConnections, noticeKind, recipientHint } from "./notice-kind";
import { KindIcon } from "./ui/kind-icon";
import {
  FIELD,
  FIELD_ERROR,
  FieldError,
  ResponseBlock,
} from "./ui/response-block";
import Select from "./ui/select";

const WHEN = [
  { key: "open", label: "whenOpen" },
  { key: "level_up", label: "whenLevelUp" },
  { key: "sla_expired", label: "whenSlaExpired" },
  { key: "close", label: "whenClose" },
];

const kindName = (kind: string | null, d: I18nRecord) =>
  kind ? trDynamic(`noticeKind${kind}`, d) : tr("noticeKindUnknown", d);

/** Connections grouped by provider type, in the order they first appear. */
function byKind(
  connections: IntegrationConnection[]
): [string, IntegrationConnection[]][] {
  const groups = new Map<string, IntegrationConnection[]>();
  for (const c of connections) {
    groups.set(c.providerType, [...(groups.get(c.providerType) ?? []), c]);
  }
  return [...groups];
}

function NoticePicker({
  connections,
  lang,
  d,
  onPick,
  onClose,
}: Readonly<{
  connections: IntegrationConnection[];
  lang: string;
  d: I18nRecord;
  onPick: (connection: IntegrationConnection) => void;
  onClose: () => void;
}>) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = connections.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      kindName(c.providerType, d).toLowerCase().includes(q)
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
          {connections.length
            ? tr("noticeNoMatch", d)
            : tr("noticeNoConnections", d)}
        </p>
      )}
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {byKind(shown).map(([kind, group]) => (
          <div key={kind} className="flex flex-col">
            <span className="px-1 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              {kindName(kind, d)}
            </span>
            {group.map((c) => {
              const inactive = c.status === "INACTIVE";
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={inactive}
                  onClick={() => onPick(c)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-white dark:hover:bg-gray-700"
                >
                  <KindIcon kind={kind} size={6} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {inactive && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tr("noticeInactive", d)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <Link
        href={`/${lang}/users/settings/connections`}
        className="self-start px-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {tr("noticeCreateConnection", d)}
      </Link>
    </div>
  );
}

function NoticeRow({
  notice,
  connections,
  readOnly,
  d,
  onChange,
  onRemove,
}: Readonly<{
  notice: Notice;
  connections: IntegrationConnection[];
  readOnly: boolean;
  d: I18nRecord;
  onChange: (patch: Partial<Notice>) => void;
  onRemove: () => void;
}>) {
  const kind = noticeKind(notice, connections);
  const known = connections.some((c) => c.id === notice.connectionId);
  // A notice copied from a template keeps its kind and waits for a connection of that kind.
  const sameKind = connections.filter((c) => c.providerType === notice.kind);
  const options = !known && sameKind.length ? sameKind : connections;
  const missing = !notice.connectionId;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <KindIcon kind={kind} label={kindName(kind, d)} />
        <Select
          aria-label={tr("noticeConnection", d)}
          className={`${FIELD} ${missing ? FIELD_ERROR : ""}`}
          wrapperClassName="min-w-48"
          disabled={readOnly}
          value={notice.connectionId ?? ""}
          onChange={(e) => {
            const c = connections.find((x) => x.id === e.target.value);
            onChange({
              connectionId: c?.id ?? null,
              templateId: c?.templateId ?? null,
              kind: c?.providerType ?? notice.kind,
            });
          }}
        >
          <option value="">{tr("pickConnection", d)}</option>
          {notice.connectionId && !known && (
            <option value={notice.connectionId}>
              {tr("configuredConnection", d)}
            </option>
          )}
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
        <input
          aria-label={tr("noticeRecipient", d)}
          className={`${FIELD} min-w-40 flex-1`}
          disabled={readOnly}
          placeholder={trDynamic(recipientHint(kind), d)}
          value={notice.recipient ?? ""}
          onChange={(e) => onChange({ recipient: e.target.value })}
        />
        {!readOnly && (
          <button
            type="button"
            aria-label={tr("removeNotice", d)}
            onClick={onRemove}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-red-400"
          >
            <HiX className="h-4 w-4" />
          </button>
        )}
      </div>
      {missing && (
        <div className="pl-8">
          <FieldError
            text={tr("noticeNeedsConnection", d, { kind: kindName(kind, d) })}
          />
        </div>
      )}
    </div>
  );
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
  const [picking, setPicking] = useState(false);
  const usable = noticeConnections(connections);
  const set = (i: number, patch: Partial<Notice>) =>
    onChange(notices.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const add = (c: IntegrationConnection) => {
    onChange([
      ...notices,
      {
        when: "open",
        kind: c.providerType,
        connectionId: c.id,
        templateId: c.templateId,
        recipient: "",
      },
    ]);
    setPicking(false);
  };

  return (
    <ResponseBlock
      title={tr("notices", d)}
      aside={
        <Link
          href={`/${lang}/users/settings/connections`}
          className="flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          <LinkIcon className="h-4 w-4" />
          {tr("connectionsLink", d)}
        </Link>
      }
    >
      {notices.length === 0 && !picking && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("noNotices", d)}
        </p>
      )}
      {notices.map((n, i) => (
        <NoticeRow
          key={`${n.connectionId ?? n.kind ?? "none"}-${i}`}
          notice={n}
          connections={usable}
          readOnly={readOnly}
          d={d}
          onChange={(patch) => set(i, patch)}
          onRemove={() => onChange(notices.filter((_, j) => j !== i))}
        />
      ))}
      {!readOnly && picking && (
        <NoticePicker
          connections={usable}
          lang={lang}
          d={d}
          onPick={add}
          onClose={() => setPicking(false)}
        />
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
