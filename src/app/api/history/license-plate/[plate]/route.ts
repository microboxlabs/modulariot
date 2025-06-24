import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

const HISTORICAL_TRIP_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/historical_trip`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import {
  TripHistoryFilters,
  TripHistoryItem,
  TripHistoryResponse,
} from "../route.types";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

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
    const token = await authToken.getToken();
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
      /* page: "eq." + (searchParams.get("page") || "1"),
      limit: "eq." + (searchParams.get("limit") || "50"), // Max 100 items per page */
    };

    // Build query parameters for the API call
    const queryParams = new URLSearchParams();
    queryParams.append("asset_id", "eq." + plate);

    // Add filters to query parameters
    if (filters.date_from)
      queryParams.append("start_time", "eq." + filters.date_from);
    if (filters.date_to)
      queryParams.append("end_time", "eq." + filters.date_to);
    if (filters.status) queryParams.append("status", "eq." + filters.status);
    if (filters.origin)
      queryParams.append("origin_geofence_label", "eq." + filters.origin);
    if (filters.destination)
      queryParams.append(
        "destination_geofence_label",
        "eq." + filters.destination,
      );
    if (filters.driver)
      queryParams.append("driver_name", "ilike.*" + filters.driver + "*");
    if (filters.page) queryParams.append("page", filters.page.toString());
    if (filters.limit) queryParams.append("limit", filters.limit.toString());

    // Make API request with optimized headers
    const response = await fetch(
      `${HISTORICAL_TRIP_API_URL}?${queryParams.toString()}`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        },
        // Add timeout for better performance
        signal: AbortSignal.timeout(30000), // 30 second timeout
      },
    );

    if (!response.ok) {
      console.log(await response.json());
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

    const apiData = await response.json();

    // Transform and optimize the response data
    const transformedData: TripHistoryItem[] = Array.isArray(apiData)
      ? apiData.map((trip: any) => ({
          trip_id: trip.trip_id,
          asset_id: trip.asset_id,
          trip_type: trip.trip_type,
          origin_geofence_id: trip.origin_geofence_id,
          destination_geofence_id: trip.destination_geofence_id,
          stop_geofence_ids: trip.stop_geofence_ids,
          status: trip.status,
          driver_id: trip.driver_id,
          start_time: trip.start_time,
          end_time: trip.end_time,
          current_geofence_id: trip.current_geofence_id,
          created_by_client_id: trip.created_by_client_id,
          created_timestamp: trip.created_timestamp,
          modified_by_client_id: trip.modified_by_client_id,
          modified_timestamp: trip.modified_timestamp,
          carrier_id: trip.carrier_id || "",
          carrier_name: trip.carrier_name,
          type_load: trip.type_load,
          driver_name: trip.driver_name,
          rampla_plate: trip.rampla_plate,
          origin_geofence_label: trip.origin_geofence_label,
          destination_geofence_label: trip.destination_geofence_label,
          closed_timestamp: trip.closed_timestamp,
        }))
      : [];

    // Calculate pagination info
    const total = transformedData.length;
    const total_pages = Math.ceil(total / parseInt(filters.limit!));

    const responseData: TripHistoryResponse = {
      success: true,
      data: transformedData,
      pagination: {
        total,
        page: parseInt(filters.page!), //parseInt(filters.page!.split(".")[1]),
        limit: parseInt(filters.limit!), //parseInt(filters.limit!.split(".")[1]),
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
    console.error("Error fetching trip history:", error);

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
