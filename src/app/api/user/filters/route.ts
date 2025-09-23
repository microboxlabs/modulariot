import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPlainTextNode,
  getGroupsForPerson,
  getUserFilters,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
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
        { status: response?.error?.status ?? 500 }
      );
    }

    const groups = response.data.filter((group) => group.includes("MINTRAL_"));
    let content = [];
    for (const group of groups) {
      try {
        const filters = await getUserFilters(session, group);
        let contentFile = null;

        contentFile = await getPlainTextNode(session, filters);

        if (contentFile) {
          content.push(contentFile);
        }
      } catch (error) {
        //ignore 404 error
        continue;
      }
    }

    return NextResponse.json({ data: content });
  } catch (error) {
    return NextResponse.json(
      { error },
      { status: (error as any)?.status ?? 500 }
    );
  }
}
