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
import { GoPulse } from "react-icons/go";
import { IoMdPin } from "react-icons/io";
import { VehicleDetailData } from "../vehicle-detail-accordion";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

interface TelemetrySectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
}

export default function TelemetrySection({ dict, data }: TelemetrySectionProps) {
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
          connectedLabel={tr("vehicleDetail.sections.telemetry.connected", dict)}
          disconnectedLabel={tr("vehicleDetail.sections.telemetry.disconnected", dict)}
        />
      }
    >
      <div className="flex flex-col gap-4">
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
              text: data.telemetry.odometer.toLocaleString() + " km",
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
                text: formatDateString(data.telemetry.dateLastUpdate),
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
                text: data.telemetry.status,
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
              text: data.telemetry.engineRunning ? tr("vehicleDetail.sections.telemetry.running", dict) : tr("vehicleDetail.sections.telemetry.notRunning", dict),
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
              text: data.telemetry.speed.toString() + " km/h",
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
              text: data.telemetry.rpm.toString() + " RPM",
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
              text: data.telemetry.batteryPercentage.toString() + "%",
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
              text: data.telemetry.engineTempC.toString() + " °C",
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
              text: data.telemetry.location,
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
              text: tr("vehicleDetail.sections.telemetry.everySeconds", dict, { seconds: data.telemetry.transmissionIntervalSecs.toString() }),
            }}
            variant="horizontal"
          />
        </div>
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("vehicleDetail.sections.telemetry.installedDevices", dict)}
          </h4>
          {data.telemetry.installedDevices.map((device) => (
            <KpiStat
              key={device.name}
              icon={{
                icon: (() => {
                  switch (device.icon) {
                    case "location": return IoMdPin;
                    case "odometer": return TbEngine;
                    case "live": return GoPulse;
                    default: return HiOutlineCog6Tooth;
                }})(),
                className: (() => {
                  switch (device.icon) {
                    case "location": return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
                    case "odometer": return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
                    case "live": return "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30";
                    default: return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
                }})()
              }}
              value={{
                text: device.name,
              }}
              description={{
                text: device.description,
              }}
              variant="horizontal"
            />
          ))}
        </div>
        <div className="flex flex-row gap-3 w-full">
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            value={{
              text: data.telemetry.accumulatedUptimePercentage.toString() + "%",
              className: "font-bold !text-xl",
            }}
            title={{
              text: tr("vehicleDetail.sections.telemetry.acumulatedUptime", dict)
            }}
            className="w-full text-center"
            variant="vertical"
          />
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            title={{
              text: tr("vehicleDetail.sections.telemetry.dataProcessedToday", dict)
            }}
            value={{
              text: data.telemetry.dataProcessedToday.toLocaleString(),
              className: "font-bold !text-xl",
            }}
            className="w-full text-center"
            variant="vertical"
          />
          <KpiStat
            icon={{
              className:
                "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
            }}
            title={{
              text: tr("vehicleDetail.sections.telemetry.signalLost", dict)
            }}
            value={{
              text: data.telemetry.signalLost30d.toString(),
              className: "font-bold !text-xl",
            }}
            className="w-full text-center"
            variant="vertical"
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
