import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL =
  "https://pgrest.streamhub.cl:443/api/v1/pgrest/rpc/api_modular_symptms_icu_view";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { SymptomsICUItemResponse, SymptomsICUResponse } from "./route.type";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  try {
    const token = await authToken.getToken();
    const response = await fetch(SYMPTOMS_API_URL, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = (await response.json()) as SymptomsICUResponse;

    // Transform API data into our desired structure
    const formattedResponse: SymptomsICUItemResponse[] = apiData.data;

    return NextResponse.json(formattedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 },
    );
  }
}
