import { NextRequest, NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import {
  isCarrierOrg,
  requireCarrierData,
} from "@/app/api/utils/carrier-scope";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { SymptomsTableResponse } from "./route.types";
import { SymptomTableResponse } from "@/features/symptoms/types/symptoms";

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
      // Trim all parameter values to remove leading/trailing whitespace
      const processedValue = value.trim();
      if (processedValue) {
        // Only add non-empty values
        params.set(apiParam, processedValue);
      }
    }
  });

  return params;
}

function formatSymptomData(data: SymptomsTableResponse): SymptomTableResponse {
  return {
    data: (data?.data ?? []).map((item) => ({
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

/**
 * One page of the active organization's symptoms, read by the modulith with
 * the user's session token.
 */
export async function GET(req: NextRequest) {
  const params = buildApiParams(req.nextUrl.searchParams);

  // PT2: org carrier ⇒ p_carrier_id se fuerza desde el scope (se ignora el
  // valor del navegador; regla de oro §A.4).
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  if (isCarrierOrg(scopeResult.scope)) {
    const guard = requireCarrierData(scopeResult.scope);
    if (guard) return guard;
    params.set("p_carrier_id", scopeResult.scope.effectiveTaxIds[0]);
  }

  const search = params.size ? `?${params}` : "";
  const response = await forwardControlTowerMap("symptoms", search);
  if (!response.ok) return response;

  const data = (await response.json()) as SymptomsTableResponse;
  return NextResponse.json(formatSymptomData(data));
}
