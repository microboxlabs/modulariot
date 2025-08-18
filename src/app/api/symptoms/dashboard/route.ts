import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { SymptomsDashboardResponse, SymptomsDashboard } from "./route.type";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_symptoms_dashboard`;
//const SYMPTOMS_API_URL = "https://iot.streamhub.cl/api/v1/avl/alerts/dashboard";

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

    const apiData = (await response.json()) as SymptomsDashboardResponse;
    // Transform API data into our desired structure
    const formattedResponse: SymptomsDashboard = {
      critic: apiData.data["Critical condition"] || 0,
      stable: apiData.data["Stable"] || 0,
      codeBlack: apiData.data["Code Black"] || 0,
      remission: apiData.data["Remission"] || 0,
      treatment: apiData.data["Under Treatment"] || 0,
      compromised: apiData.data["Compromised condition"] || 0,
      observation: apiData.data["Under Observation"] || 0,
    };

    return NextResponse.json(formattedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        data: {
          critic: 0,
          stable: 0,
          codeBlack: 0,
          remission: 0,
          treatment: 0,
          compromised: 0,
          observation: 0,
        },
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 }
    );
  }
}
