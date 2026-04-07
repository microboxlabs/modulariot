"use client";

import { useState, useMemo } from "react";
import type { Colaborator } from "../../types/colaborators.types";
import { IoShieldOutline } from "react-icons/io5";
import {
  HiClock,
  HiBolt,
  HiDocumentText,
  HiTruck,
  HiExclamationTriangle,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import ReactECharts from "echarts-for-react";

type SummaryTab = "resumen" | "evolucion";

interface ScoreCategoryProps {
  readonly icon: IconType;
  readonly label: string;
  readonly score: number;
  readonly colorClass: string;
  readonly bgClass: string;
}

function getScoreColor(score: number): { bar: string; text: string } {
  if (score >= 80)
    return { bar: "bg-green-500", text: "text-green-600 dark:text-green-400" };
  if (score >= 60)
    return {
      bar: "bg-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400",
    };
  return { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" };
}

function ScoreCategory({
  icon: Icon,
  label,
  score,
  colorClass,
  bgClass,
}: ScoreCategoryProps) {
  const scoreColor = getScoreColor(score);

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${bgClass}`}
      >
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {label}
          </span>
          <span className={`text-xs font-semibold ${scoreColor.text}`}>
            {score}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreColor.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function getOverallScoreRing(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  return "text-red-500";
}

function getOverallLabel(score: number): { label: string; className: string } {
  if (score >= 80)
    return {
      label: "Excelente",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
  if (score >= 60)
    return {
      label: "Bueno",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
  return {
    label: "En observación",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
}

// Monthly evolution data
const mockMonthlyLabels = [
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
];

const mockScoreMonthly = [68, 70, 72, 71, 75, 74, 78, 76, 80, 79, 82, 84];
const mockSafetyMonthly = [62, 65, 68, 66, 70, 69, 74, 72, 76, 75, 78, 80];
const mockPunctualityMonthly = [74, 76, 78, 75, 80, 78, 82, 80, 85, 83, 86, 88];
const mockIncidentsMonthly = [5, 4, 3, 4, 3, 2, 2, 3, 1, 2, 1, 0];

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
}: {
  readonly onHoverIndex: (index: number | null) => void;
}) {
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

  const chartOption = useMemo(
    () => ({
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: {
        type: "category" as const,
        data: mockMonthlyLabels,
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
          data: mockScoreMonthly,
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
          return `${point.name}: ${point.value} pts`;
        },
      },
    }),
    []
  );

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 rounded-md p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Historial de desempeño
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
  deltas,
}: QuickSummaryPanelProps) {
  const showRing = hoveredMonth && overallScore !== undefined;
  const ringColor = showRing ? getOverallScoreRing(overallScore) : "";
  const scoreLabel = showRing ? getOverallLabel(overallScore) : null;

  return (
    <div className="shrink-0 flex flex-col gap-2 items-center justify-center border-l border-gray-200 dark:border-gray-700 pl-6 min-w-48">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {hoveredMonth ?? "Resumen rápido"}
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
              {formatDelta(scoreDelta)} vs mes ant.
            </span>
          )}

          {scoreLabel && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${scoreLabel.className}`}
            >
              {scoreLabel.label}
            </span>
          )}
        </>
      )}

      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HiExclamationTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>
            {incidentsCount} incidentes{!hoveredMonth && " activos"}
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
          <span>{punctualityScore}% puntualidad</span>
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
          <span>{safetyScore}% seguridad</span>
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
}

export default function ColaboratorSummary({
  colaborator,
}: ColaboratorSummaryProps) {
  const [activeTab, setActiveTab] = useState<SummaryTab>("resumen");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const overallScore = colaborator.score;
  const ringColor = getOverallScoreRing(overallScore);
  const overallLabel = getOverallLabel(overallScore);

  const safetyScore = colaborator.safety;
  const punctualityScore = colaborator.punctuality;
  const efficiencyScore = Math.round((safetyScore + punctualityScore) / 2);
  const complianceScore = 88;
  const vehicleScore = 78;

  const categories = [
    {
      icon: IoShieldOutline,
      label: "Seguridad",
      score: safetyScore,
      colorClass: "text-green-600 dark:text-green-400",
      bgClass: "bg-green-100 dark:bg-green-900/30",
    },
    {
      icon: HiClock,
      label: "Puntualidad",
      score: punctualityScore,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      icon: HiBolt,
      label: "Eficiencia",
      score: efficiencyScore,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      icon: HiDocumentText,
      label: "Normativo",
      score: complianceScore,
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      icon: HiTruck,
      label: "Uso vehículo",
      score: vehicleScore,
      colorClass: "text-teal-600 dark:text-teal-400",
      bgClass: "bg-teal-100 dark:bg-teal-900/30",
    },
  ];

  const getTabClass = (tab: SummaryTab) => {
    const isActive = activeTab === tab;
    return `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {/* Tabs */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 w-fit mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("resumen")}
          className={getTabClass("resumen")}
        >
          Resumen general
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("evolucion")}
          className={getTabClass("evolucion")}
        >
          Evolución y tendencia
        </button>
      </div>

      {activeTab === "resumen" && (
        <div className="flex gap-6">
          {/* Overall score circle */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="relative w-24 h-24">
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
                <span className={`text-2xl font-bold ${ringColor}`}>
                  {overallScore}
                </span>
              </div>
            </div>
            <span
              className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${overallLabel.className}`}
            >
              {overallLabel.label}
            </span>
          </div>

          {/* Category breakdown */}
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3 content-center">
            {categories.map((cat) => (
              <ScoreCategory
                key={cat.label}
                icon={cat.icon}
                label={cat.label}
                score={cat.score}
                colorClass={cat.colorClass}
                bgClass={cat.bgClass}
              />
            ))}
          </div>

          {/* Resumen rápido */}
          <QuickSummaryPanel
            incidentsCount={colaborator.incidentsCount}
            punctualityScore={punctualityScore}
            safetyScore={safetyScore}
            assignedVehiclePlate={colaborator.assignedVehiclePlate}
          />
        </div>
      )}

      {activeTab === "evolucion" && (
        <div className="flex gap-6">
          <EvolutionChart onHoverIndex={setHoveredIndex} />

          {/* Resumen rápido with hover data */}
          <QuickSummaryPanel
            incidentsCount={
              hoveredIndex !== null
                ? mockIncidentsMonthly[hoveredIndex]
                : colaborator.incidentsCount
            }
            punctualityScore={
              hoveredIndex !== null
                ? mockPunctualityMonthly[hoveredIndex]
                : punctualityScore
            }
            safetyScore={
              hoveredIndex !== null
                ? mockSafetyMonthly[hoveredIndex]
                : safetyScore
            }
            assignedVehiclePlate={colaborator.assignedVehiclePlate}
            overallScore={
              hoveredIndex !== null
                ? mockScoreMonthly[hoveredIndex]
                : overallScore
            }
            scoreDelta={
              hoveredIndex !== null && hoveredIndex > 0
                ? mockScoreMonthly[hoveredIndex] -
                  mockScoreMonthly[hoveredIndex - 1]
                : undefined
            }
            hoveredMonth={
              hoveredIndex !== null
                ? `${mockMonthlyLabels[hoveredIndex]} ${hoveredIndex < 8 ? "2025" : "2026"}`
                : "Resumen rápido"
            }
            deltas={
              hoveredIndex !== null && hoveredIndex > 0
                ? {
                    punctuality:
                      mockPunctualityMonthly[hoveredIndex] -
                      mockPunctualityMonthly[hoveredIndex - 1],
                    safety:
                      mockSafetyMonthly[hoveredIndex] -
                      mockSafetyMonthly[hoveredIndex - 1],
                    incidents:
                      mockIncidentsMonthly[hoveredIndex] -
                      mockIncidentsMonthly[hoveredIndex - 1],
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
