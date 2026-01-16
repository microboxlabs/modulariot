"use client";

import { useState } from "react";
import { Badge, Button } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { FormSection, InfoRow, KpiRow, ProgressBar } from "./form-components";
import {
  usePlanningSelection,
  type SelectedService,
  type LeadTimeStatus,
} from "./planning-selection-context";
import { HiExclamation } from "react-icons/hi";
import { categorizeIncidencias } from "./incidencias.types";

interface PlanningSidebarFormProps {
  readonly dict: I18nRecord;
  readonly isActive: boolean;
  readonly selectedService?: SelectedService & { slot?: string };
  readonly onSubmit?: (values: Record<string, string | boolean>) => void;
}

export function PlanningSidebarForm({
  dict,
  isActive,
  selectedService,
  onSubmit,
}: PlanningSidebarFormProps) {
  const [showAllIncidencias, setShowAllIncidencias] = useState(false);
  const { confirmService, selectedSlot, canAddToSlot } = usePlanningSelection();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confirmService();
    onSubmit?.({});
  };

  // Need both a selected service and a slot with room to confirm
  const canConfirm = selectedSlot !== null && canAddToSlot(selectedSlot);

  if (!isActive || !selectedService) {
    return null;
  }

  // Categorize incidencias into primary (always visible) and secondary (expandable)
  const { primary, secondary } = categorizeIncidencias(
    selectedService.incidencias
  );
  const hasIncidencias = primary.length > 0 || secondary.length > 0;
  // Show secondary directly if no primary and 2 or fewer secondary
  const showSecondaryDirectly = primary.length === 0 && secondary.length <= 2;

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
  const id = selectedService.id;
  const client = selectedService.cliente;
  const origin = selectedService.origen;
  const loadingPlace = selectedService.lugarCarguio;
  const destination = selectedService.destino;
  const tripType = selectedService.tipoViaje;
  const permanence = selectedService.permanencia;
  const notes = selectedService.observaciones;
  const leadTime = formatDate(selectedService.leadTime.deadline);
  const leadTimeStatus = mapLeadTimeStatus(selectedService.leadTime.status);
  const eta = formatDateTime(selectedService.eta);
  const occupancy = selectedService.ocupacion;

  // Helper to get badge color class for incidencias
  const getIncidenciaBadgeProps = (key: string, color: string) => {
    if (key === "urgencia") {
      return {
        color: "purple" as const,
        className:
          "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
        icon: HiExclamation,
      };
    }
    return {
      color: "gray" as const,
      className:
        "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
    };
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Flags Section */}
      {hasIncidencias && (
        <FormSection title={tr("pages.planning.sidebar.form.flags", dict)}>
          <div className="flex flex-wrap gap-2">
            {/* Primary incidencias - always visible */}
            {primary.map(({ key, config }) => (
              <Badge
                key={key}
                size="xs"
                {...getIncidenciaBadgeProps(key, config.color)}
              >
                {config.label}
              </Badge>
            ))}

            {/* Secondary incidencias - shown directly if ≤2 and no primary, otherwise when expanded */}
            {(showSecondaryDirectly || showAllIncidencias) &&
              secondary.map(({ key, config }) => (
                <Badge
                  key={key}
                  size="xs"
                  color="gray"
                  className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                >
                  {config.label}
                </Badge>
              ))}

            {/* "+N more" button to expand secondary incidencias - only if not showing directly */}
            {!showSecondaryDirectly &&
              secondary.length > 0 &&
              !showAllIncidencias && (
                <button
                  type="button"
                  onClick={() => setShowAllIncidencias(true)}
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  +{secondary.length} más
                </button>
              )}

            {/* "Show less" button when expanded - only if not showing directly */}
            {!showSecondaryDirectly &&
              secondary.length > 0 &&
              showAllIncidencias && (
                <button
                  type="button"
                  onClick={() => setShowAllIncidencias(false)}
                  className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  ver menos
                </button>
              )}
          </div>
        </FormSection>
      )}

      {/* KPIs Section */}
      <FormSection title={tr("pages.planning.sidebar.form.kpis", dict)}>
        <KpiRow label="Lead Time" value={leadTime} status={leadTimeStatus} />
        <KpiRow label="ETA" value={eta} />
        <ProgressBar
          label={tr("pages.planning.sidebar.form.occupancy", dict)}
          value={occupancy}
        />
      </FormSection>

      {/* Information Section */}
      <FormSection title={tr("pages.planning.sidebar.form.information", dict)}>
        <InfoRow label={tr("ID", dict)} value={id} />
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
          type="submit"
          color="blue"
          className="flex-1"
          disabled={!canConfirm}
        >
          {tr("pages.planning.sidebar.form.confirm", dict)}
        </Button>
      </div>
    </form>
  );
}
