import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

//const SYMPTOMS_API_URL = "https://iot.streamhub.cl/api/v1/avl/alerts/table";
const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/api/v1/pgrest/rpc/api_modular_symptoms_table`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { SymptomsTableResponse } from "./route.types";
import { SymptomTableResponse } from "@/features/symptoms/types/symptoms";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

// Parameter mapping configuration
const PARAM_MAPPING = {
  // Standard params
  asset_id: "p_asset_id",
  icu_code: "p_icu_code",
  trip_id: "p_trip_id",
  driver_id: "p_driver_id",
  carrier_id: "p_carrier_id",
  origin: "p_origin",
  destination: "p_destination",
  symptom_name: "p_symptom_name",
  // Historic params
  from: "p_start_date_historic",
  to: "p_end_date_historic",
  // Pagination params
  limit: "p_page_size",
  page: "p_page",
} as const;

function buildApiParams(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(PARAM_MAPPING).forEach(([inputParam, apiParam]) => {
    const value = searchParams.get(inputParam);
    if (value) {
      const processedValue =
        inputParam === "limit" || inputParam === "page" ? value.trim() : value;
      params.set(apiParam, processedValue);
    }
  });

  return params;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const params = buildApiParams(url.searchParams);

  function formatSymptomData(
    data: SymptomsTableResponse
  ): SymptomTableResponse {
    return {
      data: data?.data.map((item) => ({
        id: String(item.id),
        condition: item?.icu_condition?.toLowerCase(),
        icu_code: item?.icu_code,
        licensePlate: item?.asset_id,
        time: item?.duration_sec?.toString(),
        trip: item?.trip_id,
        driver: item?.driver,
        date: item?.start_time,
        service: item?.asset_id,
        alertType: item?.type_of_incidence,
        status: item?.treatment_count === 0 ? "" : "Tratado",
        last_assigned_to: item?.last_assigned_to,
      })),
      pagination: {
        total_rows: data.total_rows,
        total_pages: data.total_pages,
        currentPage: data.page,
        page_size: data.page_size,
      },
      symptoms_list: data.symptom_name_list,
    };
  }

  async function fetchSymptomsData(params: URLSearchParams) {
    const token = await authToken.getToken();

    const response = await fetch(SYMPTOMS_API_URL + "?" + params.toString(), {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as SymptomsTableResponse;
  }

  try {
    const data = await fetchSymptomsData(params);
    const formattedResponse = formatSymptomData(data);
    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch symptoms data", errorMessage: error },
      { status: 500 }
    );
  }
}
