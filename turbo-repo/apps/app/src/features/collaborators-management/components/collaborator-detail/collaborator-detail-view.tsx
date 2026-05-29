"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  Collaborator,
  CollaboratorDetailData,
  ScoreCardIconId,
  FilterType,
} from "../../types/collaborators.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { IconType } from "react-icons";
import CollaboratorDetailHeader from "./collaborator-detail-header";
import KpiStat from "@/features/common/components/kpi-stat/kpi-stat";
import { HiClock, HiBolt, HiDocumentText, HiTruck } from "react-icons/hi2";
import { IoShieldOutline, IoPulseOutline } from "react-icons/io5";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import BehaviorHistory from "./behavior-history";
import CollaboratorSummary from "./collaborator-summary";

// ─── Static UI config (does NOT come from backend) ───────────────────

const iconMap: Record<ScoreCardIconId, IconType> = {
  shield: IoShieldOutline,
  clock: HiClock,
  bolt: HiBolt,
  document: HiDocumentText,
  truck: HiTruck,
  pulse: IoPulseOutline,
};

interface ScoreCardConfig {
  titleKey: string;
  iconId: ScoreCardIconId;
  iconClass: string;
  valueClass: string;
}

/** Static card definitions — order matches the `scores` array from backend */
const SCORE_CARD_CONFIG: readonly ScoreCardConfig[] = [
  {
    titleKey: "detail.scoreCards.security",
    iconId: "shield",
    iconClass:
      "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
    valueClass: "text-2xl text-green-600 dark:text-green-400 font-bold",
  },
  {
    titleKey: "detail.scoreCards.punctuality",
    iconId: "clock",
    iconClass:
      "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
    valueClass: "text-2xl text-blue-600 dark:text-blue-400 font-bold",
  },
  {
    titleKey: "detail.scoreCards.operationalEfficiency",
    iconId: "bolt",
    iconClass:
      "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    valueClass: "text-2xl text-amber-600 dark:text-amber-400 font-bold",
  },
  {
    titleKey: "detail.scoreCards.regulatoryCompliance",
    iconId: "document",
    iconClass:
      "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
    valueClass: "text-2xl text-purple-600 dark:text-purple-400 font-bold",
  },
  {
    titleKey: "detail.scoreCards.vehicleUsage",
    iconId: "truck",
    iconClass:
      "text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30",
    valueClass: "text-2xl text-teal-600 dark:text-teal-400 font-bold",
  },
  {
    titleKey: "detail.scoreCards.operationalEvents",
    iconId: "pulse",
    iconClass:
      "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30",
    valueClass: "text-2xl text-orange-600 dark:text-orange-400 font-bold",
  },
];

// ─── Component ───────────────────────────────────────────────────────

interface CollaboratorDetailViewProps {
  readonly collaborator: Collaborator;
  readonly detailData: CollaboratorDetailData;
  readonly dict: I18nRecord;
  readonly locale: string;
  readonly onBack: () => void;
  readonly previous: {
    hasPrevious: boolean;
    onPrevious: () => void;
  };
  readonly next: {
    hasNext: boolean;
    onNext: () => void;
  };
}

export default function CollaboratorDetailView({
  collaborator,
  detailData,
  dict,
  locale,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBack,
  previous,
  next,
}: CollaboratorDetailViewProps) {
  const [behaviorFilter, setBehaviorFilter] = useState<FilterType>("todos");

  const handleCardClick = useCallback((filter: FilterType) => {
    setBehaviorFilter(filter);
  }, []);

  /** Merge static card config with dynamic scores */
  const resolvedCards = useMemo(
    () =>
      detailData.scores
        .map((scoreData, i) => {
          const config = SCORE_CARD_CONFIG[i];
          if (!config) return null;
          return {
            ...config,
            id: scoreData.id,
            score: scoreData.score,
            icon: iconMap[config.iconId],
          };
        })
        .filter((card) => card !== null),
    [detailData.scores]
  );

  return (
    <div className="flex flex-col h-full items-center w-full">
      <CollaboratorDetailHeader
        collaborator={collaborator}
        dict={dict}
        previous={previous}
        next={next}
      />
      <div className="flex-1 min-h-0 overflow-y-auto w-[70vw] max-w-screen-2xl p-4 flex flex-col gap-4">
        <CollaboratorSummary
          collaborator={collaborator}
          dict={dict}
          locale={locale}
          monthlyData={detailData.monthlyEvolution}
          scores={detailData.scores}
        />
        <div className="grid grid-cols-3 gap-3">
          {resolvedCards.map((card) => (
            <button
              key={card.titleKey}
              type="button"
              onClick={() => handleCardClick(card.id)}
              className="cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-left"
            >
              <KpiStat
                icon={{ icon: card.icon, className: card.iconClass }}
                title={{ text: trDynamic(card.titleKey, dict) }}
                value={{ text: String(card.score), className: card.valueClass }}
                variant="horizontal"
                className="border-0"
              />
            </button>
          ))}
        </div>
        <div>
          <BehaviorHistory
            activeFilter={behaviorFilter}
            onFilterChange={setBehaviorFilter}
            dict={dict}
            events={detailData.behaviorEvents}
          />
        </div>
      </div>
    </div>
  );
}
