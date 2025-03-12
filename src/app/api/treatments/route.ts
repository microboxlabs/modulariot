import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL =
  "https://pgrest.streamhub.cl:443/api/v1/pgrest/rpc/process_treatment_manual_notifi_audit";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { TreatmentsRequest, TreatmentsResponse } from "./route.type";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const body = (await request.json()) as TreatmentsRequest;

  if (!body.client_id) {
    body.client_id = `${process.env.STREAMHUB_CLIENT_ID}`;
  }
  
  try {
    const token = await authToken.getToken();
    
    const response = await fetch(SYMPTOMS_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_json: body
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = (await response.json()) as TreatmentsResponse;

    console.log(responseData);

    if (responseData.status === 200) {
      return NextResponse.json(responseData.data, {
        status: 200,
      });
    } else {
      return NextResponse.json(
        {
          data: {},
          status: 500,
          message: "Failed to fetch symptoms data",
        },
        { status: 500 },
      );
    }
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
