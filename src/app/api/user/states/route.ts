import { getUserStates } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  try {
    const userStates = await getUserStates(session);
    return NextResponse.json({ userStates });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
