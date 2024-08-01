import { AlfrescoApi, PeopleApi } from "@alfresco/js-api";

export const alfrescoApi = new AlfrescoApi({
  hostEcm: process.env.ECM_API_URL,
  provider: process.env.AUTH_PROVIDER,
  contextRoot: process.env.CONTEXT_ROOT,
});

export async function getBase64UserAvatar(
  ticket: string,
  userId = "-me-",
): Promise<string> {
  alfrescoApi.setTicket(ticket, "");
  const peopleApi = new PeopleApi(alfrescoApi.contentClient);
  const blob = await peopleApi.getAvatarImage(userId, {
    placeholder: true,
    attachment: true,
  });

  const buffer = Buffer.from(await new Response(blob).arrayBuffer());
  return "data:image/png;base64," + buffer.toString("base64");
}

// export const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);

// export const peopleApi = new PeopleApi(alfrescoApi.contentClient);
