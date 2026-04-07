"use client";

import { useState, useMemo } from "react";
import { HiOutlineClock, HiMapPin, HiTruck } from "react-icons/hi2";
import { CustomBadge } from "@/features/common/components/custom-badge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type {
  BehaviorEvent,
  BehaviorCategory,
  EventUrgency,
  FilterType,
} from "../../types/colaborators.types";

export type { FilterType } from "../../types/colaborators.types";

const urgencyConfig: Record<
  EventUrgency,
  { className: string; labelKey: string; dotColor: string }
> = {
  critical: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    labelKey: "behaviorHistory.urgency.critical",
    dotColor: "bg-red-500 dark:bg-red-400",
  },
  warning: {
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    labelKey: "behaviorHistory.urgency.warning",
    dotColor: "bg-yellow-500 dark:bg-yellow-400",
  },
  info: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    labelKey: "behaviorHistory.urgency.info",
    dotColor: "bg-blue-500 dark:bg-blue-400",
  },
};

const categoryLabelKeys: Record<BehaviorCategory, string> = {
  seguridad: "behaviorHistory.category.safety",
  uso: "behaviorHistory.category.usage",
  normativo: "behaviorHistory.category.regulatory",
};

const categoryBadgeClasses: Record<BehaviorCategory, string> = {
  seguridad:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  uso: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  normativo:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

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
  const urgencyData = urgencyConfig[event.urgency];

  return (
    <div className="relative flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${urgencyData.dotColor} ring-4 ring-white dark:ring-gray-800 z-10`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 ${isLast ? "" : "pb-4 mb-4 border-b border-gray-100 dark:border-gray-700"}`}
      >
        <div className="flex items-start gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {event.title}
          </h4>
          <CustomBadge
            text={tr(urgencyData.labelKey, dict)}
            className={urgencyData.className}
          />
          <CustomBadge
            text={tr(categoryLabelKeys[event.category], dict)}
            className={categoryBadgeClasses[event.category]}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 flex-wrap">
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
        </div>
      </div>
    </div>
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
            onClick={() => handleFilterChange("criticos")}
            className={getFilterButtonClass("criticos")}
          >
            {tr("behaviorHistory.filter.critical", dict)}
          </button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
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
