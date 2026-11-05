import { getBiometricVerification } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { describeError } from "@/features/common/providers/fetcher-error";
import { maskRut } from "@/features/totem/diagnostics/totem-diagnostics";
import { createLogger } from "@/lib/logger";
import { generateRequestId } from "@/features/common/utils/access-log";
import { NextRequest, NextResponse } from "next/server";

const totemLogger = createLogger("totem");

function upstreamText(info: unknown): string | null {
  if (typeof info === "string") return info;
  const responseText = (info as { responseText?: unknown })?.responseText;
  return typeof responseText === "string" ? responseText : null;
}

function upstreamBody(error: unknown): Record<string, unknown> | null {
  const text = upstreamText((error as { info?: unknown })?.info);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? generateRequestId();
  const startedAt = Date.now();
  let rut = "";
  try {
    const data = await request.json();
    rut = maskRut(typeof data?.driverId === "string" ? data.driverId : "");
    const result = await getBiometricVerification(data);
    totemLogger.info(
      {
        requestId,
        rut,
        deviceId: data?.deviceId,
        deviceLocation: data?.deviceLocation,
        durationMs: Date.now() - startedAt,
      },
      "biometric verify ok"
    );
    return NextResponse.json(result);
  } catch (error) {
    const described = describeError(error);
    totemLogger.error(
      { requestId, rut, durationMs: Date.now() - startedAt, ...described, err: error as Error },
      "biometric verify failed"
    );
    const body = upstreamBody(error) ?? {
      success: false,
      message: described.message,
      code: described.code,
    };
    return NextResponse.json(
      { ...body, requestId },
      { status: described.status || 500 }
    );
  }
}
