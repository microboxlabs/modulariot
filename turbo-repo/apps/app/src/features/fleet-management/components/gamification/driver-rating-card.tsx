"use client";

import { HiStar } from "react-icons/hi2";
import type { DriverStats } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface DriverRatingCardProps {
  readonly driverName: string;
  readonly stats: DriverStats;
  readonly dict: I18nRecord;
}

export default function DriverRatingCard({
  driverName,
  stats,
  dict,
}: DriverRatingCardProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const filled = i < Math.floor(rating);
      const partial = !filled && i < rating;

      return (
        <div key={i} className="relative">
          <HiStar
            className={`w-5 h-5 ${
              filled ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"
            }`}
          />
          {partial && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${(rating % 1) * 100}%` }}
            >
              <HiStar className="w-5 h-5 text-yellow-400" />
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {tr("gamification.driverPerformance", dict)}
          </h3>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {driverName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {renderStars(stats.rating)}
          <span className="ml-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {stats.rating.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats.tripsCompleted}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("gamification.trips", dict)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.onTimeDeliveryRate}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("gamification.onTime", dict)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats.safetyScore}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr("gamification.safetyScore", dict)}
          </p>
        </div>
      </div>
    </div>
  );
}
