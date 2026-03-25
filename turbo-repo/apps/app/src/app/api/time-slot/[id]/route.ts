import { NextRequest } from "next/server";
import type {
  UpdateTimeSlotRequest,
  TimeSlotResponse,
} from "@/features/calendar/types/time-slot.types";
import {
  createAlfrescoCrudClient,
  requireAuth,
} from "../../utils/alfresco-crud-client";

const timeSlotClient = createAlfrescoCrudClient({
  endpoint: "/api/time-slots",
  resourceName: "time slot",
  mockOn404: true, // Backend endpoint not yet implemented
});

/**
 * GET /api/time-slot/[id]
 * Get a specific time slot by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;

  return timeSlotClient.get<TimeSlotResponse>(authResult.session, id);
}

/**
 * PUT /api/time-slot/[id]
 * Update a time slot
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;
  const body = (await request.json()) as UpdateTimeSlotRequest;

  return timeSlotClient.update<TimeSlotResponse>(authResult.session, id, body, {
    mockResponse: () => ({
      id,
      name: body.name || "",
      kind: body.kind || "window",
      type: body.type || "weekly",
      weeklyPattern: body.weeklyPattern,
      startTimestamp: body.startTimestamp,
      endTimestamp: body.endTimestamp,
      quota: body.quota,
      color: body.color,
    }),
  });
}

/**
 * DELETE /api/time-slot/[id]
 * Delete a time slot
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id } = await params;

  return timeSlotClient.delete(authResult.session, id);
}
