"use client";

import {
  HiOutlineSignal,
  HiOutlineSignalSlash,
  HiOutlineExclamationTriangle,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineBolt,
  HiOutlineCog6Tooth,
  HiOutlineMapPin,
} from "react-icons/hi2";
import {
  TbGauge,
  TbEngine,
  TbBattery3,
  TbThermometer,
  TbSatellite,
  TbRoute,
} from "react-icons/tb";
import type { IconType } from "react-icons";
import type { Vehicle } from "../../../types/fleet.types";
import type {
  GpsHealth,
  SignalFreshness,
  TelemetryCapabilities,
  TruckTelemetryDetail,
} from "../../../types/truck-telemetry.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { MessageBanner } from "@/features/common/components/message-banner";
import type { MessageBannerVariant } from "@/features/common/components/message-banner";
import { KpiStat } from "@/features/common/components/kpi-stat";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { useFleetTruckTelemetry } from "../../../hooks/use-fleet-truck-telemetry";
import { getTelemetrySectionStatus } from "../vehicle-detail-accordion";

interface TelemetrySectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

// --- Badge state — collapses (frescura × salud_gps) to 3 UI states. ---

type TelemetryBadgeState = "connected" | "unstable" | "no_signal";

interface BadgeUi {
  i18nKey: string;
  badgeClass: string;
  bannerVariant: MessageBannerVariant;
  bannerIcon: IconType;
}

const BADGE_UI: Record<TelemetryBadgeState, BadgeUi> = {
  connected: {
    i18nKey: "vehicleDetail.sections.telemetry.freshness.connected",
    badgeClass:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    bannerVariant: "success",
    bannerIcon: HiOutlineCheckCircle,
  },
  unstable: {
    i18nKey: "vehicleDetail.sections.telemetry.freshness.unstable",
    badgeClass:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    bannerVariant: "warning",
    bannerIcon: HiOutlineExclamationTriangle,
  },
  no_signal: {
    i18nKey: "vehicleDetail.sections.telemetry.freshness.noSignal",
    badgeClass:
      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    bannerVariant: "info",
    bannerIcon: HiOutlineInformationCircle,
  },
};

function getBadgeState(
  freshness: SignalFreshness,
  health: GpsHealth
): TelemetryBadgeState {
  if (freshness === "SIN_SENAL") return "no_signal";
  if (freshness === "REZAGADO" || health === "DEGRADADO") return "unstable";
  return "connected";
}

// --- Value formatting + derivations for the 10-cell grid. ---

function fmtKm(n: number | undefined): string {
  return n === undefined ? "—" : `${n.toLocaleString()} km`;
}

function fmtKph(n: number | undefined): string {
  return n === undefined ? "—" : `${n} km/h`;
}

function fmtRpm(n: number | undefined): string {
  return n === undefined ? "—" : `${n.toLocaleString()} RPM`;
}

function fmtVolts(n: number | undefined): string {
  return n === undefined ? "—" : `${n.toFixed(2)} V`;
}

function fmtCelsius(n: number | undefined): string {
  return n === undefined ? "—" : `${n} °C`;
}

function fmtHoursSinceSignal(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1 h";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/**
 * Derive the "Estado" cell value from `vehicle_speed_kph`. The function
 * doesn't ship a first-class operating state, so we infer:
 *   speed > 0 → En movimiento, speed = 0 → Detenido, unknown → —
 * Pragmatic and matches what the user sees in the `last_*` sensor row.
 */
function deriveStatusLabel(
  caps: TelemetryCapabilities,
  dict: I18nRecord
): string {
  const speed = caps.vehicle_speed_kph;
  if (speed === undefined) return "—";
  return speed > 0
    ? tr("vehicleDetail.sections.telemetry.statusMoving", dict)
    : tr("vehicleDetail.sections.telemetry.statusStopped", dict);
}

/**
 * Same idea for "Motor" — derive from `engine_rpm` when the device
 * reports it; otherwise render "—".
 */
function deriveMotorLabel(
  caps: TelemetryCapabilities,
  dict: I18nRecord
): string {
  const rpm = caps.engine_rpm;
  if (rpm === undefined) return "—";
  return rpm > 0
    ? tr("vehicleDetail.sections.telemetry.motorRunning", dict)
    : tr("vehicleDetail.sections.telemetry.motorOff", dict);
}

/**
 * Average signal interval derived from `senales_por_dia`. We never get a
 * literal "transmission interval" from the function, so this is the
 * best-effort seconds between signals rounded to the nearest integer.
 */
function fmtTransmissionInterval(
  signalsPerDay: number,
  dict: I18nRecord
): string {
  if (signalsPerDay <= 0) return "—";
  const seconds = Math.round(86400 / signalsPerDay);
  return tr("vehicleDetail.sections.telemetry.everySeconds", dict, {
    seconds: String(seconds),
  });
}

function buildHeaderDescription(
  telemetry: TruckTelemetryDetail | null,
  dict: I18nRecord
): string {
  if (!telemetry) {
    return tr("vehicleDetail.sections.telemetry.description", dict);
  }
  const score = Math.round(telemetry.score.telemetry);
  const provider = telemetry.gps.provider;
  if (provider) {
    return tr("vehicleDetail.sections.telemetry.headerSubtitle", dict, {
      score: String(score),
      provider,
    });
  }
  return tr("vehicleDetail.sections.telemetry.headerSubtitleNoProvider", dict, {
    score: String(score),
  });
}

// --- Component. ---

export default function TelemetrySection({
  vehicle,
  dict,
}: TelemetrySectionProps) {
  const { telemetry, notFound, error, isLoading, mutate } =
    useFleetTruckTelemetry(vehicle.plate);

  const title = tr("vehicleDetail.sections.telemetry.title", dict);
  const description = buildHeaderDescription(telemetry, dict);

  // Loading — shell with a skeleton body that roughly matches the loaded
  // layout so the section doesn't visually pop when data arrives.
  if (isLoading) {
    return (
      <ExpandableSection
        icon={HiOutlineSignal}
        title={title}
        description={description}
        status="ok"
      >
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={`tel-skel-${i}`}
              className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
            />
          ))}
        </div>
      </ExpandableSection>
    );
  }

  // Error — distinct from not-found; surface a retry affordance.
  if (error && !notFound) {
    return (
      <ExpandableSection
        icon={HiOutlineSignal}
        title={title}
        description={description}
        status="warning"
      >
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("vehicleDetail.sections.telemetry.errorTitle", dict)}
          description={tr("vehicleDetail.sections.telemetry.errorDesc", dict)}
          variant="error"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.sections.telemetry.retry", dict)}
        </button>
      </ExpandableSection>
    );
  }

  // 404, null, or a loaded SIN_SENAL row — collapse to one empty-state
  // render so the user sees a consistent "no signal" view. We don't show
  // the 10-cell grid full of dashes for the ~89% of the fleet that's
  // SIN_SENAL; the badge + banner carry the explanation.
  if (notFound || !telemetry || telemetry.signal.freshness === "SIN_SENAL") {
    const ui = BADGE_UI.no_signal;
    const badge = (
      <CustomBadge text={tr(`${ui.i18nKey}.label`, dict)} className={ui.badgeClass} />
    );
    return (
      <ExpandableSection
        icon={HiOutlineSignalSlash}
        title={title}
        description={description}
        status="ok"
        badge={badge}
      >
        <MessageBanner
          icon={ui.bannerIcon}
          title={tr(
            "vehicleDetail.sections.telemetry.freshness.noSignal.bannerTitle",
            dict
          )}
          description={tr(
            "vehicleDetail.sections.telemetry.freshness.noSignal.bannerDesc",
            dict
          )}
          variant={ui.bannerVariant}
        />
      </ExpandableSection>
    );
  }

  // Loaded — active signal (ACTIVO or REZAGADO).
  const caps = telemetry.capabilities;
  const state = getBadgeState(telemetry.signal.freshness, telemetry.gps.health);
  const ui = BADGE_UI[state];
  const sectionStatus = getTelemetrySectionStatus(
    telemetry.signal.freshness,
    telemetry.gps.health
  );

  const badge = (
    <CustomBadge text={tr(`${ui.i18nKey}.label`, dict)} className={ui.badgeClass} />
  );

  const stabilityText =
    telemetry.signal.stability_pct !== null
      ? `${Math.round(telemetry.signal.stability_pct)}%`
      : "—";

  return (
    <ExpandableSection
      icon={HiOutlineSignal}
      title={title}
      description={description}
      status={sectionStatus}
      badge={badge}
    >
      <div className="flex flex-col gap-4">
        {/* --- "Último dato recibido" — 10-cell grid, original design order. --- */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("vehicleDetail.sections.telemetry.lastDataReceived", dict)}
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <KpiStat
              icon={{
                icon: TbGauge,
                className:
                  "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.odometer", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{
                text: fmtKm(caps.odometer_km),
                className: "text-blue-600 dark:text-blue-400 font-bold text-base",
              }}
              className="bg-blue-100/40 dark:bg-blue-600/10 border border-blue-500/50"
              variant="horizontal"
            />
            <div className="col-span-2 grid grid-cols-2 gap-3 w-full">
              <KpiStat
                icon={{
                  icon: HiOutlineClock,
                  className:
                    "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700",
                }}
                title={{
                  text: tr("vehicleDetail.sections.telemetry.dateTime", dict),
                  className: "text-gray-500 dark:text-gray-300",
                }}
                value={{
                  text: telemetry.signal.last_at
                    ? formatDateString(telemetry.signal.last_at)
                    : "—",
                  className: "text-base",
                }}
                variant="horizontal"
              />
              <KpiStat
                icon={{
                  icon: TbRoute,
                  className:
                    "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
                }}
                title={{
                  text: tr("vehicleDetail.sections.telemetry.statusLabel", dict),
                  className: "text-gray-500 dark:text-gray-300",
                }}
                value={{
                  text: deriveStatusLabel(caps, dict),
                  className: "text-green-500 dark:text-green-400 font-bold text-base",
                }}
                variant="horizontal"
              />
            </div>
            <KpiStat
              icon={{
                icon: TbEngine,
                className:
                  "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.motor", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{
                text: deriveMotorLabel(caps, dict),
                className: "text-green-500 dark:text-green-400 font-bold text-base",
              }}
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: HiOutlineBolt,
                className:
                  "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.speed", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{ text: fmtKph(caps.vehicle_speed_kph), className: "text-base" }}
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: HiOutlineCog6Tooth,
                className:
                  "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.rpm", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{ text: fmtRpm(caps.engine_rpm), className: "text-base" }}
              className="col-span-2"
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: TbBattery3,
                className:
                  "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.battery", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{
                text: fmtVolts(caps.battery_voltage_v),
                className: "text-green-500 dark:text-green-400 font-bold text-base",
              }}
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: TbThermometer,
                className:
                  "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.engineTemp", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{ text: fmtCelsius(caps.coolant_temp_c), className: "text-base" }}
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: HiOutlineMapPin,
                className:
                  "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
              }}
              title={{
                text: tr("vehicleDetail.sections.telemetry.location", dict),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{ text: vehicle.lastLocation || "—", className: "text-base" }}
              className="col-span-2"
              variant="horizontal"
            />
            <KpiStat
              icon={{
                icon: TbSatellite,
                className:
                  "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30",
              }}
              title={{
                text: tr(
                  "vehicleDetail.sections.telemetry.transmissionInterval",
                  dict
                ),
                className: "text-gray-500 dark:text-gray-300",
              }}
              value={{
                text: fmtTransmissionInterval(
                  telemetry.signal.signals_per_day,
                  dict
                ),
                className: "text-base",
              }}
              variant="horizontal"
            />
          </div>
        </div>

        {/* --- Footer stats — signal reliability summary. --- */}
        <div className="grid grid-cols-3 gap-3">
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.telemetry.stability", dict),
            }}
            value={{
              text: stabilityText,
              className: "font-bold !text-xl",
            }}
            className="w-full text-center"
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.telemetry.signalsPerDay", dict),
            }}
            value={{
              text: Math.round(telemetry.signal.signals_per_day).toLocaleString(),
              className: "font-bold !text-xl",
            }}
            className="w-full text-center"
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr(
                "vehicleDetail.sections.telemetry.hoursSinceSignal",
                dict
              ),
            }}
            value={{
              text: fmtHoursSinceSignal(telemetry.signal.hours_since_last),
              className: "font-bold !text-xl",
            }}
            className="w-full text-center"
            variant="vertical"
          />
        </div>

        {/* --- State banner — reinforces the header badge in text. --- */}
        <MessageBanner
          icon={ui.bannerIcon}
          title={tr(`${ui.i18nKey}.bannerTitle`, dict)}
          description={tr(`${ui.i18nKey}.bannerDesc`, dict)}
          variant={ui.bannerVariant}
        />
      </div>
    </ExpandableSection>
  );
}
