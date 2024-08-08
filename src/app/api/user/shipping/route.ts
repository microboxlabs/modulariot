import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result = await getUserTasks(session.user.ticket);
  return NextResponse.json(result);
}
