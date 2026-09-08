"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Dropdown, DropdownItem, Button } from "flowbite-react";
import { ChevronDown } from "flowbite-react-icons/outline";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  parsePlannerSource,
  PLANNER_SOURCES,
  type PlannerSource,
} from "@/features/calendar/services/service-origin";

interface PlanningSourceFilterProps {
  dict: I18nDictionary;
}

/**
 * Grid filter for where a service was planned or assigned: everything, only
 * what this module's operators drove, or only what the upstream sync placed.
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

  const select = useCallback(
    (source: PlannerSource | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (source) {
        params.set("source", source);
      } else {
        params.delete("source");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const label = tr(`pages.planning.source.${active ?? "all"}`, dict);

  return (
    <Dropdown
      label=""
      dismissOnClick
      className="z-50"
      renderTrigger={() => (
        <Button
          color="alternative"
          size="sm"
          // Filtering hides bookings, so the control says so on its own face:
          // a planner who left it set days ago must not read a short board as
          // an empty one.
          className={
            active
              ? "flex items-center gap-1 border-blue-500 text-blue-700 dark:text-blue-400"
              : "flex items-center gap-1"
          }
          // Names the control AND its value: an aria-label replaces the
          // visible text, so without the value a screen reader announces the
          // filter without saying which one is on.
          aria-label={`${tr("pages.planning.source.label", dict)}: ${label}`}
        >
          {label}
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </Button>
      )}
    >
      <DropdownItem onClick={() => select(undefined)}>
        {tr("pages.planning.source.all", dict)}
      </DropdownItem>
      {PLANNER_SOURCES.map((source) => (
        <DropdownItem key={source} onClick={() => select(source)}>
          {tr(`pages.planning.source.${source}`, dict)}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
