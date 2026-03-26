"use client";

import {
  HiOutlineSignal,
  HiOutlineClock,
  HiOutlineMapPin,
  HiOutlineBolt,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";
import {
  TbGauge,
  TbEngine,
  TbBattery3,
  TbThermometer,
  TbSatellite,
  TbRoute,
} from "react-icons/tb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import KpiStat from "@/features/common/components/kpi-stat/kpi-stat";
import { ConnectionStatusBadge } from "@/features/common/components/connection-status-badge";

interface TelemetrySectionProps {
  readonly dict: I18nRecord;
}

export default function TelemetrySection({ dict }: TelemetrySectionProps) {
  const isConnected = true;
  const signalStrength = 85;

  return (
    <ExpandableSection
      icon={HiOutlineSignal}
      title={tr("vehicleDetail.sections.telemetry.title", dict)}
      description={tr("vehicleDetail.sections.telemetry.description", dict)}
      badge={
        <ConnectionStatusBadge
          isConnected={isConnected}
          signalStrength={signalStrength}
          connectedLabel={tr("common.connected", dict)}
          disconnectedLabel={tr("common.disconnected", dict)}
        />
      }
    >
      <div className="grid grid-cols-4 gap-3 pt-4">
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
            text: "47.000 km",
            className: "text-blue-600 dark:text-blue-400 font-bold",
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
              text: "11 Feb 2026 16:42:18",
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
              text: tr("vehicleDetail.sections.telemetry.status", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: tr("vehicleDetail.sections.telemetry.onRoute", dict),
              className: "text-green-500 dark:text-green-400 font-bold",
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
            text: tr("vehicleDetail.sections.telemetry.engine", dict),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: tr("vehicleDetail.sections.telemetry.running", dict),
            className: "text-green-500 dark:text-green-400 font-bold",
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
          value={{
            text: "65 km/h",
          }}
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
          value={{
            text: "3,000 RPM",
          }}
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
            text: "80%",
            className: "text-green-500 dark:text-green-400 font-bold",
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
          value={{
            text: "90°C",
          }}
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
          value={{
            text: "Av Kennedy, Las Condes",
          }}
          description={{
            text: "-33.4122, 70.5789",
          }}
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
            text: tr("vehicleDetail.sections.telemetry.transmissionInterval", dict),
            className: "text-gray-500 dark:text-gray-300",
          }}
          value={{
            text: tr("vehicleDetail.sections.telemetry.every30Seconds", dict),
          }}
          variant="horizontal"
        />
      </div>
    </ExpandableSection>
  );
}
