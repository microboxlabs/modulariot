import type { ReactNode } from "react";
import type { EventUrgency } from "./timeline-event.types";
import { URGENCY_STYLES } from "./timeline-event.types";
import { CustomBadge } from "@/features/common/components/custom-badge";

interface TimelineEventProps {
  /** Main headline of the event */
  readonly title: string;
  /** Urgency level used for dot color and badge */
  readonly urgency: EventUrgency;
  /** Pre-translated urgency label text */
  readonly urgencyLabel: string;
  /** Whether this is the last item (hides the connecting line) */
  readonly isLast: boolean;
  /** Optional extra badges rendered after the urgency badge */
  readonly extraBadges?: ReactNode;
  /** Slot for metadata row (license plate, route, date, etc.) */
  readonly children?: ReactNode;
}

export default function TimelineEvent({
  title,
  urgency,
  urgencyLabel,
  isLast,
  extraBadges,
  children,
}: TimelineEventProps) {
  const urgencyData = URGENCY_STYLES[urgency];

  return (
    <div className="relative flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full ${urgencyData.dotColor} ring-4 ring-white dark:ring-gray-800 z-10`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 ${isLast ? "" : "pb-4 mb-4 border-b border-gray-100 dark:border-gray-700"}`}
      >
        <div className="flex items-start gap-2 mb-1 flex-wrap">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h4>
          <CustomBadge
            text={urgencyLabel}
            className={urgencyData.className}
          />
          {extraBadges}
        </div>
        {children && (
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 flex-wrap">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
