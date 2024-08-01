import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { alfrescoApi } from "@/features/common/providers/alfresco-api.provider";
import { PeopleApi } from "@alfresco/js-api";

export async function GET(_request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  alfrescoApi.setTicket(session.user.ticket, "");
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  const blob = await peopleApi.getAvatarImage("-me-", {
    placeholder: true,
    attachment: true,
  });
  const headers = new Headers();
  headers.set("Content-Type", "image/png;charset=UTF-8");
  return new NextResponse(blob, {
    status: 200,
    headers,
  });
}
