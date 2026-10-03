"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { type CatalogFilterKey, lastPublished } from "./catalog-derive";
import { fmtK, levelName, shortDate } from "./catalog-format";
import type { SymptomStats, SymptomSummary } from "./maintainer-api";
import { stateLabel } from "./symptom-labels";
import { Card, CardFooter, CardHeader, MUTED, Tile } from "./ui/card";
import { LEVEL_STYLES, LevelIcon } from "./ui/level-icon";

const LINK =
  "rounded hover:text-blue-700 hover:underline dark:hover:text-blue-400";

/** A number or label in a stat card that applies a catalog filter or opens a symptom. */
function StatLink({
  children,
  title,
  onClick,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}>) {
  if (!onClick) return <>{children}</>;
  return (
    <button type="button" title={title} onClick={onClick} className={LINK}>
      {children}
    </button>
  );
}

function Big({
  value,
  unit,
  title,
  onClick,
}: Readonly<{
  value: string | number;
  unit: string;
  title?: string;
  onClick?: () => void;
}>) {
  return (
    <div className="flex items-baseline gap-1">
      <StatLink title={title ?? ""} onClick={onClick}>
        <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {value}
        </span>
      </StatLink>
      <span className={`text-sm ${MUTED}`}>{unit}</span>
    </div>
  );
}

function Bar({
  parts,
}: Readonly<{ parts: { width: number; className: string }[] }>) {
  return (
    <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
      {parts.map((p) => (
        <div
          key={p.className}
          className={`h-full ${p.className}`}
          style={{ width: `${Math.max(0, Math.min(100, p.width))}%` }}
        />
      ))}
    </div>
  );
}

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

/** Placeholder cards while the catalog loads, so zeros never show before the data. */
function LoadingStats() {
  return (
    <div
      aria-busy="true"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {["a", "b", "c", "d"].map((k) => (
        <Card key={k}>
          <div className="flex animate-pulse flex-col gap-3 p-4">
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </Card>
      ))}
    </div>
  );
}

type Filter = (key: CatalogFilterKey, value: string) => void;
type LastPublished = SymptomStats["changes"]["lastPublished"];

function SymptomsCard({
  all,
  d,
  onFilter,
}: Readonly<{ all: SymptomSummary[]; d: I18nRecord; onFilter: Filter }>) {
  const filterHint = tr("statFilterHint", d);
  const active = all.filter((s) => s.definition.state === "ACTIVE").length;
  const test = all.filter((s) => s.definition.state === "TEST").length;
  const off = all.length - active - test;
  return (
    <Card>
      <CardHeader
        tile={<Tile>⚑</Tile>}
        title={tr("cardSymptoms", d)}
        subtitle={tr("cardSymptomsHint", d)}
      />
      <div className="flex-1 px-4 py-3">
        <Big
          value={active}
          unit={tr("ofAvailable", d, { n: String(all.length) })}
          title={filterHint}
          onClick={() => onFilter("state", stateLabel("ACTIVE", d))}
        />
        <Bar
          parts={[
            { width: pct(active, all.length), className: "bg-green-500" },
            { width: pct(test, all.length), className: "bg-violet-500" },
          ]}
        />
      </div>
      <CardFooter>
        <StatLink
          title={filterHint}
          onClick={() => onFilter("state", stateLabel("TEST", d))}
        >
          {tr("inTest", d, { n: String(test) })}
        </StatLink>
        {" · "}
        <StatLink
          title={filterHint}
          onClick={() => onFilter("state", stateLabel("OFF", d))}
        >
          {tr("offCount", d, { n: String(off) })}
        </StatLink>
      </CardFooter>
    </Card>
  );
}

/** "X, Y y Z suman el N%", or no engine data. */
function topShareText(
  stats: SymptomStats | undefined,
  all: SymptomSummary[],
  d: I18nRecord
) {
  const top = stats?.totals.topShare;
  if (!stats?.engineAvailable || !top?.definitionIds.length) {
    return tr("noEngineData", d);
  }
  const names = new Map(all.map((s) => [s.definition.id, s.definition.name]));
  return tr("topShare", d, {
    names: top.definitionIds
      .map((id) => names.get(id) ?? "")
      .filter(Boolean)
      .join(", "),
    share: String(Math.round(top.share * 100)),
  });
}

function WeekCard({
  all,
  stats,
  lang,
  d,
  onFilter,
}: Readonly<{
  all: SymptomSummary[];
  stats: SymptomStats | undefined;
  lang: string;
  d: I18nRecord;
  onFilter: Filter;
}>) {
  const totals = stats?.engineAvailable ? stats.totals : undefined;
  return (
    <Card>
      <CardHeader
        tile={<Tile>▤</Tile>}
        title={tr("cardWeek", d)}
        subtitle={tr("cardWeekHint", d)}
      />
      <div className="flex-1 px-4 py-3">
        <Big
          value={totals ? fmtK(totals.week, lang, d) : "—"}
          unit={tr("cases", d)}
        />
        <Bar
          parts={(totals?.weekByLevel ?? []).map((n, i) => ({
            width: pct(n, totals?.week ?? 0),
            className: LEVEL_STYLES[i].bar,
          }))}
        />
        {totals && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {totals.weekByLevel.map((n, i) => (
              <button
                type="button"
                key={LEVEL_STYLES[i].icu}
                title={tr("statFilterHint", d)}
                onClick={() => onFilter("level", levelName(i + 1, d))}
                className={`flex items-center gap-1 text-xs ${MUTED} ${LINK}`}
              >
                <LevelIcon icu={i + 1} size="h-4 w-4" />
                {fmtK(n, lang, d)}
              </button>
            ))}
          </div>
        )}
      </div>
      <CardFooter>{topShareText(stats, all, d)}</CardFooter>
    </Card>
  );
}

function slaText(sla: number | null | undefined) {
  if (sla == null) return "—";
  return `${Math.round(sla * 100)}%`;
}

function LoadCard({
  stats,
  d,
  onFilter,
  onEditTeam,
}: Readonly<{
  stats: SymptomStats | undefined;
  d: I18nRecord;
  onFilter: Filter;
  onEditTeam?: () => void;
}>) {
  const totals = stats?.engineAvailable ? stats.totals : undefined;
  const op = stats?.operators;
  const capacity = op?.capacityPerShift ?? null;
  const fill = Math.min(100, pct(totals?.perShift ?? 0, capacity ?? 0));
  return (
    <Card>
      <CardHeader
        tile={<Tile>☎</Tile>}
        title={tr("cardLoad", d)}
        subtitle={tr("cardLoadHint", d)}
      />
      <div className="flex-1 px-4 py-3">
        <Big
          value={totals ? totals.perShift : "—"}
          unit={
            capacity == null
              ? tr("perShift", d)
              : tr("perShiftOf", d, { n: String(capacity) })
          }
          title={tr("statFilterHint", d)}
          onClick={
            totals ? () => onFilter("who", tr("whoOperator", d)) : undefined
          }
        />
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
      <CardFooter>
        {tr("slaMet", d)}{" "}
        <b className="text-gray-900 dark:text-white">
          {slaText(op?.slaMetLastWeek)}
        </b>{" "}
        ·{" "}
        {op?.operators == null
          ? tr("teamNotSet", d)
          : tr("operatorsCapacity", d, { n: String(op.operators) })}
        {onEditTeam && (
          <>
            {" · "}
            <button type="button" onClick={onEditTeam} className={LINK}>
              {tr("teamEdit", d)}
            </button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

/** "02/10 · who · "why"". */
function publishedLine(last: NonNullable<LastPublished>, lang: string) {
  const parts = [shortDate(last.at, lang), last.by];
  if (last.reason) parts.push(`"${last.reason}"`);
  return parts.join(" · ");
}

function ChangesCard({
  all,
  stats,
  lang,
  d,
  onFilter,
  onOpen,
}: Readonly<{
  all: SymptomSummary[];
  stats: SymptomStats | undefined;
  lang: string;
  d: I18nRecord;
  onFilter: Filter;
  onOpen: (id: string) => void;
}>) {
  const last = stats?.changes.lastPublished ?? lastPublished(all);
  const drafts = stats?.changes.drafts ?? all.filter((s) => s.hasDraft).length;
  return (
    <Card>
      <CardHeader
        tile={<Tile>↺</Tile>}
        title={tr("cardChanges", d)}
        subtitle={tr("cardChangesHint", d)}
      />
      <div className="flex-1 px-4 py-3">
        <Big
          value={drafts}
          unit={tr("draftsUnpublished", d)}
          title={tr("statFilterHint", d)}
          onClick={
            drafts ? () => onFilter("draft", tr("withDraft", d)) : undefined
          }
        />
        {last && (
          <div className={`mt-2 text-xs ${MUTED}`}>
            {tr("lastPublished", d)}{" "}
            <StatLink
              title={tr("statOpenHint", d)}
              onClick={() => onOpen(last.definitionId)}
            >
              <b className="text-gray-900 dark:text-white">
                {last.name} {last.version}
              </b>
            </StatLink>
          </div>
        )}
      </div>
      <CardFooter>
        {last ? publishedLine(last, lang) : tr("noPublished", d)}
      </CardFooter>
    </Card>
  );
}

/** The four cards over the catalog: symptoms on, cases per week, operator load, changes. */
export default function CatalogStats({
  loading,
  all,
  stats,
  lang,
  d,
  onFilter,
  onOpen,
  onEditTeam,
}: Readonly<{
  loading: boolean;
  all: SymptomSummary[];
  stats: SymptomStats | undefined;
  lang: string;
  d: I18nRecord;
  onFilter: Filter;
  onOpen: (id: string) => void;
  /** Owners only: opens the operator team editor. */
  onEditTeam?: () => void;
}>) {
  if (loading) return <LoadingStats />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SymptomsCard all={all} d={d} onFilter={onFilter} />
      <WeekCard all={all} stats={stats} lang={lang} d={d} onFilter={onFilter} />
      <LoadCard
        stats={stats}
        d={d}
        onFilter={onFilter}
        onEditTeam={onEditTeam}
      />
      <ChangesCard
        all={all}
        stats={stats}
        lang={lang}
        d={d}
        onFilter={onFilter}
        onOpen={onOpen}
      />
    </div>
  );
}
