import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserStatus } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { tryCatch } from "@/utils/tryCatch";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  const response = await tryCatch(getUserStatus(session));

  if (response?.error) {
    return NextResponse.json({
      status: 401,
    });
  }

  return NextResponse.json({ response });
}
