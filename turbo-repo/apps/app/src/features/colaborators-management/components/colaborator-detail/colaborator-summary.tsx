"use client";

import { useState, useMemo } from "react";
import type {
  Colaborator,
  MonthlyDataPoint,
  ScoreCardValue,
} from "../../types/colaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { IoShieldOutline } from "react-icons/io5";
import { HiClock, HiTruck, HiExclamationTriangle } from "react-icons/hi2";
import ReactECharts from "echarts-for-react";

function getOverallScoreRing(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

function getOverallLabel(score: number): {
  labelKey: string;
  className: string;
} {
  if (score >= 80)
    return {
      labelKey: "performanceStatus.excelente",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
  if (score >= 60)
    return {
      labelKey: "performanceStatus.bueno",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
  return {
    labelKey: "performanceStatus.en-observacion",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
}

function getDeltaColor(delta: number, higherIsBetter: boolean): string {
  if (delta === 0) return "text-gray-400 dark:text-gray-500";
  const isGood = higherIsBetter ? delta > 0 : delta < 0;
  return isGood ? "text-green-500" : "text-red-500";
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function EvolutionChart({
  onHoverIndex,
  dict,
  monthlyData,
  monthKeys,
}: {
  readonly onHoverIndex: (index: number | null) => void;
  readonly dict: I18nRecord;
  readonly monthlyData: MonthlyDataPoint[];
  readonly monthKeys: readonly string[];
}) {
  const monthLabels = useMemo(
    () => monthKeys.map((key) => tr(key, dict)),
    [dict, monthKeys]
  );

  const scoreValues = useMemo(
    () => monthlyData.map((d) => d.score),
    [monthlyData]
  );

  const onEvents = useMemo(
    () => ({
      updateAxisPointer: (params: { axesInfo?: Array<{ value?: number }> }) => {
        const idx = params.axesInfo?.[0]?.value;
        if (idx !== undefined) onHoverIndex(idx);
      },
      globalout: () => onHoverIndex(null),
    }),
    [onHoverIndex]
  );

  const pointsLabel = tr("detail.points", dict);

  const chartOption = useMemo(
    () => ({
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: {
        type: "category" as const,
        data: monthLabels,
        axisLine: { lineStyle: { color: "#9ca3af" } },
        axisLabel: { color: "#6b7280", fontSize: 10 },
        triggerEvent: true,
        axisPointer: { type: "shadow" as const },
      },
      yAxis: {
        type: "value" as const,
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisLabel: { color: "#6b7280", fontSize: 10 },
        splitLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        {
          data: scoreValues,
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
          emphasis: {
            itemStyle: { borderWidth: 3, borderColor: "#8b5cf6" },
          },
        },
      ],
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "#1f2937",
        borderColor: "#374151",
        textStyle: { color: "#f9fafb", fontSize: 12 },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const point = params[0];
          return `${point.name}: ${point.value} ${pointsLabel}`;
        },
      },
    }),
    [monthLabels, pointsLabel, scoreValues]
  );

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-md p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {tr("detail.performanceHistory", dict)}
      </p>
      <ReactECharts
        option={chartOption}
        style={{ height: 200 }}
        opts={{ renderer: "svg" }}
        onEvents={onEvents}
      />
    </div>
  );
}

interface QuickSummaryPanelProps {
  readonly incidentsCount: number;
  readonly punctualityScore: number;
  readonly safetyScore: number;
  readonly assignedVehiclePlate?: string;
  readonly hoveredMonth?: string;
  readonly overallScore?: number;
  readonly scoreDelta?: number;
  readonly dict: I18nRecord;
  readonly deltas?: {
    punctuality: number;
    safety: number;
    incidents: number;
  };
}

function QuickSummaryPanel({
  incidentsCount,
  punctualityScore,
  safetyScore,
  assignedVehiclePlate,
  hoveredMonth,
  overallScore,
  scoreDelta,
  dict,
  deltas,
}: QuickSummaryPanelProps) {
  const showRing = overallScore !== undefined;
  const ringColor = showRing ? getOverallScoreRing(overallScore) : "";
  const scoreLabel = showRing ? getOverallLabel(overallScore) : null;

  return (
    <div className="shrink-0 flex flex-col gap-2 items-center justify-center border-l border-gray-200 dark:border-gray-700 pl-6 min-w-48">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {hoveredMonth ?? tr("detail.quickSummary", dict)}
      </h4>

      {showRing && (
        <>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                className="stroke-gray-200 dark:stroke-gray-700"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                className={`stroke-current ${ringColor}`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${overallScore} ${100 - overallScore}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-bold ${ringColor}`}>
                {overallScore}
              </span>
            </div>
          </div>

          {scoreDelta !== undefined && scoreDelta !== 0 && (
            <span
              className={`text-xs font-medium ${getDeltaColor(scoreDelta, true)}`}
            >
              {formatDelta(scoreDelta)} {tr("detail.vsLastMonth", dict)}
            </span>
          )}

          {scoreLabel && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${scoreLabel.className}`}
            >
              {tr(scoreLabel.labelKey, dict)}
            </span>
          )}
        </>
      )}

      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HiExclamationTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            {incidentsCount}{" "}
            {hoveredMonth !== undefined
              ? tr("detail.incidents", dict)
              : tr("detail.activeIncidents", dict)}
          </span>
          {deltas && deltas.incidents !== 0 && (
            <span
              className={`text-xs ${getDeltaColor(deltas.incidents, false)}`}
            >
              {formatDelta(deltas.incidents)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HiClock className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            {punctualityScore}% {tr("detail.punctuality", dict)}
          </span>
          {deltas && deltas.punctuality !== 0 && (
            <span
              className={`text-xs ${getDeltaColor(deltas.punctuality, true)}`}
            >
              {formatDelta(deltas.punctuality)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <IoShieldOutline className="w-4 h-4 text-green-500 shrink-0" />
          <span>
            {safetyScore}% {tr("detail.safety", dict)}
          </span>
          {deltas && deltas.safety !== 0 && (
            <span className={`text-xs ${getDeltaColor(deltas.safety, true)}`}>
              {formatDelta(deltas.safety)}
            </span>
          )}
        </div>
        {assignedVehiclePlate && (
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <HiTruck className="w-4 h-4 text-teal-500 shrink-0" />
            <span>{assignedVehiclePlate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ColaboratorSummaryProps {
  readonly colaborator: Colaborator;
  readonly dict: I18nRecord;
  readonly monthlyData: MonthlyDataPoint[];
  readonly monthKeys: readonly string[];
  readonly scores: readonly ScoreCardValue[];
}

export default function ColaboratorSummary({
  colaborator,
  dict,
  monthlyData,
  monthKeys,
  scores,
}: ColaboratorSummaryProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const overallScore = useMemo(() => {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, s) => acc + s.score, 0);
    return Math.round(sum / scores.length);
  }, [scores]);
  const safetyScore = colaborator.safety;
  const punctualityScore = colaborator.punctuality;

  const monthLabels = useMemo(
    () => monthKeys.map((key) => tr(key, dict)),
    [dict, monthKeys]
  );

  const hovered = hoveredIndex !== null ? monthlyData[hoveredIndex] : null;
  const prevHovered =
    hoveredIndex !== null && hoveredIndex > 0
      ? monthlyData[hoveredIndex - 1]
      : null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex gap-6">
        <EvolutionChart
          onHoverIndex={setHoveredIndex}
          dict={dict}
          monthlyData={monthlyData}
          monthKeys={monthKeys}
        />

        {/* Quick summary with hover data */}
        <QuickSummaryPanel
          incidentsCount={hovered?.incidents ?? colaborator.incidentsCount}
          punctualityScore={hovered?.punctuality ?? punctualityScore}
          safetyScore={hovered?.safety ?? safetyScore}
          assignedVehiclePlate={colaborator.assignedVehiclePlate}
          overallScore={hovered?.score ?? overallScore}
          scoreDelta={
            hovered && prevHovered
              ? hovered.score - prevHovered.score
              : undefined
          }
          hoveredMonth={
            hoveredIndex !== null
              ? `${monthLabels[hoveredIndex]} ${hoveredIndex < 8 ? "2025" : "2026"}`
              : undefined
          }
          dict={dict}
          deltas={
            hovered && prevHovered
              ? {
                  punctuality: hovered.punctuality - prevHovered.punctuality,
                  safety: hovered.safety - prevHovered.safety,
                  incidents: hovered.incidents - prevHovered.incidents,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
