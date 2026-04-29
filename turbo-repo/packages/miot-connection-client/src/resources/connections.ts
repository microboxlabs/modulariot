import type { Fetcher } from "../client.js";
import type {
  ConnectionTestRequest,
  ConnectionTestResponse,
  CreateIntegrationConnectionRequest,
  CreateIntegrationOperationRequest,
  IntegrationConnection,
  IntegrationOperation,
} from "../types.js";

export function createConnectionsApi(fetcher: Fetcher, organizationId: string) {
  const BASE = `/api/v1/orgs/${organizationId}/integrations/connections`;

  return {
    list(): Promise<IntegrationConnection[]> {
      return fetcher("GET", BASE);
    },

    get(connectionId: string): Promise<IntegrationConnection> {
      return fetcher("GET", `${BASE}/${connectionId}`);
    },

    create(
      body: CreateIntegrationConnectionRequest,
    ): Promise<IntegrationConnection> {
      return fetcher("POST", BASE, { body });
    },

    test(
      connectionId: string,
      body: ConnectionTestRequest = {},
    ): Promise<ConnectionTestResponse> {
      return fetcher("POST", `${BASE}/${connectionId}/test`, { body });
    },

    listOperations(connectionId: string): Promise<IntegrationOperation[]> {
      return fetcher("GET", `${BASE}/${connectionId}/operations`);
    },

    createOperation(
      connectionId: string,
      body: CreateIntegrationOperationRequest,
    ): Promise<IntegrationOperation> {
      return fetcher("POST", `${BASE}/${connectionId}/operations`, { body });
    },
  };
}
