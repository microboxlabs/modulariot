import type { ReactNode } from "react";

export interface BaseTimelineEventProps {
  /** Color class for the dot (e.g. "bg-blue-500 dark:bg-blue-400") */
  readonly dotColor?: string;
  /** Whether this is the last item (hides the connecting line) */
  readonly isLast: boolean;
  /** Full content slot — caller controls all layout inside */
  readonly children: ReactNode;
}

/**
 * Minimal timeline layout: dot + connecting line on the left, content on the right.
 * Use this as the foundation for any timeline variant.
 */
export default function BaseTimelineEvent({
  dotColor = "bg-gray-400 dark:bg-gray-500",
  isLast,
  children,
}: BaseTimelineEventProps) {
  return (
    <div className="relative flex gap-4">
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <div
          className={`h-3 w-3 shrink-0 rounded-full ${dotColor} ring-4 ring-white dark:ring-gray-800 z-10`}
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 ${isLast ? "" : "pb-4 mb-4 border-b border-gray-100 dark:border-gray-700"}`}
      >
        {children}
      </div>
    </div>
  );
}
