import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_symptoms_icu_tripid_view`;

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

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  try {
    const token = await authToken.getToken();
    const response = await fetch(SYMPTOMS_API_URL + "?p_trip_id=" + id, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = await response.json();

    return NextResponse.json(apiData.data);
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 }
    );
  }
}
