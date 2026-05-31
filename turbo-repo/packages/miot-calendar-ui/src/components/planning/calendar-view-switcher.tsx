"use client";

import { Button, ButtonGroup } from "flowbite-react";
import type { ViewMode } from "../../services/calendar.service.types";

interface CalendarViewSwitcherProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  labels: {
    day: string;
    week: string;
    month: string;
  };
}

const activeClassName =
  "bg-gray-100 dark:bg-gray-700 cursor-default hover:bg-gray-100 dark:hover:bg-gray-700";

export function CalendarViewSwitcher({
  activeView,
  onViewChange,
  labels,
}: Readonly<CalendarViewSwitcherProps>) {
  return (
    <ButtonGroup>
      <Button
        key="day"
        color="alternative"
        onClick={() => onViewChange("day")}
        disabled={activeView === "day"}
        className={activeView === "day" ? activeClassName : ""}
      >
        {labels.day}
      </Button>
      <Button
        key="week"
        color="alternative"
        onClick={() => onViewChange("week")}
        disabled={activeView === "week"}
        className={activeView === "week" ? activeClassName : ""}
      >
        {labels.week}
      </Button>
      <Button
        key="month"
        color="alternative"
        onClick={() => onViewChange("month")}
        disabled={activeView === "month"}
        className={activeView === "month" ? activeClassName : ""}
      >
        {labels.month}
      </Button>
    </ButtonGroup>
  );
}
