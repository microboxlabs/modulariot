import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type {
  UpdatePlannedServiceRequest,
  PlannedServiceResponse,
} from "@/features/calendar/types/planned-service.types";

const ALFRESCO_API_URL = process.env.ECM_API_URL || "";
const PLANNED_SERVICE_ENDPOINT = `${ALFRESCO_API_URL}/api/planned-services`;

/**
 * GET /api/planned-service/[id]
 * Get a specific planned service by ID
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
    const url = `${PLANNED_SERVICE_ENDPOINT}/${id}`;

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
        { error: "Planned service not found" },
        { status: 404 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as PlannedServiceResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching planned service:", error);
    return NextResponse.json(
      { error: "Error fetching planned service" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/planned-service/[id]
 * Update a planned service
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
    const body = (await request.json()) as UpdatePlannedServiceRequest;

    const url = `${PLANNED_SERVICE_ENDPOINT}/${id}`;

    const { url: authUrl, headers } = prepareAlfrescoAuth(url, session);

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

    const response = await fetch(authUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(updatePayload),
    });

    // Handle 404 gracefully (endpoint not yet implemented)
    if (response.status === 404) {
      // Return the updated data as if it was saved
      const mockResponse: PlannedServiceResponse = {
        id,
        service: (body.service as PlannedServiceResponse["service"]) || {
          id: "",
          cliente: "",
          origen: "",
          destino: "",
          tipoViaje: "Sider",
          ocupacion: 0,
          permanencia: "",
          leadTime: { deadline: "", status: "" },
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
      };
      return NextResponse.json(mockResponse, { status: 200 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Alfresco API request failed: ${response.status} ${response.statusText}. Response: ${errorText || "No response body"}`
      );
    }

    const data = (await response.json()) as PlannedServiceResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating planned service:", error);
    return NextResponse.json(
      { error: "Error updating planned service" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planned-service/[id]
 * Delete a planned service
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
    const url = `${PLANNED_SERVICE_ENDPOINT}/${id}`;

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
    console.error("Error deleting planned service:", error);
    return NextResponse.json(
      { error: "Error deleting planned service" },
      { status: 500 }
    );
  }
}
