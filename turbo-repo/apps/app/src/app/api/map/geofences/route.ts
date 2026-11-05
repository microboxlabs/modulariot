import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import {
  isTripsModuleTripId,
  tripIdOf,
} from "@/features/symptoms/model/treatment-link";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_treatments_geofences_service`;

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
    return NextResponse.json({
      status: 401,
    });
  }

  try {
    const tripId = tripIdOf(req.nextUrl.searchParams.get("tripId"));
    if (!tripId)
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

    if (!process.env.STREAMHUB_IOT_URL || isTripsModuleTripId(tripId)) {
      const response = await forwardControlTowerMap(
        `trips/${encodeURIComponent(tripId)}/geofences`
      );
      if (!response.ok) return response;
      return NextResponse.json({ data: await response.json() });
    }

    const token = await authToken.getToken();

    const response = await fetch(SYMPTOMS_API_URL + "?p_trip_id=" + tripId, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = response.status === 204 ? [] : await response.json();

    return NextResponse.json(apiData);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Failed to fetch symptoms data: " + error,
      },
      { status: 500 }
    );
  }
}
