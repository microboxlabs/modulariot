"use client";

import { useState } from "react";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiOutlineKey,
  HiOutlineTrash,
  HiPlus,
  HiOutlineShieldCheck,
} from "react-icons/hi";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiKeyModal } from "./api-key-modal";
import { RolesModal } from "./roles-modal";
import { ServiceAccountModal } from "./service-account-modal";
import {
  deleteServiceAccount,
  revokeKey,
  setServiceAccountRoles,
  useServiceAccounts,
} from "./team-api";
import { formatDate } from "./team-members-tab";
import { keyDisplay, keyState, labelOf, type KeyState } from "./team-model";
import type { ApiKey, CatalogRole, ServiceAccount } from "./team.types";

const CELL = "px-4 py-2 align-middle";
const HEAD = "px-4 py-2 text-left text-xs font-medium uppercase text-gray-500";

const STATE_COLOR: Record<KeyState, string> = {
  active: "success",
  expired: "warning",
  revoked: "gray",
};

type Confirm =
  | { kind: "account"; account: ServiceAccount }
  | { kind: "key"; account: ServiceAccount; key: ApiKey }
  | null;

function confirmTexts(confirm: Confirm, d: I18nRecord) {
  if (confirm?.kind === "key") {
    return {
      title: tr("keyRevokeTitle", d),
      description: tr("keyRevokeBody", d, {
        key: keyDisplay(confirm.key.keyId),
      }),
      confirmLabel: tr("revoke", d),
    };
  }
  return {
    title: tr("accountDeleteTitle", d),
    description: tr("accountDeleteBody", d, {
      name: confirm?.kind === "account" ? confirm.account.name : "",
    }),
    confirmLabel: tr("delete", d),
  };
}

interface KeyRowProps {
  readonly apiKey: ApiKey;
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onRevoke: (key: ApiKey) => void;
}

function KeyRow({ apiKey, lang, d, onRevoke }: KeyRowProps) {
  const state = keyState(apiKey, new Date());
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className={`${CELL} text-gray-900 dark:text-white`}>
        {apiKey.name || "—"}
      </td>
      <td
        className={`${CELL} font-mono text-xs text-gray-600 dark:text-gray-300`}
      >
        {keyDisplay(apiKey.keyId)}
      </td>
      <td className={`${CELL} text-gray-500`}>{apiKey.createdBy ?? "—"}</td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(apiKey.lastUsedAt, lang, tr("never", d))}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(apiKey.expiresAt, lang, tr("keyDaysNever", d))}
      </td>
      <td className={CELL}>
        <Badge color={STATE_COLOR[state]} className="inline-flex">
          {state === "revoked"
            ? tr("keyRevokedOn", d, {
                date: formatDate(apiKey.revokedAt, lang),
              })
            : tr(`key_${state}`, d)}
        </Badge>
      </td>
      <td className={`${CELL} text-right`}>
        {state !== "revoked" && (
          <Button size="xs" color="red" onClick={() => onRevoke(apiKey)}>
            {tr("revoke", d)}
          </Button>
        )}
      </td>
    </tr>
  );
}

interface AccountCardProps {
  readonly account: ServiceAccount;
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
  readonly onAddKey: (account: ServiceAccount) => void;
  readonly onRoles: (account: ServiceAccount) => void;
  readonly onDelete: (account: ServiceAccount) => void;
  readonly onRevoke: (account: ServiceAccount, key: ApiKey) => void;
}

function AccountCard({
  account,
  roles,
  lang,
  d,
  onAddKey,
  onRoles,
  onDelete,
  onRevoke,
}: AccountCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {account.name}
            </span>
            {account.disabled && (
              <Badge color="gray">{tr("disabled", d)}</Badge>
            )}
          </div>
          {account.description && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {account.description}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {tr("createdBy", d, {
              who: account.createdBy ?? "—",
              date: formatDate(account.createdAt, lang),
            })}
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {account.roles.length === 0 && (
              <span className="text-xs text-gray-400">{tr("noAccess", d)}</span>
            )}
            {account.roles.map((key) => (
              <Badge key={key} color="indigo">
                {labelOf(
                  roles.find((r) => r.key === key),
                  lang,
                  key
                )}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="xs"
            color="alternative"
            onClick={() => onAddKey(account)}
          >
            <HiPlus className="mr-1 h-4 w-4" />
            {tr("keyAdd", d)}
          </Button>
          <Button
            size="xs"
            color="alternative"
            onClick={() => onRoles(account)}
          >
            <HiOutlineKey className="mr-1 h-4 w-4" />
            {tr("tabRoles", d)}
          </Button>
          <Button size="xs" color="red" onClick={() => onDelete(account)}>
            <HiOutlineTrash className="mr-1 h-4 w-4" />
            {tr("delete", d)}
          </Button>
        </div>
      </div>
      {account.keys.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className={HEAD}>{tr("colName", d)}</th>
                <th className={HEAD}>{tr("colKey", d)}</th>
                <th className={HEAD}>{tr("colCreatedBy", d)}</th>
                <th className={HEAD}>{tr("colLastUsed", d)}</th>
                <th className={HEAD}>{tr("colExpires", d)}</th>
                <th className={HEAD}>{tr("colStatus", d)}</th>
                <th className={HEAD} />
              </tr>
            </thead>
            <tbody>
              {account.keys.map((key) => (
                <KeyRow
                  key={key.id}
                  apiKey={key}
                  lang={lang}
                  d={d}
                  onRevoke={(k) => onRevoke(account, k)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface TeamKeysTabProps {
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Service accounts and their API keys, for calls made without a person. */
export function TeamKeysTab({ roles, lang, d }: TeamKeysTabProps) {
  const accounts = useServiceAccounts(true);
  const [creating, setCreating] = useState(false);
  const [addingKey, setAddingKey] = useState<ServiceAccount | null>(null);
  const [editingRoles, setEditingRoles] = useState<ServiceAccount | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => void accounts.mutate();

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      await (confirm.kind === "key"
        ? revokeKey(confirm.account.id, confirm.key.id)
        : deleteServiceAccount(confirm.account.id));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("saveFailed", d));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const list = accounts.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <HiOutlineShieldCheck className="h-4 w-4 shrink-0" />
          {tr("keysHelp", d)}
        </p>
        <Button color="blue" size="sm" onClick={() => setCreating(true)}>
          <HiPlus className="mr-1.5 h-4 w-4" />
          {tr("accountCreate", d)}
        </Button>
      </div>
      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {accounts.error && <Alert color="failure">{tr("loadFailed", d)}</Alert>}
      {accounts.isLoading && <Spinner className="mx-auto" />}
      {accounts.data && list.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">
          {tr("noAccounts", d)}
        </p>
      )}
      {list.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          roles={roles}
          lang={lang}
          d={d}
          onAddKey={setAddingKey}
          onRoles={setEditingRoles}
          onDelete={(a) => setConfirm({ kind: "account", account: a })}
          onRevoke={(a, key) => setConfirm({ kind: "key", account: a, key })}
        />
      ))}

      <ServiceAccountModal
        show={creating}
        onClose={() => setCreating(false)}
        onCreated={reload}
        roles={roles}
        lang={lang}
        d={d}
      />
      <ApiKeyModal
        account={addingKey}
        onClose={() => setAddingKey(null)}
        onCreated={reload}
        d={d}
      />
      <RolesModal
        current={editingRoles?.roles ?? null}
        title={tr("rolesTitle", d, { name: editingRoles?.name ?? "" })}
        onSave={(selected) =>
          setServiceAccountRoles(editingRoles?.id ?? "", selected)
        }
        onClose={() => setEditingRoles(null)}
        onSaved={reload}
        roles={roles}
        lang={lang}
        d={d}
      />
      <ConfirmationModal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        isProcessing={busy}
        variant="danger"
        {...confirmTexts(confirm, d)}
      />
    </div>
  );
}
