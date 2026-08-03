import {
  ENRICHMENT_EVENT_TYPE,
  type EnrichmentBinding,
  type EnrichmentTarget,
  type UpsertEnrichmentBinding,
} from "./enrichment.types";

// Served under basePath "/app"; fetch() is not auto-prefixed the way <Link> is.
function base(orgSlug: string): string {
  return `/app/api/admin/orgs/${encodeURIComponent(orgSlug)}/integrations`;
}

async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** The org's enrichment bindings — same /bindings feed, narrowed to the event. */
export async function fetchEnrichmentBindings(
  orgSlug: string
): Promise<EnrichmentBinding[]> {
  const response = await fetch(`${base(orgSlug)}/bindings`, {
    headers: { Accept: "application/json" },
  });
  const all = await unwrap<EnrichmentBinding[]>(response);
  return all.filter((binding) => binding.eventType === ENRICHMENT_EVENT_TYPE);
}

export async function fetchEnrichmentTargets(
  orgSlug: string
): Promise<EnrichmentTarget[]> {
  const response = await fetch(`${base(orgSlug)}/dispatch-targets`, {
    headers: { Accept: "application/json" },
  });
  const targets = await unwrap<EnrichmentTarget[]>(response);
  // A fetch needs an operation to call; operationless channels (WhatsApp)
  // cannot answer one.
  return targets.filter((target) => Boolean(target.operationId));
}

export async function upsertEnrichmentBinding(
  orgSlug: string,
  request: UpsertEnrichmentBinding
): Promise<EnrichmentBinding> {
  const response = await fetch(`${base(orgSlug)}/bindings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return unwrap<EnrichmentBinding>(response);
}

export async function deleteEnrichmentBinding(
  orgSlug: string,
  bindingId: string
): Promise<void> {
  const response = await fetch(
    `${base(orgSlug)}/bindings/${encodeURIComponent(bindingId)}`,
    { method: "DELETE" }
  );
  await unwrap<void>(response);
}
