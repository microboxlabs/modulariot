"use client";

import { useState } from "react";
import { Badge, Button } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  FormSection,
  InfoRow,
  KpiRow,
  ProgressBar,
  LeadTimeDisplay,
} from "./form-components";
import {
  usePlanningSelection,
  type SelectedService,
} from "./planning-selection-context";
import { HiExclamation } from "react-icons/hi";
import { categorizeIncidencias } from "./incidencias.types";
import { ShowNotification } from "@/features/notifications/notification";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";

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
  const {
    confirmService,
    selectedSlot,
    canAddToSlot,
    reassigningService,
    cancelReassignment,
  } = usePlanningSelection();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasReassigning = reassigningService !== null;
    const result = await confirmService();
    if (wasReassigning || result) {
      ShowNotification({
        type: "success",
        message: "Servicio reasignado exitosamente",
      });
    } else {
      ShowNotification({
        type: "success",
        message: "Servicio asignado exitosamente",
      });
    }
    onSubmit?.({});
  };

  // Need both a selected service and a slot with room to confirm
  const canConfirm = selectedSlot !== null && canAddToSlot(selectedSlot);

  if (!isActive || !selectedService) {
    return null;
  }

  // Extract incident codes and create code-to-label map for tooltips
  const codeToLabelMap = new Map<string, string>();
  const incidentCodes = selectedService.mintral_incidents
    ? selectedService.mintral_incidents.map((incident) => {
        const rawCode = incident[0] as string;
        const label = incident[1] as string;
        // Remove "mintral_incident_" prefix to get just the code (e.g., "C307")
        const code = rawCode.replace(/^mintral_incident_/i, "");
        codeToLabelMap.set(code, label);
        return code;
      })
    : [];

  // Categorize incidencias into primary (always visible) and secondary (expandable)
  const { primary, secondary } = categorizeIncidencias(incidentCodes);
  const hasIncidencias = primary.length > 0 || secondary.length > 0;
  // Show secondary directly if no primary and 2 or fewer secondary
  const showSecondaryDirectly = primary.length === 0 && secondary.length <= 2;

  // Use real data from selectedService
  const id = selectedService.id;
  const client = selectedService.cliente;
  const origin = selectedService.origen;
  const loadingPlace = selectedService.lugarCarguio;
  const destination = selectedService.destino;
  const tripType = selectedService.tipoViaje;
  const permanence = selectedService.permanencia;
  const notes = selectedService.observaciones;
  const eta = formatDateString(selectedService.eta, "datetime");
  const occupancy = selectedService.ocupacion;

  // Helper to get badge color class for incidencias
  const getIncidenciaBadgeProps = (key: string, configColor?: string, label?: string) => {
    // Check if it's urgencia/C309 (purple with icon)
    if (key === "urgencia" || key === "C309" || label === "C309" || configColor === "purple") {
      return {
        color: "purple" as const,
        className:
          "flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5",
        icon: HiExclamation,
      };
    }
    // Use the config color if available, otherwise gray
    return {
      color: (configColor as "red" | "yellow" | "green" | "blue" | "gray" | "pink") || "gray",
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
            {primary.map(({ key, config }) => {
              const tooltip = codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
              return (
                <Badge
                  key={key}
                  size="xs"
                  title={tooltip}
                  {...getIncidenciaBadgeProps(key, config.color, config.label)}
                >
                  {config.label}
                </Badge>
              );
            })}

            {/* Secondary incidencias - shown directly if ≤2 and no primary, otherwise when expanded */}
            {(showSecondaryDirectly || showAllIncidencias) &&
              secondary.map(({ key, config }) => {
                const tooltip = codeToLabelMap.get(key) || codeToLabelMap.get(config.label);
                return (
                  <Badge
                    key={key}
                    size="xs"
                    color="gray"
                    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5"
                    title={tooltip}
                  >
                    {config.label}
                  </Badge>
                );
              })}

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
        <LeadTimeDisplay leadTime={selectedService.leadTime} />
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
          {reassigningService
            ? tr("pages.planning.sidebar.form.confirmReassignment", dict)
            : tr("pages.planning.sidebar.form.confirm", dict)}
        </Button>
      </div>
    </form>
  );
}
