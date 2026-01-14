"use client";

import { Button } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  FormSection,
  InfoRow,
  FlagBadge,
  KpiRow,
  ProgressBar,
} from "./form-components";
import type {
  SelectedService,
  LeadTimeStatus,
} from "./planning-selection-context";

interface PlanningSidebarFormProps {
  dict: I18nRecord;
  isActive: boolean;
  selectedService?: SelectedService & { slot?: string };
  onSubmit?: (values: Record<string, string | boolean>) => void;
  onCancel?: () => void;
}

export function PlanningSidebarForm({
  dict,
  isActive,
  selectedService,
  onSubmit,
  onCancel,
}: PlanningSidebarFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({});
  };

  if (!isActive || !selectedService) {
    return null;
  }

  // Map leadTime status to display status
  const mapLeadTimeStatus = (
    status: LeadTimeStatus
  ): "success" | "warning" | "error" => {
    switch (status) {
      case "on_time":
        return "success";
      case "warning":
        return "warning";
      case "delayed":
        return "error";
    }
  };

  // Format dates for display
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  };

  const formatDateTime = (isoDateTime: string): string => {
    const date = new Date(isoDateTime);
    return date.toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Use real data from selectedService
  const client = selectedService.cliente;
  const origin = selectedService.origen;
  const loadingPlace = selectedService.lugarCarguio;
  const destination = selectedService.destino;
  const tripType = selectedService.tipoViaje;
  const permanence = selectedService.permanencia;
  const notes = selectedService.observaciones;
  const isUrgent = selectedService.urgencia;
  const isShutdown = selectedService.shutdown;
  const incidentsCount = selectedService.incidencias;
  const leadTime = formatDate(selectedService.leadTime.deadline);
  const leadTimeStatus = mapLeadTimeStatus(selectedService.leadTime.status);
  const eta = formatDateTime(selectedService.eta);
  const occupancy = selectedService.ocupacion;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Flags Section */}
      <FormSection title={tr("pages.planning.sidebar.form.flags", dict)}>
        <div className="flex flex-wrap gap-2">
          {isUrgent && (
            <FlagBadge
              label={tr("pages.planning.sidebar.form.urgent", dict)}
              color="red"
            />
          )}
          {isShutdown && (
            <FlagBadge
              label={tr("pages.planning.sidebar.form.shutdown", dict)}
              color="orange"
            />
          )}
          {incidentsCount > 0 && (
            <FlagBadge
              label={`${incidentsCount} ${tr("pages.planning.sidebar.form.incidents", dict)}`}
              color="yellow"
            />
          )}
        </div>
      </FormSection>

      {/* KPIs Section */}
      <FormSection title={tr("pages.planning.sidebar.form.kpis", dict)}>
        <KpiRow
          label="Lead Time"
          value={leadTime}
          status={leadTimeStatus}
          statusLabel={
            leadTimeStatus === "success"
              ? tr("pages.planning.sidebar.form.onTime", dict)
              : leadTimeStatus === "warning"
                ? tr("pages.planning.sidebar.form.atRisk", dict)
                : tr("pages.planning.sidebar.form.delayed", dict)
          }
        />
        <KpiRow label="ETA" value={eta} />
        <ProgressBar
          label={tr("pages.planning.sidebar.form.occupancy", dict)}
          value={occupancy}
        />
      </FormSection>

      {/* Information Section */}
      <FormSection title={tr("pages.planning.sidebar.form.information", dict)}>
        <InfoRow
          label={tr("pages.planning.sidebar.form.client", dict)}
          value={client}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.origin", dict)}
          value={origin}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.loadingPlace", dict)}
          value={loadingPlace}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.destination", dict)}
          value={destination}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.tripType", dict)}
          value={tripType}
        />
        <InfoRow
          label={tr("pages.planning.sidebar.form.permanence", dict)}
          value={permanence}
        />
      </FormSection>

      {/* Notes Section */}
      <FormSection title={tr("pages.planning.sidebar.form.notes", dict)}>
        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
          {notes}
        </p>
      </FormSection>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          color="gray"
          onClick={onCancel}
          className="flex-1"
        >
          {tr("pages.planning.sidebar.form.cancel", dict)}
        </Button>
        <Button type="submit" color="blue" className="flex-1">
          {tr("pages.planning.sidebar.form.assign", dict)}
        </Button>
      </div>
    </form>
  );
}
