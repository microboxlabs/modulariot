"use client";

import { Button, TextInput, Label } from "flowbite-react";
import { useCallback, useEffect, useState } from "react";
import { HiCheck } from "react-icons/hi";
import type { CalendarFilter } from "@microboxlabs/miot-calendar-client";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

export interface FilterManagerMessages {
  originLabel: string;
  destinationLabel: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  hint: string;
  save: string;
}

const FILTER_MANAGER_BASE = "layout.planning.calendarRules.taskFilter" as const;

export function getFilterManagerMessages(
  dict: I18nDictionary
): FilterManagerMessages {
  return {
    originLabel: tr(`${FILTER_MANAGER_BASE}.originLabel`, dict),
    destinationLabel: tr(`${FILTER_MANAGER_BASE}.destinationLabel`, dict),
    originPlaceholder: tr(`${FILTER_MANAGER_BASE}.originPlaceholder`, dict),
    destinationPlaceholder: tr(
      `${FILTER_MANAGER_BASE}.destinationPlaceholder`,
      dict
    ),
    hint: tr(`${FILTER_MANAGER_BASE}.hint`, dict),
    save: tr(`${FILTER_MANAGER_BASE}.save`, dict),
  };
}

interface FilterManagerProps {
  messages: FilterManagerMessages;
  initialFilter?: CalendarFilter;
  onFilterChange?: (filter: CalendarFilter) => void;
}

/**
 * Task filter manager — lets the user constrain the planning sidebar's
 * task list to a specific origin and/or destination delegate code.
 */
export default function FilterManager({
  messages,
  initialFilter,
  onFilterChange,
}: Readonly<FilterManagerProps>) {
  const [origin, setOrigin] = useState<string>(initialFilter?.origin ?? "");
  const [destination, setDestination] = useState<string>(
    initialFilter?.destination ?? ""
  );

  useEffect(() => {
    setOrigin(initialFilter?.origin ?? "");
    setDestination(initialFilter?.destination ?? "");
  }, [initialFilter?.origin, initialFilter?.destination]);

  const handleSave = useCallback(() => {
    const next: CalendarFilter = {};
    const o = origin.trim();
    const d = destination.trim();
    if (o) next.origin = o;
    if (d) next.destination = d;
    onFilterChange?.(next);
  }, [origin, destination, onFilterChange]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label
            htmlFor="filter-origin"
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {messages.originLabel}
          </Label>
          <TextInput
            id="filter-origin"
            type="text"
            value={origin}
            placeholder={messages.originPlaceholder}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            sizing="sm"
          />
        </div>

        <div className="flex-1 space-y-2">
          <Label
            htmlFor="filter-destination"
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {messages.destinationLabel}
          </Label>
          <TextInput
            id="filter-destination"
            type="text"
            value={destination}
            placeholder={messages.destinationPlaceholder}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            sizing="sm"
          />
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
        {messages.hint}
      </div>

      <Button color="blue" size="sm" className="w-full" onClick={handleSave}>
        <HiCheck className="mr-2 h-4 w-4" />
        {messages.save}
      </Button>
    </div>
  );
}
