import { NextRequest, NextResponse } from "next/server";
import type {
  CreateTimeSlotRequest,
  TimeSlotResponse,
  TimeSlotListResponse,
} from "@/features/calendar/types/time-slot.types";
import {
  createAlfrescoCrudClient,
  requireAuth,
  validateRequired,
} from "../utils/alfresco-crud-client";

const timeSlotClient = createAlfrescoCrudClient({
  endpoint: "/api/time-slots",
  resourceName: "time slot",
  mockOn404: true, // Backend endpoint not yet implemented
});

/**
 * GET /api/time-slot
 * Get all time slots, optionally filtered by kind
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);

  return timeSlotClient.list<TimeSlotListResponse>(authResult.session, {
    params: {
      kind: searchParams.get("kind") ?? undefined, // "window" | "block" | null (all)
    },
    mockResponse: () => ({ data: [], total: 0 }),
  });
}

/**
 * POST /api/time-slot
 * Create a new time slot
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body = (await request.json()) as CreateTimeSlotRequest;

  // Validate required fields
  const validation = validateRequired(body, ["name", "kind", "type"]);
  if (!validation.valid) return validation.response;

  // Validate kind-specific requirements
  if (body.kind === "window" && body.quota === undefined) {
    return NextResponse.json(
      { error: "Quota is required for window type" },
      { status: 400 }
    );
  }

  // Validate type-specific requirements
  if (body.type === "weekly" && !body.weeklyPattern) {
    return NextResponse.json(
      { error: "weeklyPattern is required for weekly type" },
      { status: 400 }
    );
  }

  if (
    body.type === "daily-override" &&
    (!body.startTimestamp || !body.endTimestamp)
  ) {
    return NextResponse.json(
      {
        error:
          "startTimestamp and endTimestamp are required for daily-override type",
      },
      { status: 400 }
    );
  }

  return timeSlotClient.create<TimeSlotResponse>(authResult.session, body, {
    mockResponse: () => ({
      id: `mock-${Date.now()}`,
      name: body.name,
      kind: body.kind,
      type: body.type,
      weeklyPattern: body.weeklyPattern,
      startTimestamp: body.startTimestamp,
      endTimestamp: body.endTimestamp,
      quota: body.quota,
      color: body.color,
    }),
  });
}
