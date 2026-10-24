"use client";

import { useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { TAG } from "@/features/symptoms/maintainer/catalog-card";
import { ago } from "@/features/symptoms/maintainer/catalog-format";
import { MUTED, Tile } from "@/features/symptoms/maintainer/ui/card";
import { FilterChip } from "@/features/symptoms/maintainer/ui/filter-chip";
import ChannelIcon from "./channel-icon";
import LayoutToggle, { type CatalogLayout } from "./layout-toggle";
import { usePlatformTemplates } from "./conversations-api";
import type { ConversationTemplate } from "./conversations-types";
import { channelLabel } from "./rule-model";

export const PLATFORM_TEMPLATES_PAGE =
  "/users/settings/platform/message-templates";

/** The creation segment. Keys start with a letter or digit, so no stored template takes it. */
export const NEW_TEMPLATE = "_new";

export const platformTemplateHref = (lang: string, key: string) =>
  `/${lang}${PLATFORM_TEMPLATES_PAGE}/${encodeURIComponent(key)}`;

const CHANNELS = ["whatsapp", "email"] as const;

/** The channels a template has a version for. */
function channelsOf(t: ConversationTemplate) {
  return CHANNELS.filter((c) => t[c] != null);
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
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] px-4 text-xs text-gray-600 dark:text-gray-300">
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
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            <th className="px-4 py-2">{tr("colTemplate", d)}</th>
            <th className="px-4 py-2">{tr("colChannels", d)}</th>
            <th className="px-4 py-2">{tr("usedBy", d)}</th>
            <th className="px-4 py-2">{tr("colVersion", d)}</th>
          </tr>
        </thead>
        <tbody>
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
              <td className="whitespace-nowrap px-4 py-2.5">
                {usedByText(t, d)}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-2.5 font-mono ${MUTED}`}
              >
                {versionText(t)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Settings › Plataforma › Plantillas de mensajes: the templates every organization's rules send. */
export default function PlatformTemplatesCatalog({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const { data, error, isLoading } = usePlatformTemplates();
  const [channel, setChannel] = useState("");
  const [layout, setLayout] = useState<CatalogLayout>("cards");
  const all = data ?? [];
  const shown = all.filter(
    (t) => !channel || channelsOf(t).some((c) => channelLabel(c, d) === channel)
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "platform", "messageTemplates"]}
          disableLinks
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
        <FilterChip
          label={tr("filterChannel", d)}
          value={channel}
          options={CHANNELS.map((c) => channelLabel(c, d))}
          allLabel={tr("filterAll", d)}
          onChange={setChannel}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pb-10 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tile>
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
            </Tile>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("templatesTitle", d)}
              </h1>
              <p className={`text-sm ${MUTED}`}>
                {tr("templatesDescription", d)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LayoutToggle layout={layout} d={d} onLayout={setLayout} />
              <Link
                href={platformTemplateHref(lang, NEW_TEMPLATE)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                ＋ {tr("newTemplate", d)}
              </Link>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {tr("loadFailed", d)}
            </p>
          )}
          {isLoading && (
            <p className={`text-sm ${MUTED}`}>{tr("loading", d)}</p>
          )}
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
        </div>
      </div>
    </div>
  );
}
