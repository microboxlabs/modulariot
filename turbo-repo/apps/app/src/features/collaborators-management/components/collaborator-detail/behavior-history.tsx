"use client";

import { useState, useMemo } from "react";
import { HiOutlineClock, HiMapPin, HiTruck } from "react-icons/hi2";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { TimelineEvent } from "@/features/common/components/timeline-event";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type {
  BehaviorEvent,
  FilterType,
} from "../../types/collaborators.types";

export type { FilterType } from "../../types/collaborators.types";

/** Maps each urgency level to its i18n key within the collaborators dict */
const urgencyLabelKeys: Record<string, string> = {
  critical: "behaviorHistory.urgency.critical",
  warning: "behaviorHistory.urgency.warning",
  info: "behaviorHistory.urgency.info",
};

const categoryLabelKeys: Record<string, string> = {
  seguridad: "behaviorHistory.category.safety",
  uso: "behaviorHistory.category.usage",
  normativo: "behaviorHistory.category.regulatory",
  eficiencia: "behaviorHistory.category.efficiency",
};

const categoryBadgeClasses: Record<string, string> = {
  seguridad:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  uso: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  normativo:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  eficiencia:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const DEFAULT_BADGE_CLASS =
  "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";

interface BehaviorTimelineEventProps {
  readonly event: BehaviorEvent;
  readonly isLast: boolean;
  readonly dict: I18nRecord;
}

function BehaviorTimelineEvent({
  event,
  isLast,
  dict,
}: BehaviorTimelineEventProps) {
  const urgencyKey = urgencyLabelKeys[event.urgency] ?? event.urgency;
  const categoryKey = categoryLabelKeys[event.category] ?? event.category;

  return (
    <TimelineEvent
      title={event.title}
      urgency={event.urgency}
      urgencyLabel={tr(urgencyKey, dict)}
      isLast={isLast}
      extraBadges={
        <CustomBadge
          text={tr(categoryKey, dict)}
          className={categoryBadgeClasses[event.category] ?? DEFAULT_BADGE_CLASS}
        />
      }
    >
      <span className="flex items-center gap-1">
        <HiTruck className="w-3.5 h-3.5" />
        {event.licensePlate}
      </span>
      <span>•</span>
      <span>{event.route}</span>
      <span>•</span>
      <span className="flex items-center gap-1">
        <HiMapPin className="w-3.5 h-3.5" />
        {event.location}
      </span>
      <span>•</span>
      <span className="flex items-center gap-1">
        <HiOutlineClock className="w-3.5 h-3.5" />
        {event.date}
      </span>
    </TimelineEvent>
  );
}

interface BehaviorHistoryProps {
  readonly activeFilter?: FilterType;
  readonly onFilterChange?: (filter: FilterType) => void;
  readonly dict: I18nRecord;
  readonly events: readonly BehaviorEvent[];
}

export default function BehaviorHistory({
  activeFilter,
  onFilterChange,
  dict,
  events,
}: BehaviorHistoryProps) {
  const [internalFilter, setInternalFilter] = useState<FilterType>("todos");

  const filter = activeFilter ?? internalFilter;
  const handleFilterChange = (f: FilterType) => {
    setInternalFilter(f);
    onFilterChange?.(f);
  };

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case "seguridad":
        return events.filter((e) => e.category === "seguridad");
      case "uso":
        return events.filter((e) => e.category === "uso");
      case "normativo":
        return events.filter((e) => e.category === "normativo");
      case "eficiencia":
        return events.filter((e) => e.category === "eficiencia");
      case "criticos":
        return events.filter((e) => e.urgency === "critical");
      default:
        return [...events];
    }
  }, [filter, events]);

  const getFilterButtonClass = (filterType: FilterType) => {
    const isActive = filter === filterType;
    return `px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;
  };

  return (
    <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("behaviorHistory.title", dict)}
        </h3>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => handleFilterChange("todos")}
            className={getFilterButtonClass("todos")}
          >
            {tr("behaviorHistory.filter.all", dict)}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("seguridad")}
            className={getFilterButtonClass("seguridad")}
          >
            {tr("behaviorHistory.filter.safety", dict)}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("uso")}
            className={getFilterButtonClass("uso")}
          >
            {tr("behaviorHistory.filter.usage", dict)}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("normativo")}
            className={getFilterButtonClass("normativo")}
          >
            {tr("behaviorHistory.filter.regulatory", dict)}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("eficiencia")}
            className={getFilterButtonClass("eficiencia")}
          >
            {tr("behaviorHistory.filter.efficiency", dict)}
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange("criticos")}
            className={getFilterButtonClass("criticos")}
          >
            {tr("behaviorHistory.filter.critical", dict)}
          </button>
        </div>
      </div>

      <div className="max-h-125 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            {tr("behaviorHistory.noEvents", dict)}
          </p>
        ) : (
          filteredEvents.map((event, index) => (
            <BehaviorTimelineEvent
              key={`${event.title}-${event.date}`}
              event={event}
              isLast={index === filteredEvents.length - 1}
              dict={dict}
            />
          ))
        )}
      </div>
    </div>
  );
}
