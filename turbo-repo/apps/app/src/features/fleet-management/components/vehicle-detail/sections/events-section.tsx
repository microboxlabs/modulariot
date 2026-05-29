"use client";

import { useCallback, useState } from "react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { useParams } from "next/navigation";
import type { Vehicle } from "../../../types/fleet.types";
import type { TruckEventItem } from "../../../types/truck-events.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { MessageBanner } from "@/features/common/components/message-banner";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { TimelineEvent } from "@/features/common/components/timeline-event";
import type { EventUrgency } from "@/features/common/components/timeline-event";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { useFleetTruckEvents } from "../../../hooks/use-fleet-truck-events";
import type { EventFilters } from "../../../hooks/use-fleet-truck-events";
import { getEventsSectionStatus } from "../vehicle-detail-accordion";
import EventsFilterHeader from "./events-filter-header";

const DEFAULT_LIMIT = 50;

interface EventsSectionProps {
  readonly vehicle: Vehicle;
  readonly dict: I18nRecord;
}

// --- Severity → urgency mapping. ---

function severityToUrgency(icuCode: number): EventUrgency {
  if (icuCode >= 3) return "critical";
  if (icuCode === 2) return "warning";
  return "info";
}

// --- Category i18n lookup. ---

const CATEGORY_I18N: Record<string, string> = {
  SEÑAL: "vehicleDetail.sections.events.category.SEÑAL",
  VELOCIDAD: "vehicleDetail.sections.events.category.VELOCIDAD",
  HORARIO: "vehicleDetail.sections.events.category.HORARIO",
  MANTENIMIENTO: "vehicleDetail.sections.events.category.MANTENIMIENTO",
  OTROS: "vehicleDetail.sections.events.category.OTROS",
};

function getCategoryLabel(category: string, dict: I18nRecord): string {
  const key = CATEGORY_I18N[category];
  return key ? trDynamic(key, dict) : category;
}

const URGENCY_I18N: Record<EventUrgency, string> = {
  critical: "vehicleDetail.sections.events.urgency.critical",
  warning: "vehicleDetail.sections.events.urgency.warning",
  info: "vehicleDetail.sections.events.urgency.info",
};

// --- Badge. ---

function getCriticalKey(count: number): string {
  if (count === 1) return "vehicleDetail.sections.events.criticalCount_one";
  return "vehicleDetail.sections.events.criticalCount";
}

function getWarningKey(count: number): string {
  if (count === 1) return "vehicleDetail.sections.events.warningCount_one";
  return "vehicleDetail.sections.events.warningCount";
}

function getEventsBadge(events: TruckEventItem[], dict: I18nRecord) {
  const criticalCount = events.filter((e) => e.icu_code >= 3).length;
  const warningCount = events.filter((e) => e.icu_code === 2).length;

  if (criticalCount > 0) {
    return (
      <CustomBadge
        text={trDynamic(getCriticalKey(criticalCount), dict, {
          count: String(criticalCount),
        })}
        className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      />
    );
  }

  if (warningCount > 0) {
    return (
      <CustomBadge
        text={trDynamic(getWarningKey(warningCount), dict, {
          count: String(warningCount),
        })}
        className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      />
    );
  }

  return (
    <CustomBadge
      text={tr("vehicleDetail.sections.events.noIssues", dict)}
      className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    />
  );
}

// --- Duration formatting. ---

function fmtDuration(minutes: number | null, dict: I18nRecord): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) {
    return tr("vehicleDetail.sections.events.durationMinutes", dict, {
      minutes: String(Math.round(minutes)),
    });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMin = Math.round(minutes % 60);
  return `${hours}h ${remainingMin}m`;
}

// --- Component. ---

export default function EventsSection({ vehicle, dict }: EventsSectionProps) {
  const { lang } = useParams<{ lang: string }>();
  const isSpanish = lang === "es";

  const [filters, setFilters] = useState<EventFilters>({
    limit: DEFAULT_LIMIT,
  });

  const handleLimitChange = useCallback((limit: number) => {
    setFilters((prev) => ({ ...prev, limit }));
  }, []);

  const handleTipoEventoChange = useCallback((pTipoEvento: string) => {
    setFilters((prev) => ({
      ...prev,
      pTipoEvento: pTipoEvento || undefined,
    }));
  }, []);

  const handleDateChange = useCallback((desde: string, hasta: string) => {
    setFilters((prev) => ({ ...prev, pDesde: desde, pHasta: hasta }));
  }, []);

  const { eventsDetail, notFound, error, isLoading, mutate } =
    useFleetTruckEvents(vehicle.plate, filters);

  const title = tr("vehicleDetail.sections.events.title", dict);
  const description = tr("vehicleDetail.sections.events.description", dict);

  // Loading — skeleton timeline.
  if (isLoading) {
    return (
      <ExpandableSection
        icon={HiOutlineExclamationTriangle}
        title={title}
        description={description}
        status="ok"
      >
        <div className="flex flex-col gap-3 pt-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={`ev-skel-${i}`}
              className="h-16 rounded-lg bg-gray-100 dark:bg-gray-700/40 animate-pulse"
            />
          ))}
        </div>
      </ExpandableSection>
    );
  }

  // Error — retry.
  if (error && !notFound) {
    return (
      <ExpandableSection
        icon={HiOutlineExclamationTriangle}
        title={title}
        description={description}
        status="critical"
        badge={
          <CustomBadge
            text={tr("vehicleDetail.sections.events.errorBadge", dict)}
            className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          />
        }
      >
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("vehicleDetail.sections.events.errorTitle", dict)}
          description={tr("vehicleDetail.sections.events.errorDesc", dict)}
          variant="error"
        />
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {tr("vehicleDetail.sections.events.retry", dict)}
        </button>
      </ExpandableSection>
    );
  }

  const events = eventsDetail?.events ?? [];
  const sectionStatus =
    events.length > 0 ? getEventsSectionStatus(events) : "ok";
  const badge = getEventsBadge(events, dict);

  // No events in the window — clean state.
  if (events.length === 0) {
    return (
      <ExpandableSection
        icon={HiOutlineExclamationTriangle}
        title={title}
        description={description}
        status="ok"
        badge={badge}
      >
        <div>
          <EventsFilterHeader
            limit={filters.limit ?? DEFAULT_LIMIT}
            tipoEvento={filters.pTipoEvento ?? ""}
            desde={filters.pDesde}
            hasta={filters.pHasta}
            onLimitChange={handleLimitChange}
            onTipoEventoChange={handleTipoEventoChange}
            onDateChange={handleDateChange}
            dict={dict}
          />
        </div>
        <MessageBanner
          icon={HiOutlineExclamationTriangle}
          title={tr("vehicleDetail.sections.events.emptyTitle", dict)}
          description={tr("vehicleDetail.sections.events.emptyDesc", dict)}
          variant="info"
        />
      </ExpandableSection>
    );
  }

  // Loaded with events.
  return (
    <ExpandableSection
      icon={HiOutlineExclamationTriangle}
      title={title}
      description={description}
      status={sectionStatus}
      badge={badge}
    >
      <div>
        <EventsFilterHeader
          limit={filters.limit ?? DEFAULT_LIMIT}
          tipoEvento={filters.pTipoEvento ?? ""}
          desde={filters.pDesde}
          hasta={filters.pHasta}
          onLimitChange={handleLimitChange}
          onTipoEventoChange={handleTipoEventoChange}
          onDateChange={handleDateChange}
          dict={dict}
        />
      </div>
      <div className="pt-4 max-h-150 overflow-y-auto">
        {events.map((event, index) => {
          const urgency = severityToUrgency(event.icu_code);
          // Language-aware title: `message` for es, `symptom_name` for en.
          const eventTitle = isSpanish ? event.message : event.symptom_name;
          const eventSubtitle = isSpanish ? event.symptom_name : event.message;
          const duration = fmtDuration(event.duration_minutes, dict);

          return (
            <TimelineEvent
              key={event.id}
              title={eventTitle || event.symptom_name}
              urgency={urgency}
              urgencyLabel={trDynamic(URGENCY_I18N[urgency], dict)}
              isLast={index === events.length - 1}
              extraBadges={
                <CustomBadge
                  text={getCategoryLabel(event.category, dict)}
                  className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                />
              }
            >
              <span>{eventSubtitle}</span>
              {event.speed_detected !== null && event.speed_limit !== null && (
                <>
                  <span>•</span>
                  <span>
                    {tr("vehicleDetail.sections.events.speedExceeded", dict, {
                      speed: String(event.speed_detected),
                      limit: String(event.speed_limit),
                    })}
                  </span>
                </>
              )}
              {duration && (
                <>
                  <span>•</span>
                  <span>{duration}</span>
                </>
              )}
              <span>•</span>
              <span>{formatDateString(event.timestamp)}</span>
            </TimelineEvent>
          );
        })}
      </div>
    </ExpandableSection>
  );
}
