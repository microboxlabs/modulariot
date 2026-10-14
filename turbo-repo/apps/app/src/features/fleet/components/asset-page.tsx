"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Spinner } from "flowbite-react";
import { HiCheck, HiOutlineLocationMarker, HiPencil } from "react-icons/hi";
import { useSWRConfig } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import {
  acceptSuggestion,
  ago,
  dismissSuggestion,
  field,
  formatDateTime,
  formatDay,
  formatNumber,
  hours,
  useFleetActivity,
  useFleetAsset,
  type ActivityDay,
  type AssetDetail,
  type Change,
  type DocumentStatus,
  type Suggestion,
  type Trip,
} from "../fleet-api";
import { errorMessage } from "./fleet-page";
import {
  AgentCard,
  CAPTION,
  DocumentText,
  InfoRow,
  Kpi,
  PANEL,
  PageHeader,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusPill,
} from "./fleet-ui";

const VIEW = "fleet:assets.view";
const EDIT = "fleet:assets.edit";
const CHART_DAYS = 14;

const DOCUMENT_TONE: Record<DocumentStatus, "muted" | "good" | "warn" | "bad"> =
  {
    MISSING: "muted",
    VALID: "good",
    EXPIRING: "warn",
    EXPIRED: "bad",
  };

interface AssetPageProps {
  readonly assetId: string;
  /** `pages.fleet` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/** One asset: its data, suggestions, indicators, activity, trips and documents. */
export default function AssetPage({ assetId, dict, lang }: AssetPageProps) {
  const d = dict ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(VIEW);
  const { data, error, mutate } = useFleetAsset(assetId, allowed);
  const loading = !accessError && (!access || (allowed && !data && !error));
  const failure = accessError ?? error;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
        {loading && <Spinner className="mx-auto" />}
        {!loading && failure && (
          <Alert color="gray">{errorMessage(failure, d)}</Alert>
        )}
        {!loading && !failure && !allowed && (
          <Alert color="gray">{tr("notAllowed", d)}</Alert>
        )}
        {data && allowed && (
          <AssetContent
            asset={data}
            d={d}
            lang={lang}
            canEdit={can(EDIT)}
            onChange={(next) => mutate(next, { revalidate: false })}
          />
        )}
      </div>
    </div>
  );
}

interface ContentProps {
  readonly asset: AssetDetail;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly canEdit: boolean;
  readonly onChange: (next: AssetDetail) => void;
}

function AssetContent({ asset, d, lang, canEdit, onChange }: ContentProps) {
  const fleetHref = `/${lang}/fleet`;
  const editHref = `${fleetHref}/${encodeURIComponent(asset.id)}/edit`;
  const value = (key: string) => field(asset, key)?.value ?? null;
  const brand = [value("brandModel"), value("year")]
    .filter(Boolean)
    .join(" · ");
  const { indicators, live } = asset;
  const accreditation = asset.documents.find((x) => x.key === "accreditation");

  return (
    <>
      <PageHeader
        caption={`${tr("breadcrumb.fleet", d)} / ${asset.id}`}
        title={
          <>
            {asset.label ?? trDynamic(`kinds.${asset.kind}`, d)} ·{" "}
            <span className="font-mono">{asset.id}</span>
          </>
        }
        backHref={fleetHref}
        backLabel={tr("actions.back", d)}
        actions={
          <>
            <Link
              className={SECONDARY_BUTTON}
              href={`/${lang}/geographic-view?licensePlate=${encodeURIComponent(asset.id)}`}
            >
              <HiOutlineLocationMarker className="h-4 w-4" />
              {tr("actions.viewOnMap", d)}
            </Link>
            {canEdit && (
              <Link className={PRIMARY_BUTTON} href={editHref}>
                <HiPencil className="h-4 w-4" />
                {tr("actions.edit", d)}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-stretch gap-4">
        <section
          className={`${PANEL} flex min-w-0 flex-[999_1_640px] flex-col p-5`}
        >
          <div className="flex flex-wrap items-center gap-3 pb-2 text-sm">
            <StatusPill status={asset.status} d={d} />
            <span className="text-gray-600 dark:text-gray-400">
              {tr("updated", d, { ago: ago(live.lastSignalAt, lang) })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <div>
              <InfoRow label={tr("live.driver", d)}>
                {live.driver ?? "—"}
              </InfoRow>
              <InfoRow label={tr("fields.carrier", d)}>
                {value("carrier") ?? "—"}
              </InfoRow>
              <InfoRow label={tr("fields.usualTrailer", d)}>
                <span className="font-mono">
                  {value("usualTrailer") ?? "—"}
                </span>
              </InfoRow>
              <InfoRow label={tr("fields.base", d)}>
                {value("base") ?? "—"}
              </InfoRow>
            </div>
            <div>
              <InfoRow label={tr("fields.brandModel", d)}>
                {brand || "—"}
              </InfoRow>
              <InfoRow label={tr("fields.vin", d)}>
                <span className="font-mono">{value("vin") ?? "—"}</span>
              </InfoRow>
              <InfoRow label={tr("fields.gpsProvider", d)}>
                {live.gpsProvider ?? "—"}
              </InfoRow>
              <InfoRow label={tr("live.speed", d)}>
                {live.speed == null
                  ? "—"
                  : tr("live.speedValue", d, {
                      v: formatNumber(live.speed, lang),
                    })}
              </InfoRow>
            </div>
          </div>
        </section>
        <div className="flex min-w-0 flex-[1_1_340px]">
          <Suggestions
            asset={asset}
            d={d}
            canEdit={canEdit}
            onChange={onChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Kpi
              label={tr("indicators.km30d", d)}
              value={formatNumber(indicators.km30d, lang)}
            />
            <Kpi
              label={tr("indicators.engineHours", d)}
              value={`${formatNumber(indicators.engineHours30d, lang)} h`}
              hint={
                indicators.idlePct == null
                  ? tr("indicators.noData", d)
                  : tr("indicators.idle", d, {
                      pct: formatNumber(indicators.idlePct, lang),
                    })
              }
            />
            <Kpi
              label={tr("indicators.utilization", d)}
              value={
                indicators.utilizationPct == null
                  ? "—"
                  : `${formatNumber(indicators.utilizationPct, lang)}%`
              }
              hint={
                indicators.fleetUtilizationPct == null
                  ? tr("indicators.noData", d)
                  : tr("indicators.fleet", d, {
                      pct: formatNumber(indicators.fleetUtilizationPct, lang),
                    })
              }
            />
            <Kpi
              label={tr("indicators.trips", d)}
              value={formatNumber(indicators.trips30d, lang)}
              hint={
                indicators.avgTripHours == null
                  ? undefined
                  : tr("indicators.avgTrip", d, {
                      h: formatNumber(indicators.avgTripHours, lang, 1),
                    })
              }
            />
            {accreditation && (
              <Kpi
                label={tr("table.accreditation", d)}
                value={trDynamic(`documentState.${accreditation.status}`, d)}
                hint={
                  accreditation.expiresAt
                    ? formatDay(accreditation.expiresAt, lang)
                    : undefined
                }
                tone={DOCUMENT_TONE[accreditation.status]}
              />
            )}
          </div>
          <ActivityChart assetId={asset.id} d={d} lang={lang} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Trips asset={asset} d={d} lang={lang} />
          <section className={`${PANEL} p-5`}>
            <h2 className="mb-1 text-base font-medium text-gray-900 dark:text-white">
              {tr("edit.documents", d)}
            </h2>
            {asset.documents.map((doc) => (
              <InfoRow
                key={doc.key}
                label={trDynamic(`documents.${doc.key}`, d)}
              >
                <DocumentText
                  status={doc.status}
                  expiresAt={doc.expiresAt}
                  d={d}
                  lang={lang}
                />
              </InfoRow>
            ))}
          </section>
          <section className={`${PANEL} p-5`}>
            <h2 className={`${CAPTION} mb-1`}>{tr("live.title", d)}</h2>
            <InfoRow label={tr("live.signal", d)}>
              {ago(live.lastSignalAt, lang)}
            </InfoRow>
            <InfoRow label={tr("live.engine", d)}>
              {engineText(live.engineOn, d)}
            </InfoRow>
            <InfoRow label={tr("live.speed", d)}>
              {live.speed == null
                ? tr("live.unknown", d)
                : tr("live.speedValue", d, {
                    v: formatNumber(live.speed, lang),
                  })}
            </InfoRow>
          </section>
          <History changes={asset.changes} d={d} lang={lang} />
        </aside>
      </div>
    </>
  );
}

function engineText(engineOn: boolean | null, d: I18nRecord): string {
  if (engineOn == null) return tr("live.unknown", d);
  return engineOn ? tr("live.engineOn", d) : tr("live.engineOff", d);
}

function Suggestions({
  asset,
  d,
  canEdit,
  onChange,
}: {
  readonly asset: AssetDetail;
  readonly d: I18nRecord;
  readonly canEdit: boolean;
  readonly onChange: (next: AssetDetail) => void;
}) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const act = async (
    suggestion: Suggestion,
    action: typeof acceptSuggestion
  ) => {
    setBusy(suggestion.kind);
    setFailed(false);
    try {
      onChange(await action(asset.id, suggestion.kind));
      await mutate(
        (key) =>
          typeof key === "string" && key.startsWith("/app/api/fleet/assets?"),
        undefined,
        { revalidate: true }
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AgentCard title={tr("agent.title", d)}>
      {asset.suggestions.length === 0 && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {tr("agent.done", d)}
        </p>
      )}
      {asset.suggestions.map((s) => (
        <div key={s.kind} className="flex flex-col gap-3">
          <p className="text-base leading-snug font-medium text-gray-900 dark:text-white">
            {trDynamic(`agent.${s.kind}`, d, {
              value: s.value,
              count: String(s.count),
              total: String(s.total),
            })}
          </p>
          <div className="flex flex-col gap-1 rounded-xl bg-white p-3 text-sm dark:bg-gray-800">
            <span className={CAPTION}>{tr("agent.whyLabel", d)}</span>
            <span className="text-gray-900 dark:text-gray-100">
              {tr("agent.why", d)}
            </span>
            <span className={`${CAPTION} mt-2`}>
              {tr("agent.effectLabel", d)}
            </span>
            <span className="text-gray-900 dark:text-gray-100">
              {trDynamic(`agent.effect_${s.kind}`, d)}
            </span>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON}
                disabled={busy !== null}
                onClick={() => act(s, acceptSuggestion)}
              >
                <HiCheck className="h-4 w-4" />
                {tr("agent.accept", d)}
              </button>
              <button
                type="button"
                className={`${SECONDARY_BUTTON} border-transparent bg-transparent dark:bg-transparent`}
                disabled={busy !== null}
                onClick={() => act(s, dismissSuggestion)}
              >
                {tr("agent.dismiss", d)}
              </button>
            </div>
          )}
        </div>
      ))}
      {failed && (
        <p className="text-sm text-rose-700 dark:text-rose-400">
          {tr("loadFailed", d)}
        </p>
      )}
    </AgentCard>
  );
}

function ActivityChart({
  assetId,
  d,
  lang,
}: {
  readonly assetId: string;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const { data } = useFleetActivity(assetId, CHART_DAYS, true);
  const [picked, setPicked] = useState<number | null>(null);
  const days = data ?? [];
  const max = Math.max(
    10,
    ...days.map((x) => hours(x.movingSeconds + x.idleSeconds))
  );
  const empty = days.every((x) => x.movingSeconds + x.idleSeconds === 0);
  const selected: ActivityDay | undefined =
    picked == null ? days[days.length - 1] : days[picked];
  const dayName = (day: string) =>
    new Intl.DateTimeFormat(lang, {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T00:00:00Z`));

  return (
    <section className={`${PANEL} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-gray-900 dark:text-white">
            {tr("chart.title", d)}
          </h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {tr("chart.subtitle", d)}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-900 dark:bg-gray-100" />
            {tr("chart.moving", d)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gray-300 dark:bg-gray-600" />
            {tr("chart.idle", d)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
            {tr("chart.today", d)}
          </span>
        </div>
      </div>
      {!data && <Spinner className="mx-auto mt-8" />}
      {data && empty && (
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          {tr("chart.empty", d)}
        </p>
      )}
      {data && !empty && (
        <>
          <div className="mt-5 flex h-52 items-end gap-2 border-b border-gray-300 dark:border-gray-600">
            {days.map((day, i) => {
              const today = i === days.length - 1;
              const moving = hours(day.movingSeconds);
              const idle = hours(day.idleSeconds);
              const active = selected === day;
              return (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={active}
                  aria-label={tr("chart.dayLabel", d, {
                    day: dayName(day.day),
                    moving: formatNumber(moving, lang, 1),
                    idle: formatNumber(idle, lang, 1),
                  })}
                  className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-md ${active ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
                >
                  <span
                    className={`w-3/4 rounded-t ${today ? "bg-blue-300 dark:bg-blue-800" : "bg-gray-300 dark:bg-gray-600"}`}
                    style={{ height: `${(idle / max) * 100}%` }}
                  />
                  <span
                    className={`w-3/4 ${today ? "bg-blue-600" : "bg-gray-900 dark:bg-gray-100"}`}
                    style={{ height: `${(moving / max) * 100}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {days.map((day, i) => (
              <span
                key={day.day}
                className={`min-w-0 flex-1 truncate text-center text-[11px] ${i === days.length - 1 ? "font-medium text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}
              >
                {i === days.length - 1
                  ? tr("chart.today", d)
                  : dayName(day.day)}
              </span>
            ))}
          </div>
          {selected && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-900 dark:text-white">
              <span className="font-medium">{dayName(selected.day)}</span>
              <span>
                {tr("chart.moving", d)}:{" "}
                {formatNumber(hours(selected.movingSeconds), lang, 1)} h
              </span>
              <span>
                {tr("chart.idle", d)}:{" "}
                {formatNumber(hours(selected.idleSeconds), lang, 1)} h
              </span>
              <span>
                {tr("chart.engine", d)}:{" "}
                {formatNumber(hours(selected.engineSeconds), lang, 1)} h
              </span>
              <span>
                {tr("chart.km", d)}: {formatNumber(selected.km, lang)} km
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TripLine({
  trip,
  state,
  d,
  lang,
}: {
  readonly trip: Trip;
  readonly state: "current" | "planned" | "done";
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const route =
    [trip.origin, trip.destination].filter(Boolean).join(" → ") || trip.id;
  const dot = {
    current: "bg-blue-600",
    planned: "border border-gray-400 bg-white dark:bg-gray-800",
    done: "bg-green-600",
  }[state];
  let detail: string;
  if (state === "current") {
    detail = trip.eta
      ? tr("trips.eta", d, { time: formatDateTime(trip.eta, lang) })
      : tr("trips.current", d);
  } else if (state === "planned") {
    detail = tr("trips.starts", d, { time: formatDateTime(trip.start, lang) });
  } else {
    detail = formatDateTime(trip.start, lang);
  }
  return (
    <li className="flex gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 text-sm">
        <div className="truncate text-gray-900 dark:text-white">{route}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {trDynamic(`trips.${state}`, d)} · {detail}
          {trip.trailer
            ? ` · ${tr("trips.with", d, { trailer: trip.trailer })}`
            : ""}
        </div>
      </div>
    </li>
  );
}

function Trips({
  asset,
  d,
  lang,
}: {
  readonly asset: AssetDetail;
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const none =
    !asset.currentTrip &&
    asset.plannedTrips.length === 0 &&
    asset.recentTrips.length === 0;
  return (
    <section className={`${PANEL} p-5`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-gray-900 dark:text-white">
          {tr("trips.title", d)}
        </h2>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {tr("trips.count", d, {
            n: formatNumber(asset.indicators.trips30d, lang),
          })}
        </span>
      </div>
      {none && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {tr("trips.none", d)}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {asset.currentTrip && (
          <TripLine
            trip={asset.currentTrip}
            state="current"
            d={d}
            lang={lang}
          />
        )}
        {asset.plannedTrips.map((trip) => (
          <TripLine
            key={trip.id}
            trip={trip}
            state="planned"
            d={d}
            lang={lang}
          />
        ))}
        {asset.recentTrips.slice(0, 5).map((trip) => (
          <TripLine key={trip.id} trip={trip} state="done" d={d} lang={lang} />
        ))}
      </ul>
    </section>
  );
}

function History({
  changes,
  d,
  lang,
}: {
  readonly changes: Change[];
  readonly d: I18nRecord;
  readonly lang: string;
}) {
  const label = (key: string) =>
    key.startsWith("document.")
      ? trDynamic(`documents.${key.slice("document.".length)}`, d)
      : trDynamic(`fields.${key}`, d);
  return (
    <section className={`${PANEL} p-5`}>
      <h2 className={`${CAPTION} mb-2`}>{tr("history.title", d)}</h2>
      {changes.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {tr("history.empty", d)}
        </p>
      )}
      <ul className="flex flex-col gap-2 text-sm">
        {changes.map((c, i) => (
          <li
            key={`${c.changedAt}-${i}`}
            className="flex justify-between gap-3"
          >
            <span className="min-w-0 text-gray-900 dark:text-white">
              {c.newValue == null
                ? tr("history.cleared", d, { field: label(c.field) })
                : tr("history.set", d, {
                    field: label(c.field),
                    value: c.newValue,
                  })}
              <span className="block text-xs text-gray-600 dark:text-gray-400">
                {[
                  c.changedBy,
                  c.origin === "SUGGESTION"
                    ? tr("history.suggestion", d)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-xs text-gray-600 dark:text-gray-400">
              {formatDateTime(c.changedAt, lang)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
