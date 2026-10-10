"use client";

import { useState, type FormEvent } from "react";
import { Button, Label, Select, TextInput } from "flowbite-react";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { toast } from "sonner";
import { mutate } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  EMPTY_ORGANIZATION_DRAFT,
  slugFromClientName,
  toOrganizationRequest,
  type OrganizationDraft,
  type OrganizationDraftError,
} from "./create-organization-form";
import {
  createOrganizationWithOwner,
  type CreateOrganizationOutcome,
} from "./create-organization-flow";
import {
  createPlatformOrganization,
  setOrganizationOwners,
} from "./platform-data-service";
import {
  AUTH0_CLIENTS_KEY,
  PLATFORM_ORGANIZATIONS_KEY,
  organizationOwnersKey,
  useUnlinkedAuth0Clients,
} from "./use-platform-organizations";
import type { Auth0Client } from "./platform.types";

interface OrganizationsSectionProps {
  readonly dict: I18nRecord;
  /** Called with the slug once the organization exists and has its owner. */
  readonly onCreated?: (slug: string) => void | Promise<void>;
  /** When set, a Cancel button closes the form. */
  readonly onCancel?: () => void;
}

type Field = keyof OrganizationDraft;

const FIELDS: readonly { field: Field; id: string }[] = [
  { field: "name", id: "platform-org-name" },
  { field: "slug", id: "platform-org-slug" },
  { field: "tenantClientId", id: "platform-org-tenant" },
  { field: "ownerEmail", id: "platform-org-owner" },
];

const CALLS = {
  create: createPlatformOrganization,
  setOwners: setOrganizationOwners,
};

/** The draft with an existing application's client id, and a name and slug taken from it where empty. */
function withClient(
  draft: OrganizationDraft,
  client: Auth0Client | undefined
): OrganizationDraft {
  if (!client) return { ...draft, tenantClientId: "" };
  return {
    ...draft,
    tenantClientId: client.clientId,
    name: draft.name || (client.name?.split(":").pop() ?? ""),
    slug: draft.slug || slugFromClientName(client.name),
  };
}

function withDetail(message: string, detail: string | null): string {
  return detail ? `${message} (${detail})` : message;
}

function reportFailure(
  outcome: Exclude<CreateOrganizationOutcome, { kind: "created" }>,
  dict: I18nRecord
): void {
  if (outcome.kind === "slugTaken") {
    toast.error(
      withDetail(trDynamic("errors.slugTaken", dict), outcome.detail)
    );
  } else if (outcome.kind === "ownerFailed") {
    toast.error(withDetail(tr("ownerError", dict), outcome.detail));
  } else {
    toast.error(withDetail(tr("createError", dict), outcome.detail));
  }
}

/**
 * Creates a top-level organization with native membership and names its first
 * owner. The owner can then invite everyone else from Settings › Team.
 */
export default function OrganizationsSection({
  dict,
  onCreated,
  onCancel,
}: Readonly<OrganizationsSectionProps>) {
  const [draft, setDraft] = useState<OrganizationDraft>(
    EMPTY_ORGANIZATION_DRAFT
  );
  const [problem, setProblem] = useState<OrganizationDraftError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Slug of an organization created by an earlier attempt whose owner failed.
  const [ownerPendingFor, setOwnerPendingFor] = useState<string | null>(null);
  const unlinked = useUnlinkedAuth0Clients();

  const pickClient = (clientId: string) => {
    const client = unlinked.find((c) => c.clientId === clientId);
    setDraft((current) => withClient(current, client));
    setProblem(null);
  };

  const changeField = (field: Field, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setProblem(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = toOrganizationRequest(draft);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setIsSaving(true);
    const { organization, ownerEmail } = result.value;
    const outcome = await createOrganizationWithOwner(
      organization,
      ownerEmail,
      ownerPendingFor,
      CALLS
    );
    setIsSaving(false);
    if (outcome.kind === "created" || outcome.kind === "ownerFailed") {
      void mutate(PLATFORM_ORGANIZATIONS_KEY);
      void mutate(AUTH0_CLIENTS_KEY);
    }
    if (outcome.kind === "created") {
      toast.success(tr("created", dict, { slug: organization.slug }));
      void mutate(organizationOwnersKey(organization.slug));
      setDraft(EMPTY_ORGANIZATION_DRAFT);
      setOwnerPendingFor(null);
      void onCreated?.(organization.slug);
      return;
    }
    if (outcome.kind === "ownerFailed") setOwnerPendingFor(organization.slug);
    reportFailure(outcome, dict);
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <HiOutlineOfficeBuilding className="h-5 w-5 text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {tr("title", dict)}
        </h2>
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      <form onSubmit={(event) => void submit(event)}>
        {unlinked.length > 0 && (
          <div className="mt-4">
            <Label htmlFor="platform-org-application">
              {tr("application", dict)}
            </Label>
            <Select
              id="platform-org-application"
              value={
                unlinked.some((c) => c.clientId === draft.tenantClientId)
                  ? draft.tenantClientId
                  : ""
              }
              disabled={ownerPendingFor !== null}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="">{tr("applicationNew", dict)}</option>
              {unlinked.map((client) => (
                <option key={client.clientId} value={client.clientId}>
                  {client.name ?? client.clientId} ({client.clientId})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {tr("applicationHint", dict)}
            </p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {FIELDS.map(({ field, id }) => (
            <div key={field}>
              <Label htmlFor={id}>{trDynamic(`fields.${field}`, dict)}</Label>
              <TextInput
                id={id}
                value={draft[field]}
                disabled={ownerPendingFor !== null && field !== "ownerEmail"}
                onChange={(e) => changeField(field, e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {trDynamic(`hints.${field}`, dict)}
              </p>
            </div>
          ))}
        </div>

        {problem && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {trDynamic(`errors.${problem}`, dict)}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {onCancel && (
            <Button size="sm" color="alternative" onClick={onCancel}>
              {tr("cancel", dict)}
            </Button>
          )}
          <Button type="submit" size="sm" color="blue" disabled={isSaving}>
            {isSaving ? tr("creating", dict) : tr("create", dict)}
          </Button>
        </div>
      </form>
    </section>
  );
}
