import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getChildrenNodes } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({
      error: "Node ID is required",
      status: 400,
    });
  }

  try {
    const taskResponses = await getChildrenNodes(session.user.ticket, nodeId, {
      where: "(isFile=true)",
      include: ["properties"],
    });

    return NextResponse.json({
      data: taskResponses,
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
        },
      );
    }
    return NextResponse.json({
      data: [],
    });
  }
}
