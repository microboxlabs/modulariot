import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { Dropdown, DropdownItem, Button } from "flowbite-react";
import { ChevronDown } from "flowbite-react-icons/outline";
import { useState } from "react";
import { useCalendars } from "@/features/common/providers/client-api.provider";

export default function PlanningTitle({
  dict,
  calendarId,
}: Readonly<{ dict: I18nRecord; calendarId?: string }>) {
  const [type, setType] = useState<"dispatch" | "reception">("dispatch");
  const { calendars } = useCalendars();
  const calendarName = calendarId
    ? (calendars.find((c) => c.id === calendarId)?.name ?? tr("layout.secured.sidebar.planning", dict))
    : tr("layout.secured.sidebar.planning", dict);

  return (
    <div className="flex flex-row gap-2 items-center">
      {/* Title */}
      <h1 className="text-xl font-semibold text-gray-700 dark:text-white">
        {calendarName}
      </h1>
      <Dropdown
        label=""
        dismissOnClick={false}
        className="z-50"
        renderTrigger={() => (
          <Button
            color="alternative"
            className="text-lg font-normal text-gray-500 dark:text-white bg-white px-2 py-1 h-8 rounded-lg flex items-center"
          >
            {type === "dispatch"
              ? tr("layout.planning.dispatch", dict)
              : tr("layout.planning.reception", dict)}
            <ChevronDown
              className={`inline transition-transform duration-200`}
            />
          </Button>
        )}
      >
        <DropdownItem
          onClick={() => {
            setType("dispatch");
          }}
        >
          {tr("layout.planning.dispatch", dict)}
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            setType("reception");
          }}
        >
          {tr("layout.planning.reception", dict)}
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
