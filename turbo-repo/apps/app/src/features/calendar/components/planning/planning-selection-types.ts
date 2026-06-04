// Domain types + fixtures for the freight planning calendar. These stay
// app-side (the @microboxlabs/miot-calendar-ui package is domain-agnostic) and
// are injected into the generic planning provider via planning-selection-wrapper.

import { type LeadTimeData } from "@/features/common/components/kpi-display";

// Re-export the lead-time helpers so existing planning imports keep resolving.
export type { LeadTimeData };
export { getLeadTimeStatus } from "@/features/common/components/kpi-display";

/** Trip type options. */
export type TripType = "Sider" | "Doble Sider" | "Rampla";

export type TaskStage =
  | "planService"
  | "assignDriver"
  | "presentDriver"
  | "prepareService"
  | "missionControl";

/**
 * Represents a service that can be selected in the planning calendar.
 * Based on the Service mock data contract.
 */
export interface SelectedService {
  id: string;
  /**
   * Stable business id for the service (e.g. "1626876"). Mirrors
   * `mintral_serviceCode` from Alfresco; the only key that survives every
   * workflow stage advance, so use it — never `taskId` or `id` — when
   * resolving the live workflow task for a planned service.
   */
  mintral_serviceCode?: string;
  cliente: string;
  mintral_clientRut?: string;
  mintral_delegacionOrigen?: string;
  origen: string;
  lugarCarguio: string;
  destino: string;
  tipoViaje: TripType;
  /**
   * Raw Alfresco `mintral_serviceType` value (e.g. "v"). Forwarded verbatim
   * on the booking payload so the bookings route can populate the
   * coordinator binding's `tipo_servicio` and reach the assigned stage.
   */
  mintral_serviceType?: string;
  ocupacion: number; // percentage 0-100
  permanencia: string;
  leadTime: LeadTimeData;
  eta: string; // ISO datetime
  incidencias: string[]; // e.g. ['urgencia', 'shutdown', 'c5']
  mintral_incidents?: Array<[string, string]>; // e.g. [["mintral_incident_C306", "SOBREDIMENSION"], ...]
  observaciones: string;
  prioridad: number;
  cm_created?: string; // ISO datetime - creation date
  loadConstraint?: string; // Dominant constraint: "Carga" | "Pallets" | "Volumen"
  loadMaxUtilization?: number; // Maximum of the three utilizations %
  loadWeightUtilization?: number; // Weight capacity utilization %
  loadPalletUtilization?: number; // Pallet position utilization %
  loadVolumeUtilization?: number; // Volumetric utilization %
  serviceCategory?: string; // Alfresco mintral_serviceCategory code
  expectedDepartureDate?: string; // ISO datetime - expected departure date
  presentationDate?: string; // ISO datetime - service creation/presentation date
  /** Primary driver assigned to this service (frontend-only for now) */
  assignedDriver?: string;
  /** Secondary driver assigned to this service (frontend-only for now) */
  assignedDriver2?: string;
  /**
   * Accredited-resources `carrier_id` chosen in the Asignación tab. Persisted
   * on the booking payload so reopening the sidebar for a planned service
   * hydrates the dropdowns with the previously confirmed selection.
   */
  assignedCarrier?: string;
  /** Accredited-resources TRUCK `resource_id` assigned in the Asignación tab. */
  assignedTruck?: string;
  /** Assigned trailer id — placeholder until the trailer feed is wired. */
  assignedTrailer?: string;
  /**
   * Carrier's upstream `prve_codigo` (from `AccreditedResource.external_id`).
   * Persisted on the booking so the calendar-binding extractor can ship it as
   * `carrier_external_id` — Alerce `proveedor` is sourced from this code.
   */
  assignedCarrierExternalId?: string | null;
  /**
   * Driver / truck / trailer upstream codes (`cond_codigo`, `cami_matricula`,
   * `remo_matricula`). Declared for schema symmetry with the carrier slot; not
   * yet routed downstream.
   */
  assignedDriverExternalId?: string | null;
  assignedDriver2ExternalId?: string | null;
  assignedTruckExternalId?: string | null;
  assignedTrailerExternalId?: string | null;
}
