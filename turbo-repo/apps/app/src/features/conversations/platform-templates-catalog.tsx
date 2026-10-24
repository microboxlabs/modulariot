"use client";

import Link from "next/link";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { TAG } from "@/features/symptoms/maintainer/catalog-card";
import { ago } from "@/features/symptoms/maintainer/catalog-format";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import CatalogTable from "@/features/common/components/catalog-table";
import ChannelIcon from "./channel-icon";
import type { CatalogLayout } from "@/features/common/components/layout-toggle";
import { useConversationTemplates } from "./conversations-api";
import type { ConversationTemplate } from "./conversations-types";
import { channelLabel } from "./rule-model";

/** Comunicaciones › Plantillas, in the platform scope. */
export const PLATFORM_TEMPLATES_PAGE =
  "/users/settings/communications?section=templates";

/** The creation segment. Keys start with a letter or digit, so no stored template takes it. */
export const NEW_TEMPLATE = "_new";

export const platformTemplateHref = (lang: string, key: string) =>
  `/${lang}/users/settings/communications/templates/${encodeURIComponent(key)}`;

export const TEMPLATE_CHANNELS = ["whatsapp", "email"] as const;

/** The channels a template has a version for. */
function channelsOf(t: ConversationTemplate) {
  return TEMPLATE_CHANNELS.filter((c) => t[c] != null);
}

function usedByText(t: ConversationTemplate, d: I18nRecord) {
  return tr("usedByCount", d, { n: String(t.usedBy?.length ?? 0) });
}

function versionText(t: ConversationTemplate) {
  return t.version ? `v${t.version}` : "";
}

/** The round badge where a symptom card has its icon. */
function TemplateIconCircle() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
      <svg
        aria-hidden
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
      </svg>
    </span>
  );
}

/** A template laid out like a symptom card: name and key, text, channels, and the version at the foot. */
export function TemplateCard({
  t,
  lang,
  d,
}: Readonly<{ t: ConversationTemplate; lang: string; d: I18nRecord }>) {
  const channels = channelsOf(t);
  return (
    <Link
      href={platformTemplateHref(lang, t.key)}
      className="flex flex-col rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
    >
      <div className="flex w-full items-start gap-3 px-4 pt-4">
        <TemplateIconCircle />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-gray-900 dark:text-white">
            {t.name}
          </div>
          <div className={`truncate font-mono text-xs ${MUTED}`}>{t.key}</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 h-8 px-4 text-xs text-gray-600 dark:text-gray-300">
        {t.baseText || "—"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4 text-xs">
        {channels.map((c) => (
          <span key={c} className={TAG}>
            {channelLabel(c, d)}
          </span>
        ))}
        <span className={TAG}>{usedByText(t, d)}</span>
      </div>
      {/* Keeps the footers of a row of cards on one line. */}
      <div className="min-h-3 flex-1" />
      <div
        className={`flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs dark:border-gray-700/60 ${MUTED}`}
      >
        <span className="font-mono">{versionText(t)}</span>
        {t.updatedAt && <span>· {ago(t.updatedAt, lang)}</span>}
        <span className="ml-auto flex items-center gap-1">
          {channels.map((c) => (
            <ChannelIcon
              key={c}
              channel={c}
              label={channelLabel(c, d)}
              size={6}
            />
          ))}
        </span>
      </div>
    </Link>
  );
}

function TemplatesTable({
  templates,
  lang,
  d,
}: Readonly<{
  templates: ConversationTemplate[];
  lang: string;
  d: I18nRecord;
}>) {
  return (
    <CatalogTable
      columns={[
        tr("colTemplate", d),
        tr("colChannels", d),
        tr("usedBy", d),
        tr("colVersion", d),
      ]}
    >
      {templates.map((t) => (
        <tr
          key={t.key}
          className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
        >
          <td className="px-4 py-2.5">
            <Link
              href={platformTemplateHref(lang, t.key)}
              className="text-sm font-medium text-gray-900 hover:underline dark:text-white"
            >
              {t.name}
            </Link>
            <div className={`font-mono ${MUTED}`}>{t.key}</div>
          </td>
          <td className="px-4 py-2.5">
            <span className="flex items-center gap-1">
              {channelsOf(t).map((c) => (
                <ChannelIcon
                  key={c}
                  channel={c}
                  label={channelLabel(c, d)}
                  size={6}
                />
              ))}
            </span>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5">{usedByText(t, d)}</td>
          <td className={`whitespace-nowrap px-4 py-2.5 font-mono ${MUTED}`}>
            {versionText(t)}
          </td>
        </tr>
      ))}
    </CatalogTable>
  );
}

/** Comunicaciones › Plantillas in the platform scope: the templates every organization's rules send, as cards or a table. */
export default function MessageTemplatesPanel({
  channel,
  layout,
  lang,
  d,
}: Readonly<{
  channel: string;
  layout: CatalogLayout;
  lang: string;
  d: I18nRecord;
}>) {
  const { data, error, isLoading } = useConversationTemplates();
  const all = data ?? [];
  const shown = all.filter(
    (t) => !channel || channelsOf(t).some((c) => channelLabel(c, d) === channel)
  );
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {tr("loadFailed", d)}
        </p>
      )}
      {isLoading && <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>}
      {data && shown.length === 0 && (
        <p className={`py-10 text-center text-sm ${MUTED}`}>
          {all.length === 0
            ? tr("noTemplates", d)
            : tr("templatesEmptyFiltered", d)}
        </p>
      )}
      {shown.length > 0 && layout === "cards" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((t) => (
            <TemplateCard key={t.key} t={t} lang={lang} d={d} />
          ))}
        </div>
      )}
      {shown.length > 0 && layout === "list" && (
        <TemplatesTable templates={shown} lang={lang} d={d} />
      )}
    </>
  );
}
