import {
  OPERATOR_PARAM,
  parseOperatorFilter,
} from "@/features/symptoms/model/operator-filter";
import type { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import {
  isCarrierOrg,
  requireCarrierData,
} from "@/app/api/utils/carrier-scope";
import { isoDate } from "@/app/api/utils/control-tower-map";

/** The app's symptom list query parameters and the modulith's names for them. */
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

const DATE_PARAMS = new Set(["from", "to"]);

/** The list filters with a value, trimmed, under the modulith's names. */
export function buildSymptomListParams(
  searchParams: URLSearchParams
): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(PARAM_MAPPING).forEach(([inputParam, apiParam]) => {
    const value = searchParams.get(inputParam);
    if (value) {
      const processedValue = DATE_PARAMS.has(inputParam)
        ? isoDate(value)
        : value.trim();
      if (processedValue) {
        params.set(apiParam, processedValue);
      }
    }
  });

  const operator = parseOperatorFilter(searchParams.get(OPERATOR_PARAM));
  if (operator) params.set(OPERATOR_PARAM, operator);

  return params;
}

type ScopedParams =
  | { ok: true; params: URLSearchParams }
  | { ok: false; response: NextResponse };

/**
 * {@link buildSymptomListParams} for the active organization. A carrier
 * organization always filters by its own tax id, whatever the browser sent
 * (PT2, regla de oro §A.4), and without one it is a 403.
 */
export async function scopedSymptomListParams(
  searchParams: URLSearchParams
): Promise<ScopedParams> {
  const params = buildSymptomListParams(searchParams);
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved)
    return { ok: false, response: scopeResult.response };
  if (isCarrierOrg(scopeResult.scope)) {
    const guard = requireCarrierData(scopeResult.scope);
    if (guard) return { ok: false, response: guard };
    params.set("p_carrier_id", scopeResult.scope.effectiveTaxIds[0]);
  }
  return { ok: true, params };
}
