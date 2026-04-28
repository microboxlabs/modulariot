import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_map_positions`;

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
    const params = new URLSearchParams();
    //params.set("lastUpdatedSince", new Date().toISOString());
    params.set("p_is_dev", "true");

    const response = await fetch(
      SYMPTOMS_API_URL + "?" + params.toString(),
      {
        headers: {
          accept: "application/json",
          Authorization: ` Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("API Error Details:", {
        responseUrl: response.url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorBody,
      });
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorBody}`
      );
    }

    const data = await response.json();

    return NextResponse.json(data.data); //TODO: ask to standardize the response
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch map positions",
        errorMessage:
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message: string }).message
            : String(error),
      },
      { status: 500 }
    );
  }
}
