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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const params = new URLSearchParams();

  // params
  if (url.searchParams.get("asset_id")) {
    params.set("p_asset_id", `${url.searchParams.get("asset_id") ?? ""}`);
  }
  if (url.searchParams.get("icu_code")) {
    params.set("p_icu_code", url.searchParams.get("icu_code") ?? "");
  }
  if (url.searchParams.get("trip_id")) {
    params.set("p_trip_id", url.searchParams.get("trip_id") ?? "");
  }
  if (url.searchParams.get("driver_id")) {
    params.set("p_driver_id", url.searchParams.get("driver_id") ?? "");
  }
  if (url.searchParams.get("carrier_id")) {
    params.set("p_carrier_id", url.searchParams.get("carrier_id") ?? "");
  }
  if (url.searchParams.get("origin")) {
    params.set("p_origin", url.searchParams.get("origin") ?? "");
  }
  if (url.searchParams.get("destination")) {
    params.set("p_destination", url.searchParams.get("destination") ?? "");
  }
  if (url.searchParams.get("symptom_name")) {
    params.set("p_symptom_name", "Plan de Ruta Adelantado");
  }

  // Historic
  if (url.searchParams.get("from")) {
    params.set("p_start_date_historic", url.searchParams.get("from") ?? "");
  }
  if (url.searchParams.get("to")) {
    params.set("p_end_date_historic", url.searchParams.get("to") ?? "");
  }

  // Pagination
  if (url.searchParams.get("limit")) {
    params.set("p_page_size", (url.searchParams.get("limit") ?? "").trim());
  }
  if (url.searchParams.get("page")) {
    params.set("p_page", (url.searchParams.get("page") ?? "").trim());
  }

  try {
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
    const data = (await response.json()) as SymptomsTableResponse;

    const formattedResponse: SymptomTableResponse = {
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
    };

    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch symptoms data", errorMessage: error },
      { status: 500 }
    );
  }
}
