import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { tryCatch } from "@/utils/tryCatch";
import { getSympthomTemplate } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { SympthomTemplateResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";

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
  // Without the ECM there are no templates: the form starts empty.
  if (!process.env.ECM_API_URL) {
    const empty: SympthomTemplateResponse = {
      data: { icuCode, name: "", conditionName, message: "" },
      success: false,
    };
    return NextResponse.json(empty);
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
