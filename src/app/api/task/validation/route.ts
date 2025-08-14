import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getValidationByServiceCode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const serviceCode = url.searchParams.get("serviceCode");
  const scope = url.searchParams.get("scope") ?? undefined;
  const scopeId = url.searchParams.get("scopeId") ?? undefined;

  if (!serviceCode) {
    return NextResponse.json(
      { error: "Filter parameter is required" },
      { status: 400 },
    );
  }

  try {
    const tasks = await getValidationByServiceCode(
      session,
      serviceCode,
      scope,
      scopeId,
    );
    return NextResponse.json(tasks);
  } catch (e: any) {
    if (e?.status === 401) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          status: 401,
        },
        {
          status: 401,
        },
      );
    }
    return NextResponse.json(
      {
        error: "An error occurred",
        status: 500,
      },
      {
        status: 500,
      },
    );
  }
}
