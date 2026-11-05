import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { legacySymptomsEnabled } from "@/app/api/utils/control-tower-map";
import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_symptoms_icu_tripid_view`;

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
  const tripId = req.nextUrl.searchParams.get("tripId");

  if (!tripId) {
    return NextResponse.json("Trip ID is required", { status: 400 });
  }
  // The GPS database's symptoms of a trip; none where only the evaluator's show.
  if (!legacySymptomsEnabled()) {
    return NextResponse.json([]);
  }

  try {
    const token = await authToken.getToken();
    const response = await fetch(SYMPTOMS_API_URL + `?p_trip_id=${tripId}`, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data.data);
  } catch (error) {
    return NextResponse.json("Error fetching conditions", { status: 500 });
  }
}
