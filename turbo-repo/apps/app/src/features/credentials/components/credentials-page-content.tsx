"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Spinner } from "flowbite-react";
import { HiKey, HiPlus } from "react-icons/hi";
import { toast } from "sonner";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  filterCredentials,
  hasActiveFilters,
  sortCredentials,
  type CredentialFilters,
  type CredentialSort,
} from "../credential-filters";
import {
  BUILT_IN_ENVIRONMENTS,
  mergeEnvironments,
  type CredentialFormData,
  type CredentialListItem,
  type CredentialTestResult,
  type CredentialTypeId,
} from "../credential.types";
import { useCredentials } from "../use-credentials";
import { AzureEntraCredentialModal } from "./azure-entra-credential-modal";
import { CredentialDeleteDialog } from "./credential-delete-dialog";
import { CredentialTypePickerModal } from "./credential-type-picker-modal";
import { CredentialsList } from "./credentials-list";
import { CredentialsToolbar } from "./credentials-toolbar";
import { OAuth2CredentialModal } from "./oauth2-credential-modal";

const ENTRA = "AZURE_ENTRA_CLIENT_CREDENTIALS" as const;
const OAUTH2 = "OAUTH2_CLIENT_CREDENTIALS" as const;

interface CredentialsPageContentProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  /** Root dictionary — the shared filter badges translate from it. */
  readonly rootDict: I18nRecord;
}

/**
 * Settings › Credentials.
 *
 * Reusable credentials configured once and referenced from data sources, integrations
 * and jobs. Azure Entra (client credentials) is the first type.
 *
 * Backed by miot-integrations through the org admin proxy: managing credentials means
 * handling secrets, so the API requires organization-owner access and answers 403 to
 * everyone else — which is what the forbidden state below reflects.
 */
export default function CredentialsPageContent({
  dict,
  rootDict,
}: CredentialsPageContentProps) {
  const credentialsDict = (dict?.credentials as I18nRecord) ?? {};
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const {
    credentials,
    isLoading,
    error,
    actionLoading,
    create,
    update,
    remove,
    test,
    testConfig,
  } = useCredentials(orgSlug);

  // Seeded environments plus any a user already created on another credential,
  // so a new label becomes a first-class option as soon as it's used once.
  const environments = useMemo(
    () =>
      mergeEnvironments(
        BUILT_IN_ENVIRONMENTS,
        credentials.map((credential) => credential.environment)
      ),
    [credentials]
  );

  const [filters, setFilters] = useState<CredentialFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<CredentialSort>(DEFAULT_SORT);
  const types = useMemo(
    () => [...new Set(credentials.map((credential) => credential.typeId))],
    [credentials]
  );

  const visible = useMemo(
    () => sortCredentials(filterCredentials(credentials, filters), sort),
    [credentials, filters, sort]
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  /** Which type's form is showing — set by the picker, or by the row on edit. */
  const [formType, setFormType] = useState<CredentialTypeId>(ENTRA);
  const [editing, setEditing] = useState<CredentialListItem | null>(null);
  const [deleting, setDeleting] = useState<CredentialListItem | null>(null);

  function handleAdd() {
    setEditing(null);
    setPickerOpen(true);
  }

  function handleTypeSelected(typeId: CredentialTypeId) {
    setFormType(typeId);
    setPickerOpen(false);
    setFormOpen(true);
  }

  function handleEdit(credential: CredentialListItem) {
    // Editing opens the form for the type the credential already is; the
    // picker is only ever consulted when creating a new one.
    setFormType(credential.typeId);
    setEditing(credential);
    setFormOpen(true);
  }

  async function handleSubmit(form: CredentialFormData) {
    try {
      if (editing) {
        await update(editing.id, form);
        toast.success(tr("toast.updated", credentialsDict));
      } else {
        await create(formType, form);
        toast.success(tr("toast.created", credentialsDict));
      }
      setFormOpen(false);
      setEditing(null);
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.saveFailed", credentialsDict)));
    }
  }

  /** Deleting from the record: close it first, then confirm. */
  function handleDeleteFromModal(credential: CredentialListItem) {
    setFormOpen(false);
    setEditing(null);
    setDeleting(credential);
  }

  /**
   * Test from inside the record. A saved credential is exercised by id so the outcome
   * lands on its badge; one being created has no id yet, so the form values are sent to
   * the dry run instead.
   */
  async function handleFormTest(
    form: CredentialFormData
  ): Promise<CredentialTestResult> {
    try {
      return editing
        ? await test(editing.id)
        : await testConfig(formType, form);
    } catch (cause) {
      return {
        success: false,
        message: messageOf(cause, tr("toast.testFailed", credentialsDict)),
      };
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    try {
      // The dialog already named every consumer it knew about and the operator
      // confirmed anyway. Without that warning the API's 409 stands, so a list that
      // had gone stale surfaces as an error rather than a silent break.
      await remove(deleting.id, deleting.usedBy.length > 0);
      toast.success(tr("toast.deleted", credentialsDict));
      setDeleting(null);
    } catch (cause) {
      toast.error(messageOf(cause, tr("toast.deleteFailed", credentialsDict)));
    }
  }

  return (
    // Same shell as Settings > Data sources: a full-width sticky breadcrumb bar
    // over a capped, centred content column, so a wide monitor doesn't strand
    // the row actions far from the names they belong to.
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 flex w-full items-center justify-between bg-white p-5 dark:bg-gray-900 dark:text-white">
        <ClientBreadcrumb
          dict={breadcrumbDict}
          path={[
            { label: "user" },
            { label: "settings" },
            { label: "credentials" },
          ]}
        />
      </div>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-2 pb-6 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <HiKey className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {tr("title", credentialsDict)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("description", credentialsDict)}
              </p>
            </div>
          </div>
          <Button color="blue" onClick={handleAdd} disabled={!orgSlug}>
            <HiPlus className="mr-2 h-4 w-4" />
            {tr("addButton", credentialsDict)}
          </Button>
        </div>

        {error && (
          <Alert color="failure">
            <span className="text-sm">
              {isForbidden(error)
                ? tr("errors.forbidden", credentialsDict)
                : tr("errors.loadFailed", credentialsDict)}
            </span>
          </Alert>
        )}

        <CredentialsToolbar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          types={types}
          environments={environments}
          dict={credentialsDict}
          rootDict={rootDict}
        />

        <div>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner aria-label={tr("list.loading", credentialsDict)} />
            </div>
          ) : (
            <CredentialsList
              credentials={visible}
              onOpen={handleEdit}
              onDelete={setDeleting}
              emptyMessage={
                hasActiveFilters(filters)
                  ? tr("filters.noMatches", credentialsDict)
                  : tr("list.empty", credentialsDict)
              }
              dict={credentialsDict}
            />
          )}
        </div>
      </div>

      <CredentialTypePickerModal
        show={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleTypeSelected}
        dict={credentialsDict}
      />

      <AzureEntraCredentialModal
        show={formOpen && formType === ENTRA}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        onTest={handleFormTest}
        onDelete={editing ? () => handleDeleteFromModal(editing) : undefined}
        loading={actionLoading}
        environments={environments}
        dict={credentialsDict}
      />

      <OAuth2CredentialModal
        show={formOpen && formType === OAUTH2}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        onTest={handleFormTest}
        onDelete={editing ? () => handleDeleteFromModal(editing) : undefined}
        loading={actionLoading}
        environments={environments}
        dict={credentialsDict}
      />

      <CredentialDeleteDialog
        credential={deleting}
        show={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDeleteConfirm}
        loading={actionLoading}
        dict={credentialsDict}
      />
    </div>
  );
}

/** The API's own reason when it gave one, so a 400 names the field it rejected. */
function messageOf(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : "";
  return message || fallback;
}

function isForbidden(error: Error): boolean {
  return (error as { status?: number }).status === 403;
}
