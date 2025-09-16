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
    let content = "";
    for (const group of groups) {
      const filters = await getUserFilters(session, group);
      const contentFile = await getPlainTextNode(session, filters).catch(() => {
        return null;
      });
      if (contentFile) {
        content = contentFile;
        break;
      } else {
        return NextResponse.json({ data: null });
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
