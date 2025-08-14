import { auth } from "@/auth";
import { getServiceValidation } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  const serviceCode = req.nextUrl.searchParams.get("serviceCode");
  if (!serviceCode || serviceCode.trim() === "") {
    return NextResponse.json({
      error: "Service code is required",
      status: 400,
    });
  }
  try {
    const taskResponses = await getServiceValidation(session, serviceCode);
    return NextResponse.json(taskResponses);
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    return NextResponse.json({
      totals: {},
    });
  }
}
