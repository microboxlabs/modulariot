"use client";

import { Button } from "flowbite-react";

interface CalendarNavigationProps {
  onToday: () => void;
  todayLabel: string;
}

export function CalendarNavigation({
  onToday,
  todayLabel,
}: Readonly<CalendarNavigationProps>) {
  return (
    <Button color="alternative" size="sm" onClick={onToday}>
      {todayLabel}
    </Button>
  );
}
