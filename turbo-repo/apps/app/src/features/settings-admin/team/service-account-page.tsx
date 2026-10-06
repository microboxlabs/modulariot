"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Alert, Badge, Button, Select, Spinner } from "flowbite-react";
import { HiOutlineChip, HiOutlineTrash } from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import { fetchCredentials } from "@/features/credentials/credentials-data-service";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  CARD,
  DetailShell,
  EffectivePermissions,
  Meta,
  ModuleCard,
  SaveBar,
  SectionTitle,
} from "./module-access";
import { ServiceAccountKeys } from "./service-account-keys";
import {
  deleteServiceAccount,
  setServiceAccountRoles,
  setServiceAccountTokenCredential,
  useAccessCatalog,
  useServiceAccounts,
  useTeam,
} from "./team-api";
import {
  activeKeyCount,
  catalogModules,
  effectivePermissions,
  lastKeyUse,
  rolesByModule,
  sameRoles,
  selectedRoles,
} from "./team-model";
import { formatDate } from "./team-members-tab";
import type { AccessCatalog, ServiceAccount } from "./team.types";

const OAUTH_TYPES = new Set(["AUTH0_M2M", "OAUTH2_CLIENT_CREDENTIALS"]);

interface ServiceAccountPageProps {
  readonly dict: I18nRecord;
  readonly lang: string;
  readonly accountId: string;
}

/** Settings › Team › one service account: module access, keys and the linked OAuth credential. */
export default function ServiceAccountPage({
  dict,
  lang,
  accountId,
}: ServiceAccountPageProps) {
  const d = dict?.team as I18nRecord;
  const router = useRouter();
  const accounts = useServiceAccounts(true);
  const team = useTeam();
  const { data: catalog } = useAccessCatalog();
  const keysPath = `/${lang}/users/settings/team?tab=keys`;
  const account = accounts.data?.find((a) => a.id === accountId);

  return (
    <DetailShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      backHref={keysPath}
      backLabel={tr("backToKeys", d)}
    >
      {(accounts.isLoading || !catalog) && !accounts.error && (
        <Spinner className="mx-auto" />
      )}
      {accounts.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {accounts.data && catalog && !account && (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr("accountNotFound", d)}
          </p>
        </div>
      )}
      {account && catalog && (
        <AccountEditor
          key={account.id}
          account={account}
          catalog={catalog}
          organization={team.data?.organization}
          lang={lang}
          d={d}
          onChanged={() => accounts.mutate()}
          onDeleted={() => {
            void accounts.mutate();
            router.push(keysPath);
          }}
        />
      )}
    </DetailShell>
  );
}

interface AccountEditorProps {
  readonly account: ServiceAccount;
  readonly catalog: AccessCatalog;
  readonly organization: string | undefined;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onChanged: () => void;
  readonly onDeleted: () => void;
}

function AccountEditor({
  account,
  catalog,
  organization,
  lang,
  d,
  onChanged,
  onDeleted,
}: AccountEditorProps) {
  const [byModule, setByModule] = useState<Record<string, string>>(() =>
    rolesByModule(account.roles, catalog.roles)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reset = () => setByModule(rolesByModule(account.roles, catalog.roles));
  useEffect(reset, [account, catalog]);

  const roles = selectedRoles(byModule);
  const dirty = !sameRoles(roles, account.roles);
  const modules = useMemo(() => catalogModules(catalog), [catalog]);

  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : tr("saveFailed", d));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setServiceAccountRoles(account.id, roles);
      onChanged();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteServiceAccount(account.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      fail(e);
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  return (
    <>
      <AccountHeader
        account={account}
        lang={lang}
        d={d}
        onDelete={() => setConfirmDelete(true)}
      />
      {error && (
        <Alert color="gray" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <SectionTitle
              title={tr("moduleAccessTitle", d)}
              help={tr("accountAccessHelp", d)}
            />
            {modules.map((mod) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                roles={catalog.roles.filter((r) => r.module === mod.key)}
                catalog={catalog}
                value={byModule[mod.key] ?? ""}
                includedByBase={false}
                disabled={busy}
                lang={lang}
                d={d}
                onChange={(key) => setByModule({ ...byModule, [mod.key]: key })}
              />
            ))}
          </section>
          <ServiceAccountKeys
            account={account}
            lang={lang}
            d={d}
            onChanged={onChanged}
            onError={fail}
          />
          <TokenCredentialSection
            account={account}
            organization={organization}
            d={d}
            onChanged={onChanged}
            onError={fail}
          />
        </div>
        <aside className="lg:col-span-1">
          <EffectivePermissions
            permissions={effectivePermissions("MEMBER", roles, catalog)}
            catalog={catalog}
            modules={modules}
            help={tr("accountEffectiveHelp", d)}
            lang={lang}
            d={d}
          />
        </aside>
      </div>
      {dirty && <SaveBar busy={busy} d={d} onDiscard={reset} onSave={save} />}
      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={tr("accountDeleteTitle", d)}
        description={tr("accountDeleteBody", d, { name: account.name })}
        confirmLabel={tr("delete", d)}
        isProcessing={busy}
        variant="danger"
      />
    </>
  );
}

interface AccountHeaderProps {
  readonly account: ServiceAccount;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onDelete: () => void;
}

function AccountHeader({ account, lang, d, onDelete }: AccountHeaderProps) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <HiOutlineChip className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                {account.name}
              </h1>
              {account.disabled && (
                <Badge color="gray">{tr("disabled", d)}</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {account.description || tr("serviceAccount", d)}
            </p>
          </div>
        </div>
        <Button color="alternative" size="sm" onClick={onDelete}>
          <HiOutlineTrash className="mr-1.5 h-4 w-4" />
          {tr("deleteAccount", d)}
        </Button>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 text-sm sm:grid-cols-4 dark:border-gray-700">
        <Meta
          label={tr("colCreated", d)}
          value={formatDate(account.createdAt, lang)}
        />
        <Meta label={tr("colCreatedBy", d)} value={account.createdBy ?? "—"} />
        <Meta
          label={tr("colLastUsed", d)}
          value={formatDate(lastKeyUse(account), lang, tr("never", d))}
        />
        <Meta
          label={tr("activeKeys", d)}
          value={String(activeKeyCount(account, new Date()))}
        />
      </dl>
    </div>
  );
}

interface TokenCredentialSectionProps {
  readonly account: ServiceAccount;
  readonly organization: string | undefined;
  readonly d: I18nRecord;
  readonly onChanged: () => void;
  readonly onError: (e: unknown) => void;
}

function TokenCredentialSection({
  account,
  organization,
  d,
  onChanged,
  onError,
}: TokenCredentialSectionProps) {
  // Listing credentials is for organization owners; anyone else sees the linked id only.
  const credentials = useSWR(
    organization ? ["team-token-credentials", organization] : null,
    () => fetchCredentials(organization ?? ""),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  const options: CredentialListItem[] | null = credentials.data
    ? credentials.data.filter((c) => OAUTH_TYPES.has(c.typeId))
    : null;
  const current = account.tokenCredentialRef;
  const linked = options?.find((c) => c.id === current);
  const [saving, setSaving] = useState(false);

  const change = async (ref: string | null) => {
    setSaving(true);
    try {
      await setServiceAccountTokenCredential(account.id, ref);
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle
        title={tr("tokenCredential", d)}
        help={tr("tokenCredentialHint", d)}
      />
      <div
        className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <label
          htmlFor="token-credential"
          className="text-sm font-medium text-gray-900 dark:text-white"
        >
          {tr("tokenCredentialLabel", d)}
        </label>
        {options ? (
          <Select
            id="token-credential"
            sizing="sm"
            className="sm:w-80"
            value={current ?? ""}
            disabled={saving}
            onChange={(e) => change(e.target.value || null)}
          >
            <option value="">{tr("tokenCredentialNone", d)}</option>
            {current && !linked && <option value={current}>{current}</option>}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {current ?? tr("tokenCredentialNone", d)}
          </span>
        )}
      </div>
    </section>
  );
}
