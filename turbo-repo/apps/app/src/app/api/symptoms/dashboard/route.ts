import { NextRequest, NextResponse } from "next/server";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { SymptomsDashboard } from "./route.type";

/**
 * Symptom counts by condition for the active organization: active symptoms, or
 * with `from` and `to` the symptoms created in that range. The modulith
 * answers 400 when only one of them is sent.
 */
export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  for (const name of ["from", "to"]) {
    const value = req.nextUrl.searchParams.get(name);
    if (value) params.set(name, value);
  }
  const search = params.size ? `?${params}` : "";

  const response = await forwardControlTowerMap("conditions", search);
  if (!response.ok) return response;

  const counts = (await response.json()) as Record<string, number>;
  const dashboard: SymptomsDashboard = {
    critic: counts["Critical condition"] || 0,
    stable: counts["Stable"] || 0,
    codeBlack: counts["Code Black"] || 0,
    remission: counts["Remission"] || 0,
    treatment: counts["Under Treatment"] || 0,
    compromised: counts["Compromised condition"] || 0,
    observation: counts["Under Observation"] || 0,
  };
  return NextResponse.json(dashboard);
}
