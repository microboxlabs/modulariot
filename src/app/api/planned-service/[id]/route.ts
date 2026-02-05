import { NextRequest } from "next/server";
import type {
  UpdatePlannedServiceRequest,
  PlannedServiceResponse,
} from "@/features/calendar/types/planned-service.types";
import {
  createAlfrescoCrudClient,
  requireAuth,
} from "../../utils/alfresco-crud-client";

const plannedServiceClient = createAlfrescoCrudClient({
  endpoint: "/api/planned-services",
  resourceName: "planned service",
  mockOn404: true, // Backend endpoint not yet implemented
});

/**
 * GET /api/planned-service/[id]
 * Get a specific planned service by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;

  return plannedServiceClient.get<PlannedServiceResponse>(authResult.session, id);
}

/**
 * PUT /api/planned-service/[id]
 * Update a planned service
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;
  const body = (await request.json()) as UpdatePlannedServiceRequest;

  // Prepare update payload
  const updatePayload: Partial<PlannedServiceResponse> = {};
  if (body.service) {
    updatePayload.service = body.service as PlannedServiceResponse["service"];
  }
  if (body.slot) {
    updatePayload.slot = {
      date:
        body.slot.date instanceof Date
          ? body.slot.date.toISOString().split("T")[0]
          : String(body.slot.date),
      hour: body.slot.hour ?? 0,
      minutes: body.slot.minutes ?? 0,
    };
  }

  return plannedServiceClient.update<PlannedServiceResponse>(
    authResult.session,
    id,
    updatePayload,
    {
      mockResponse: () => ({
        id,
        service: (body.service as PlannedServiceResponse["service"]) || {
          id: "",
          cliente: "",
          origen: "",
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
        },
        slot: {
          date:
            body.slot?.date instanceof Date
              ? body.slot.date.toISOString().split("T")[0]
              : String(body.slot?.date ?? ""),
          hour: body.slot?.hour ?? 0,
          minutes: body.slot?.minutes ?? 0,
        },
      }),
    }
  );
}

/**
 * DELETE /api/planned-service/[id]
 * Delete a planned service
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;

  return plannedServiceClient.delete(authResult.session, id);
}
