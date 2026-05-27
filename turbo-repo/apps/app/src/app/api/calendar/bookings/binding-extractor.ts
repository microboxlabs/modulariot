import type {
  CalendarBindingPayload,
  CalendarBindingStage,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";

/**
 * Minimal shape of a planner-driven booking payload — enough to derive the
 * calendar-binding call. Both `POST /bookings` and `POST /bookings/{id}/move`
 * accept supersets of this; this is the only piece the binding-extractor
 * actually reads.
 */
export type BindingSourceBody = {
  calendarId: string;
  resource?: {
    id?: string;
    data?: Record<string, unknown>;
  };
};

/**
 * Recover the service-type code from the canonical resource id. Planner
 * bookings carry an id of the form `${serviceCode}-${serviceType}` (the
 * kanban transform's display name); the suffix is the `tipo_servicio` the
 * Alerce webscript expects. Present on every planner booking — including
 * ones written before `mintral_serviceType` was persisted in resource data.
 * Returns "" when the id has no `-` suffix.
 */
function serviceTypeFromResourceId(id: string | undefined): string {
  if (!id) return "";
  const dash = id.lastIndexOf("-");
  return dash >= 0 ? id.slice(dash + 1) : "";
}

/**
 * Build the calendar-binding payload from a planner-driven booking write.
 * Returns null when the booking isn't planner-driven (no
 * `mintral_serviceCode` on the resource data).
 *
 * `stage` is selected by the planner UI's actual gate, not the dropdown
 * defaults: carrier+driver+truck all set → `assigned`; otherwise → `planned`.
 * Mirrors `planning-sidebar-form.tsx`'s "Asignar" button enable rule.
 *
 * Pure function — no runtime dependency on the alfresco-api provider, so
 * it can be unit-tested in isolation without dragging the `@alfresco/js-api`
 * client into the test bundle.
 */
export function extractCalendarBindingPayload(
  body: BindingSourceBody
): CalendarBindingPayload | null {
  const data = body.resource?.data;
  if (!data || typeof data !== "object") return null;

  const numeroServicio = readString(data, "mintral_serviceCode");
  if (!numeroServicio) return null;

  const carrierId = readString(data, "assignedCarrier");
  const driverId = readString(data, "assignedDriver");
  const truckId = readString(data, "assignedTruck");
  const isAssignment = Boolean(carrierId && driverId && truckId);

  const stage: CalendarBindingStage = isAssignment ? "assigned" : "planned";
  const payload: CalendarBindingPayload = {
    numero_servicio: numeroServicio,
    calendar_id: body.calendarId,
    stage,
  };

  if (isAssignment) {
    // `tipo_servicio` is the service-type code. Prefer the canonical
    // `${serviceCode}-${serviceType}` resource id — present on every planner
    // booking, including legacy ones — and fall back to the explicit
    // `mintral_serviceType` field. Without it, downgrade to a planned-stage
    // call so the booking still records the calendar binding without trying
    // to push an incomplete Alerce request.
    const serviceTypeRaw =
      serviceTypeFromResourceId(body.resource?.id) ||
      readString(data, "mintral_serviceType");
    if (!serviceTypeRaw) {
      return { ...payload, stage: "planned" };
    }
    payload.tipo_servicio = serviceTypeRaw.toUpperCase();
    payload.carrier_id = carrierId;
    payload.driver_id = driverId;
    payload.truck_id = truckId;
    payload.driver2_id = readString(data, "assignedDriver2") || null;
    payload.trailer_id = readString(data, "assignedTrailer") || null;
    // Carrier upstream prve_codigo (Alerce `proveedor`). Always emitted on
    // assigned-stage requests; `null` is the soft-fail signal the
    // coordinator already tolerates.
    payload.carrier_external_id = readNullableString(
      data,
      "assignedCarrierExternalId"
    );
  }

  return payload;
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

/**
 * Read a `string | null` field from the booking's resource data. Returns
 * `null` when the value is missing, explicitly `null`, an empty string, or
 * any non-string — distinguished from {@link readString}, which collapses
 * everything to `""`. Used for slots where the coordinator needs the
 * absence signal to surface as JSON `null` on the wire.
 */
function readNullableString(
  data: Record<string, unknown>,
  key: string
): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
