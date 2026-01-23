import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type {
  CreatePlannedServiceRequest,
  PlannedServiceResponse,
  PlannedServiceListResponse,
} from "@/features/calendar/types/planned-service.types";

const ALFRESCO_API_URL = process.env.ECM_API_URL || "";
const PLANNED_SERVICE_ENDPOINT = `${ALFRESCO_API_URL}/api/planned-services`;

/**
 * GET /api/planned-service
 * Get all planned services, optionally filtered by date range
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.set("startDate", startDate);
    if (endDate) queryParams.set("endDate", endDate);

    const url = queryParams.toString()
      ? `${PLANNED_SERVICE_ENDPOINT}?${queryParams.toString()}`
      : PLANNED_SERVICE_ENDPOINT;

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
      return NextResponse.json<PlannedServiceListResponse>(
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

    const data = (await response.json()) as PlannedServiceListResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching planned services:", error);
    // Return empty list on error (endpoint not yet implemented)
    return NextResponse.json<PlannedServiceListResponse>(
      { data: [], total: 0 },
      { status: 200 }
    );
  }
}

/**
 * POST /api/planned-service
 * Create a new planned service
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreatePlannedServiceRequest;

    // Validate required fields
    if (!body.service || !body.slot) {
      return NextResponse.json(
        { error: "Service and slot are required" },
        { status: 400 }
      );
    }

    const { url: authUrl, headers } = prepareAlfrescoAuth(
      PLANNED_SERVICE_ENDPOINT,
      session
    );

    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        service: body.service,
        slot: {
          date: body.slot.date instanceof Date
            ? body.slot.date.toISOString().split("T")[0]
            : body.slot.date,
          hour: body.slot.hour,
          minutes: body.slot.minutes,
        },
      }),
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      // Return a mock response with generated ID
      const mockResponse: PlannedServiceResponse = {
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
      };
      return NextResponse.json(mockResponse, { status: 201 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as PlannedServiceResponse;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating planned service:", error);
    return NextResponse.json(
      { error: "Error creating planned service" },
      { status: 500 }
    );
  }
}
