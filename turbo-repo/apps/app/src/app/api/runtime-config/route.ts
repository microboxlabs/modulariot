import { NextResponse } from "next/server";
import { RUNTIME_CONFIG_WHITELIST } from "@/features/runtime-config/runtime-config.constants";

export const dynamic = "force-dynamic";

export function GET() {
  const config: Record<string, string> = {};

  for (const [key, envVar] of Object.entries(RUNTIME_CONFIG_WHITELIST)) {
    config[key] = process.env[envVar] ?? "";
  }

  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
