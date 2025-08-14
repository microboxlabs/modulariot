import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { tryCatch } from "@/utils/tryCatch";

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await tryCatch(getGroupsForPerson(session));

    if (response?.error) {
      return NextResponse.json(
        { error: "Failed to fetch groups" },
        //@ts-ignore
        { status: response?.error?.status ?? 500 },
      );
    }

    return NextResponse.json({ data: response.data });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
