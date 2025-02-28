import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

//const SYMPTOMS_API_URL = "https://iot.streamhub.cl/api/v1/avl/alerts/table";
const SYMPTOMS_API_URL =
  "https://pgrest.streamhub.cl:443/api/v1/pgrest/rpc/api_modular_symptoms_table";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { SymptomsTable } from "./route.types";
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
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const params = new URLSearchParams();
  params.set("page", url.searchParams.get("page") ?? "1");
  params.set("limit", url.searchParams.get("limit") ?? "10");
  if (url.searchParams.get("search")) {
    params.set("service", url.searchParams.get("service") ?? "");
  }
  if (url.searchParams.get("condition")) {
    params.set("condition", url.searchParams.get("condition") ?? "");
  }

  console.log(params.toString());

  try {
    const token = await authToken.getToken();
    const response = await fetch(SYMPTOMS_API_URL, {
      //+ "?" + params.toString()
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as SymptomsTable[];
    const formattedResponse: SymptomTableResponse = {
      data: data.map((item) => ({
        condition: item.icu_condition.toLowerCase(),
        licensePlate: item.asset_id,
        time: item.duration_sec.toString(),
        trip: item.trip_id,
        driver: item.driver,
        date: item.start_time,
        service: item.asset_id,
        alertType: item.type_of_incidence,
        status: item.treatment_count === 0 ? "" : "Tratado",
      })),
      total: data.length,
      page: 1,
      pageSize: data.length,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalRecords: data.length,
        limit: data.length,
      },
    };

    return NextResponse.json(formattedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch symptoms data",
        errorMessage: error,
      },
      { status: 500 },
    );
  }
}
