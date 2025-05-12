import { auth } from "@/auth";
import { getTaskHistory } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

/*
  We get the historial of a task
    we get the taskid from the url
    we get the session
    we call the alfresco api to get the historial of the task
    we return the historial
*/

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    const taskHistory = await getTaskHistory(session.user.ticket, taskId);

    return NextResponse.json(taskHistory);
  } catch (error: any) {
    console.error(error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
