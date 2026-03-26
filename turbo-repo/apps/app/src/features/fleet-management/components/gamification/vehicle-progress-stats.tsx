"use client";

import { HiOutlineFire, HiOutlineBolt } from "react-icons/hi2";
import type { VehicleGamification } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface VehicleProgressStatsProps {
  readonly gamification: VehicleGamification;
  readonly dict: I18nRecord;
}

export default function VehicleProgressStats({
  gamification,
  dict,
}: VehicleProgressStatsProps) {
  const xpProgress = gamification.xpToNextLevel
    ? Math.min(100, (gamification.xp / gamification.xpToNextLevel) * 100)
    : 0;
  const kmProgress = gamification.weeklyKmGoal
    ? Math.min(100, (gamification.weeklyKmProgress / gamification.weeklyKmGoal) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Streak */}
      <div className="flex items-center gap-3 p-3 bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-full">
          <HiOutlineFire className="w-6 h-6 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tr("gamification.currentStreak", dict)}
          </p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {gamification.streakDays}{" "}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              {tr("gamification.days", dict)}
            </span>
          </p>
        </div>
        {gamification.streakDays >= 7 && (
          <div className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full animate-pulse">
            🔥 {tr("gamification.onFire", dict)}
          </div>
        )}
      </div>

      {/* XP Progress */}
      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <HiOutlineBolt className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tr("gamification.experiencePoints", dict)}
            </span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {gamification.xp.toLocaleString()} /{" "}
            {gamification.xpToNextLevel.toLocaleString()} XP
          </span>
        </div>
        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-linear-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(xpProgress, 100)}%` }}
          />
          {/* Animated shine effect */}
          <div
            className="absolute inset-y-0 w-1/4 bg-linear-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]"
            style={{ left: `${Math.min(xpProgress, 100) - 25}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {Math.round(
            gamification.xpToNextLevel - gamification.xp
          ).toLocaleString()}{" "}
          XP {tr("gamification.toNextLevel", dict)}
        </p>
      </div>

      {/* Weekly Goal */}
      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr("gamification.weeklyGoal", dict)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {gamification.weeklyKmProgress.toLocaleString()} /{" "}
            {gamification.weeklyKmGoal.toLocaleString()} km
          </span>
        </div>
        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
              kmProgress >= 100
                ? "bg-linear-to-r from-green-500 to-emerald-600"
                : "bg-linear-to-r from-blue-500 to-cyan-600"
            }`}
            style={{ width: `${Math.min(kmProgress, 100)}%` }}
          />
        </div>
        {kmProgress >= 100 && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
            🎉 {tr("gamification.goalCompleted", dict)}
          </p>
        )}
      </div>
    </div>
  );
}
