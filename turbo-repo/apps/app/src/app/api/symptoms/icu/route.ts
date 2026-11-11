import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { SymptomsICUResponse } from "./route.type";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import {
  OPERATOR_PARAM,
  parseOperatorFilter,
} from "@/features/symptoms/model/operator-filter";

/** At most this many cases at one level. */
const CASES_PAGE_SIZE = 200;

/** The evaluator's cases at one level (`p_icu_code`), from the modulith. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  const { searchParams } = new URL(request.url);
  const pIcuCode = searchParams.get("p_icu_code");

  const params = new URLSearchParams({ p_page_size: `${CASES_PAGE_SIZE}` });
  if (pIcuCode?.trim()) params.set("p_icu_code", pIcuCode.trim());
  const operator = parseOperatorFilter(searchParams.get(OPERATOR_PARAM));
  if (operator) params.set(OPERATOR_PARAM, operator);
  const response = await forwardControlTowerMap("symptoms", `?${params}`);
  if (!response.ok) return response;
  const page = (await response.json()) as SymptomsICUResponse;
  return NextResponse.json(page.data ?? []);
}
