import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  alfrescoApi,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { tryCatch } from "@/utils/tryCatch";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let token = url.searchParams.get("token");
    console.log("token", token);

    if (!token) {
      const session = await auth();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      token = session.user.ticket;
    }

    alfrescoApi.setTicket(token, "");
    const response = await tryCatch(getGroupsForPerson(token));

    if (response?.error) {
      return NextResponse.json({ error: "Failed to fetch groups" }, { status: 401 });
    }

    return NextResponse.json({ data: response.data });
  } catch (error) {
    console.error("Error in groups endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
