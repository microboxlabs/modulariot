"use client";

import dayjs from "dayjs";
import { twMerge } from "tailwind-merge";
import type {
  PlannedService,
  TimeWindowColor,
} from "./planning-selection-context";
import type { PositionedShift } from "./shift-layout";
import { OVERFLOW_STRIPE_CLASS } from "./planning-slot-utils";
import { PlannedServiceChip } from "./planned-service-chip";
import type {
  I18nDictionary,
  I18nRecord,
} from "@/features/i18n/i18n.service.types";

interface Props {
  readonly shifts: readonly PositionedShift[];
  readonly onShiftClick?: (shift: PositionedShift) => void;
  readonly isShiftSelected?: (shift: PositionedShift) => boolean;
  readonly getServicesForShift?: (
    shift: PositionedShift
  ) => readonly PlannedService[];
  readonly onChipClick?: (ps: PlannedService) => void;
  readonly onChipContextMenu?: (
    e: React.MouseEvent,
    ps: PlannedService
  ) => void;
  readonly reassigningServiceId?: string;
  readonly dict: I18nDictionary | I18nRecord;
}

/**
 * Overlay layer that paints one rectangle per synthesized shift on top of the
 * underlying day grid. Each rectangle owns:
 *  - the existing planned-service chips for that exact shift start, rendered
 *    above the rectangle so chip click + right-click work natively, and
 *  - an "add booking" affordance (an absolutely-positioned button covering
 *    the empty area) when the shift has remaining capacity.
 *
 * Cells beneath are bare scaffolding (TW colored bg + badges only). All
 * interactive content for a shift lives here, in one stacking context, so
 * there is no z-index fight between cells, chips, and overlays.
 */
export function ShiftOverlayLayer({
  shifts,
  onShiftClick,
  isShiftSelected,
  getServicesForShift,
  onChipClick,
  onChipContextMenu,
  reassigningServiceId,
  dict,
}: Props) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {shifts.map((s) => {
        const c = SHIFT_COLOR_CLASSES[s.twColor] ?? SHIFT_COLOR_CLASSES.emerald;
        const services = getServicesForShift?.(s) ?? [];
        const isFull = services.length >= s.capacity;
        // OVERFLOW: rectangle generated beyond the MANUAL window's bookable quota — rendered for
        // visibility (grey hatch) but not bookable; no "add" affordance, never selectable.
        const isOverflow = !s.assignable;
        // Past-day shifts are read-only: cannot be planned or assigned.
        // Chips inside them stay clickable for view/inspection only.
        const canAdd =
          !s.isPastDay && !isFull && !isOverflow && Boolean(onShiftClick);
        const selected = !isOverflow && (isShiftSelected?.(s) ?? false);
        const colWidth = 100 / s.columnCount;
        const colLeft = colWidth * s.columnIndex;
        const positionStyle = {
          top: s.top,
          height: s.height,
          left: `calc(${colLeft}% + 4px)`,
          width: `calc(${colWidth}% - 8px)`,
        } satisfies React.CSSProperties;
        const className = twMerge(
          "absolute rounded-md border border-dashed",
          !isOverflow && c.border,
          !isOverflow && c.tint,
          canAdd && "transition-colors",
          canAdd && c.hover,
          isFull && !isOverflow && "border-solid",
          // OVERFLOW overlays: neutral-grey hatch + solid grey border + muted, no hover.
          isOverflow &&
            `border-solid border-gray-400/60 dark:border-gray-600/60 opacity-60 ${OVERFLOW_STRIPE_CLASS}`,
          // Past-day overlays are visually muted and use a non-dashed
          // grey border so they don't read as "click me to plan".
          s.isPastDay &&
            "opacity-50 border-solid border-gray-300 dark:border-gray-700 bg-transparent",
          selected && `border-solid ring-2 ${c.selectedRing}`
        );
        const labelHM = formatHM(s.slotHour, s.slotMinutes);
        const title = isOverflow
          ? "Beyond window capacity — not assignable"
          : `${labelHM} – ${formatHM(
              Math.floor(s.endsAtMin / 60),
              s.endsAtMin % 60
            )} (${s.durationMinutes}m) — ${services.length}/${s.capacity}`;

        return (
          <div
            key={s.id}
            data-slot-date={dayjs(s.date).format("YYYY-MM-DD")}
            data-slot-time={labelHM}
            className={className}
            style={positionStyle}
            title={title}
          >
            {/* "Add booking" affordance: absolutely covers the rectangle.
                Rendered first so chips paint on top and win clicks in chip
                areas; the button only catches clicks in empty space. */}
            {canAdd && (
              <button
                type="button"
                onClick={() => onShiftClick?.(s)}
                className="absolute inset-0 cursor-pointer pointer-events-auto"
                aria-label={`Add booking at ${labelHM}`}
              />
            )}

            {/* Time label in the corner — hidden when chips occupy the
                rectangle since they already make the slot identifiable. */}
            {services.length === 0 && s.height >= 24 && (
              <span
                className={twMerge(
                  "absolute top-0.5 left-1.5 text-[10px] font-medium leading-none pointer-events-none",
                  isOverflow ? "text-gray-400 dark:text-gray-500" : c.label
                )}
              >
                {labelHM}
              </span>
            )}

            {/* Chips for this shift's bookings. The container stays
                pointer-events-none so empty gaps fall through to the
                "add" button below; chips re-enable pointer-events-auto so
                their own click + onContextMenu fire natively. Stacked
                vertically so each chip uses the full overlay width to
                show the service info; chips beyond the rectangle's
                height overflow visibly. */}
            {services.length > 0 && (
              <div className="absolute inset-1 flex flex-col gap-0.5 pointer-events-none">
                {services.map((ps) => (
                  <PlannedServiceChip
                    key={ps.service.id}
                    plannedService={ps}
                    isBeingReassigned={reassigningServiceId === ps.service.id}
                    onContextMenu={onChipContextMenu ?? noop}
                    onClick={onChipClick}
                    className="w-full"
                    dict={dict}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function noop() {
  /* noop — used when no context-menu handler is wired. */
}

function formatHM(h: number, m: number): string {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Static class map so Tailwind's JIT can detect every variant. Keep keys in
// sync with TIME_WINDOW_COLORS; new colors there must be added here.
const SHIFT_COLOR_CLASSES: Record<
  TimeWindowColor,
  {
    border: string;
    tint: string;
    hover: string;
    label: string;
    /** Darker tone of the TW color used for the selected-shift ring. */
    selectedRing: string;
  }
> = {
  emerald: {
    border: "border-emerald-400/70 dark:border-emerald-500/60",
    tint: "bg-white/30 dark:bg-emerald-950/20",
    hover: "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30",
    label: "text-emerald-700 dark:text-emerald-300",
    selectedRing: "ring-emerald-600 dark:ring-emerald-400",
  },
  blue: {
    border: "border-blue-400/70 dark:border-blue-500/60",
    tint: "bg-white/30 dark:bg-blue-950/20",
    hover: "hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
    label: "text-blue-700 dark:text-blue-300",
    selectedRing: "ring-blue-600 dark:ring-blue-400",
  },
  violet: {
    border: "border-violet-400/70 dark:border-violet-500/60",
    tint: "bg-white/30 dark:bg-violet-950/20",
    hover: "hover:bg-violet-100/50 dark:hover:bg-violet-900/30",
    label: "text-violet-700 dark:text-violet-300",
    selectedRing: "ring-violet-600 dark:ring-violet-400",
  },
  rose: {
    border: "border-rose-400/70 dark:border-rose-500/60",
    tint: "bg-white/30 dark:bg-rose-950/20",
    hover: "hover:bg-rose-100/50 dark:hover:bg-rose-900/30",
    label: "text-rose-700 dark:text-rose-300",
    selectedRing: "ring-rose-600 dark:ring-rose-400",
  },
  amber: {
    border: "border-amber-400/70 dark:border-amber-500/60",
    tint: "bg-white/30 dark:bg-amber-950/20",
    hover: "hover:bg-amber-100/50 dark:hover:bg-amber-900/30",
    label: "text-amber-700 dark:text-amber-300",
    selectedRing: "ring-amber-600 dark:ring-amber-400",
  },
  cyan: {
    border: "border-cyan-400/70 dark:border-cyan-500/60",
    tint: "bg-white/30 dark:bg-cyan-950/20",
    hover: "hover:bg-cyan-100/50 dark:hover:bg-cyan-900/30",
    label: "text-cyan-700 dark:text-cyan-300",
    selectedRing: "ring-cyan-600 dark:ring-cyan-400",
  },
  lime: {
    border: "border-lime-400/70 dark:border-lime-500/60",
    tint: "bg-white/30 dark:bg-lime-950/20",
    hover: "hover:bg-lime-100/50 dark:hover:bg-lime-900/30",
    label: "text-lime-700 dark:text-lime-300",
    selectedRing: "ring-lime-600 dark:ring-lime-400",
  },
  orange: {
    border: "border-orange-400/70 dark:border-orange-500/60",
    tint: "bg-white/30 dark:bg-orange-950/20",
    hover: "hover:bg-orange-100/50 dark:hover:bg-orange-900/30",
    label: "text-orange-700 dark:text-orange-300",
    selectedRing: "ring-orange-600 dark:ring-orange-400",
  },
};
