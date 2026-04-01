"use client";

import { useId } from "react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface VehicleScoreRingProps {
  readonly score: number;
  readonly level: number;
  readonly dict: I18nRecord;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function getScoreGradient(score: number): string {
  if (score >= 80) return "from-green-400 to-emerald-600";
  if (score >= 60) return "from-yellow-400 to-amber-600";
  if (score >= 40) return "from-orange-400 to-orange-600";
  return "from-red-400 to-red-600";
}

function getGradientStartColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#facc15";
  if (score >= 40) return "#fb923c";
  return "#f87171";
}

function getGradientEndColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  if (score >= 40) return "#ea580c";
  return "#dc2626";
}

export default function VehicleScoreRing({
  score,
  level,
  dict,
}: VehicleScoreRingProps) {
  const gradientId = useId();
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient
              id={gradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop
                offset="0%"
                className={`${getScoreGradient(score).split(" ")[0].replace("from-", "stop-")}`}
                stopColor={getGradientStartColor(score)}
              />
              <stop
                offset="100%"
                stopColor={getGradientEndColor(score)}
              />
            </linearGradient>
          </defs>
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
            {score}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tr("gamification.healthScore", dict)}
          </span>
        </div>
      </div>
      {/* Level badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-linear-to-r from-purple-500 to-indigo-600 rounded-full">
        <span className="text-white text-xs font-semibold">
          {tr("gamification.level", dict)} {level}
        </span>
      </div>
    </div>
  );
}
