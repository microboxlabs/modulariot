import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { TOTEM_DIAGNOSTIC_EVENTS } from "@/features/totem/diagnostics/totem-diagnostics";

const MAX_BODY_BYTES = 4096;

const diagnosticSchema = z.object({
  event: z.enum(TOTEM_DIAGNOSTIC_EVENTS),
  sessionId: z.string().max(16),
  deviceId: z.string().max(64),
  deviceLocation: z.string().max(64),
  at: z.string().max(40),
  rut: z.string().max(16).optional(),
  step: z.number().int().min(0).max(10).optional(),
  durationMs: z.number().int().min(0).optional(),
  code: z.string().max(64).optional(),
  status: z.number().int().optional(),
  erc: z.number().int().optional(),
  message: z.string().max(300).optional(),
});

export type TotemDiagnostic = z.infer<typeof diagnosticSchema>;

const totemLogger = createLogger("totem");

/** Unauthenticated on purpose: the totem page itself is public. The schema and size cap bound what it accepts. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = diagnosticSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid diagnostic" }, { status: 400 });
  }

  const record = parsed.data;
  const fields = {
    ...record,
    source: "browser",
    remoteAddr: request.headers.get("x-forwarded-for") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
  const isFailure =
    record.event.endsWith(".error") || record.event.endsWith(".failed");
  if (isFailure) {
    totemLogger.warn(fields, `totem ${record.event}`);
  } else {
    totemLogger.info(fields, `totem ${record.event}`);
  }

  return new NextResponse(null, { status: 204 });
}
