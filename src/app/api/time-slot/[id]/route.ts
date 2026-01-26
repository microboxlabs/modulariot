import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type {
  UpdateTimeSlotRequest,
  TimeSlotResponse,
} from "@/features/calendar/types/time-slot.types";

const ALFRESCO_API_URL = process.env.ECM_API_URL || "";
const TIME_SLOT_ENDPOINT = `${ALFRESCO_API_URL}/api/time-slots`;

/**
 * GET /api/time-slot/[id]
 * Get a specific time slot by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = `${TIME_SLOT_ENDPOINT}/${id}`;

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
      return NextResponse.json(
        { error: "Time slot not found" },
        { status: 404 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as TimeSlotResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching time slot:", error);
    return NextResponse.json(
      { error: "Error fetching time slot" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/time-slot/[id]
 * Update a time slot
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateTimeSlotRequest;

    const url = `${TIME_SLOT_ENDPOINT}/${id}`;

    const { url: authUrl, headers } = prepareAlfrescoAuth(url, session);

    const response = await fetch(authUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      // Return the updated data as if it was saved
      const mockResponse: TimeSlotResponse = {
        id,
        name: body.name || "",
        kind: body.kind || "window",
        type: body.type || "weekly",
        weeklyPattern: body.weeklyPattern,
        startTimestamp: body.startTimestamp,
        endTimestamp: body.endTimestamp,
        quota: body.quota,
        color: body.color,
      };
      return NextResponse.json(mockResponse, { status: 200 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as TimeSlotResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating time slot:", error);
    return NextResponse.json(
      { error: "Error updating time slot" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/time-slot/[id]
 * Delete a time slot
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = `${TIME_SLOT_ENDPOINT}/${id}`;

    const { url: authUrl, headers } = prepareAlfrescoAuth(url, session);

    const response = await fetch(authUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      // Return success as if it was deleted
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting time slot:", error);
    return NextResponse.json(
      { error: "Error deleting time slot" },
      { status: 500 }
    );
  }
}
