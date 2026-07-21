import { z } from "zod";
import dayjs from "dayjs";
import type { BookingResponse } from "@microboxlabs/miot-calendar-client";
import type { PlannedService } from "@microboxlabs/miot-calendar-ui";
import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";
import { bookingStatusToWorkflowStage } from "@/features/calendar/services/workflow-stage";

/**
 * Persisted accreditation level of an assigned resource — mirrors the
 * `AccreditationLevel` union; `null` = unknown at selection time.
 */
const AccreditationLevelSchema = z
  .enum(["accredited", "notAccredited", "superAccredited"])
  .nullable()
  .optional();

/**
 * Zod schema for data stored inside booking.resource.data. All SelectedService
 * fields are optional (defaults applied on merge). `_anden` is stored here
 * because SlotData has no andén field.
 */
export const StoredServiceSchema = z
  .object({
    mintral_clientRut: z.string().optional(),
    mintral_delegacionOrigen: z.string().optional(),
    /**
     * Stable business id for the service. Persisted because `resource.id` is a
     * derived display label whose format is owed to the kanban transform —
     * keeping the raw code lets the live-task lookup work without parsing.
     */
    mintral_serviceCode: z.string().optional(),
    origen: z.string().optional(),
    lugarCarguio: z.string().optional(),
    destino: z.string().optional(),
    tipoViaje: z.enum(["Sider", "Doble Sider", "Rampla"]).optional(),
    mintral_serviceType: z.string().optional(),
    ocupacion: z.number().optional(),
    permanencia: z.string().optional(),
    leadTime: z
      .object({
        total_lineasoc_cumplen: z.number(),
        total_lineasoc_incumplen: z.number(),
        // null means "not measured yet" — distinct from a measured 0%.
        lineasoc_pctn_cumplimiento: z.number().nullable(),
      })
      .optional(),
    eta: z.string().optional(),
    incidencias: z.array(z.string()).optional(),
    mintral_incidents: z.array(z.tuple([z.string(), z.string()])).optional(),
    observaciones: z.string().optional(),
    prioridad: z.number().optional(),
    cm_created: z.string().optional(),
    loadConstraint: z.string().optional(),
    loadMaxUtilization: z.number().optional(),
    loadWeightUtilization: z.number().optional(),
    loadPalletUtilization: z.number().optional(),
    loadVolumeUtilization: z.number().optional(),
    serviceCategory: z.string().optional(),
    expectedDepartureDate: z.string().optional(),
    presentationDate: z.string().optional(),
    assignedDriver: z.string().optional(),
    assignedDriver2: z.string().optional(),
    assignedCarrier: z.string().optional(),
    assignedTruck: z.string().optional(),
    assignedTrailer: z.string().optional(),
    assignedCarrierExternalId: z.string().nullable().optional(),
    assignedDriverExternalId: z.string().nullable().optional(),
    assignedDriver2ExternalId: z.string().nullable().optional(),
    assignedTruckExternalId: z.string().nullable().optional(),
    assignedTrailerExternalId: z.string().nullable().optional(),
    assignedCarrierAccreditation: AccreditationLevelSchema,
    assignedDriverAccreditation: AccreditationLevelSchema,
    assignedDriver2Accreditation: AccreditationLevelSchema,
    assignedTruckAccreditation: AccreditationLevelSchema,
    assignedTrailerAccreditation: AccreditationLevelSchema,
    _anden: z.number().optional(),
  })
  .optional();

/** A booking resolved into the service the grid draws, plus its booking id. */
export interface MappedBooking {
  bookingId: string;
  calendarId: string;
  planned: PlannedService<SelectedService>;
}

/**
 * Canonical booking → planned-service transform.
 *
 * Shared by the grid loader and the calendar search on purpose: if search
 * parsed bookings more loosely than the grid does, it could report a match on
 * a booking the grid then refuses to render, and the highlight would point at
 * nothing. One transform, one notion of a valid planned service.
 *
 * Returns null for bookings with no slot — there is nowhere to place them.
 */
export function mapBookingToPlannedService(
  booking: BookingResponse
): MappedBooking | null {
  if (!booking.slot) return null;

  const storedParse = StoredServiceSchema.safeParse(booking.resource.data);
  const stored = storedParse.success ? storedParse.data : undefined;
  // Keep _anden separate so it is not spread into SelectedService.
  const { _anden, ...storedService } = stored ?? {};

  const service: SelectedService = {
    origen: "",
    lugarCarguio: "",
    destino: "",
    tipoViaje: "Sider",
    ocupacion: 0,
    permanencia: "",
    leadTime: {
      total_lineasoc_cumplen: 0,
      total_lineasoc_incumplen: 0,
      lineasoc_pctn_cumplimiento: 0,
    },
    eta: "",
    incidencias: [],
    observaciones: "",
    prioridad: 0,
    ...storedService,
    // Canonical booking fields always win over stored data.
    id: booking.resource.id,
    cliente: booking.resource.label ?? booking.resource.id,
    // Recover the code from the `${code}-${type}` resource id prefix for
    // legacy bookings written before mintral_serviceCode was persisted.
    mintral_serviceCode:
      storedService.mintral_serviceCode ?? booking.resource.id.split("-")[0],
  };

  // Terminal stages ride the booking row itself (ECM writes the status);
  // load-time is fine for them because a FINISHED/CANCELLED booking never
  // goes live again. Live stages overlay this at render time via the
  // provider's workflow-stage merge, and win on conflict.
  const workflowStage = bookingStatusToWorkflowStage(booking.status);

  return {
    bookingId: booking.id,
    calendarId: booking.calendarId,
    planned: {
      service,
      slot: {
        date: dayjs(booking.slot.date).toDate(),
        hour: booking.slot.hour,
        minutes: booking.slot.minutes,
        ...(_anden === undefined ? {} : { anden: _anden }),
      },
      ...(workflowStage === undefined ? {} : { workflowStage }),
    },
  };
}
