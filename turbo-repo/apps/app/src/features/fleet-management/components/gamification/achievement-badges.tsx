"use client";

import {
  HiOutlineTrophy,
  HiOutlineBolt,
  HiOutlineWrenchScrewdriver,
  HiOutlineFire,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineGlobeAmericas,
  HiOutlineBuildingOffice2,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import type { Achievement, AchievementId } from "../../types/fleet.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

interface AchievementConfig {
  icon: IconType;
  color: string;
  bgColor: string;
}

const achievementConfigs: Record<AchievementId, AchievementConfig> = {
  road_warrior: {
    icon: HiOutlineTrophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  eco_champion: {
    icon: HiOutlineBolt,
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  perfect_maintenance: {
    icon: HiOutlineWrenchScrewdriver,
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  speed_demon: {
    icon: HiOutlineFire,
    color: "text-red-500",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  early_bird: {
    icon: HiOutlineSun,
    color: "text-orange-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  night_owl: {
    icon: HiOutlineMoon,
    color: "text-purple-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  long_hauler: {
    icon: HiOutlineGlobeAmericas,
    color: "text-cyan-500",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
  },
  city_navigator: {
    icon: HiOutlineBuildingOffice2,
    color: "text-indigo-500",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
};

interface AchievementBadgesProps {
  readonly achievements: Achievement[];
  readonly dict: I18nRecord;
}

export default function AchievementBadges({
  achievements,
  dict,
}: AchievementBadgesProps) {
  const allAchievementIds: AchievementId[] = [
    "road_warrior",
    "eco_champion",
    "perfect_maintenance",
    "speed_demon",
    "early_bird",
    "night_owl",
    "long_hauler",
    "city_navigator",
  ];

  const unlockedIds = new Set(achievements.map((a) => a.id));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {tr("gamification.achievements", dict)}
      </h3>
      <div className="flex flex-wrap gap-2">
        {allAchievementIds.map((id) => {
          const config = achievementConfigs[id];
          const Icon = config.icon;
          const isUnlocked = unlockedIds.has(id);

          return (
            <div
              key={id}
              className={`relative group flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                isUnlocked
                  ? `${config.bgColor} ${config.color} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-current`
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 opacity-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {tr(`gamification.badge.${id}`, dict)}
                {isUnlocked && <span className="ml-1 text-green-400">✓</span>}
              </div>
              {/* Locked overlay */}
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    🔒
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {achievements.length} / {allAchievementIds.length}{" "}
        {tr("gamification.unlocked", dict)}
      </p>
    </div>
  );
}
