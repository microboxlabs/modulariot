import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData, getCarrierPatentes } from "@/app/api/utils/carrier-scope";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.STREAMHUB_URL}/rpc/api_modular_mapa_table_resume`;

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


// PT2: los contadores vienen PRE-AGREGADOS del RPC (no filtrables por
// patente). Para org carrier ⇒ 403 fail-closed hasta que el RPC acepte
// p_carrier_id (pedido al equipo StreamHub).
async function carrierGuard(): Promise<NextResponse | null> {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved || !isCarrierOrg(scopeResult.scope)) return null;
  return NextResponse.json(
    { error: "Map resume is not tenant-filtered yet for carrier organizations" },
    { status: 403 }
  );
}

export async function GET() {
  const guard = await carrierGuard();
  if (guard) return guard;

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

    const data = await response.json();
    return NextResponse.json(data.data); //TODO: ask to standardize the response
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch symptoms data",
        errorMessage: error,
      },
      { status: 500 }
    );
  }
}
