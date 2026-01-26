import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type {
  CreateTimeSlotRequest,
  TimeSlotResponse,
  TimeSlotListResponse,
} from "@/features/calendar/types/time-slot.types";

const ALFRESCO_API_URL = process.env.ECM_API_URL || "";
const TIME_SLOT_ENDPOINT = `${ALFRESCO_API_URL}/api/time-slots`;

/**
 * GET /api/time-slot
 * Get all time slots, optionally filtered by kind
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind"); // "window" | "block" | null (all)

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (kind) queryParams.set("kind", kind);

    const url = queryParams.toString()
      ? `${TIME_SLOT_ENDPOINT}?${queryParams.toString()}`
      : TIME_SLOT_ENDPOINT;

    const { url: authUrl, headers } = prepareAlfrescoAuth(url, session);

    const response = await fetch(authUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      return NextResponse.json<TimeSlotListResponse>(
        { data: [], total: 0 },
        { status: 200 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as TimeSlotListResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching time slots:", error);
    // Return empty list on error (endpoint not yet implemented)
    return NextResponse.json<TimeSlotListResponse>(
      { data: [], total: 0 },
      { status: 200 }
    );
  }
}

/**
 * POST /api/time-slot
 * Create a new time slot
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateTimeSlotRequest;

    // Validate required fields
    if (!body.name || !body.kind || !body.type) {
      return NextResponse.json(
        { error: "Name, kind, and type are required" },
        { status: 400 }
      );
    }

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

    const { url: authUrl, headers } = prepareAlfrescoAuth(
      TIME_SLOT_ENDPOINT,
      session
    );

    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      // Return a mock response with generated ID
      const mockResponse: TimeSlotResponse = {
        id: `mock-${Date.now()}`,
        name: body.name,
        kind: body.kind,
        type: body.type,
        weeklyPattern: body.weeklyPattern,
        startTimestamp: body.startTimestamp,
        endTimestamp: body.endTimestamp,
        quota: body.quota,
        color: body.color,
      };
      return NextResponse.json(mockResponse, { status: 201 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as TimeSlotResponse;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating time slot:", error);
    return NextResponse.json(
      { error: "Error creating time slot" },
      { status: 500 }
    );
  }
}
