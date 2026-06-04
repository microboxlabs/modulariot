"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Select, ToggleSwitch } from "flowbite-react";
import {
  HiOutlineTrash,
  HiOutlineUserGroup,
  HiOutlineUser,
} from "react-icons/hi2";
import useSWR from "swr";
import FormModal from "@/features/common/components/form-modal/form-modal";
import fetcher from "@/features/common/providers/fetcher";
import type { FetcherError } from "@/features/common/providers/fetcher.types";
import { ShowNotification } from "@/features/notifications/notification";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type {
  AlfrescoNodePermissions,
  AlfrescoPermissionEntry,
  AuthoritySuggestion,
  NodePermissionsUpdate,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import {
  DASHBOARD_ROLES,
  isDashboardRole,
  type DashboardPermissionsResponse,
  type DashboardRole,
} from "@/features/dashboard/types/permissions.types";
import { AuthorityAutocomplete } from "./authority-autocomplete";

interface DashboardPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: string;
  slug: string;
  dashboardName: string;
  dictionary: I18nRecord;
}

const ROLE_LABEL_KEYS: Record<DashboardRole, string> = {
  Consumer: "dashboard.permissions.roleConsumer",
  Contributor: "dashboard.permissions.roleContributor",
  Editor: "dashboard.permissions.roleEditor",
  Coordinator: "dashboard.permissions.roleCoordinator",
};

// The four site-role groups that every dashboard inherits by default. They
// add no signal to the UI (same on every dashboard in the site), so they get
// collapsed into a count and any inherited entry outside this set is surfaced.
const SITE_ROLE_GROUP_SUFFIXES = new Set([
  "SiteConsumer",
  "SiteCollaborator",
  "SiteContributor",
  "SiteManager",
]);

function isDefaultSiteGroup(
  entry: AlfrescoPermissionEntry,
  site: string
): boolean {
  if (entry.accessStatus !== "ALLOWED") return false;
  const prefix = `GROUP_site_${site}_`;
  if (!entry.authorityId.startsWith(prefix)) return false;
  const suffix = entry.authorityId.slice(prefix.length);
  if (!SITE_ROLE_GROUP_SUFFIXES.has(suffix)) return false;
  // Alfresco's default ACL grants each site-role group the role whose name
  // matches the suffix (SiteManager → SiteManager, etc.). Any mismatch is an
  // atypical entry worth surfacing instead of collapsing.
  return entry.name === suffix;
}

function fallbackRole(name: string): DashboardRole {
  return isDashboardRole(name) ? name : "Consumer";
}

function entryKey(entry: AlfrescoPermissionEntry) {
  return `${entry.authorityId}::${entry.name}`;
}

export function DashboardPermissionsModal({
  isOpen,
  onClose,
  site,
  slug,
  dashboardName,
  dictionary,
}: Readonly<DashboardPermissionsModalProps>) {
  const t = useCallback(
    (key: string, params?: Record<string, string>) =>
      tr(`dashboard.permissions.${key}`, dictionary, params),
    [dictionary]
  );

  const swrKey = isOpen
    ? `/app/api/dashboard/${encodeURIComponent(site)}/${encodeURIComponent(slug)}/permissions`
    : null;

  const { data, error, isLoading, mutate } = useSWR<
    DashboardPermissionsResponse,
    FetcherError
  >(swrKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const [isInheritanceEnabled, setIsInheritanceEnabled] = useState(true);
  const [localEntries, setLocalEntries] = useState<AlfrescoPermissionEntry[]>(
    []
  );
  const [activeTab, setActiveTab] = useState<"user" | "group">("user");
  const [pendingRole, setPendingRole] = useState<DashboardRole>("Consumer");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setIsInheritanceEnabled(data.permissions.isInheritanceEnabled);
    setLocalEntries(data.permissions.locallySet ?? []);
  }, [data]);

  // Reset local UI state when the modal closes so re-opening starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("user");
      setPendingRole("Consumer");
      setSaving(false);
    }
  }, [isOpen]);

  const inheritedEntries = useMemo(
    () => data?.permissions.inherited ?? [],
    [data]
  );

  const { inheritedAtypical, inheritedDefaultCount } = useMemo(() => {
    let defaultCount = 0;
    const atypical: AlfrescoPermissionEntry[] = [];
    for (const entry of inheritedEntries) {
      if (isDefaultSiteGroup(entry, site)) defaultCount++;
      else atypical.push(entry);
    }
    return {
      inheritedAtypical: atypical,
      inheritedDefaultCount: defaultCount,
    };
  }, [inheritedEntries, site]);

  const existingAuthorityIds = useMemo(
    () => new Set(localEntries.map((e) => e.authorityId)),
    [localEntries]
  );

  const handleAddAuthority = useCallback(
    (suggestion: AuthoritySuggestion) => {
      if (existingAuthorityIds.has(suggestion.id)) {
        ShowNotification({ type: "error", message: t("alreadyAdded") });
        return;
      }
      setLocalEntries((prev) => [
        ...prev,
        {
          authorityId: suggestion.id,
          name: pendingRole,
          accessStatus: "ALLOWED",
        },
      ]);
    },
    [existingAuthorityIds, pendingRole, t]
  );

  const handleChangeRole = (authorityId: string, role: DashboardRole) => {
    setLocalEntries((prev) =>
      prev.map((entry) =>
        entry.authorityId === authorityId ? { ...entry, name: role } : entry
      )
    );
  };

  const handleRemove = (authorityId: string) => {
    setLocalEntries((prev) =>
      prev.filter((entry) => entry.authorityId !== authorityId)
    );
  };

  const handleSave = async () => {
    if (!swrKey) return;
    if (!data?.nodeId) return;

    setSaving(true);
    const payload: { permissions: NodePermissionsUpdate } = {
      permissions: {
        isInheritanceEnabled,
        locallySet: localEntries,
      },
    };

    try {
      const response = await fetch(swrKey, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const updated = (await response.json()) as {
        nodeId: string;
        permissions: AlfrescoNodePermissions;
      };
      await mutate(
        { nodeId: updated.nodeId, permissions: updated.permissions },
        { revalidate: false }
      );
      ShowNotification({ type: "success", message: t("saveSuccess") });
      onClose();
    } catch (err) {
      console.error("Failed to save permissions for node", data?.nodeId, err);
      ShowNotification({ type: "error", message: t("saveError") });
    } finally {
      setSaving(false);
    }
  };

  const canSave = !saving && !isLoading && Boolean(data?.nodeId);

  if (!isOpen) return null;

  const renderBody = () => {
    if (isLoading) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("loading")}
        </p>
      );
    }
    if (error) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.status === 403 ? t("notAuthorized") : t("loadError")}
        </p>
      );
    }
    return (
      <div className="space-y-5">
        <InheritanceToggle
          checked={isInheritanceEnabled}
          onChange={setIsInheritanceEnabled}
          label={t("inheritanceLabel")}
          help={t("inheritanceHelp")}
        />

        <InheritedList
          entries={inheritedAtypical}
          heading={t("inheritedHeading")}
          defaultCount={inheritedDefaultCount}
          emptyLabel={t("noInherited")}
          badgeLabel={t("inheritedBadge")}
          roleLabel={(role) =>
            trDynamic(ROLE_LABEL_KEYS[fallbackRole(role)], dictionary)
          }
        />

        <LocalList
          entries={localEntries}
          heading={t("localHeading")}
          emptyLabel={t("noLocalEntries")}
          removeAriaLabel={(id) => t("removeAriaLabel", { authority: id })}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
          dictionary={dictionary}
        />

        <AddAuthoritySection
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          pendingRole={pendingRole}
          onChangeRole={setPendingRole}
          onAdd={handleAddAuthority}
          t={t}
          dictionary={dictionary}
        />
      </div>
    );
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modalTitle", { name: dashboardName })}
      size="2xl"
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
      showCancelButton
      isProcessing={saving || !canSave}
      onSubmit={() => {
        void handleSave();
      }}
    >
      {renderBody()}
    </FormModal>
  );
}

// ============================================================================
// Subsections
// ============================================================================

function InheritanceToggle({
  checked,
  onChange,
  label,
  help,
}: Readonly<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function InheritedList({
  entries,
  heading,
  defaultCount,
  emptyLabel,
  badgeLabel,
  roleLabel,
}: Readonly<{
  entries: AlfrescoPermissionEntry[];
  heading: string;
  /** Site-default inherited entries are collapsed into a count shown beside
   *  the heading; only `entries` (atypical ones) are rendered as list items. */
  defaultCount: number;
  emptyLabel: string;
  badgeLabel: string;
  roleLabel: (role: string) => string;
}>) {
  const headingText =
    defaultCount > 0 ? `${heading} (${defaultCount})` : heading;
  // Only render the "nothing inherited" copy when there truly is nothing —
  // i.e. no atypical entries AND no collapsed defaults.
  const hasNothing = entries.length === 0 && defaultCount === 0;
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {headingText}
      </h4>
      {hasNothing && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
      )}
      {entries.length > 0 && (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li
              key={entryKey(entry)}
              className="flex items-center justify-between gap-2 rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-600 dark:bg-gray-700/40"
            >
              <span className="truncate text-sm text-gray-700 dark:text-gray-200">
                {entry.authorityId.replace(/^GROUP_/, "")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {roleLabel(entry.name)}
                </span>
                <Badge color="gray" size="xs">
                  {badgeLabel}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LocalList({
  entries,
  heading,
  emptyLabel,
  removeAriaLabel,
  onChangeRole,
  onRemove,
  dictionary,
}: Readonly<{
  entries: AlfrescoPermissionEntry[];
  heading: string;
  emptyLabel: string;
  removeAriaLabel: (id: string) => string;
  onChangeRole: (authorityId: string, role: DashboardRole) => void;
  onRemove: (authorityId: string) => void;
  dictionary: I18nRecord;
}>) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {heading}
      </h4>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => {
            const isGroup = entry.authorityId.startsWith("GROUP_");
            return (
              <li
                key={entry.authorityId}
                className="flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 dark:border-gray-600"
              >
                {isGroup ? (
                  <HiOutlineUserGroup className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                ) : (
                  <HiOutlineUser className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                )}
                <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                  {entry.authorityId.replace(/^GROUP_/, "")}
                </span>
                <Select
                  sizing="sm"
                  value={fallbackRole(entry.name)}
                  onChange={(e) =>
                    onChangeRole(
                      entry.authorityId,
                      e.target.value as DashboardRole
                    )
                  }
                  className="w-40 shrink-0"
                >
                  {DASHBOARD_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {trDynamic(ROLE_LABEL_KEYS[role], dictionary)}
                    </option>
                  ))}
                </Select>
                <Button
                  color="light"
                  size="xs"
                  onClick={() => onRemove(entry.authorityId)}
                  aria-label={removeAriaLabel(entry.authorityId)}
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddAuthoritySection({
  activeTab,
  onChangeTab,
  pendingRole,
  onChangeRole,
  onAdd,
  t,
  dictionary,
}: Readonly<{
  activeTab: "user" | "group";
  onChangeTab: (v: "user" | "group") => void;
  pendingRole: DashboardRole;
  onChangeRole: (role: DashboardRole) => void;
  onAdd: (suggestion: AuthoritySuggestion) => void;
  t: (key: string, params?: Record<string, string>) => string;
  dictionary: I18nRecord;
}>) {
  return (
    <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("addSectionTitle")}
      </h4>
      <div className="mb-2 flex border-b border-gray-200 dark:border-gray-600">
        {(["user", "group"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChangeTab(tab)}
            className={
              activeTab === tab
                ? "-mb-px border-b-2 border-blue-500 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400"
                : "-mb-px border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }
          >
            {tab === "user" ? t("tabUsers") : t("tabGroups")}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <AuthorityAutocomplete
            kind={activeTab}
            placeholder={
              activeTab === "user"
                ? t("searchUsersPlaceholder")
                : t("searchGroupsPlaceholder")
            }
            searchingLabel={t("searching")}
            noResultsLabel={t("noResults")}
            onSelect={onAdd}
          />
        </div>
        <Select
          sizing="sm"
          value={pendingRole}
          onChange={(e) => onChangeRole(e.target.value as DashboardRole)}
          className="w-40 shrink-0"
        >
          {DASHBOARD_ROLES.map((role) => (
            <option key={role} value={role}>
              {trDynamic(ROLE_LABEL_KEYS[role], dictionary)}
            </option>
          ))}
        </Select>
      </div>
    </section>
  );
}
