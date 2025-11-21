import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getStatisticsTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { StatisticsMode } from "@/features/common/providers/alfresco-api/alfresco-api.types";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
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

  try {
    const searchParams = request.nextUrl.searchParams;
    const mode =
      (searchParams.get("mode") as StatisticsMode) || "running_tasks";

    const statisticsResponse = await getStatisticsTasks(session, mode);
    return NextResponse.json({
      totals: statisticsResponse.totals,
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
