"use client";

import { useState } from "react";
import { HiOutlineDocumentText, HiOutlineViewBoards } from "react-icons/hi";
import { MdOutlineTimeline } from "react-icons/md";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { shortTime } from "../board/trip-card";
import type { SheetFeed, SheetStage, SheetTransition } from "./sheet-api";

const STAGE_ACTIONS = new Set(["advance", "start", "close"]);

function actionText(a: SheetTransition["actions"][number], d: I18nRecord) {
  const name = trDynamic(`sheet.actions.${a.type ?? "other"}`, d);
  if (!a.value) return name;
  const stage = STAGE_ACTIONS.has(a.type ?? "");
  const value = stage ? trDynamic(`sheet.stages.${a.value}`, d) : a.value;
  return `${name} ${value}`;
}

function Movements({
  transitions,
  d,
  lang,
}: Readonly<{ transitions: SheetTransition[]; d: I18nRecord; lang: string }>) {
  const rows = transitions.map((t) => [
    shortTime(t.at, lang) ?? "-",
    [t.event.on, t.event.kind].filter(Boolean).join(" · ") || "-",
    t.ruleKey ?? (t.matched.join(", ") || "-"),
    t.toStage ? trDynamic(`sheet.stages.${t.toStage}`, d) : "-",
    t.error ? (
      <span className="text-red-600">{t.error}</span>
    ) : (
      t.actions.map((a) => actionText(a, d)).join(" · ") || "-"
    ),
  ]);
  return (
    <CustomTable
      header={[
        tr("sheet.table.at", d),
        tr("sheet.table.event", d),
        tr("sheet.table.rule", d),
        tr("sheet.table.stage", d),
        tr("sheet.table.actions", d),
      ]}
      content={rows}
      no_data_message={tr("sheet.noHistory", d)}
    />
  );
}

function Stages({
  stages,
  d,
  lang,
}: Readonly<{ stages: SheetStage[]; d: I18nRecord; lang: string }>) {
  const rows = stages.map((s) => [
    trDynamic(`sheet.stages.${s.stageType}`, d),
    s.serviceStatus ?? "-",
    trDynamic(`sheet.stageStatus.${s.status}`, d),
    shortTime(s.actualStart, lang) ?? "-",
    shortTime(s.actualEnd, lang) ?? "-",
    shortTime(s.plannedEnd, lang) ?? "-",
  ]);
  return (
    <CustomTable
      header={[
        tr("sheet.table.stage", d),
        tr("sheet.table.serviceStatus", d),
        tr("sheet.table.status", d),
        tr("sheet.table.start", d),
        tr("sheet.table.end", d),
        tr("sheet.plannedEnd", d),
      ]}
      content={rows}
      no_data_message="-"
    />
  );
}

function Feed({
  feed,
  d,
  lang,
}: Readonly<{ feed: SheetFeed | null; d: I18nRecord; lang: string }>) {
  if (!feed) {
    return (
      <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
        {tr("sheet.noFeed", d)}
      </p>
    );
  }
  const head: [string, string][] = [
    [tr("sheet.feedKey", d), feed.feedKey],
    [tr("sheet.lastAction", d), feed.lastAction ?? "-"],
    [
      tr("sheet.lastReconciled", d),
      shortTime(feed.lastReconciledAt, lang) ?? "-",
    ],
  ];
  const source = Object.entries(feed.source)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return (
    <CustomTable
      header={[tr("sheet.table.field", d), tr("sheet.table.value", d)]}
      content={[...head, ...source]}
    />
  );
}

const TABS = [
  { key: "movements", icon: MdOutlineTimeline },
  { key: "stages", icon: HiOutlineViewBoards },
  { key: "feed", icon: HiOutlineDocumentText },
] as const;

/** What the monitor did, the trip's stages and the feed row, one tab each. */
export function SheetTables({
  transitions,
  stages,
  feed,
  d,
  lang,
}: Readonly<{
  transitions: SheetTransition[];
  stages: SheetStage[];
  feed: SheetFeed | null;
  d: I18nRecord;
  lang: string;
}>) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("movements");
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div role="tablist" className="flex w-full flex-row">
        {TABS.map(({ key, icon: Icon }, i) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 border-t border-gray-200 py-1 text-sm font-light transition-all duration-300 dark:border-gray-600 ${
              i === 0 ? "rounded-tl-lg border-l" : ""
            } ${i === TABS.length - 1 ? "rounded-tr-lg border-r" : ""} ${
              tab === key
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 opacity-50 dark:bg-gray-800 dark:text-gray-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tr(`sheet.tabs.${key}`, d)}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-b-lg border-x border-b border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
        {tab === "movements" && (
          <Movements transitions={transitions} d={d} lang={lang} />
        )}
        {tab === "stages" && <Stages stages={stages} d={d} lang={lang} />}
        {tab === "feed" && <Feed feed={feed} d={d} lang={lang} />}
      </div>
    </div>
  );
}
