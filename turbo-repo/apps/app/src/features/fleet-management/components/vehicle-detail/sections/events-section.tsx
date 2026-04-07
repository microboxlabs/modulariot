"use client";

import {
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { TimelineEvent } from "@/features/common/components/timeline-event";
import type { EventUrgency } from "@/features/common/components/timeline-event";
import { VehicleDetailData, SectionStatus } from "../vehicle-detail-accordion";

type EventCategory = "falla_tecnica" | "evento" | "uso" | "cambio_datos" | "mantencion";

const categoryLabelKeys: Record<EventCategory, string> = {
  falla_tecnica: "vehicleDetail.sections.events.category.falla_tecnica",
  evento: "vehicleDetail.sections.events.category.evento",
  uso: "vehicleDetail.sections.events.category.uso",
  cambio_datos: "vehicleDetail.sections.events.category.cambio_datos",
  mantencion: "vehicleDetail.sections.events.category.mantencion",
};

const urgencyLabelKeys: Record<EventUrgency, string> = {
  critical: "vehicleDetail.sections.events.urgency.critical",
  warning: "vehicleDetail.sections.events.urgency.warning",
  info: "vehicleDetail.sections.events.urgency.info",
};

interface FleetTimelineEventProps {
  readonly title: string;
  readonly description: string;
  readonly urgency: EventUrgency;
  readonly direction?: string;
  readonly date: string;
  readonly category: EventCategory;
  readonly isLast: boolean;
  readonly dict: I18nRecord;
}

function FleetTimelineEvent({
  title,
  description,
  urgency,
  direction,
  date,
  category,
  isLast,
  dict,
}: FleetTimelineEventProps) {
  return (
    <TimelineEvent
      title={title}
      urgency={urgency}
      urgencyLabel={tr(urgencyLabelKeys[urgency], dict)}
      isLast={isLast}
      extraBadges={
        <CustomBadge
          text={tr(categoryLabelKeys[category], dict)}
          className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        />
      }
    >
      <span>{description}</span>
      {direction && (
        <>
          <span>•</span>
          <span>{direction}</span>
        </>
      )}
      <span>•</span>
      <span>{date}</span>
    </TimelineEvent>
  );
}

interface EventsSectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
  readonly status: SectionStatus;
}

function getEventsBadge(data: VehicleDetailData, status: SectionStatus, dict: I18nRecord) {
  const criticalCount = data.events.filter(e => e.urgency === "critical").length;
  const warningCount = data.events.filter(e => e.urgency === "warning").length;
  
  if (criticalCount > 0) {
    return (
      <CustomBadge 
        text={`${criticalCount} evento${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}`}
        className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      />
    );
  }
  
  if (warningCount > 0) {
    return (
      <CustomBadge 
        text={`${warningCount} alerta${warningCount > 1 ? 's' : ''}`}
        className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      />
    );
  }
  
  return (
    <CustomBadge 
      text={tr("vehicleDetail.sections.events.noIssues", dict) || "Sin alertas"}
      className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    />
  );
}

export default function EventsSection({ dict, data, status }: EventsSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineExclamationTriangle}
      title={tr("vehicleDetail.sections.events.title", dict)}
      description={tr("vehicleDetail.sections.events.description", dict)}
      status={status}
      badge={getEventsBadge(data, status, dict)}
    >
      <div className="pt-4 max-h-150 overflow-y-auto">
        {data.events.map((event, index) => (
          <FleetTimelineEvent
            key={`${event.title}-${index}`}
            title={event.title}
            description={event.description}
            urgency={event.urgency as EventUrgency}
            direction={event.direction}
            date={event.date}
            category={event.category as EventCategory}
            isLast={index === data.events.length - 1}
            dict={dict}
          />
        ))}
      </div>
    </ExpandableSection>
  );
}
