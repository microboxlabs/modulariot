import { NextRequest, NextResponse } from "next/server";
import { createStreamHubApiHandler } from "../../utils/streamhub-api-client";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg, requireCarrierData, getCarrierPatentes } from "@/app/api/utils/carrier-scope";

const paramMapping = [
  { source: "asset_id", target: "p_asset_id" },
  { source: "p_from", target: "p_start_date_historic" },
  { source: "p_to", target: "p_end_date_historic" },
];

const baseHandler = createStreamHubApiHandler(
  "/rpc/api_modular_overview_historic_position",
  paramMapping
);

// PT2: la patente llega como texto libre desde /signal-history — una org
// carrier solo puede consultar SUS patentes (anti-IDOR, fail-closed).
export const GET = async (req: NextRequest) => {
  const scopeResult = await resolveTenantScope();
  if (scopeResult.resolved && isCarrierOrg(scopeResult.scope)) {
    const guard = requireCarrierData(scopeResult.scope);
    if (guard) return guard;
    const assetId = req.nextUrl.searchParams.get("asset_id") ?? "";
    const patentes = await getCarrierPatentes(scopeResult.scope);
    if (!assetId || !patentes.has(assetId.toUpperCase())) {
      return NextResponse.json(
        { error: "Asset does not belong to the active organization" },
        { status: 403 }
      );
    }
  }
  return baseHandler(req);
};
