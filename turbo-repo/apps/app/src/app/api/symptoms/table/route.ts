import { NextRequest, NextResponse } from "next/server";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { scopedSymptomListParams } from "../list-params";
import { SymptomsTableResponse } from "./route.types";
import { SymptomTableResponse } from "@/features/symptoms/types/symptoms";
import { formatActiveDuration } from "@/features/symptoms/model/active-duration";
import { tripPlateNow } from "@/features/symptoms/model/plate-change";
function formatSymptomData(data: SymptomsTableResponse): SymptomTableResponse {
  return {
    data: (data?.data ?? []).map((item) => ({
      id: String(item.id),
      condition: item?.icu_condition?.toLowerCase(),
      icu_code: item?.icu_code,
      licensePlate: item?.asset_id,
      tripPlateNow: tripPlateNow(item?.asset_id, item?.trip_asset_id),
      time: formatActiveDuration(item?.duration_sec) ?? "",
      trip: item?.trip_id,
      tripCode: item?.trip_code,
      driver: item?.driver,
      date: item?.start_time,
      endDate: item?.end_time ?? null,
      service: item?.asset_id,
      alertType: item?.type_of_incidence,
      status: item?.treatment_count === 0 ? "" : "Tratado",
      last_assigned_to: item?.last_assigned_to,
      sla_minutes: item?.sla_minutes ?? null,
      recurrence_events: item?.recurrence_events ?? null,
      ignored: item?.ignored ?? null,
      returnedAfterIgnoreAt: item?.returned_after_ignore_at ?? null,
      slaSince: item?.sla_since ?? null,
      operatorRequired: item?.operator_required ?? null,
      treatmentState: item?.treatment_state ?? null,
      treatment: item?.treatment ?? null,
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
  const scoped = await scopedSymptomListParams(req.nextUrl.searchParams);
  if (!scoped.ok) return scoped.response;
  const { params } = scoped;

  const search = params.size ? `?${params}` : "";
  const response = await forwardControlTowerMap("symptoms", search);
  if (!response.ok) return response;

  const data = (await response.json()) as SymptomsTableResponse;
  return NextResponse.json(formatSymptomData(data));
}
