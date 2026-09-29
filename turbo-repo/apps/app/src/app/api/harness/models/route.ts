import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isModulithConfigured } from "@/lib/modulith-host";
import { harnessRouteClient } from "../harness-route-client";

const EMPTY = { default: null, models: [] as string[] };

/**
 * The conversation models the harness lets a run choose, via
 * `client.models.list()` (`GET /models`). Empty when the harness has no
 * per-run model.
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
    return NextResponse.json(EMPTY);
  }
}
