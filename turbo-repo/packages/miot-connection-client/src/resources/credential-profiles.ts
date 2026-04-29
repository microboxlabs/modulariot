import type { Fetcher } from "../client.js";
import type {
  CreateCredentialProfileRequest,
  CredentialProfileResponse,
} from "../types.js";

export function createCredentialProfilesApi(
  fetcher: Fetcher,
  organizationId: string,
) {
  const BASE = `/api/v1/orgs/${organizationId}/integrations/credential-profiles`;

  return {
    list(): Promise<CredentialProfileResponse[]> {
      return fetcher("GET", BASE);
    },

    create(
      body: CreateCredentialProfileRequest,
    ): Promise<CredentialProfileResponse> {
      return fetcher("POST", BASE, { body });
    },
  };
}
