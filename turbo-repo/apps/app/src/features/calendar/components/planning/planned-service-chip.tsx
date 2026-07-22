"use client";

import { twMerge } from "tailwind-merge";
import {
  IoPerson,
  IoPeople,
  IoNavigate,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoEllipse,
} from "react-icons/io5";
import { useScrollIntoViewWhen } from "@microboxlabs/miot-calendar-ui";
import type { PlannedService } from "./planning-selection-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  getAssignmentAccreditation,
  assignmentAccreditationTooltip,
} from "./assignment-accreditation";
import { AccreditationBadge } from "./sidebar-tabs/assignment/accreditation";
import { ServiceCategoryBadge } from "@/features/common/components/service-category-badge/service-category-badge";

/**
 * Get the CSS classes for a planned service chip based on urgencia status
 */
export function getPlannedServiceChipClassName(hasUrgencia: boolean): string {
  return hasUrgencia
    ? "bg-purple-100 text-purple-800 border-purple-600 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-400"
    : "bg-blue-100 text-blue-800 border-blue-600 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-400";
}

/**
 * Check if a planned service has urgencia incidencia
 * Checks incidencias array and mintral_incidents for C309/DESPACHO URGENTE
 */
export function hasUrgenciaIncidencia(
  service: PlannedService["service"]
): boolean {
  // Check incidencias array for direct "urgencia" match
  if (service.incidencias.some((inc) => inc.toLowerCase() === "urgencia")) {
    return true;
  }

  // Check mintral_incidents for urgencia codes (C309, DESPACHO URGENTE)
  if (service.mintral_incidents) {
    return service.mintral_incidents.some(([code, label]) => {
      const cleanCode = code.replace(/^mintral_incident_/i, "").toUpperCase();
      return cleanCode === "C309" || label.toUpperCase() === "DESPACHO URGENTE";
    });
  }

  return false;
}

/**
 * Post-planning workflow stages the chip marks with an "en route" indicator.
 * Planning-segment stages keep the plain chip look (the chip's existence
 * already means "planned", driver icons mean "assigned").
 */
const IN_COURSE_STAGES = new Set<string>([
  "monitorTrip",
  "confirmArrival",
  "closeMonitoring",
]);

/**
 * Get the number of assigned drivers for a service
 */
export function getDriverCount(service: PlannedService["service"]): 0 | 1 | 2 {
  const hasDriver1 = Boolean(service.assignedDriver);
  const hasDriver2 = Boolean(service.assignedDriver2);
  if (hasDriver1 && hasDriver2) return 2;
  if (hasDriver1 || hasDriver2) return 1;
  return 0;
}

/** CALSYNC read-time stage → chip presentation flags + tooltip suffix. */
interface StageIndicator {
  /** Terminal/muted: the slot is history, not plannable work. */
  readonly isTerminal: boolean;
  readonly isFinished: boolean;
  readonly isCancelled: boolean;
  /** In-course stages get an "en route" marker. */
  readonly isInCourse: boolean;
  /** " · <label>" appended to the chip title, or "" when no stage. */
  readonly titleSuffix: string;
}

/** Sync-status dot presentation: color family + tooltip + a11y label. */
interface SyncIndicator {
  readonly colorClass: string;
  readonly title: string;
  readonly ariaLabel: string;
}

/** dot color per downstream ack — grey pending, green confirmed, red rejected. */
const SYNC_DOT_COLOR: Record<
  NonNullable<PlannedService["syncStatus"]>,
  string
> = {
  PENDING: "text-gray-400 dark:text-gray-500",
  CONFIRMED: "text-emerald-500 dark:text-emerald-400",
  REJECTED: "text-red-500 dark:text-red-400",
};

/**
 * Downstream sync acknowledgement → status-dot presentation. Null = untracked
 * (no external mirror / legacy booking): the chip shows no dot. A REJECTED dot
 * appends the reason to its tooltip so a hover explains why the slot is
 * "planned but unconfirmed".
 */
function getSyncIndicator(
  syncStatus: PlannedService["syncStatus"],
  syncDetail: string | undefined,
  dict: I18nRecord
): SyncIndicator | null {
  if (!syncStatus) return null;
  const key = syncStatus.toLowerCase();
  const label = tr(`pages.planning.sidebar.syncStatus.${key}`, dict);
  return {
    colorClass: SYNC_DOT_COLOR[syncStatus],
    title:
      syncStatus === "REJECTED" && syncDetail ? `${label}: ${syncDetail}` : label,
    ariaLabel: `sync-status-${key}`,
  };
}

function getStageIndicator(
  workflowStage: string | undefined,
  dict: I18nRecord
): StageIndicator {
  const isFinished = workflowStage === "finished";
  const isCancelled = workflowStage === "cancelled";
  const stageTitle = workflowStage
    ? tr(`pages.planning.sidebar.taskStage.${workflowStage}`, dict)
    : undefined;
  return {
    isTerminal: isFinished || isCancelled,
    isFinished,
    isCancelled,
    isInCourse:
      workflowStage !== undefined && IN_COURSE_STAGES.has(workflowStage),
    titleSuffix: stageTitle ? ` · ${stageTitle}` : "",
  };
}

interface PlannedServiceChipProps {
  readonly plannedService: PlannedService;
  readonly isBeingReassigned?: boolean;
  /**
   * Visual-only "this chip is selected" mark, set by right-clicking the
   * chip. Renders a static corner ring (same color family as the reassign
   * ring, no pulse) and is independent of slot/sidebar selection.
   */
  readonly isSelected?: boolean;
  /** Matches the active calendar search. */
  readonly isHighlighted?: boolean;
  /** A search is active and this chip missed it — faded into the background. */
  readonly isDimmed?: boolean;
  /** The match the search navigator is parked on. Scrolls itself into view. */
  readonly isFocused?: boolean;
  readonly onContextMenu: (e: React.MouseEvent, ps: PlannedService) => void;
  /** Optional left-click handler — opens the sidebar in view/read-only mode. */
  readonly onClick?: (ps: PlannedService) => void;
  /** Additional size/layout classes to apply */
  readonly className?: string;
  readonly dict: I18nRecord;
}

/**
 * Shared PlannedServiceChip component for calendar views
 * Displays a service ID with urgencia-aware styling and route information
 */
export function PlannedServiceChip({
  plannedService,
  isBeingReassigned = false,
  isSelected = false,
  isHighlighted = false,
  isDimmed = false,
  isFocused = false,
  onContextMenu,
  onClick,
  className,
  dict,
}: PlannedServiceChipProps) {
  const ref = useScrollIntoViewWhen<HTMLButtonElement>(isFocused);
  const hasUrgencia = hasUrgenciaIncidencia(plannedService.service);
  const driverCount = getDriverCount(plannedService.service);
  const { origen, destino } = plannedService.service;
  // Live/terminal workflow stage (CALSYNC read-time join). Terminal chips
  // recede — the slot is history, not plannable work — while in-course
  // stages get a marker so a dispatched service stops looking merely
  // "planned".
  const workflowStage = plannedService.workflowStage;
  const { isTerminal, isFinished, isCancelled, isInCourse, titleSuffix } =
    getStageIndicator(workflowStage, dict);
  // Weakest accreditation level across the assigned resources — rendered with
  // the same labelled badge the service card and sidebar show (icon + text),
  // with the per-resource breakdown as tooltip. Unknown levels (legacy
  // bookings) render nothing.
  const accreditation = getAssignmentAccreditation(plannedService.service);
  // Downstream sync ack (grey pending / green confirmed / red rejected).
  // Untracked bookings render no dot. A red dot means the slot is planned but
  // the external system refused its current data — hover shows the reason.
  const sync = getSyncIndicator(
    plannedService.syncStatus,
    plannedService.syncDetail,
    dict
  );

  return (
    <button
      ref={ref}
      type="button"
      onClick={
        onClick
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onClick(plannedService);
            }
          : undefined
      }
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, plannedService);
      }}
      onKeyDown={(e) => {
        // Shift+F10 or ContextMenu key opens context menu
        if (e.shiftKey && e.key === "F10") {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const syntheticEvent = {
            ...e,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          } as unknown as React.MouseEvent<HTMLButtonElement>;
          onContextMenu(syntheticEvent, plannedService);
        }
      }}
      className={twMerge(
        "min-w-0 w-full pointer-events-auto",
        "rounded flex items-center",
        onClick ? "cursor-pointer" : "cursor-context-menu",
        "text-xs font-medium px-1.5 py-1 border-l-4",
        getPlannedServiceChipClassName(hasUrgencia),
        // Ring precedence, strongest intent first. An in-flight reassignment
        // outranks a search hit: it is an operation, not a lookup. Search rings
        // use the platform's Smalt/primary blue — the design system reserves it
        // for "focus rings, selected states", exactly what a match is (amber
        // stays the must-act/reassign accent). Dark 600/700 steps + ring-offset
        // separate it from the chip's own blue fill.
        isBeingReassigned &&
          "ring-2 ring-amber-500 ring-offset-1 animate-pulse",
        !isBeingReassigned &&
          isFocused &&
          "ring-4 ring-primary-700 ring-offset-2",
        !isBeingReassigned &&
          !isFocused &&
          isHighlighted &&
          "ring-2 ring-primary-600 ring-offset-1",
        !isBeingReassigned &&
          !isFocused &&
          !isHighlighted &&
          isSelected &&
          "ring-2 ring-amber-500 ring-offset-1",
        // Terminal services recede (the search dim below is stronger and
        // still wins when both apply).
        isTerminal && "opacity-60 saturate-50",
        // Non-matches stay legible enough to keep the slot's context, but
        // clearly recede so the eye lands on the match.
        isDimmed && "opacity-30",
        className
      )}
      title={`${plannedService.service.id}${titleSuffix} - ${tr("pages.planning.sidebar.contextMenu.chipTitle", dict)}`}
    >
      {/* Left: Service ID + Route stacked */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-bold truncate text-left">
          {plannedService.service.id}
        </span>
        <div className="flex items-center gap-1 text-[10px] font-normal">
          <span className="flex items-center gap-0.5 min-w-0 flex-1 opacity-80">
            <span className="truncate">{origen}</span>
            <span className="shrink-0">→</span>
            <span className="truncate">{destino}</span>
          </span>
          <ServiceCategoryBadge
            code={plannedService.service.serviceCategory}
            variant="ghost"
            className="shrink-0 px-1 text-[9px] font-semibold leading-none"
          />
          {accreditation && (
            <AccreditationBadge
              level={accreditation.level}
              dict={dict}
              title={assignmentAccreditationTooltip(accreditation, dict)}
              className="cursor-help px-1 py-0 text-[9px] leading-none"
            />
          )}
        </div>
      </div>
      {/* Right: Driver icon centered vertically */}
      {driverCount === 1 && (
        <IoPerson
          className={twMerge(
            "ml-1 shrink-0 w-4 h-4",
            hasUrgencia
              ? "text-purple-700 dark:text-purple-300"
              : "text-blue-700 dark:text-blue-300"
          )}
        />
      )}
      {driverCount === 2 && (
        <IoPeople
          className={twMerge(
            "ml-1 shrink-0 w-4 h-4",
            hasUrgencia
              ? "text-purple-700 dark:text-purple-300"
              : "text-blue-700 dark:text-blue-300"
          )}
        />
      )}
      {isInCourse && (
        <IoNavigate
          aria-label={`workflow-stage-${workflowStage}`}
          className="ml-1 shrink-0 w-3.5 h-3.5 text-sky-600 dark:text-sky-400"
        />
      )}
      {isFinished && (
        <IoCheckmarkCircle
          aria-label="workflow-stage-finished"
          className="ml-1 shrink-0 w-4 h-4 text-emerald-600 dark:text-emerald-400"
        />
      )}
      {isCancelled && (
        <IoCloseCircle
          aria-label="workflow-stage-cancelled"
          className="ml-1 shrink-0 w-4 h-4 text-red-500 dark:text-red-400"
        />
      )}
      {sync && (
        // Wrapper carries the hover tooltip (the reason for a REJECTED sync);
        // the icon carries the accessible name. Matches the react-icons +
        // aria-label convention of the workflow-stage indicators above.
        <span title={sync.title} className="ml-1 shrink-0 flex items-center">
          <IoEllipse
            aria-label={sync.ariaLabel}
            className={twMerge("w-2.5 h-2.5", sync.colorClass)}
          />
        </span>
      )}
    </button>
  );
}
