import type { AlfrescoDataSource } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export function buildMaskedResponse(ds: AlfrescoDataSource) {
  const authMethod = ds.config?.authMethod || "TOKEN";
  let authFields: Record<string, unknown>;

  if (ds.config?.authMethod === "OAUTH") {
    authFields = {
      clientId: ds.config.clientId,
      maskedClientSecret: ds.config.clientSecretSuffix?.length === 4
        ? `****${ds.config.clientSecretSuffix}`
        : "****",
      tokenUrl: ds.config.tokenUrl,
      scope: ds.config.scope,
      audience: ds.config.audience,
      ...(ds.config.tokenRequestFormat ? { tokenRequestFormat: ds.config.tokenRequestFormat } : {}),
    };
  } else {
    const tokenSuffix = ds.config?.authMethod === "TOKEN" ? ds.config.tokenSuffix : undefined;
    authFields = {
      maskedToken: tokenSuffix?.length === 4
        ? `****${tokenSuffix}`
        : "****",
    };
  }

  return {
    id: ds.nodeRef,
    name: ds.name,
    type: ds.type,
    description: ds.description,
    siteId: ds.site,
    authMethod,
    connectionConfig: {
      url: ds.url,
      ...authFields,
    },
    isActive: ds.isActive,
    lastTestedAt: ds.lastTestedAt,
    lastTestResult: ds.lastTestResult,
  };
}
