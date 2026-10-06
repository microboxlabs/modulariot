import { getUserStates } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { isEcmConfigured } from "@/features/common/providers/alfresco-api/ecm-config";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logError } from "@/lib/logger";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  // Operator states come from Alfresco tasks; without Alfresco there are none.
  if (!isEcmConfigured()) return NextResponse.json({ userStates: [] });
  try {
    const userStates = await getUserStates(session);
    return NextResponse.json({ userStates });
  } catch (error: any) {
    logError(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
