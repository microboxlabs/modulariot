import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export function handleMiotCalendarApiError(
  error: unknown,
  logMessage: string,
  userMessage: string
): NextResponse {
  const status = error instanceof MiotCalendarApiError ? error.status : 500;
  logger.error({ err: error }, logMessage);
  return NextResponse.json({ error: userMessage }, { status });
}

export async function parseJsonBody(
  request: Request
): Promise<{ data: unknown } | { error: NextResponse }> {
  try {
    const data = await request.json();
    return { data };
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}
