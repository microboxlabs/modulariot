import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_mapa_table_resume`;

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

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
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

    const data = await response.json();
    return NextResponse.json(data.data); //TODO: ask to standardize the response
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch symptoms data",
        errorMessage: error,
      },
      { status: 500 }
    );
  }
}
