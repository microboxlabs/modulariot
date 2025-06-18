import { auth } from "@/auth";
import {
  alfrescoApi,
  getBiometricVerification,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.next({
        status: 401,
      });
    }
    alfrescoApi.setTicket(session.user.ticket, "");
    const data = await request.json();

    const result = await getBiometricVerification(session.user.ticket, data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
