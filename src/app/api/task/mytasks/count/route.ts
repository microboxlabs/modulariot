import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getCountTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  try {
    const taskResponses = await getCountTask(session);
    return NextResponse.json({
      totals: taskResponses.totals,
    });
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
        }
      );
    }
    return NextResponse.json({
      totals: {},
    });
  }
}
