"use client";

import {
  HiOutlineArrowPath,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  HiOutlineXCircle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import type { Vehicle } from "../../../types/fleet.types";
import type {
  ContractDeviation,
  TruckUsageDetail,
} from "../../../types/truck-usage.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { ProgressBar } from "@/features/common/components/progress-bar";
import KpiStat from "@/features/common/components/kpi-stat/kpi-stat";
import { TbRoute } from "react-icons/tb";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { MessageBanner } from "@/features/common/components/message-banner";
import type { MessageBannerVariant } from "@/features/common/components/message-banner";
import { useFleetTruckUsage } from "../../../hooks/use-fleet-truck-usage";
import { getUsageSectionStatus } from "../vehicle-detail-accordion";

interface UsageSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

// --- Contract-deviation → UI mapping ---
// Single source of truth for badge colors, progress-bar color, and the
// SIN_DATOS empty-state banner. The accordion section status comes from
// `getUsageSectionStatus` so the header color and the overall health
// overview share the same derivation.

interface DeviationUi {
  badgeClass: string;
  progressBarClass: string;
  bannerVariant: MessageBannerVariant;
  bannerIcon: IconType;
}

const DEVIATION_UI: Record<ContractDeviation, DeviationUi> = {
  NORMAL: {
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    progressBarClass: "bg-green-500",
    bannerVariant: "success",
    bannerIcon: HiOutlineCheckCircle,
  },
  SOBREUSO: {
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    progressBarClass: "bg-red-500",
    bannerVariant: "error",
    bannerIcon: HiOutlineXCircle,
  },
  SUBUTILIZADO: {
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    progressBarClass: "bg-blue-500",
    bannerVariant: "info",
    bannerIcon: HiOutlineInformationCircle,
  },
  SIN_DATOS: {
    badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    progressBarClass: "bg-gray-400",
    bannerVariant: "info",
    bannerIcon: HiOutlineInformationCircle,
  },
};

// --- Value formatters ---

function formatKm(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n).toLocaleString()} km`;
}

function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

// --- Header badge ---

function getUsageBadge(usage: TruckUsageDetail, dict: I18nRecord) {
  const status = usage.contract.status;
  const ui = DEVIATION_UI[status];
  const label =
    status === "SIN_DATOS"
      ? tr("vehicleDetail.sections.usage.contractStatus.SIN_DATOS.label", dict)
      : tr(
          `vehicleDetail.sections.usage.contractStatus.${status}.label`,
          dict,
          { pct: formatPct(usage.contract.pct_consumed) }
        );
  return <CustomBadge text={label} className={ui.badgeClass} />;
}

// --- Component ---

export default function UsageSection({ vehicle, dict }: UsageSectionProps) {
  const { usage, notFound, error, isLoading, mutate } = useFleetTruckUsage(
    vehicle.plate
  );

  const title = tr("vehicleDetail.sections.usage.title", dict);
  const description = tr("vehicleDetail.sections.usage.description", dict);

  // Loading — skeleton grid mirroring the final layout.
  if (isLoading) {
    return (
      <ExpandableSection
        icon={HiOutlineArrowPath}
        title={title}
        description={description}
        status="ok"
      >
        <div className="flex flex-col gap-4">
          <div className="h-20 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
          <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={`us-skel-${i}`}
                className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
              />
            ))}
          </div>
        </div>
      </ExpandableSection>
    );
  }

  // Error (distinct from not-found) — retry affordance.
  if (error && !notFound) {
    return (
      <ExpandableSection
        icon={HiOutlineArrowPath}
        title={title}
        description={description}
        status="warning"
      >
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("vehicleDetail.sections.usage.errorTitle", dict)}
          description={tr("vehicleDetail.sections.usage.errorDesc", dict)}
          variant="error"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.sections.usage.retry", dict)}
        </button>
      </ExpandableSection>
    );
  }

  // 404 — the truck has no row upstream. Render the same SIN_DATOS shell
  // as a regular SIN_DATOS vehicle so the user sees a coherent state.
  if (notFound || !usage) {
    const ui = DEVIATION_UI.SIN_DATOS;
    const badge = (
      <CustomBadge
        text={tr(
          "vehicleDetail.sections.usage.contractStatus.SIN_DATOS.label",
          dict
        )}
        className={ui.badgeClass}
      />
    );
    return (
      <ExpandableSection
        icon={HiOutlineArrowPath}
        title={title}
        description={description}
        status="ok"
        badge={badge}
      >
        <MessageBanner
          icon={ui.bannerIcon}
          title={tr(
            "vehicleDetail.sections.usage.contractStatus.SIN_DATOS.bannerTitle",
            dict
          )}
          description={tr(
            "vehicleDetail.sections.usage.contractStatus.SIN_DATOS.bannerDesc",
            dict
          )}
          variant={ui.bannerVariant}
        />
      </ExpandableSection>
    );
  }

  // Loaded state.
  const deviation = usage.contract.status;
  const ui = DEVIATION_UI[deviation];
  const pctConsumed = usage.contract.pct_consumed;
  // The progress bar caps at 100 visually even when sobreuso hits 115+.
  const progressValue = pctConsumed === null ? 0 : Math.min(pctConsumed, 100);

  // Cell 2 — km restantes del contrato. When over-contract, show the
  // excess km with a `+N km sobreuso` description so the direction is
  // clear instead of rendering "0 km" with no signal that it's worse
  // than zero.
  const remainingKm = usage.contract.remaining_km;
  const deviationKm = usage.contract.deviation_km;
  const remainingCellValue = formatKm(remainingKm);
  let remainingCellDesc: string;
  if (remainingKm === null) {
    remainingCellDesc = tr("vehicleDetail.sections.usage.noDataShort", dict);
  } else if (deviationKm !== null && deviationKm > 0) {
    remainingCellDesc = tr("vehicleDetail.sections.usage.overuseAmount", dict, {
      km: Math.round(deviationKm).toLocaleString(),
    });
  } else {
    remainingCellDesc = tr("vehicleDetail.sections.usage.withinContract", dict);
  }

  // Cell 6 — annual projection. Computed client-side as km/day * 365;
  // null when the upstream has no km/day signal at all.
  const annualProjection =
    usage.period.km_per_day === null
      ? null
      : Math.round(usage.period.km_per_day * 365);

  // Intensity label shown as the description on the km/day cell.
  const intensityLabel = tr(
    `vehicleDetail.sections.usage.intensity.${usage.period.intensity}.label`,
    dict
  );

  // Cell 4 — "Días con dato". The upstream `dias_con_dato` column was
  // dropped in the 11-column shrink; until backend re-exposes it, the
  // cell renders a placeholder. Once `active_days` comes back non-null
  // the existing i18n keys kick back in with no code change.
  const activeDays = usage.period.active_days;
  const activeDaysValue =
    activeDays === null
      ? "—"
      : tr("vehicleDetail.sections.usage.activeDaysValue", dict, {
          active: String(activeDays),
          total: String(usage.period.lookback_days),
        });
  const activeDaysDesc =
    activeDays === null
      ? tr("vehicleDetail.sections.usage.noDataShort", dict)
      : tr("vehicleDetail.sections.usage.utilization", dict, {
          percentage: (
            (activeDays / usage.period.lookback_days) *
            100
          ).toFixed(0),
        });

  return (
    <ExpandableSection
      icon={HiOutlineArrowPath}
      title={title}
      description={description}
      status={getUsageSectionStatus(deviation, pctConsumed)}
      badge={getUsageBadge(usage, dict)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <KpiStat
            icon={{
              icon: TbRoute,
              className:
                "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 border border-purple-500",
            }}
            title={{
              text: tr("vehicleDetail.sections.usage.currentOdometer", dict),
            }}
            value={{
              text: formatKm(usage.odometer.current_km),
              className:
                "font-bold !text-xl text-purple-500 dark:text-purple-400",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.odometerSinceOrigin", dict),
            }}
            className="w-full bg-purple-50 border border-purple-500 dark:bg-purple-900/30 dark:border-purple-500"
            variant="horizontal"
          />
          <ProgressBar
            progress={progressValue}
            label={{
              text: tr("vehicleDetail.sections.usage.contractConsumption", dict),
              className: "text-sm text-gray-600 dark:text-gray-400",
            }}
            value={{
              text: formatPct(pctConsumed),
              className: "text-purple-500 dark:text-purple-400 font-medium",
            }}
            barClassName={ui.progressBarClass}
            description={{
              text: tr("vehicleDetail.sections.usage.contractMaxLabel", dict, {
                km: usage.contract.max_travel_km.toLocaleString(),
              }),
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.kmLast30Days", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{ text: formatKm(usage.period.km_traveled) }}
            description={{
              text: tr("vehicleDetail.sections.usage.lookbackWindowLabel", dict, {
                days: String(usage.period.lookback_days),
              }),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.kmRemainingContract", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{ text: remainingCellValue }}
            description={{
              text: remainingCellDesc,
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.avgDailyKm", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text:
                usage.period.km_per_day === null
                  ? "—"
                  : tr("vehicleDetail.sections.usage.kmPerDay", dict, {
                      km: usage.period.km_per_day.toFixed(1),
                    }),
            }}
            description={{
              text: intensityLabel,
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.activeDaysLabel", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{ text: activeDaysValue }}
            description={{
              text: activeDaysDesc,
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.useType", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text:
                usage.use_type ??
                tr("vehicleDetail.sections.usage.useTypeUnknown", dict),
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.useTypeDesc", dict),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.annualProjection", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{ text: formatKm(annualProjection) }}
            description={{
              text: tr("vehicleDetail.sections.usage.projectionBasis", dict),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
        </div>
        {deviation !== "SIN_DATOS" && (
          <MessageBanner
            icon={ui.bannerIcon}
            title={tr(
              `vehicleDetail.sections.usage.contractStatus.${deviation}.bannerTitle`,
              dict
            )}
            description={tr(
              `vehicleDetail.sections.usage.contractStatus.${deviation}.bannerDesc`,
              dict
            )}
            variant={ui.bannerVariant}
          />
        )}
      </div>
    </ExpandableSection>
  );
}
