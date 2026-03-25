import type { DynamicFormConfig } from "@/features/dynamic-forms";

/**
 * Form configuration for the Planning Sidebar - Service Assignment Form
 *
 * This form allows dispatchers to assign drivers and vehicles to services.
 */
export const planningAssignmentFormConfig: DynamicFormConfig = {
  fields: [
    {
      name: "serviceNumber",
      labelKey: "pages.planning.sidebar.form.serviceNumber",
      type: "display",
      displayFormat: "id",
    },
    {
      name: "origin",
      labelKey: "pages.planning.sidebar.form.origin",
      type: "display",
      displayFormat: "text",
    },
    {
      name: "destination",
      labelKey: "pages.planning.sidebar.form.destination",
      type: "display",
      displayFormat: "text",
    },
    {
      name: "departureDate",
      labelKey: "pages.planning.sidebar.form.departureDate",
      type: "datetime-local",
      required: true,
    },
    {
      name: "driverId",
      labelKey: "pages.planning.sidebar.form.driver",
      type: "select",
      required: true,
      options: [
        { value: "", labelKey: "pages.planning.sidebar.form.selectDriver" },
      ],
    },
    {
      name: "vehiclePlate",
      labelKey: "pages.planning.sidebar.form.vehicle",
      type: "select",
      required: true,
      options: [
        { value: "", labelKey: "pages.planning.sidebar.form.selectVehicle" },
      ],
    },
    {
      name: "notes",
      labelKey: "pages.planning.sidebar.form.notes",
      type: "textarea",
      placeholder: "Observaciones adicionales...",
    },
  ],
};
