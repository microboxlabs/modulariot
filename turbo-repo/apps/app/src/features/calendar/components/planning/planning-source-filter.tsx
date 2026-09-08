"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown, DropdownItem, Button } from "flowbite-react";
import { ChevronDown } from "flowbite-react-icons/outline";
import { HiCalendar, HiRefresh, HiViewGrid } from "react-icons/hi";
import type { IconType } from "react-icons";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  parsePlannerSource,
  PLANNER_SOURCES,
  type PlannerSource,
} from "@/features/calendar/services/service-origin";
import { FILTER_ANY } from "@/features/layout/services/kanban-default-filters";

interface PlanningSourceFilterProps {
  dict: I18nDictionary;
}

/**
 * One icon per state, carried by both the trigger and the menu. The calendar
 * glyph is the point of the control: a service planned through the calendar is
 * the intended route, and the sync arrows are what arrived without it.
 */
const SOURCE_ICONS: Record<"all" | PlannerSource, IconType> = {
  all: HiViewGrid,
  miot: HiCalendar,
  synced: HiRefresh,
};

/**
 * Grid filter for where a service was planned or assigned: everything, only
 * what came through the calendar, or only what the upstream sync placed.
 *
 * Preset rather than locked — unlike the sidebar's calendar-imposed chips this
 * is the planner's own choice, so it clears from here and rides the URL, which
 * makes a filtered board a link.
 */
export default function PlanningSourceFilter({
  dict,
}: Readonly<PlanningSourceFilterProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parsePlannerSource(searchParams.get("source"));

  // "Todos" writes the `all` sentinel rather than dropping the param: the
  // planner defaults to the calendar's own work (`defaultPlannerSourceFor`),
  // so a missing param would be re-filled on the next navigation and the
  // choice would not survive landing.
  const select = useCallback(
    (source: PlannerSource | typeof FILTER_ANY) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("source", source);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const label = tr(`pages.planning.source.${active ?? "all"}`, dict);
  const ActiveIcon = SOURCE_ICONS[active ?? "all"];

  return (
    <Dropdown
      label=""
      dismissOnClick
      className="z-50"
      renderTrigger={() => (
        <Button
          color="alternative"
          size="sm"
          className="flex items-center gap-1.5"
          // Names the control AND its value: an aria-label replaces the
          // visible text, so without the value a screen reader announces the
          // filter without saying which one is on.
          aria-label={`${tr("pages.planning.source.label", dict)}: ${label}`}
        >
          {/* Filtering hides bookings, so the icon and the label together say
              which state is on — a planner who left it set days ago must not
              read a short board as an empty one. */}
          <ActiveIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          {label}
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </Button>
      )}
    >
      <DropdownItem
        icon={SOURCE_ICONS.all}
        onClick={() => select(FILTER_ANY)}
      >
        {tr("pages.planning.source.all", dict)}
      </DropdownItem>
      {PLANNER_SOURCES.map((source) => (
        <DropdownItem
          key={source}
          icon={SOURCE_ICONS[source]}
          onClick={() => select(source)}
        >
          {tr(`pages.planning.source.${source}`, dict)}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
