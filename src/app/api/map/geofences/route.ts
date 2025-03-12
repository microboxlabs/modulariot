import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

const SYMPTOMS_API_URL =
  "https://pgrest.streamhub.cl:443/api/v1/pgrest/rpc/api_modular_treatments_geofences_service";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  try {
    const token = await authToken.getToken();

    const tripId = req.nextUrl.searchParams.get("tripId");

    if (!tripId) return NextResponse.error();

    const response = await fetch(SYMPTOMS_API_URL + "?p_trip_id=" + tripId, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = await response.json();

    return NextResponse.json(apiData);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 },
    );
  }
}
