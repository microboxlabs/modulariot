/**
 * The calendar's resource-enrichment binding, as this screen manages it.
 *
 * One row of `integration_event_bindings` with `event_type =
 * calendar.resource_enrichment`: before a booking write, the modulith renders
 * `fieldTemplates` over the job payload, calls the bound connection/operation,
 * and merges `responseTemplates` over the response into the booking's
 * resource data. This screen authors that row — the same table and routes the
 * kanban review settings use, with the fetch-shaped return trip added.
 */

export const ENRICHMENT_EVENT_TYPE = "calendar.resource_enrichment";
export const ENRICHMENT_SCOPE_KIND = "calendar";

export interface EnrichmentBinding {
  readonly id: string;
  readonly ownerOrgSlug: string;
  readonly inherited: boolean;
  readonly eventType: string;
  readonly scopeKind: string | null;
  readonly scopeKey: string | null;
  readonly connectionId: string;
  readonly operationId: string | null;
  readonly matchCondition: Record<string, unknown>;
  readonly fieldTemplates: Record<string, string>;
  readonly responseTemplates: Record<string, string>;
  readonly enabled: boolean;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

export interface UpsertEnrichmentBinding {
  readonly eventType: string;
  readonly scopeKind: string | null;
  readonly scopeKey: string | null;
  readonly connectionId: string;
  readonly operationId: string;
  readonly matchCondition: Record<string, unknown>;
  readonly fieldTemplates: Record<string, string>;
  readonly responseTemplates: Record<string, string>;
  readonly enabled: boolean;
}

/** A connection+operation the picker can bind, from the dispatch-targets feed. */
export interface EnrichmentTarget {
  readonly connectionId: string;
  readonly connectionName: string;
  readonly providerType: string;
  readonly operationId: string;
  readonly operationName: string;
  readonly method: string;
  readonly path: string;
  readonly fields: readonly {
    readonly id: string;
    readonly required: boolean;
  }[];
}

/**
 * Suggested request mapping per known resolver parameter. Suggestions only —
 * the operator sees and edits every row; an unknown parameter starts blank.
 */
export const REQUEST_TEMPLATE_SUGGESTIONS: Record<string, string> = {
  p_carrier_external_id: "{{resourceData.mintral_supplierPrveCodigo}}",
  p_driver_rut: "{{resourceData.mintral_driver1Rut}}",
  p_driver2_rut: "{{resourceData.mintral_driver2Rut}}",
  p_truck_plate: "{{resourceData.mintral_truckLicensePlate}}",
  p_trailer_plate: "{{resourceData.mintral_trailerLicensePlate}}",
};

/** Default return trip: resolver slots → the booking keys the planner renders. */
export const DEFAULT_RESPONSE_TEMPLATES: Record<string, string> = {
  assignedCarrier: "{{response.carrier_id}}",
  assignedDriver: "{{response.driver_id}}",
  assignedDriver2: "{{response.driver2_id}}",
  assignedTruck: "{{response.truck_id}}",
  assignedTrailer: "{{response.trailer_id}}",
};
