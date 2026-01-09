"use client";

import { Button } from "flowbite-react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

interface CalendarNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  todayLabel: string;
}

export function CalendarNavigation({
  onPrev,
  onNext,
  onToday,
  todayLabel,
}: CalendarNavigationProps) {
  return (
    <div className="flex items-center gap-2">
      <Button color="alternative" size="sm" onClick={onToday}>
        {todayLabel}
      </Button>
      <div className="flex items-center">
        <Button
          color="alternative"
          size="xs"
          onClick={onPrev}
          className="rounded-r-none"
        >
          <HiChevronLeft className="h-3 w-3" />
        </Button>
        <Button
          color="alternative"
          size="xs"
          onClick={onNext}
          className="rounded-l-none border-l-0"
        >
          <HiChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
