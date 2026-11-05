"use client";

import { useState } from "react";
import { HiOutlineCheckCircle, HiOutlineCube } from "react-icons/hi";
import { MdOutlineTimeline } from "react-icons/md";
import CustomTable from "@/features/common/components/custom-table/custom-table";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { shortTime } from "../board/trip-card";
import type { Milestone } from "../monitors/monitors-api";
import type { SheetCargo, SheetTransition, TripSheet } from "./sheet-api";
import { plannedAt } from "./milestone-checklist";

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

const AMOUNT = { maximumFractionDigits: 2 };

function amount(value: number | null, lang: string, unit?: string | null) {
  if (value == null) return "-";
  const text = value.toLocaleString(lang, AMOUNT);
  return unit ? `${text} ${unit}` : text;
}

/** The cargo units mounted on the trip, by order. */
function Cargo({
  cargo,
  d,
  lang,
}: Readonly<{ cargo: SheetCargo[]; d: I18nRecord; lang: string }>) {
  const rows = cargo.map((c) => [
    c.orderRef ? `${c.mandate} · ${c.orderRef}` : c.mandate,
    c.description,
    amount(c.qty, lang, c.qtyUnit),
    amount(c.weightKg, lang),
    amount(c.volumeM3, lang),
    trDynamic(`sheet.cargoStatus.${c.status}`, d),
  ]);
  return (
    <CustomTable
      header={[
        tr("sheet.table.order", d),
        tr("sheet.table.description", d),
        tr("sheet.table.qty", d),
        tr("sheet.weight", d),
        tr("sheet.volume", d),
        tr("sheet.table.status", d),
      ]}
      content={rows}
      no_data_message={tr("sheet.noCargo", d)}
    />
  );
}

function Milestones({
  sheet,
  d,
  lang,
  onOpen,
}: Readonly<{
  sheet: TripSheet;
  d: I18nRecord;
  lang: string;
  onOpen: (m: Milestone) => void;
}>) {
  const rows = sheet.milestones.map((m) => [
    <button
      key="name"
      type="button"
      onClick={() => onOpen(m.milestone)}
      className="font-medium text-primary-700 hover:underline dark:text-primary-400"
    >
      {trDynamic(`milestone.${m.milestone}`, d)}
    </button>,
    trDynamic(`milestoneStatus.${m.status}`, d),
    shortTime(plannedAt(sheet, m.milestone), lang) ?? "-",
    m.proposedAt
      ? `${shortTime(m.proposedAt, lang)} · ${m.source ?? "-"}`
      : "-",
    shortTime(m.confirmedAt, lang) ?? "-",
  ]);
  return (
    <CustomTable
      header={[
        tr("sheet.table.milestone", d),
        tr("sheet.table.status", d),
        tr("sheet.planned", d),
        tr("sheet.detected", d),
        tr("sheet.confirmed", d),
      ]}
      content={rows}
    />
  );
}

const TABS = [
  { key: "milestones", icon: HiOutlineCheckCircle },
  { key: "movements", icon: MdOutlineTimeline },
  { key: "cargo", icon: HiOutlineCube },
] as const;

/** The milestones, what the monitor did and the trip's cargo, one tab each. */
export function SheetTables({
  sheet,
  d,
  lang,
  onMilestone,
}: Readonly<{
  sheet: TripSheet;
  d: I18nRecord;
  lang: string;
  onMilestone: (m: Milestone) => void;
}>) {
  const { transitions } = sheet;
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("milestones");
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
        {tab === "milestones" && (
          <Milestones sheet={sheet} d={d} lang={lang} onOpen={onMilestone} />
        )}
        {tab === "movements" && (
          <Movements transitions={transitions} d={d} lang={lang} />
        )}
        {tab === "cargo" && (
          <Cargo cargo={sheet.details?.cargo ?? []} d={d} lang={lang} />
        )}
      </div>
    </div>
  );
}
