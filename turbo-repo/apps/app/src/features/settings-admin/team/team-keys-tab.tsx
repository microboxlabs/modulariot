"use client";

import Link from "next/link";
import { Alert, Badge, Button, Spinner } from "flowbite-react";
import {
  HiChevronRight,
  HiOutlineChip,
  HiOutlineShieldCheck,
  HiPlus,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useServiceAccounts } from "./team-api";
import { formatDate } from "./team-members-tab";
import { activeKeyCount, labelOf, lastKeyUse } from "./team-model";
import type { CatalogRole, ServiceAccount } from "./team.types";

const CELL = "px-4 py-3 align-middle";
const HEAD = "px-4 py-2 text-left text-xs font-medium uppercase text-gray-500";

interface AccountRowProps {
  readonly account: ServiceAccount;
  readonly href: string;
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

function AccountRow({ account, href, roles, lang, d }: AccountRowProps) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700">
      <td className={CELL}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
            <HiOutlineChip className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <Link
              href={href}
              className="font-medium text-gray-900 hover:underline dark:text-white"
            >
              {account.name}
            </Link>
            {account.description && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {account.description}
              </p>
            )}
          </div>
          {account.disabled && <Badge color="gray">{tr("disabled", d)}</Badge>}
        </div>
      </td>
      <td className={CELL}>
        <div className="flex flex-wrap gap-1">
          {account.roles.length === 0 && (
            <span className="text-xs text-gray-400">{tr("noAccess", d)}</span>
          )}
          {account.roles.map((key) => (
            <Badge key={key} color="gray">
              {labelOf(
                roles.find((r) => r.key === key),
                lang,
                key
              )}
            </Badge>
          ))}
        </div>
      </td>
      <td className={`${CELL} text-gray-500`}>
        {activeKeyCount(account, new Date())}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {formatDate(lastKeyUse(account), lang, tr("never", d))}
      </td>
      <td className={`${CELL} text-gray-500`}>
        {account.tokenCredentialRef
          ? tr("linked", d)
          : tr("tokenCredentialDefaultShort", d)}
      </td>
      <td className={`${CELL} text-right`}>
        <Button as={Link} href={href} size="xs" color="alternative">
          {tr("manage", d)}
          <HiChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

interface TeamKeysTabProps {
  readonly roles: CatalogRole[];
  readonly lang: string;
  readonly d: I18nRecord;
}

/** Service accounts, for calls made without a person. Each opens its own page. */
export function TeamKeysTab({ roles, lang, d }: TeamKeysTabProps) {
  const accounts = useServiceAccounts(true);
  const base = `/${lang}/users/settings/team/service-accounts`;
  const list = accounts.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <HiOutlineShieldCheck className="h-4 w-4 shrink-0" />
          {tr("keysHelp", d)}
        </p>
        <Button as={Link} href={`${base}/new`} color="blue" size="sm">
          <HiPlus className="mr-1.5 h-4 w-4" />
          {tr("accountCreate", d)}
        </Button>
      </div>
      {accounts.error && <Alert color="gray">{tr("loadFailed", d)}</Alert>}
      {accounts.isLoading && <Spinner className="mx-auto" />}
      {accounts.data && list.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-500">
          {tr("noAccounts", d)}
        </p>
      )}
      {list.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className={HEAD}>{tr("serviceAccount", d)}</th>
                <th className={HEAD}>{tr("colAccess", d)}</th>
                <th className={HEAD}>{tr("activeKeys", d)}</th>
                <th className={HEAD}>{tr("colLastUsed", d)}</th>
                <th className={HEAD}>{tr("tokenCredential", d)}</th>
                <th className={HEAD} />
              </tr>
            </thead>
            <tbody>
              {list.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  href={`${base}/${encodeURIComponent(account.id)}`}
                  roles={roles}
                  lang={lang}
                  d={d}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
