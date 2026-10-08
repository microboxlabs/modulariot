import { NextRequest, NextResponse } from "next/server";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { SymptomsDashboard } from "./route.type";

/**
 * Symptom counts by condition for the active organization: active symptoms, or
 * with `from` and `to` the symptoms created in that range.
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const params = new URLSearchParams();
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
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
