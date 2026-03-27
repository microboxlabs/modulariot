"use client";

import {
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import ExpandableSection from "../expandable-section";
import { CustomBadge } from "@/features/common/components/custom-badge";
import { VehicleDetailData } from "../vehicle-detail-accordion";

type EventUrgency = "critical" | "warning" | "info";
type EventCategory = "falla_tecnica" | "evento" | "uso" | "cambio_datos" | "mantencion";

interface TimelineEventProps {
  readonly title: string;
  readonly description: string;
  readonly urgency: EventUrgency;
  readonly direction?: string;
  readonly date: string;
  readonly category: EventCategory;
  readonly isLast?: boolean;
}

const urgencyConfig: Record<EventUrgency, { className: string; label: string; dotColor: string }> = {
  critical: { 
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", 
    label: "Crítico",
    dotColor: "bg-red-500 dark:bg-red-400"
  },
  warning: { 
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", 
    label: "Alerta",
    dotColor: "bg-yellow-500 dark:bg-yellow-400"
  },
  info: { 
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", 
    label: "Info",
    dotColor: "bg-blue-500 dark:bg-blue-400"
  },
};

const categoryLabels: Record<EventCategory, string> = {
  falla_tecnica: "Falla técnica",
  evento: "Evento",
  uso: "Uso",
  cambio_datos: "Cambio de datos",
  mantencion: "Mantención",
};

function TimelineEvent({ title, description, urgency, direction, date, category, isLast }: TimelineEventProps) {
  const urgencyData = urgencyConfig[urgency];
  
  return (
    <div className="relative flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${urgencyData.dotColor} ring-4 ring-white dark:ring-gray-800 z-10`} />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 ${isLast ? '' : 'pb-4 mb-4 border-b border-gray-100 dark:border-gray-700'}`}>
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
          <CustomBadge text={urgencyData.label} className={urgencyData.className} />
          <CustomBadge 
            text={categoryLabels[category]} 
            className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" 
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{description}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          {direction && (
            <>
              <span>{direction}</span>
              <span>•</span>
            </>
          )}
          <span>{date}</span>
        </div>
      </div>
    </div>
  );
}

interface EventsSectionProps {
  readonly data: VehicleDetailData;
  readonly dict: I18nRecord;
}

export default function EventsSection({ dict, data }: EventsSectionProps) {
  return (
    <ExpandableSection
      icon={HiOutlineExclamationTriangle}
      title={tr("vehicleDetail.sections.events.title", dict)}
      description={tr("vehicleDetail.sections.events.description", dict)}
    >
      <div className="pt-4 max-h-[600px] overflow-y-auto">
        {data.events.map((event, index) => (
          <TimelineEvent
            key={`${event.title}-${index}`}
            {...event}
            urgency={event.urgency as EventUrgency}
            category={event.category as EventCategory}
            isLast={index === data.events.length - 1}
          />
        ))}
      </div>
    </ExpandableSection>
  );
}
