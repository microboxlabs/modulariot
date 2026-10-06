"use client";

import { useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import {
  EMPTY_ORGANIZATION_DRAFT,
  toOrganizationRequest,
  type OrganizationDraft,
  type OrganizationDraftError,
} from "./create-organization-form";
import {
  createPlatformOrganization,
  setOrganizationOwners,
} from "./platform-data-service";

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

/**
 * Creates a top-level organization with native membership and names its first
 * owner. The owner can then invite everyone else from Settings › Team.
 */
export default function OrganizationsSection({
  dict,
}: OrganizationsSectionProps) {
  const [draft, setDraft] = useState<OrganizationDraft>(
    EMPTY_ORGANIZATION_DRAFT
  );
  const [problem, setProblem] = useState<OrganizationDraftError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    const result = toOrganizationRequest(draft);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    setIsSaving(true);
    const { organization, ownerEmail } = result.value;
    let created = false;
    try {
      await createPlatformOrganization(organization);
      created = true;
      await setOrganizationOwners(organization.slug, [ownerEmail]);
      toast.success(tr("created", dict, { slug: organization.slug }));
      setDraft(EMPTY_ORGANIZATION_DRAFT);
    } catch (err) {
      if (created) {
        toast.error(tr("ownerError", dict));
      } else {
        toast.error(
          err instanceof ApiError ? err.message : tr("createError", dict)
        );
      }
    } finally {
      setIsSaving(false);
    }
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

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {FIELDS.map(({ field, id }) => (
          <div key={field}>
            <Label htmlFor={id}>{trDynamic(`fields.${field}`, dict)}</Label>
            <TextInput
              id={id}
              value={draft[field]}
              onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
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
        <Button
          size="sm"
          color="blue"
          disabled={isSaving}
          onClick={() => void submit()}
        >
          {isSaving ? tr("creating", dict) : tr("create", dict)}
        </Button>
      </div>
    </section>
  );
}
