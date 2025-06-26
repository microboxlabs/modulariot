import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

import {
  TripHistoryFilters,
  TripHistoryItem,
  TripHistoryResponse,
} from "../route.types";
import { getTaskByLicensePlate } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
/**
 * GET /api/history/license-plate/{plate}
 *
 * Retrieves trip history for a specific license plate (asset_id)
 *
 * Query Parameters:
 * - date_from: Start date filter (YYYY-MM-DD)
 * - date_to: End date filter (YYYY-MM-DD)
 * - status: Trip status filter
 * - origin: Origin location filter
 * - destination: Destination location filter
 * - driver: Driver name filter
 * - page: Page number for pagination (default: 1)
 * - limit: Number of items per page (default: 50, max: 100)
 *
 * Response:
 * {
 *   "success": boolean,
 *   "data": TripHistoryItem[],
 *   "pagination": {
 *     "total": number,
 *     "page": number,
 *     "limit": number,
 *     "total_pages": number
 *   },
 *   "filters": {
 *     "date_from": string,
 *     "date_to": string,
 *     "status": string,
 *     "origin": string,
 *     "destination": string,
 *     "driver": string
 *   }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { plate: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        data: [],
        message: "Unauthorized access",
      },
      { status: 401 },
    );
  }

  try {
    const { plate } = params;

    if (!plate) {
      return NextResponse.json(
        {
          success: false,
          data: [],
          message: "License plate parameter is required",
        },
        { status: 400 },
      );
    }

    // Extract query parameters for filtering
    const searchParams = req.nextUrl.searchParams;
    const filters: TripHistoryFilters = {
      date_from: searchParams.get("date_from") || undefined,
      date_to: searchParams.get("date_to") || undefined,
      status: searchParams.get("status") || undefined,
      origin: searchParams.get("origin") || undefined,
      destination: searchParams.get("destination") || undefined,
      driver: searchParams.get("driver") || undefined,
      type_load: searchParams.get("type_load") || undefined,
      trailer_license_plate:
        searchParams.get("trailer_license_plate") || undefined,
      /* page: "eq." + (searchParams.get("page") || "1"),
      limit: "eq." + (searchParams.get("limit") || "50"), // Max 100 items per page */
    };

    // Build query parameters for the API call
    const body = {
      from: 0,
      size: 100,
      filter: {
        licensePlate: plate,
      } as Record<string, any>,
    };

    // Add filters to query parameters
    if (filters.driver) body.filter.driverId = filters.driver;
    if (filters.trailer_license_plate)
      body.filter.trailerLicensePlate = filters.trailer_license_plate;
    if (filters.carrier_id) body.filter.carrierId = filters.carrier_id;
    if (filters.carrier_name) body.filter.carrierName = filters.carrier_name;
    if (filters.origin) body.filter.origin = filters.origin;
    if (filters.destination) body.filter.destination = filters.destination;
    if (filters.customer_code) body.filter.customerCode = filters.customer_code;

    /* if (filters.date_from) body.filter.dateFrom = filters.date_from;
    if (filters.date_to) body.filter.endTime = filters.date_to;
    if (filters.status) body.filter.status = filters.status;
    if (filters.type_load) body.filter.type_load = filters.type_load; */
    if (filters.page) body.from = parseInt(filters.page);
    if (filters.limit) body.size = parseInt(filters.limit);

    // Make API request with optimized headers
    const response = await getTaskByLicensePlate(session.user.ticket, body);
    if (!response) {
      const errorMessage =
        response.status === 404
          ? "No trips found for this license plate"
          : `API request failed with status: ${response.status}`;

      return NextResponse.json(
        {
          success: false,
          data: [],
          message: errorMessage,
        },
        { status: response.status },
      );
    }

    const apiData = response.tasks;

    // Transform and optimize the response data
    const transformedData: TripHistoryItem[] = Array.isArray(apiData)
      ? apiData
      : [];

    // Calculate pagination info
    const total = transformedData.length;
    const total_pages = Math.ceil(total / body.size!);

    const responseData: TripHistoryResponse = {
      success: true,
      data: transformedData,
      pagination: {
        total,
        page: body.from,
        limit: body.size,
        total_pages,
      },
      filters: {
        date_from: filters.date_from,
        date_to: filters.date_to,
        status: filters.status,
        origin: filters.origin,
        destination: filters.destination,
        driver: filters.driver,
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: [],
        message:
          error instanceof Error
            ? `Failed to fetch trip history: ${error.message}`
            : "Failed to fetch trip history: Unknown error",
      },
      { status: 500 },
    );
  }
}
