import { isPlausibleEmail } from "./assignee-email";
import type { CreatePlatformOrganization } from "./platform.types";

/** The form as typed. */
export interface OrganizationDraft {
  slug: string;
  name: string;
  tenantClientId: string;
  ownerEmail: string;
}

/** Keys under `organizations.errors` in the dictionary. */
export type OrganizationDraftError =
  | "slug"
  | "name"
  | "tenantClientId"
  | "ownerEmail";

export type OrganizationDraftResult =
  | {
      ok: true;
      value: { organization: CreatePlatformOrganization; ownerEmail: string };
    }
  | { ok: false; error: OrganizationDraftError };

/** `PlatformOrganizationsResource.SLUG`. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

/** `organizations.name` and `tenant_client_id` are VARCHAR(255). */
const MAX_LENGTH = 255;

function fits(value: string): boolean {
  return value !== "" && value.length <= MAX_LENGTH;
}

export const EMPTY_ORGANIZATION_DRAFT: OrganizationDraft = {
  slug: "",
  name: "",
  tenantClientId: "",
  ownerEmail: "",
};

/** The request bodies for a draft, or the first problem with it. */
export function toOrganizationRequest(
  draft: OrganizationDraft
): OrganizationDraftResult {
  const name = draft.name.trim();
  if (!fits(name)) return { ok: false, error: "name" };
  const slug = draft.slug.trim();
  if (!SLUG.test(slug)) return { ok: false, error: "slug" };
  const tenantClientId = draft.tenantClientId.trim();
  if (!fits(tenantClientId)) return { ok: false, error: "tenantClientId" };
  const ownerEmail = draft.ownerEmail.trim().toLowerCase();
  if (!isPlausibleEmail(ownerEmail)) return { ok: false, error: "ownerEmail" };
  return {
    ok: true,
    value: {
      organization: { slug, name, tenantClientId, membershipSource: "NATIVE" },
      ownerEmail,
    },
  };
}
