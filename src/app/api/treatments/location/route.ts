import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_treatment_symptoms_signals_map`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

import {
  TreatmentsLocationResponse,
  TreatmentsLocationResponseItemFeature,
} from "./route.type";
import { parseWKBPoint } from "@/utils/map-conversion";

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
  const symptom_id = searchParams.get("symptom_id");
  const trip_id = searchParams.get("trip_id");
  const symptom_name = searchParams.get("symptom_name");
  /* const first_date = searchParams.get("first_date")?.replaceAll(" ", "+");
  const last_date = searchParams.get("last_date")?.replaceAll(" ", "+"); */

  //!symptom_name || !first_date || !last_date ||

  if (!trip_id || !symptom_id) {
    return NextResponse.json(
      {
        data: [],
        status: 400,
        message: "Missing required parameters",
      },
      { status: 400 },
    );
  }
  try {
    const token = await authToken.getToken();
    const response = await fetch(
      SYMPTOMS_API_URL +
        "?p_client_id=" +
        config.clientId +
        "&p_trip_id=" +
        trip_id +
        "&p_symptom_name=" +
        symptom_name +
        /*  "&p_first_date=" +
        encodeURIComponent(first_date ?? "") +
        "&p_last_date=" +
        encodeURIComponent(last_date ?? "") + */
        "&p_symptom_id=" +
        symptom_id,
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

    const apiData = (await response.json()) as TreatmentsLocationResponse;
    // Transform API data into our desired structure
    const formattedResponse: TreatmentsLocationResponseItemFeature[] =
      apiData?.data?.features?.map((feature) => {
        const [longitude, latitude] = parseWKBPoint(feature.geometry);
        return {
          ...feature,
          longitude,
          latitude,
          symptom_name,
        };
      }) ?? [];

    return NextResponse.json(formattedResponse);
  } catch (error: any) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: error.message,
      },
      { status: 500 },
    );
  }
}
