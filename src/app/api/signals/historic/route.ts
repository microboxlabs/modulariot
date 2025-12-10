import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_overview_historic_position`;

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

  const url = new URL(req.url);
  const params = new URLSearchParams();

  if (url.searchParams.get("asset_id")) {
    params.set("p_asset_id", `${url.searchParams.get("asset_id") ?? ""}`);
  }
  if (url.searchParams.get("p_from")) {
    params.set("p_start_date_historic", url.searchParams.get("p_from") ?? "");
  }
  if (url.searchParams.get("p_to")) {
    params.set("p_end_date_historic", url.searchParams.get("p_to") ?? "");
  }

  try {
    const token = await authToken.getToken();

    const response = await fetch(SYMPTOMS_API_URL + "?" + params.toString(), {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    console.log("------------ response ----------------");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch symptoms data", errorMessage: error },
      { status: 500 }
    );
  }
}
