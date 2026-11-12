import { NextRequest, NextResponse } from "next/server";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import type { SymptomConstellationCounts } from "@/features/symptoms/types/symptoms";
import type { TreatmentState } from "@/features/symptoms/model/treatment-state";
import { scopedSymptomListParams } from "../list-params";

/** The modulith's answer: case counts by its condition keys. */
interface CaseCountsResponse {
  conditions?: Record<string, number>;
  vehicles_on_trip?: number;
  treatment_states?: Partial<Record<TreatmentState, number>>;
}

/**
 * The active organization's open cases by condition and its vehicles on a
 * trip, for the same filters as `/app/api/symptoms/table`. The condition
 * filter and paging are not sent: every condition is counted.
 */
export async function GET(req: NextRequest) {
  const scoped = await scopedSymptomListParams(req.nextUrl.searchParams);
  if (!scoped.ok) return scoped.response;
  const { params } = scoped;
  for (const name of ["p_icu_code", "p_page", "p_page_size"]) {
    params.delete(name);
  }

  const search = params.size ? `?${params}` : "";
  const response = await forwardControlTowerMap("case-counts", search);
  if (!response.ok) return response;

  const body = (await response.json()) as CaseCountsResponse;
  const counts = body.conditions ?? {};
  const result: SymptomConstellationCounts = {
    conditions: {
      codeBlack: counts["Code Black"] ?? 0,
      critic: counts["Critical condition"] ?? 0,
      compromised: counts["Compromised condition"] ?? 0,
      observation: counts["Under Observation"] ?? 0,
      treatment: counts["Under Treatment"] ?? 0,
      stable: counts["Stable"] ?? 0,
    },
    vehiclesOnTrip: body.vehicles_on_trip ?? 0,
    ignored: counts["Ignored"] ?? 0,
    treatmentStates: {
      untreated: body.treatment_states?.untreated ?? 0,
      in_treatment: body.treatment_states?.in_treatment ?? 0,
      treated: body.treatment_states?.treated ?? 0,
    },
  };
  return NextResponse.json(result);
}
