import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { toShippingKanban } from "@/features/shipping/services/data.service";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  try {
    const response = await getUserTasks(session.user.ticket);
    const data = await toShippingKanban(response);
    return NextResponse.json({
      total: response.total,
      data,
    });
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
    console.error(e);
    return new NextResponse(null, {
      status: 500,
    });
  }
}
