import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isModulithConfigured } from "@/lib/modulith-host";
import { harnessRouteClient } from "../harness-route-client";

const EMPTY = { default: null, models: [] as string[] };

/**
 * The conversation models the harness lets a run choose, via
 * `client.models.list()` (`GET /models`). Empty when the harness has no
 * per-run model; 502 when the harness could not be asked.
 */
export async function GET() {
  if (!isModulithConfigured()) {
    return NextResponse.json(EMPTY);
  }

  const route = await harnessRouteClient();
  if (!route.ok) return route.response;

  try {
    return NextResponse.json(await route.client.models.list());
  } catch (err: unknown) {
    logger.error({ err }, "[harness/models] failed to fetch models");
    // Not EMPTY: an empty list means "no per-run model", and the panel would
    // cache it and hide the picker.
    return NextResponse.json({ error: "models unavailable" }, { status: 502 });
  }
}
