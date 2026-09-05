"use client";

import { ApiError } from "../data/json-client";
import {
  formToCreateBody,
  formToUpdateBody,
  type GpsWebhookFormData,
  type GpsWebhookSubscription,
  type GpsWebhookTestResult,
} from "./gps-webhook.types";

const base = (orgSlug: string) =>
  `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations/gps-webhooks`;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError({ status: res.status, url });
  }
  return (await res.json()) as T;
}

async function mutateJson<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message: string | undefined;
    try {
      const parsed = (await res.json()) as {
        message?: string;
        error?: string | { message?: string };
      };
      message =
        parsed.message ??
        (typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message);
    } catch {
      // non-JSON error body
    }
    throw new ApiError({ status: res.status, url, message });
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function fetchGpsWebhooks(
  orgSlug: string,
): Promise<GpsWebhookSubscription[]> {
  return getJson<GpsWebhookSubscription[]>(base(orgSlug));
}

export async function createGpsWebhook(
  orgSlug: string,
  form: GpsWebhookFormData,
): Promise<GpsWebhookSubscription> {
  return mutateJson<GpsWebhookSubscription>(
    "POST",
    base(orgSlug),
    formToCreateBody(form),
  );
}

export async function updateGpsWebhook(
  orgSlug: string,
  subscriptionId: string,
  form: GpsWebhookFormData,
): Promise<GpsWebhookSubscription> {
  return mutateJson<GpsWebhookSubscription>(
    "PATCH",
    `${base(orgSlug)}/${encodeURIComponent(subscriptionId)}`,
    formToUpdateBody(form),
  );
}

export async function deleteGpsWebhook(
  orgSlug: string,
  subscriptionId: string,
): Promise<void> {
  await mutateJson<void>(
    "DELETE",
    `${base(orgSlug)}/${encodeURIComponent(subscriptionId)}`,
  );
}

export async function testGpsWebhook(
  orgSlug: string,
  subscriptionId: string,
): Promise<GpsWebhookTestResult> {
  return mutateJson<GpsWebhookTestResult>(
    "POST",
    `${base(orgSlug)}/${encodeURIComponent(subscriptionId)}/test`,
    {},
  );
}
