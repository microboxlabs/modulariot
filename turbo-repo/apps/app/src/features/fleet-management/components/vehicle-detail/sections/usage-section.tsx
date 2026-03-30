"use client";

import { HiOutlineArrowPath } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { ProgressBar } from "@/features/common/components/progress-bar";
import KpiStat from "@/features/common/components/kpi-stat/kpi-stat";
import { TbRoute } from "react-icons/tb";
import ReactECharts from "echarts-for-react";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { VehicleDetailData } from "../vehicle-detail-accordion";

interface UsageSectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
}

export default function UsageSection({
  data,
  dict,
}: UsageSectionProps) {
  const percentage = data.usage.monthlyContractualConsumptionPercentage;

  const chartOption = {
    grid: {
      top: 10,
      right: 10,
      bottom: 20,
      left: 40,
    },
    xAxis: {
      type: "category" as const,
      data: Array.from({ length: 30 }, (_, i) => (i + 1).toString()),
      axisLine: { lineStyle: { color: "#9ca3af" } },
      axisLabel: { color: "#6b7280", fontSize: 10 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      axisLabel: { color: "#6b7280", fontSize: 10 },
      splitLine: { lineStyle: { color: "#e5e7eb" } },
    },
    series: [
      {
        data: data.usage.intensityLast30Days,
        type: "line" as const,
        smooth: true,
        lineStyle: { color: "#8b5cf6", width: 2 },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(139, 92, 246, 0.3)" },
              { offset: 1, color: "rgba(139, 92, 246, 0.05)" },
            ],
          },
        },
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: "#8b5cf6" },
      },
    ],
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      textStyle: { color: "#f9fafb", fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const point = params[0];
        return `${point.name}: ${point.value} km`;
      },
    },
  };

  return (
    <ExpandableSection
      icon={HiOutlineArrowPath}
      title={tr("vehicleDetail.sections.usage.title", dict)}
      description={tr("vehicleDetail.sections.usage.description", dict)}
      badge={
        <CustomBadge 
          text={`${percentage}% uso`}
          className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <KpiStat
            icon={{
              icon: TbRoute,
              className:
                "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30 border border-purple-500",
            }}
            title={{
              text: tr("vehicleDetail.sections.usage.totalKm", dict),
            }}
            value={{
              text: data.usage.totalKilometers.toLocaleString() + " km",
              className: "font-bold !text-xl text-purple-500 dark:text-purple-400",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.odometerSinceOrigin", dict),
            }}
            className="w-full bg-purple-50 border border-purple-500 dark:bg-purple-900/30 dark:border-purple-500"
            variant="horizontal"
          />
          <ProgressBar 
            progress={percentage} 
            label={{ text: tr("vehicleDetail.sections.usage.monthlyContractualConsumption", dict), className: "text-sm text-gray-600 dark:text-gray-400" }}
            value={{
              text: `${percentage}%`,
              className: "text-purple-500 dark:text-purple-400 font-medium"
            }}
            barClassName="bg-purple-500"
            description={{
              text: `+12% ${tr("vehicleDetail.sections.usage.deviationFromAverage", dict)}`
            }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KpiStat
            title={{
              text: tr(
                "vehicleDetail.sections.usage.kmTraveledThisMonth",
                dict
              ),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: data.usage.kmTravelledThisMonth.toLocaleString() + " km",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.limitKmMonthly", dict, { km: data.usage.remainingKmThisMonth.toLocaleString() }),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.kmRemainingThisMonth", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: data.usage.remainingKmThisMonth.toLocaleString() + " km",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.projectedDays", dict, { days: "8" }),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.avgDaily", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: tr("vehicleDetail.sections.usage.kmPerDay", dict, { km: data.usage.averageDaily.toLocaleString() }),
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.kmPerDay", dict, { km: "390" }),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.operationHours", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: data.usage.operationHours.toLocaleString() + " hrs",
            }}
            description={{
              text: tr(
                "vehicleDetail.sections.usage.avgDailyOperationHours",
                dict,
                {
                  hours:
                    data.usage.activeDays > 0
                      ? (data.usage.operationHours / data.usage.activeDays).toFixed(1) + "h"
                      : "0h",
                }
              ),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.activeDays", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: data.usage.activeDays.toString() + " días",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.utilization", dict, { percentage: ((data.usage.activeDays / 30) * 100).toFixed(0) }),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
          <KpiStat
            title={{
              text: tr("vehicleDetail.sections.usage.annualTotalKm", dict),
              className: "text-gray-500 dark:text-gray-300",
            }}
            value={{
              text: data.usage.annualTotalKm.toLocaleString() + " km",
            }}
            description={{
              text: tr("vehicleDetail.sections.usage.estimatedProjection", dict),
              className: "text-gray-500 dark:text-gray-300/60",
            }}
            variant="vertical"
          />
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {tr("vehicleDetail.sections.usage.intensityLastDays", dict)}
          </p>
          <ReactECharts 
            option={chartOption} 
            style={{ height: 200 }}
            opts={{ renderer: "svg" }}
          />
        </div>
      </div>
    </ExpandableSection>
  );
}
