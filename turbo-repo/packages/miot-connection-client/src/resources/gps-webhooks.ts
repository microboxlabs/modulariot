import type { Fetcher } from "../client.js";
import type {
  CreateGpsWebhookRequest,
  GpsWebhookResponse,
  GpsWebhookTestResponse,
  UpdateGpsWebhookRequest,
  WebhookDeliveryResponse,
} from "../types.js";

export function createGpsWebhooksApi(fetcher: Fetcher, organizationId: string) {
  const BASE = `/api/v1/orgs/${organizationId}/integrations/gps-webhooks`;

  return {
    list(): Promise<GpsWebhookResponse[]> {
      return fetcher("GET", BASE);
    },

    get(subscriptionId: string): Promise<GpsWebhookResponse> {
      return fetcher("GET", `${BASE}/${subscriptionId}`);
    },

    create(body: CreateGpsWebhookRequest): Promise<GpsWebhookResponse> {
      return fetcher("POST", BASE, { body });
    },

    update(
      subscriptionId: string,
      body: UpdateGpsWebhookRequest,
    ): Promise<GpsWebhookResponse> {
      return fetcher("PATCH", `${BASE}/${subscriptionId}`, { body });
    },

    delete(subscriptionId: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${subscriptionId}`);
    },

    test(subscriptionId: string): Promise<GpsWebhookTestResponse> {
      return fetcher("POST", `${BASE}/${subscriptionId}/test`, { body: {} });
    },

    listDeliveries(
      subscriptionId: string,
      limit = 50,
    ): Promise<WebhookDeliveryResponse[]> {
      return fetcher("GET", `${BASE}/${subscriptionId}/deliveries`, {
        query: { limit },
      });
    },

    recompileFilters(subscriptionId: string): Promise<GpsWebhookResponse> {
      return fetcher("POST", `${BASE}/${subscriptionId}/recompile-filters`, {
        body: {},
      });
    },
  };
}
