import { AlfrescoApi, WebscriptApi, PeopleApi } from "@alfresco/js-api";

export const alfrescoApi = new AlfrescoApi({
  hostEcm: process.env.ECM_API_URL,
  provider: process.env.AUTH_PROVIDER,
  contextRoot: process.env.CONTEXT_ROOT,
});

export const webscriptApi = new WebscriptApi(alfrescoApi.contentClient);

export const peopleApi = new PeopleApi(alfrescoApi.contentClient);
