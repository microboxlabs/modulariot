import { auth } from "@/auth";
import { getUserStates } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

import { NextResponse } from "next/server";

export async function GET (request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  try {
    console.log("--------------------------------");
    const userStates = await getUserStates(session.user.ticket);
    console.log(userStates);
    return NextResponse.json({ userStates });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get user states" }, { status: 500 });
  }
}
