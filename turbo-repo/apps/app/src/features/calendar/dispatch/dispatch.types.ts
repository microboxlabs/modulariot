/**
 * The calendar's resource-assignment dispatch binding, as this screen manages
 * it.
 *
 * One row of `integration_event_bindings` with `event_type =
 * calendar.resource_assignment`: when the workflow (re)assigns — or unassigns —
 * a service's resources, the modulith renders `fieldTemplates` over the event
 * context and POSTs the result to the bound connection/operation (the
 * partner's resource-modification endpoint). Two columns the enrichment
 * binding does not use carry this event's semantics:
 *
 * - `fieldDefaults` — a literal per field, used when its template renders
 *   empty. An unassignment dispatches an EMPTY context on purpose, so these
 *   defaults ARE the partner's "unassigned" stand-in tuple.
 * - `responseConditions` — success/retry matchers over `{response}`, for
 *   partners that answer HTTP 200 with a verdict in the body.
 */

import type { EnrichmentBinding } from "../enrichment/enrichment.types";

export const DISPATCH_EVENT_TYPE = "calendar.resource_assignment";
export const DISPATCH_SCOPE_KIND = "calendar";

/** The same bindings row, plus the two dispatch-only columns. */
export interface DispatchBinding extends EnrichmentBinding {
  /** Absent on rows written before the column existed. */
  readonly fieldDefaults?: Record<string, string>;
  /** `{"success": {...}, "retry": {...}}` — flat matchers over `{response}`. */
  readonly responseConditions?: Record<string, Record<string, unknown>>;
}

export interface UpsertDispatchBinding {
  readonly eventType: string;
  readonly scopeKind: string | null;
  readonly scopeKey: string | null;
  readonly connectionId: string;
  readonly operationId: string;
  readonly matchCondition: Record<string, unknown>;
  readonly fieldTemplates: Record<string, string>;
  readonly responseTemplates: Record<string, string>;
  readonly fieldDefaults: Record<string, string>;
  readonly responseConditions: Record<string, Record<string, string>>;
  readonly enabled: boolean;
}

/**
 * FE mirror of the server's allowed template roots for this event
 * (`CalendarSyncFeature.ASSIGNMENT_TEMPLATE_ROOTS`): what `checkTemplate` may
 * accept without painting green something the API then refuses. The service
 * scalars are nested (`service.code`, `service.kind`) because a bare root
 * reads as a whole object.
 */
export const DISPATCH_TEMPLATE_ROOTS: readonly string[] = [
  "service",
  "resourceData",
];

/**
 * Autocomplete catalog. Suggestions, not a whitelist — `service.*` carries the
 * event's own scalars; `resourceData.*` the raw workflow identity the producer
 * ships on an assignment (empty on an unassignment, which is when
 * `fieldDefaults` take over).
 */
export const DISPATCH_NAMESPACES = [
  {
    prefix: "service",
    suggestions: ["code", "kind"],
  },
  {
    prefix: "resourceData",
    suggestions: [
      "assignedCarrierExternalId",
      "mintral_driver1Rut",
      "mintral_driver2Rut",
      "mintral_truckLicensePlate",
      "mintral_trailerLicensePlate",
      "expectedDepartureDate",
    ],
  },
];
