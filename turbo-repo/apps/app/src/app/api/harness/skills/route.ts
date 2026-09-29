import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isModulithConfigured } from "@/lib/modulith-host";
import { harnessRouteClient } from "../harness-route-client";

/**
 * Lists the skills the harness exposes, via the same `client.skills.list()`
 * call (`GET /skills`) the harness CLI and TUI use — see
 * @microboxlabs/miot-harness-client's skills resource.
 */
export async function GET() {
  if (!isModulithConfigured()) {
    return NextResponse.json({ skills: [] });
  }

  const route = await harnessRouteClient();
  if (!route.ok) return route.response;

  try {
    const skills = await route.client.skills.list({ tenant: route.orgSlug });
    return NextResponse.json({ skills });
  } catch (err: unknown) {
    logger.error({ err }, "[harness/skills] failed to fetch skills");
    return NextResponse.json({ skills: [] });
  }
}
