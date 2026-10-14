"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Spinner } from "flowbite-react";
import {
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineLocationMarker,
  HiOutlineMap,
  HiOutlinePencil,
  HiOutlineShieldCheck,
  HiOutlineSwitchHorizontal,
  HiOutlineTruck,
} from "react-icons/hi";
import { useSWRConfig } from "swr";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { useMyAccess } from "@/features/settings-admin/team/team-api";
import {
  acceptSuggestion,
  ago,
  dismissSuggestion,
  field,
  formatDateTime,
  formatNumber,
  hours,
  useFleetActivity,
  useFleetAsset,
  type ActivityDay,
  type AssetDetail,
  type Change,
  type Suggestion,
  type Trip,
} from "../fleet-api";
import { errorMessage } from "./fleet-page";
import {
  CARD,
  CARD_TITLE,
  DocumentBadge,
  FleetHeader,
  HarnessCard,
  InfoRow,
  StatusBadge,
} from "./fleet-ui";

const VIEW = "fleet:assets.view";
const EDIT = "fleet:assets.edit";
const CHART_DAYS = 14;

interface AssetPageProps {
  readonly assetId: string;
  /** `pages.fleet` subtree. */
  readonly dict: I18nRecord;
  /** The whole dictionary, for the section header's filter bar. */
  readonly rootDict: I18nRecord;
  readonly lang: string;
}

/** One asset: its data, suggestions, indicators, activity, trips and documents. */
export default function AssetPage({
  assetId,
  dict,
  lang,
  rootDict,
}: Readonly<AssetPageProps>) {
  const d = dict ?? {};
  const { access, accessError, can } = useMyAccess();
  const allowed = can(VIEW);
  const canEdit = can(EDIT);
  const { data, error, mutate } = useFleetAsset(assetId, allowed);
  const loading = !accessError && (!access || (allowed && !data && !error));
  const failure = accessError ?? error;
  const fleetHref = `/${lang}/fleet`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <FleetHeader
        filterDict={rootDict}
        crumbs={[
          { label: tr("title", d), href: fleetHref },
          { label: assetId },
        ]}
        actions={
          data && (
            <AssetActions
              assetId={assetId}
              lang={lang}
              canEdit={canEdit}
              d={d}
            />
          )
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
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
            canEdit={canEdit}
            onChange={(next) => mutate(next, { revalidate: false })}
          />
        )}
      </div>
    </div>
  );
}

function AssetActions({
  assetId,
  lang,
  canEdit,
  d,
}: Readonly<{
  assetId: string;
  lang: string;
  canEdit: boolean;
  d: I18nRecord;
}>) {
  const id = encodeURIComponent(assetId);
  return (
    <>
      <Button
        as={Link}
        href={`/${lang}/geographic-view?licensePlate=${id}`}
        color="light"
        size="sm"
      >
        <HiOutlineLocationMarker className="mr-2 h-4 w-4" />
        {tr("actions.viewOnMap", d)}
      </Button>
      {canEdit && (
        <Button
          as={Link}
          href={`/${lang}/fleet/${id}/edit`}
          color="blue"
          size="sm"
        >
          <HiOutlinePencil className="mr-2 h-4 w-4" />
          {tr("actions.edit", d)}
        </Button>
      )}
    </>
  );
}

interface ContentProps {
  readonly asset: AssetDetail;
  readonly d: I18nRecord;
  readonly lang: string;
  readonly canEdit: boolean;
  readonly onChange: (next: AssetDetail) => void;
}

function speedText(speed: number | null, d: I18nRecord, lang: string) {
  if (speed == null) return tr("live.unknown", d);
  return tr("live.speedValue", d, { v: formatNumber(speed, lang) });
}

function engineText(engineOn: boolean | null, d: I18nRecord): string {
  if (engineOn == null) return tr("live.unknown", d);
  return engineOn ? tr("live.engineOn", d) : tr("live.engineOff", d);
}

function AssetContent({
  asset,
  d,
  lang,
  canEdit,
  onChange,
}: Readonly<ContentProps>) {
  const value = (key: string) => field(asset, key)?.value ?? null;
  const brand = [value("brandModel"), value("year")]
    .filter(Boolean)
    .join(" · ");
  const { live } = asset;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {asset.label ?? trDynamic(`kinds.${asset.kind}`, d)} ·{" "}
          <span className="font-mono">{asset.id}</span>
        </h2>
        <StatusBadge status={asset.status} d={d} />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {tr("updated", d, { ago: ago(live.lastSignalAt, lang) })}
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <section
          className={`${CARD} flex min-w-0 flex-[999_1_640px] flex-wrap gap-5 p-5`}
        >
          <VehicleImage asset={asset} brand={brand} d={d} />
          <div className="grid min-w-0 flex-[1_1_360px] grid-cols-1 gap-x-8 md:grid-cols-2">
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
                {speedText(live.speed, d, lang)}
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
          <Indicators asset={asset} d={d} lang={lang} />
          <ActivityChart assetId={asset.id} d={d} lang={lang} />
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Trips asset={asset} d={d} lang={lang} />
          <section className={`${CARD} p-5`}>
            <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
              <HiOutlineShieldCheck
                className="h-5 w-5 text-gray-500"
                aria-hidden
              />
              {tr("edit.documents", d)}
            </h3>
            {asset.documents.map((doc) => (
              <InfoRow
                key={doc.key}
                label={trDynamic(`documents.${doc.key}`, d)}
              >
                <DocumentBadge
                  status={doc.status}
                  expiresAt={doc.expiresAt}
                  d={d}
                  lang={lang}
                />
              </InfoRow>
            ))}
          </section>
          <section className={`${CARD} p-5`}>
            <h3 className={`${CARD_TITLE} mb-2`}>{tr("live.title", d)}</h3>
            <InfoRow label={tr("live.signal", d)}>
              {ago(live.lastSignalAt, lang)}
            </InfoRow>
            <InfoRow label={tr("live.engine", d)}>
              {engineText(live.engineOn, d)}
            </InfoRow>
            <InfoRow label={tr("live.speed", d)}>
              {speedText(live.speed, d, lang)}
            </InfoRow>
          </section>
          <History changes={asset.changes} d={d} lang={lang} />
        </aside>
      </div>
    </>
  );
}

/** The studio image of the truck's make and model, or why there is none. */
function VehicleImage({
  asset,
  brand,
  d,
}: Readonly<{ asset: AssetDetail; brand: string; d: I18nRecord }>) {
  if (asset.kind !== "TRUCK") return null;
  const vehicle = brand || asset.id;
  return (
    <div className="flex aspect-[16/10] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 sm:w-72 dark:bg-gray-700">
      {asset.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed CDN URL that expires; next/image would cache it
        <img
          src={asset.image.url}
          alt={tr("image.imageAlt", d, { vehicle })}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 p-4 text-center text-xs text-gray-500 dark:text-gray-400">
          <HiOutlineTruck className="h-10 w-10" aria-hidden />
          {brand ? tr("image.imageNone", d) : tr("image.imageMissing", d)}
        </div>
      )}
    </div>
  );
}

function percentText(pct: number | null, lang: string): string {
  return pct == null ? "—" : `${formatNumber(pct, lang)}%`;
}

function Indicators({
  asset,
  d,
  lang,
}: Readonly<{ asset: AssetDetail; d: I18nRecord; lang: string }>) {
  const i = asset.indicators;
  const idle =
    i.idlePct == null
      ? tr("indicators.noData", d)
      : tr("indicators.idle", d, { pct: formatNumber(i.idlePct, lang) });
  const fleet =
    i.fleetUtilizationPct == null
      ? tr("indicators.noData", d)
      : tr("indicators.fleet", d, {
          pct: formatNumber(i.fleetUtilizationPct, lang),
        });
  const avgTrip =
    i.avgTripHours == null
      ? undefined
      : {
          text: tr("indicators.avgTrip", d, {
            h: formatNumber(i.avgTripHours, lang, 1),
          }),
          className: "text-xs",
        };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiStat
        icon={{ icon: HiOutlineMap }}
        title={{ text: tr("indicators.km30d", d), className: "text-xs" }}
        value={{ text: formatNumber(i.km30d, lang), className: "text-2xl" }}
        variant="horizontal"
      />
      <KpiStat
        icon={{ icon: HiOutlineClock }}
        title={{ text: tr("indicators.engineHours", d), className: "text-xs" }}
        value={{
          text: `${formatNumber(i.engineHours30d, lang)} h`,
          className: "text-2xl",
        }}
        description={{ text: idle, className: "text-xs" }}
        variant="horizontal"
      />
      <KpiStat
        icon={{ icon: HiOutlineChartBar }}
        title={{ text: tr("indicators.utilization", d), className: "text-xs" }}
        value={{
          text: percentText(i.utilizationPct, lang),
          className: "text-2xl",
        }}
        description={{ text: fleet, className: "text-xs" }}
        variant="horizontal"
      />
      <KpiStat
        icon={{ icon: HiOutlineSwitchHorizontal }}
        title={{ text: tr("indicators.trips", d), className: "text-xs" }}
        value={{ text: formatNumber(i.trips30d, lang), className: "text-2xl" }}
        description={avgTrip}
        variant="horizontal"
      />
    </div>
  );
}

function Suggestions({
  asset,
  d,
  canEdit,
  onChange,
}: Readonly<{
  asset: AssetDetail;
  d: I18nRecord;
  canEdit: boolean;
  onChange: (next: AssetDetail) => void;
}>) {
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
    <HarnessCard
      title={tr("agent.title", d)}
      subtitle={tr("agent.subtitle", d)}
    >
      {asset.suggestions.length === 0 && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {tr("agent.done", d)}
        </p>
      )}
      {asset.suggestions.map((s) => (
        <div
          key={s.kind}
          className="flex flex-col gap-2 rounded-lg border border-amber-100 bg-white p-3 dark:border-amber-800/40 dark:bg-gray-800"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {trDynamic(`agent.${s.kind}`, d, {
              value: s.value,
              count: String(s.count),
              total: String(s.total),
            })}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {tr("agent.why", d)} {trDynamic(`agent.effect_${s.kind}`, d)}
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="xs"
                color="blue"
                disabled={busy !== null}
                onClick={() => act(s, acceptSuggestion)}
              >
                <HiOutlineCheck className="mr-1 h-4 w-4" />
                {tr("agent.accept", d)}
              </Button>
              <Button
                size="xs"
                color="light"
                disabled={busy !== null}
                onClick={() => act(s, dismissSuggestion)}
              >
                {tr("agent.dismiss", d)}
              </Button>
            </div>
          )}
        </div>
      ))}
      {failed && (
        <p className="text-sm text-red-600 dark:text-red-500">
          {tr("loadFailed", d)}
        </p>
      )}
    </HarnessCard>
  );
}

function barClass(active: boolean): string {
  if (active) return "bg-gray-100 dark:bg-gray-700";
  return "hover:bg-gray-50 dark:hover:bg-gray-700/50";
}

function dayLabelClass(today: boolean): string {
  if (today) return "font-semibold text-blue-600 dark:text-blue-500";
  return "text-gray-500 dark:text-gray-400";
}

function ActivityChart({
  assetId,
  d,
  lang,
}: Readonly<{ assetId: string; d: I18nRecord; lang: string }>) {
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
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={CARD_TITLE}>{tr("chart.title", d)}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr("chart.subtitle", d)}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
            {tr("chart.moving", d)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-200 dark:bg-blue-900" />
            {tr("chart.idle", d)}
          </span>
        </div>
      </div>
      {!data && <Spinner className="mx-auto mt-8 block" />}
      {data && empty && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {tr("chart.empty", d)}
        </p>
      )}
      {data && !empty && (
        <>
          <div className="mt-5 flex h-52 items-end gap-2 border-b border-gray-200 dark:border-gray-700">
            {days.map((day, i) => {
              const moving = hours(day.movingSeconds);
              const idle = hours(day.idleSeconds);
              return (
                <button
                  key={day.day}
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={selected === day}
                  aria-label={tr("chart.dayLabel", d, {
                    day: dayName(day.day),
                    moving: formatNumber(moving, lang, 1),
                    idle: formatNumber(idle, lang, 1),
                  })}
                  className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-md ${barClass(selected === day)}`}
                >
                  <span
                    className="w-3/4 rounded-t bg-blue-200 dark:bg-blue-900"
                    style={{ height: `${(idle / max) * 100}%` }}
                  />
                  <span
                    className="w-3/4 bg-blue-600"
                    style={{ height: `${(moving / max) * 100}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {days.map((day, i) => {
              const today = i === days.length - 1;
              return (
                <span
                  key={day.day}
                  className={`min-w-0 flex-1 truncate text-center text-[11px] ${dayLabelClass(today)}`}
                >
                  {today ? tr("chart.today", d) : dayName(day.day)}
                </span>
              );
            })}
          </div>
          {selected && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">
                {dayName(selected.day)}
              </span>
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

type TripState = "current" | "planned" | "done";

const TRIP_DOT: Record<TripState, string> = {
  current: "bg-blue-600",
  planned:
    "border-2 border-gray-300 bg-white dark:border-gray-500 dark:bg-gray-800",
  done: "bg-green-500",
};

function tripDetail(trip: Trip, state: TripState, d: I18nRecord, lang: string) {
  if (state === "planned") {
    return tr("trips.starts", d, { time: formatDateTime(trip.start, lang) });
  }
  if (state === "done") return formatDateTime(trip.start, lang);
  if (trip.eta) {
    return tr("trips.eta", d, { time: formatDateTime(trip.eta, lang) });
  }
  return tr("trips.current", d);
}

function TripLine({
  trip,
  state,
  d,
  lang,
}: Readonly<{ trip: Trip; state: TripState; d: I18nRecord; lang: string }>) {
  const route =
    [trip.origin, trip.destination].filter(Boolean).join(" → ") || trip.id;
  const trailer = trip.trailer
    ? ` · ${tr("trips.with", d, { trailer: trip.trailer })}`
    : "";
  return (
    <li className="ms-4 mb-4 last:mb-0">
      <span
        className={`absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full ${TRIP_DOT[state]}`}
      />
      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
        {route}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {trDynamic(`trips.${state}`, d)} · {tripDetail(trip, state, d, lang)}
        {trailer}
      </p>
    </li>
  );
}

function Trips({
  asset,
  d,
  lang,
}: Readonly<{ asset: AssetDetail; d: I18nRecord; lang: string }>) {
  const none =
    !asset.currentTrip &&
    asset.plannedTrips.length === 0 &&
    asset.recentTrips.length === 0;
  return (
    <section className={`${CARD} p-5`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className={CARD_TITLE}>{tr("trips.title", d)}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {tr("trips.count", d, {
            n: formatNumber(asset.indicators.trips30d, lang),
          })}
        </span>
      </div>
      {none && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr("trips.none", d)}
        </p>
      )}
      <ol className="relative border-s border-gray-200 dark:border-gray-700">
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
      </ol>
    </section>
  );
}

function History({
  changes,
  d,
  lang,
}: Readonly<{ changes: Change[]; d: I18nRecord; lang: string }>) {
  const label = (key: string) =>
    key.startsWith("document.")
      ? trDynamic(`documents.${key.slice("document.".length)}`, d)
      : trDynamic(`fields.${key}`, d);
  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-2`}>{tr("history.title", d)}</h3>
      {changes.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
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
              <span className="block text-xs text-gray-500 dark:text-gray-400">
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
            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(c.changedAt, lang)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
