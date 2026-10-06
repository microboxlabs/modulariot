"use client";

import { useState, type FormEvent } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { toast } from "sonner";
import { mutate } from "swr";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  EMPTY_ORGANIZATION_DRAFT,
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
import { PLATFORM_ORGANIZATIONS_KEY } from "./use-platform-organizations";

interface OrganizationsSectionProps {
  readonly dict: I18nRecord;
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

function withDetail(message: string, detail: string | null): string {
  return detail ? `${message} (${detail})` : message;
}

function reportFailure(
  outcome: Exclude<CreateOrganizationOutcome, { kind: "created" }>,
  dict: I18nRecord
): void {
  if (outcome.kind === "slugTaken") {
    toast.error(trDynamic("errors.slugTaken", dict));
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
}: Readonly<OrganizationsSectionProps>) {
  const [draft, setDraft] = useState<OrganizationDraft>(
    EMPTY_ORGANIZATION_DRAFT
  );
  const [problem, setProblem] = useState<OrganizationDraftError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Slug of an organization created by an earlier attempt whose owner failed.
  const [ownerPendingFor, setOwnerPendingFor] = useState<string | null>(null);

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
    if (outcome.kind === "created") {
      toast.success(tr("created", dict, { slug: organization.slug }));
      void mutate(PLATFORM_ORGANIZATIONS_KEY);
      setDraft(EMPTY_ORGANIZATION_DRAFT);
      setOwnerPendingFor(null);
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

        <div className="mt-4 flex justify-end">
          <Button type="submit" size="sm" color="blue" disabled={isSaving}>
            {isSaving ? tr("creating", dict) : tr("create", dict)}
          </Button>
        </div>
      </form>
    </section>
  );
}
