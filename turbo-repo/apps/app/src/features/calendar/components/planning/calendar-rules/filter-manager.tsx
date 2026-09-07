"use client";

import { Button, Checkbox, TextInput, Label, Select } from "flowbite-react";
import { useCallback, useEffect, useState } from "react";
import { HiCheck } from "react-icons/hi";
import type { CalendarFilter } from "@microboxlabs/miot-calendar-client";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  SERVICE_TYPES,
  normalizeServiceType,
  serviceTypeLabel,
} from "@/features/calendar/services/service-types";

export interface FilterManagerMessages {
  originLabel: string;
  destinationLabel: string;
  serviceTypeLabel: string;
  serviceTypeAny: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  hint: string;
  save: string;
  defaultLabel: string;
  defaultHint: string;
  defaultNeedsOrigin: string;
}

const FILTER_MANAGER_BASE = "layout.planning.calendarRules.taskFilter" as const;

export function getFilterManagerMessages(
  dict: I18nDictionary
): FilterManagerMessages {
  return {
    originLabel: tr(`${FILTER_MANAGER_BASE}.originLabel`, dict),
    destinationLabel: tr(`${FILTER_MANAGER_BASE}.destinationLabel`, dict),
    serviceTypeLabel: tr(`${FILTER_MANAGER_BASE}.serviceTypeLabel`, dict),
    serviceTypeAny: tr(`${FILTER_MANAGER_BASE}.serviceTypeAny`, dict),
    originPlaceholder: tr(`${FILTER_MANAGER_BASE}.originPlaceholder`, dict),
    destinationPlaceholder: tr(
      `${FILTER_MANAGER_BASE}.destinationPlaceholder`,
      dict
    ),
    hint: tr(`${FILTER_MANAGER_BASE}.hint`, dict),
    save: tr(`${FILTER_MANAGER_BASE}.save`, dict),
    defaultLabel: tr(`${FILTER_MANAGER_BASE}.defaultLabel`, dict),
    defaultHint: tr(`${FILTER_MANAGER_BASE}.defaultHint`, dict),
    defaultNeedsOrigin: tr(`${FILTER_MANAGER_BASE}.defaultNeedsOrigin`, dict),
  };
}

interface FilterManagerProps {
  messages: FilterManagerMessages;
  initialFilter?: CalendarFilter;
  initialIsDefault?: boolean;
  onFilterChange?: (filter: CalendarFilter, isDefault: boolean) => void;
}

/**
 * Task filter manager — lets the user constrain the planning sidebar's
 * task list to a specific origin, destination delegate code and/or service
 * type, and mark the calendar as the default for that origin and type: the one
 * a service created outside the planner gets booked into. They live here
 * together because the default is scoped by the very fields above it.
 *
 * The whole key set is rebuilt on every save. The BFF replaces `filter`
 * wholesale rather than merging key by key, so an editor that owned only some
 * of these would wipe the rest — a calendar would stop being the OTR default
 * with nobody having touched that setting.
 */
export default function FilterManager({
  messages,
  initialFilter,
  initialIsDefault,
  onFilterChange,
}: Readonly<FilterManagerProps>) {
  const [origin, setOrigin] = useState<string>(initialFilter?.origin ?? "");
  const [destination, setDestination] = useState<string>(
    initialFilter?.destination ?? ""
  );
  const [serviceType, setServiceType] = useState<string>(
    normalizeServiceType(initialFilter?.serviceType) ?? ""
  );
  const [isDefault, setIsDefault] = useState<boolean>(
    initialIsDefault ?? false
  );

  useEffect(() => {
    setOrigin(initialFilter?.origin ?? "");
    setDestination(initialFilter?.destination ?? "");
    setServiceType(normalizeServiceType(initialFilter?.serviceType) ?? "");
  }, [
    initialFilter?.origin,
    initialFilter?.destination,
    initialFilter?.serviceType,
  ]);

  useEffect(() => {
    setIsDefault(initialIsDefault ?? false);
  }, [initialIsDefault]);

  // A default with no origin is the catch-all for every origin nothing else
  // claims. Reachable on purpose, but not by leaving a field blank.
  const defaultWithoutOrigin = isDefault && origin.trim() === "";

  const handleSave = useCallback(() => {
    const next: CalendarFilter = {};
    const o = origin.trim();
    const d = destination.trim();
    const t = normalizeServiceType(serviceType);
    if (o) next.origin = o;
    if (d) next.destination = d;
    if (t) next.serviceType = t;
    onFilterChange?.(next, isDefault);
  }, [origin, destination, serviceType, isDefault, onFilterChange]);

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

      <div className="space-y-2">
        <Label
          htmlFor="filter-service-type"
          className="text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          {messages.serviceTypeLabel}
        </Label>
        <Select
          id="filter-service-type"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          sizing="sm"
        >
          <option value="">{messages.serviceTypeAny}</option>
          {SERVICE_TYPES.map((code) => (
            <option key={code} value={code}>
              {serviceTypeLabel(code)}
            </option>
          ))}
        </Select>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
        {messages.hint}
      </div>

      <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="filter-is-default"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5"
          />
          <Label
            htmlFor="filter-is-default"
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {messages.defaultLabel}
          </Label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {defaultWithoutOrigin
            ? messages.defaultNeedsOrigin
            : messages.defaultHint}
        </p>
      </div>

      <Button color="blue" size="sm" className="w-full" onClick={handleSave}>
        <HiCheck className="mr-2 h-4 w-4" />
        {messages.save}
      </Button>
    </div>
  );
}
