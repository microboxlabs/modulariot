import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg } from "@/app/api/utils/carrier-scope";
import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_treatments_geofences_service`;

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
  // PT2 TODO: falta resolver trip→asset para validar pertenencia; hasta
  // entonces, fail-closed para orgs carrier (geometría de rutas ajenas).
  const scopeResult = await resolveTenantScope();
  if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
    return NextResponse.json(
      { error: "Trip geofences are not tenant-validated yet for carrier organizations" },
      { status: 403 }
    );
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  try {
    const token = await authToken.getToken();

    const tripId = req.nextUrl.searchParams.get("tripId");

    if (!tripId) return NextResponse.error();

    const response = await fetch(SYMPTOMS_API_URL + "?p_trip_id=" + tripId, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = await response.json();

    return NextResponse.json(apiData);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Failed to fetch symptoms data: " + error,
      },
      { status: 500 }
    );
  }
}
