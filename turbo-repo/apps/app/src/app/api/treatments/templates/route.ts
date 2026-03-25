import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { tryCatch } from "@/utils/tryCatch";
import { getSympthomTemplate } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }
  const { searchParams } = new URL(request.url);
  const serviceCode = searchParams.get("serviceCode");
  const conditionName = searchParams.get("conditionName");
  const icuCode = searchParams.get("icuCode");
  if (!serviceCode || !conditionName || !icuCode) {
    return NextResponse.json({
      status: 400,
    });
  }
  const response = await tryCatch(
    getSympthomTemplate(session, serviceCode, conditionName, icuCode)
  );

  if (response?.error || !response?.data?.success) {
    return NextResponse.json({
      status: 400,
      message: response?.error || "No template found",
    });
  }

  return NextResponse.json({ data: response?.data?.data });
}
