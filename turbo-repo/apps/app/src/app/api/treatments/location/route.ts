import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_treatment_symptoms_signals_map`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";

import {
  TreatmentsLocationResponse,
  TreatmentsLocationResponseItem,
} from "./route.type";
import { parseWKBPoint } from "@/utils/map-conversion";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { isEngineCaseId } from "@/features/symptoms/model/treatment-link";

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
    return NextResponse.json({
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

  // The evaluator's cases live in the modulith and may have no trip.
  const engineCase = isEngineCaseId(symptom_id);
  if (!symptom_id || (!trip_id && !engineCase)) {
    return NextResponse.json(
      {
        data: {
          type: "FeatureCollection",
          features: [],
          description: {},
        },
        status: 400,
        message: "Missing required parameters",
      },
      { status: 400 }
    );
  }
  // Without PostgREST, the modulith reads the signals as the active organization.
  if (!process.env.STREAMHUB_URL || engineCase) {
    const response = await forwardControlTowerMap(
      `symptoms/${encodeURIComponent(symptom_id)}/signals`
    );
    if (!response.ok) return response;
    const data = (await response.json()) as TreatmentsLocationResponseItem;
    return NextResponse.json(withCoordinates(data, symptom_name));
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
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = (await response.json()) as TreatmentsLocationResponse;
    return NextResponse.json(withCoordinates(apiData.data, symptom_name));
  } catch (error: any) {
    return NextResponse.json(
      {
        data: {
          type: "FeatureCollection",
          features: [],
          description: {},
        },
        status: 500,
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// The GPS function answers features: null when the symptom has no GPS rows.
function withCoordinates(
  data: Omit<TreatmentsLocationResponseItem, "features"> & {
    features: TreatmentsLocationResponseItem["features"] | null;
  },
  symptom_name: string | null
): TreatmentsLocationResponseItem {
  return {
    type: "FeatureCollection",
    features: (data.features ?? []).map((feature) => {
      const [longitude, latitude] = parseWKBPoint(feature.geometry);
      return {
        ...feature,
        longitude,
        latitude,
        symptom_name,
      };
    }),
    description: data.description,
  };
}
