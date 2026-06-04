"use client";

import { Select } from "flowbite-react";
import dynamic from "next/dynamic";
import dayjs from "dayjs";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";

const DateRangePicker = dynamic(
  () => import("@/features/common/components/date-picker/date-range-picker"),
  { ssr: false }
);

const LIMIT_OPTIONS = [10, 25, 50, 100, 200] as const;
const TIPO_EVENTO_OPTIONS = [
  "",
  "VELOCIDAD",
  "SEÑAL",
  "HORARIO",
  "MANTENIMIENTO",
  "OTROS",
] as const;

interface EventsFilterHeaderProps {
  readonly limit: number;
  readonly tipoEvento: string;
  readonly desde?: string;
  readonly hasta?: string;
  readonly onLimitChange: (limit: number) => void;
  readonly onTipoEventoChange: (tipo: string) => void;
  readonly onDateChange: (desde: string, hasta: string) => void;
  readonly dict: I18nRecord;
}

const TIPO_EVENTO_I18N: Record<string, string> = {
  VELOCIDAD: "vehicleDetail.sections.events.filters.tipoVelocidad",
  SEÑAL: "vehicleDetail.sections.events.filters.tipoSenal",
  HORARIO: "vehicleDetail.sections.events.filters.tipoHorario",
  MANTENIMIENTO: "vehicleDetail.sections.events.filters.tipoMantenimiento",
  OTROS: "vehicleDetail.sections.events.filters.tipoOtros",
};

function getTipoEventoLabel(tipo: string, dict: I18nRecord): string {
  const key = TIPO_EVENTO_I18N[tipo];
  if (key) return trDynamic(key, dict);
  return tr("vehicleDetail.sections.events.filters.allTypes", dict);
}

export default function EventsFilterHeader({
  limit,
  tipoEvento,
  desde,
  hasta,
  onLimitChange,
  onTipoEventoChange,
  onDateChange,
  dict,
}: EventsFilterHeaderProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
      {/* Date range */}
      <div className="flex-1 min-w-48 [&_input]:h-7 [&_input]:p-1.5 [&_input]:text-xs [&>div]:flex-col [&>div]:items-start">
        <DateRangePicker
          label={tr("vehicleDetail.sections.events.filters.dateRange", dict)}
          onDateChange={onDateChange}
          defaultStartDate={desde ? dayjs(desde) : undefined}
          defaultEndDate={hasta ? dayjs(hasta) : undefined}
          className="text-gray-700 dark:text-gray-300"
        />
      </div>

      {/* Event type */}
      <div className="min-w-36 [&_select]:h-7! [&_select]:py-0! [&_select]:text-xs!">
        <label
          htmlFor="events-tipo-evento"
          className="mb-1 block text-sm font-light text-gray-700 dark:text-gray-300"
        >
          {tr("vehicleDetail.sections.events.filters.eventType", dict)}
        </label>
        <Select
          id="events-tipo-evento"
          sizing="sm"
          value={tipoEvento}
          onChange={(e) => onTipoEventoChange(e.target.value)}
        >
          {TIPO_EVENTO_OPTIONS.map((tipo) => (
            <option key={tipo} value={tipo}>
              {getTipoEventoLabel(tipo, dict)}
            </option>
          ))}
        </Select>
      </div>

      {/* Limit */}
      <div className="min-w-24 [&_select]:h-7! [&_select]:py-0! [&_select]:text-xs!">
        <label
          htmlFor="events-limit"
          className="mb-1 block text-sm font-light text-gray-700 dark:text-gray-300"
        >
          {tr("vehicleDetail.sections.events.filters.limit", dict)}
        </label>
        <Select
          id="events-limit"
          sizing="sm"
          value={String(limit)}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
