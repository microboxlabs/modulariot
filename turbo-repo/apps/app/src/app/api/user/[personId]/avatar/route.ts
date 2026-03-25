import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBase64UserAvatar } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  const avatar = await getBase64UserAvatar(session);
  const headers = new Headers();
  headers.set("Content-Type", "image/png;charset=UTF-8");
  return new NextResponse(avatar, {
    status: 200,
    headers,
  });
}
