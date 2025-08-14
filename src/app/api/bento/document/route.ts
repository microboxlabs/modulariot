import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getContentNode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const nodeIds = url.searchParams.get("nodeIds");

  if (!nodeIds) {
    return NextResponse.json({
      error: "Node ID is required",
      status: 400,
    });
  }

  try {
    const nodeIdsArray = nodeIds.split(",");
    const responses = await Promise.all(
      nodeIdsArray.map(async (nodeId) => {
        try {
          const result = await getContentNode(session, nodeId);
          return result;
        } catch (nodeError: any) {
          return {
            error: `Failed to fetch node ${nodeId}`,
            details: nodeError.message,
          };
        }
      }),
    );

    return NextResponse.json({
      data: responses,
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
