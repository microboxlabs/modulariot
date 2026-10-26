"use client";

import Link from "next/link";
import { HiArrowRight, HiTruck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import { useTripsPermission } from "../monitors/monitors-api";
import { MILESTONE_CONFIRM } from "../milestones/milestones-api";
import { LANE_VIEW, type BoardCard } from "../board/board-api";
import { shortTime, statusLabel } from "../board/trip-card";
import {
  useTripSheet,
  type SheetFeed,
  type SheetStage,
  type SheetTransition,
  type TripSheet as Sheet,
} from "./sheet-api";
import { MilestoneRow } from "./milestone-row";

function Panel({
  title,
  className = "",
  children,
}: Readonly<{ title: string; className?: string; children: React.ReactNode }>) {
  return (
    <section
      className={`rounded-lg bg-white p-4 shadow dark:bg-gray-800 ${className}`}
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
}: Readonly<{ label: string; value: string | null | undefined }>) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {value || "—"}
      </dd>
    </div>
  );
}

function Head({ card, d }: Readonly<{ card: BoardCard; d: I18nRecord }>) {
  return (
    <Panel title={tr("sheet.service", d)} className="lg:col-span-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {card.codes.join(" · ") || card.tripId.slice(0, 8)}
        </span>
        <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium uppercase text-primary-800 dark:bg-primary-900/50 dark:text-primary-300">
          {statusLabel(card, d)}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
          {trDynamic(`lanes.${card.lane}`, d)}
        </span>
        {card.regularized && (
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
            {tr("lanes.regularized", d)}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <span>{card.origin ?? "—"}</span>
        <HiArrowRight className="h-4 w-4 text-gray-400" />
        <span>{card.destination ?? "—"}</span>
      </div>
      {card.cancelReason && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {tr("sheet.cancelReason", d)}: {card.cancelReason}
        </p>
      )}
    </Panel>
  );
}

function Resources({ card, d }: Readonly<{ card: BoardCard; d: I18nRecord }>) {
  const drivers = [card.driver, card.secondDriver].filter(Boolean).join(" · ");
  return (
    <Panel title={tr("sheet.resources", d)}>
      <dl className="grid grid-cols-2 gap-3">
        <Field label={tr("sheet.truck", d)} value={card.truck} />
        <Field label={tr("sheet.trailer", d)} value={card.trailer} />
        <Field label={tr("sheet.drivers", d)} value={drivers} />
        <Field label={tr("sheet.carrier", d)} value={card.carrier} />
      </dl>
    </Panel>
  );
}

function Milestones({
  sheet,
  d,
  lang,
}: Readonly<{ sheet: Sheet; d: I18nRecord; lang: string }>) {
  const canConfirm = useTripsPermission(MILESTONE_CONFIRM);
  const planned: Record<string, string | null> = {
    departure: sheet.card.plannedStart,
    arrival: sheet.card.plannedArrival,
    closure: null,
  };
  return (
    <Panel title={tr("sheet.milestones", d)} className="lg:col-span-2">
      {sheet.milestones.map((m) => (
        <MilestoneRow
          key={m.milestone}
          m={m}
          planned={planned[m.milestone] ?? null}
          canConfirm={canConfirm}
          d={d}
          lang={lang}
        />
      ))}
    </Panel>
  );
}

const STAGE_STYLE: Record<SheetStage["status"], string> = {
  pending: "border-gray-300 dark:border-gray-600",
  in_progress: "border-primary-500 bg-primary-50 dark:bg-primary-900/30",
  completed: "border-green-500",
};

function Plan({
  stages,
  d,
  lang,
}: Readonly<{ stages: SheetStage[]; d: I18nRecord; lang: string }>) {
  return (
    <Panel title={tr("sheet.plan", d)} className="lg:col-span-2">
      <ol className="space-y-2">
        {stages.map((s) => (
          <li
            key={s.id}
            className={`rounded border-l-4 px-3 py-2 ${STAGE_STYLE[s.status]}`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900 dark:text-white">
                {trDynamic(`sheet.stages.${s.stageType}`, d)}
                {s.serviceStatus && (
                  <span className="ml-2 text-xs text-gray-500">
                    {s.serviceStatus}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500">
                {trDynamic(`sheet.stageStatus.${s.status}`, d)}
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {shortTime(s.actualStart, lang) ?? "—"} →{" "}
              {shortTime(s.actualEnd, lang) ?? "—"}
              {s.plannedEnd && (
                <span className="ml-2">
                  ({tr("sheet.plannedEnd", d)} {shortTime(s.plannedEnd, lang)})
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

const STAGE_ACTIONS = new Set(["advance", "start", "close"]);

function actionText(a: SheetTransition["actions"][number], d: I18nRecord) {
  const name = trDynamic(`sheet.actions.${a.type ?? "other"}`, d);
  if (!a.value) return name;
  const stage = STAGE_ACTIONS.has(a.type ?? "");
  return `${name} ${stage ? trDynamic(`sheet.stages.${a.value}`, d) : a.value}`;
}

function History({
  transitions,
  d,
  lang,
}: Readonly<{ transitions: SheetTransition[]; d: I18nRecord; lang: string }>) {
  return (
    <Panel title={tr("sheet.history", d)}>
      {transitions.length === 0 && (
        <p className="text-sm text-gray-500">{tr("sheet.noHistory", d)}</p>
      )}
      <ol className="max-h-96 space-y-2 overflow-auto">
        {transitions.map((t) => (
          <li key={t.id} className="text-xs">
            <div className="text-gray-500">
              {shortTime(t.at, lang)} · {t.event.on}
              {t.event.kind && ` · ${t.event.kind}`}
            </div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {t.ruleKey ?? t.matched.join(", ")}
              {t.toStage && ` → ${trDynamic(`sheet.stages.${t.toStage}`, d)}`}
            </div>
            {t.actions.length > 0 && (
              <div className="text-gray-600 dark:text-gray-400">
                {t.actions.map((a) => actionText(a, d)).join(" · ")}
              </div>
            )}
            {t.error && <div className="text-red-600">{t.error}</div>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function FeedRow({
  feed,
  d,
  lang,
}: Readonly<{ feed: SheetFeed | null; d: I18nRecord; lang: string }>) {
  if (!feed) {
    return (
      <Panel title={tr("sheet.feed", d)}>
        <p className="text-sm text-gray-500">{tr("sheet.noFeed", d)}</p>
      </Panel>
    );
  }
  const entries = Object.entries(feed.source).filter(
    ([, v]) => v !== null && v !== ""
  );
  return (
    <Panel title={tr("sheet.feed", d)} className="lg:col-span-3">
      <dl className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label={tr("sheet.feedKey", d)} value={feed.feedKey} />
        <Field label={tr("sheet.service", d)} value={feed.externalCode} />
        <Field label={tr("sheet.lastAction", d)} value={feed.lastAction} />
        <Field
          label={tr("sheet.lastReconciled", d)}
          value={shortTime(feed.lastReconciledAt, lang)}
        />
      </dl>
      {entries.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs md:grid-cols-3 dark:border-gray-700">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 text-gray-500">{k}</dt>
              <dd className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">
                {String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

/** One trip's page: what the feed planned, what happened, and the milestones a person confirms. */
export default function TripSheet({
  tripId,
  lang,
  d,
  general,
}: Readonly<{
  tripId: string;
  lang: string;
  d: I18nRecord;
  general: I18nRecord;
}>) {
  const { data, error, isLoading } = useTripSheet(tripId);
  const view = data ? LANE_VIEW[data.card.lane] : undefined;
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <SectionHeader
        path={["breadcrumb.trips", "breadcrumb.trip"]}
        rootIcon={<HiTruck className="mr-2 h-4 w-4" />}
        breadcrumbDict={d}
        filterDict={general}
        lang={lang}
        rightContent={
          view && (
            <Link
              href={`/trips/${view}`}
              className="text-sm text-primary-700 hover:underline dark:text-primary-400"
            >
              {trDynamic(`breadcrumb.${view}`, d)}
            </Link>
          )
        }
      />
      <div className="h-screen w-full overflow-auto bg-gray-50 p-4 dark:bg-gray-900">
        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {tr("error", d)}:{" "}
            {error instanceof Error ? error.message : String(error)}
          </p>
        )}
        {isLoading && !data && (
          <p className="text-sm text-gray-500">{tr("loading", d)}</p>
        )}
        {data && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Head card={data.card} d={d} />
            <Milestones sheet={data} d={d} lang={lang} />
            <Resources card={data.card} d={d} />
            <Plan stages={data.stages} d={d} lang={lang} />
            <History transitions={data.transitions} d={d} lang={lang} />
            <FeedRow feed={data.feed} d={d} lang={lang} />
          </div>
        )}
      </div>
    </div>
  );
}
