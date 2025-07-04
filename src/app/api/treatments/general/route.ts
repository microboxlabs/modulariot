import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_treatments_info_general`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import {
  TreatmentsGeneralResponse,
  TreatmentsGeneralResponseItem,
} from "./route.type";

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
    const response = await fetch(
      SYMPTOMS_API_URL + "?p_symptom_id=" + id + "&p_dev_env=1",
      {
        headers: {
          accept: "application/json",
          Authorization: ` Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    //console.log(JSON.stringify(await response.json()));
    //console.log((await response.json()).data.timeline)
    const apiData = (await response.json()) as TreatmentsGeneralResponse;
    // Transform API data into our desired structure
    const formattedResponse: TreatmentsGeneralResponseItem = apiData.data;
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
