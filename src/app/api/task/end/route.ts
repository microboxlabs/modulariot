import { auth } from "@/auth";
import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const json = await request.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const taskId = json.taskId as string;
  const response = await endTask(session.user.ticket, taskId);
  return NextResponse.json({
    success: true,
    status: 200,
    ...response,
  });
}
