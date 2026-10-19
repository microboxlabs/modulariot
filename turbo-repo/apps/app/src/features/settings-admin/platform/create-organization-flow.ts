import { ApiError } from "../data/json-client";
import type { CreatePlatformOrganization } from "./platform.types";

export interface CreateOrganizationCalls {
  create: (value: CreatePlatformOrganization) => Promise<unknown>;
  setOwners: (slug: string, assigneeIds: string[]) => Promise<void>;
}

export type CreateOrganizationOutcome =
  | { kind: "created" }
  | { kind: "slugTaken"; detail: string | null }
  | { kind: "createFailed"; detail: string | null }
  | { kind: "ownerFailed"; detail: string | null };

function detailOf(err: unknown): string | null {
  return err instanceof ApiError ? err.message : null;
}

/**
 * Creates the organization, then names its owner. The two calls are separate,
 * so when `ownerPendingFor` names the slug of an organization already created
 * by an earlier attempt, only the owner step runs again.
 */
export async function createOrganizationWithOwner(
  organization: CreatePlatformOrganization,
  ownerEmail: string,
  ownerPendingFor: string | null,
  calls: CreateOrganizationCalls
): Promise<CreateOrganizationOutcome> {
  if (ownerPendingFor !== organization.slug) {
    try {
      await calls.create(organization);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return { kind: "slugTaken", detail: detailOf(err) };
      }
      return { kind: "createFailed", detail: detailOf(err) };
    }
  }
  try {
    await calls.setOwners(organization.slug, [ownerEmail]);
  } catch (err) {
    return { kind: "ownerFailed", detail: detailOf(err) };
  }
  return { kind: "created" };
}
