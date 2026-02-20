"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Dropdown, DropdownItem, Button } from "flowbite-react";
import { ChevronDown } from "flowbite-react-icons/outline";
import {
  useCalendars,
  useCalendarsInGroup,
} from "@/features/common/providers/client-api.provider";

interface PlanningTitleProps {
  dict: I18nRecord;
  calendarId?: string;
  groupCode?: string | null;
}

export default function PlanningTitle({
  dict,
  calendarId,
  groupCode,
}: Readonly<PlanningTitleProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // All calendars for name resolution; group calendars for the picker
  const { calendars: allCalendars } = useCalendars();
  const { calendars: groupCalendars } = useCalendarsInGroup(groupCode ?? null);

  const calendarName = calendarId
    ? (allCalendars.find((c) => c.id === calendarId)?.name ??
       tr("layout.secured.sidebar.planning", dict))
    : tr("layout.secured.sidebar.planning", dict);

  const handleSelect = (id: string) => {
    if (!calendarId || id === calendarId) return;
    const newPath = pathname
      .split("/")
      .map((seg) => (seg === calendarId ? id : seg))
      .join("/");
    const query = searchParams.toString();
    router.push(query ? `${newPath}?${query}` : newPath);
  };

  const showPicker = groupCalendars.length > 1;

  return (
    <div className="flex flex-row items-center">
      {showPicker ? (
        <Dropdown
          label=""
          dismissOnClick
          className="z-50"
          renderTrigger={() => (
            <Button
              color="alternative"
              className="text-xl font-semibold text-gray-700 dark:text-white bg-transparent border-0 shadow-none px-0 flex items-center gap-1 hover:bg-transparent focus:ring-0"
            >
              {calendarName}
              <ChevronDown className="inline h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
            </Button>
          )}
        >
          {groupCalendars.map((cal) => (
            <DropdownItem
              key={cal.id}
              onClick={() => handleSelect(cal.id)}
            >
              {cal.name}
            </DropdownItem>
          ))}
        </Dropdown>
      ) : (
        <h1 className="text-xl font-semibold text-gray-700 dark:text-white">
          {calendarName}
        </h1>
      )}
    </div>
  );
}
