"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCalendarsInGroup } from "@/features/common/providers/client-api.provider";

interface CalendarGroupSelectorProps {
  calendarId: string;
  groupCode: string;
}

export function CalendarGroupSelector({
  calendarId,
  groupCode,
}: Readonly<CalendarGroupSelectorProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { calendars, isLoading } = useCalendarsInGroup(groupCode);

  if (isLoading || calendars.length === 0) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (selectedId === calendarId) return;
    const newPath = pathname.replace(calendarId, selectedId);
    const params = new URLSearchParams(searchParams.toString());
    router.push(`${newPath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="calendar-group-selector"
        className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
      >
        Calendar
      </label>
      <select
        id="calendar-group-selector"
        value={calendarId}
        onChange={handleChange}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
      >
        {calendars.map((cal) => (
          <option key={cal.id} value={cal.id}>
            {cal.name}
          </option>
        ))}
      </select>
    </div>
  );
}
