"use client";

import {
  HiOutlineWrenchScrewdriver,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import type { Vehicle } from "../../../types/fleet.types";
import type { MaintenanceCriticality } from "../../../types/truck-maintenance.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { MessageBanner } from "@/features/common/components/message-banner";
import type { MessageBannerVariant } from "@/features/common/components/message-banner";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { getMaintenanceSectionStatus } from "../vehicle-detail-accordion";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { useFleetTruckMaintenance } from "../../../hooks/use-fleet-truck-maintenance";

interface MaintenanceSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

// --- Criticality → UI mapping ---
// One place for color, icon, and banner variant per criticality bucket.
// The accordion section status comes from `getMaintenanceSectionStatus` in
// vehicle-detail-accordion.tsx so the header color and the overall health
// overview share a single source of truth.

interface CriticalityUi {
  badgeClass: string;
  bannerVariant: MessageBannerVariant;
  bannerIcon: IconType;
}

const CRITICALITY_UI: Record<MaintenanceCriticality, CriticalityUi> = {
  AL_DIA: {
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    bannerVariant: "success",
    bannerIcon: HiOutlineCheckCircle,
  },
  POR_VENCER: {
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    bannerVariant: "warning",
    bannerIcon: HiOutlineExclamationTriangle,
  },
  CRITICO: {
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    bannerVariant: "error",
    bannerIcon: HiOutlineExclamationTriangle,
  },
  VENCIDO: {
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    bannerVariant: "error",
    bannerIcon: HiOutlineXCircle,
  },
  EN_TALLER: {
    badgeClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    bannerVariant: "warning",
    bannerIcon: HiOutlineWrenchScrewdriver,
  },
  AGENDADO: {
    badgeClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    bannerVariant: "info",
    bannerIcon: HiOutlineClock,
  },
  SIN_INFO: {
    badgeClass:
      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    bannerVariant: "info",
    bannerIcon: HiOutlineInformationCircle,
  },
};

function formatKm(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString()} km`;
}

export default function MaintenanceSection({
  vehicle,
  dict,
}: MaintenanceSectionProps) {
  const { maintenance, notFound, error, isLoading, mutate } =
    useFleetTruckMaintenance(vehicle.plate);

  const title = tr("vehicleDetail.sections.maintenance.title", dict);
  const description = tr(
    "vehicleDetail.sections.maintenance.description",
    dict
  );

  // Loading state — render the shell with a skeleton body so the section
  // doesn't visually "pop in" when data arrives.
  if (isLoading) {
    return (
      <ExpandableSection
        icon={HiOutlineWrenchScrewdriver}
        title={title}
        description={description}
        status="ok"
      >
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`mx-skel-${i}`}
              className="h-24 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
            />
          ))}
        </div>
      </ExpandableSection>
    );
  }

  // Error (distinct from not-found) — show a retry affordance.
  if (error && !notFound) {
    return (
      <ExpandableSection
        icon={HiOutlineWrenchScrewdriver}
        title={title}
        description={description}
        status="warning"
      >
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("vehicleDetail.sections.maintenance.errorTitle", dict)}
          description={tr("vehicleDetail.sections.maintenance.errorDesc", dict)}
          variant="error"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.sections.maintenance.retry", dict)}
        </button>
      </ExpandableSection>
    );
  }

  // 404 — the truck has no row in the source catalog. Render the same
  // shell as SIN_INFO with the "no data" copy so the user sees a coherent
  // state, not a separate error.
  if (notFound || !maintenance) {
    return renderEmptyState({
      criticality: "SIN_INFO",
      dict,
      title,
      description,
    });
  }

  const criticality = maintenance.status.criticality;
  const ui = CRITICALITY_UI[criticality];

  const badge = (
    <CustomBadge
      text={tr(
        `vehicleDetail.sections.maintenance.criticality.${criticality}.label`,
        dict
      )}
      className={ui.badgeClass}
    />
  );

  // KPI 2 ("next maintenance") description — show remaining km + projected
  // days when both are available, just remaining when days are unknown, or
  // empty when neither is computable.
  const kpiNextDesc = (() => {
    const kmRemaining = maintenance.remaining.km_effective;
    const daysRemaining = maintenance.forecast.estimated_days_remaining;
    if (kmRemaining === null) return "";
    if (daysRemaining !== null) {
      return tr("vehicleDetail.sections.maintenance.kmRemaining", dict, {
        km: kmRemaining.toLocaleString(),
        days: String(daysRemaining),
      });
    }
    return tr("vehicleDetail.sections.maintenance.kmRemainingNoDays", dict, {
      km: kmRemaining.toLocaleString(),
    });
  })();

  const lastServiceKm = maintenance.plan.last_service_km;
  const lastServiceAt = maintenance.plan.last_service_at;
  const kpiLastServiceDesc =
    lastServiceKm !== null
      ? tr("vehicleDetail.sections.maintenance.atKm", dict, {
          km: lastServiceKm.toLocaleString(),
        })
      : tr("vehicleDetail.sections.maintenance.neverServiced", dict);

  const kpiKmSinceDesc =
    maintenance.plan.pct_of_interval !== null
      ? tr("vehicleDetail.sections.maintenance.intervalPercent", dict, {
          percent: String(maintenance.plan.pct_of_interval),
          interval: `${(maintenance.plan.interval_km / 1000).toFixed(0)}k`,
        })
      : "";

  return (
    <ExpandableSection
      icon={HiOutlineWrenchScrewdriver}
      title={title}
      description={description}
      status={getMaintenanceSectionStatus(criticality)}
      badge={badge}
    >
      <div className="grid grid-cols-3 gap-3">
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.totalKm", dict),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: formatKm(maintenance.odometer.current_km),
            className: "text-blue-600 dark:text-blue-400 bold",
          }}
          description={{
            text: tr("vehicleDetail.sections.maintenance.totalKmDesc", dict),
            className: "text-gray-500 dark:text-gray-300/60",
          }}
          icon={{}}
          className="bg-blue-100/40 dark:bg-blue-600/10 border border-blue-500/50"
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.nextMaintenance",
              dict
            ),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: formatKm(maintenance.plan.next_service_target_km),
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: kpiNextDesc,
            className: "text-gray-500 dark:text-gray-300/60",
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr("vehicleDetail.sections.maintenance.lastService", dict),
          }}
          value={{
            // lastServiceAt: known date, formatted.
            // lastServiceKm !== null: serviced, date unknown (pgrest dropped
            //   `last_seen_at`) — show a dash so the description's "A los X km"
            //   still carries the signal.
            // else: actually never serviced (km_os was 0).
            text: lastServiceAt
              ? formatDateString(lastServiceAt)
              : lastServiceKm !== null
              ? "—"
              : tr("vehicleDetail.sections.maintenance.neverServiced", dict),
          }}
          description={{ text: kpiLastServiceDesc }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.contractualFrequency",
              dict
            ),
          }}
          value={{ text: formatKm(maintenance.plan.interval_km) }}
          description={{
            text: tr(
              "vehicleDetail.sections.maintenance.contractualFrequencyDesc",
              dict
            ),
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.maintenanceCount",
              dict
            ),
          }}
          value={{
            // Nullable: source function dropped `num_maintance`. Fall back
            // to em-dash instead of rendering "null" or a misleading "0".
            text:
              maintenance.plan.completed_services !== null
                ? String(maintenance.plan.completed_services)
                : "—",
            className: "text-green-500 dark:text-green-400 bold",
          }}
          description={{
            text: tr(
              "vehicleDetail.sections.maintenance.maintenanceCountDesc",
              dict
            ),
          }}
          variant="vertical"
        />
        <KpiStat
          title={{
            text: tr(
              "vehicleDetail.sections.maintenance.kmSinceService",
              dict
            ),
          }}
          value={{
            text: formatKm(maintenance.plan.km_since_last_service),
            className: "text-green-500 dark:text-green-400",
          }}
          description={{ text: kpiKmSinceDesc }}
          variant="vertical"
        />
      </div>
      <div className="mt-3">
        <MessageBanner
          icon={ui.bannerIcon}
          title={tr(
            `vehicleDetail.sections.maintenance.criticality.${criticality}.bannerTitle`,
            dict
          )}
          description={tr(
            `vehicleDetail.sections.maintenance.criticality.${criticality}.bannerDesc`,
            dict
          )}
          variant={ui.bannerVariant}
        />
      </div>
    </ExpandableSection>
  );
}

// Extracted so the 404 path and (future) other empty paths share one render.
function renderEmptyState({
  criticality,
  dict,
  title,
  description,
}: {
  criticality: MaintenanceCriticality;
  dict: I18nRecord;
  title: string;
  description: string;
}) {
  const ui = CRITICALITY_UI[criticality];
  const badge = (
    <CustomBadge
      text={tr(
        `vehicleDetail.sections.maintenance.criticality.${criticality}.label`,
        dict
      )}
      className={ui.badgeClass}
    />
  );
  return (
    <ExpandableSection
      icon={HiOutlineWrenchScrewdriver}
      title={title}
      description={description}
      status={getMaintenanceSectionStatus(criticality)}
      badge={badge}
    >
      <MessageBanner
        icon={ui.bannerIcon}
        title={tr(
          `vehicleDetail.sections.maintenance.criticality.${criticality}.bannerTitle`,
          dict
        )}
        description={tr(
          `vehicleDetail.sections.maintenance.criticality.${criticality}.bannerDesc`,
          dict
        )}
        variant={ui.bannerVariant}
      />
    </ExpandableSection>
  );
}
