import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_symptoms_icu_view`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { SymptomsICUItemResponse, SymptomsICUResponse } from "./route.type";
import {
  forwardControlTowerMap,
  legacySymptomsEnabled,
} from "@/app/api/utils/control-tower-map";

/** At most this many cases at one level when the list shows the evaluator's cases only. */
const CASES_PAGE_SIZE = 200;

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
  const pIcuCode = searchParams.get("p_icu_code");

  if (!legacySymptomsEnabled()) {
    const params = new URLSearchParams({ p_page_size: `${CASES_PAGE_SIZE}` });
    if (pIcuCode?.trim()) params.set("p_icu_code", pIcuCode.trim());
    const response = await forwardControlTowerMap("symptoms", `?${params}`);
    if (!response.ok) return response;
    const page = (await response.json()) as SymptomsICUResponse;
    return NextResponse.json(page.data ?? []);
  }

  try {
    const token = await authToken.getToken();
    const response = await fetch(SYMPTOMS_API_URL + "?p_icu_code=" + pIcuCode, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = (await response.json()) as SymptomsICUResponse;

    // Transform API data into our desired structure
    const formattedResponse: SymptomsICUItemResponse[] = apiData.data;

    return NextResponse.json(formattedResponse);
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 }
    );
  }
}
