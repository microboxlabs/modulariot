import type { ReactNode } from "react";
import type { EventUrgency } from "./timeline-event.types";
import { URGENCY_STYLES } from "./timeline-event.types";
import { CustomBadge } from "@/features/common/components/custom-badge";
import BaseTimelineEvent from "./base-timeline-event";

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
    <BaseTimelineEvent dotColor={urgencyData.dotColor} isLast={isLast}>
      <div className="flex items-start gap-2 mb-1 flex-wrap">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h4>
        <CustomBadge text={urgencyLabel} className={urgencyData.className} />
        {extraBadges}
      </div>
      {children && (
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2 flex-wrap">
          {children}
        </div>
      )}
    </BaseTimelineEvent>
  );
}
