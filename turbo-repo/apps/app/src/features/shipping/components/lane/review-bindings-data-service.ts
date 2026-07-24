import type {
  BindingPreview,
  DispatchTarget,
  EventBinding,
  UpsertBindingRequest,
} from "./review-binding.types";

/**
 * Talks to the org-admin proxy in front of miot-integrations.
 *
 * Every route requires organization-owner access — a binding decides which external
 * system receives a verdict and under which credential — so a 403 here is a real
 * answer the UI must render, not a bug.
 */

function base(orgSlug: string): string {
  return `/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations`;
}

/** Surfaces the API's own message, and keeps the status for the 403 case. */
async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body; the status line is all we have.
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function fetchDispatchTargets(orgSlug: string): Promise<DispatchTarget[]> {
  const response = await fetch(`${base(orgSlug)}/dispatch-targets`, {
    headers: { Accept: "application/json" },
  });
  return unwrap<DispatchTarget[]>(response);
}

export async function fetchBindings(orgSlug: string): Promise<EventBinding[]> {
  const response = await fetch(`${base(orgSlug)}/bindings`, {
    headers: { Accept: "application/json" },
  });
  return unwrap<EventBinding[]>(response);
}

export async function upsertBinding(
  orgSlug: string,
  request: UpsertBindingRequest
): Promise<EventBinding> {
  const response = await fetch(`${base(orgSlug)}/bindings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return unwrap<EventBinding>(response);
}

export async function deleteBinding(orgSlug: string, bindingId: string): Promise<void> {
  const response = await fetch(
    `${base(orgSlug)}/bindings/${encodeURIComponent(bindingId)}`,
    { method: "DELETE" }
  );
  await unwrap<void>(response);
}

/**
 * Renders a candidate mapping with the engine that will actually send it.
 *
 * The drawer previews locally with Handlebars for instant feedback; this is the
 * authority, and the two agreeing is the point — the server refuses to store a
 * template it would render differently.
 */
export async function previewBinding(
  orgSlug: string,
  binding: UpsertBindingRequest,
  context: Record<string, unknown>
): Promise<BindingPreview> {
  const response = await fetch(`${base(orgSlug)}/bindings/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ binding, context }),
  });
  return unwrap<BindingPreview>(response);
}
