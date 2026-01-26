import { NextRequest, NextResponse } from "next/server";
import type {
  CreatePlannedServiceRequest,
  PlannedServiceResponse,
  PlannedServiceListResponse,
} from "@/features/calendar/types/planned-service.types";
import {
  createAlfrescoCrudClient,
  requireAuth,
  validateRequired,
} from "../utils/alfresco-crud-client";

const plannedServiceClient = createAlfrescoCrudClient({
  endpoint: "/api/planned-services",
  resourceName: "planned service",
  mockOn404: true, // Backend endpoint not yet implemented
});

/**
 * GET /api/planned-service
 * Get all planned services, optionally filtered by date range
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);

  return plannedServiceClient.list<PlannedServiceListResponse>(
    authResult.session,
    {
      params: {
        startDate: searchParams.get("startDate") ?? undefined,
        endDate: searchParams.get("endDate") ?? undefined,
      },
      mockResponse: () => ({ data: [], total: 0 }),
    }
  );
}

/**
 * POST /api/planned-service
 * Create a new planned service
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body = (await request.json()) as CreatePlannedServiceRequest;

  // Validate required fields
  const validation = validateRequired(body, ["service", "slot"]);
  if (!validation.valid) return validation.response;

  // Prepare request payload with normalized slot date
  const payload = {
    service: body.service,
    slot: {
      date:
        body.slot.date instanceof Date
          ? body.slot.date.toISOString().split("T")[0]
          : body.slot.date,
      hour: body.slot.hour,
      minutes: body.slot.minutes,
    },
  };

  return plannedServiceClient.create<PlannedServiceResponse>(
    authResult.session,
    payload,
    {
      mockResponse: () => ({
        id: `mock-${Date.now()}`,
        service: body.service,
        slot: {
          date:
            body.slot.date instanceof Date
              ? body.slot.date.toISOString().split("T")[0]
              : String(body.slot.date),
          hour: body.slot.hour,
          minutes: body.slot.minutes,
        },
      }),
    }
  );
}
