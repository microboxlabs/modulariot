"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HiDotsVertical, HiPencil, HiTrash } from "react-icons/hi";
import CatalogTable from "@/features/common/components/catalog-table";
import type { CatalogLayout } from "@/features/common/components/layout-toggle";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  findCredentialType,
  maskIdentifier,
  usagePath,
  type CredentialListItem,
} from "../credential.types";
import { CredentialTestBadge, EnvironmentBadge } from "./credential-badges";
import { usageDetail } from "./credential-modal-parts";
import { BrandLogo } from "@/features/common/components/brand-logo";

interface CredentialsListProps {
  readonly credentials: readonly CredentialListItem[];
  readonly onOpen: (credential: CredentialListItem) => void;
  readonly onDelete: (credential: CredentialListItem) => void;
  /** Empty-state copy differs for "nothing yet" vs "nothing matches". */
  readonly emptyMessage: string;
  readonly layout: CatalogLayout;
  readonly dict: I18nRecord;
}

/**
 * Credentials as cards or as a table, like the other settings catalogs. Clicking a
 * credential opens the details modal (edit, test, delete); the kebab offers the
 * same without opening.
 */
export function CredentialsList({
  credentials,
  onOpen,
  onDelete,
  emptyMessage,
  layout,
  dict,
}: CredentialsListProps) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  if (layout === "list") {
    return (
      <CatalogTable
        columns={[
          tr("list.colCredential", dict),
          tr("list.colType", dict),
          tr("list.colEnvironment", dict),
          tr("list.colUsedBy", dict),
          tr("list.colUpdated", dict),
          "",
        ]}
      >
        {credentials.map((credential) => (
          <CredentialRow
            key={credential.id}
            credential={credential}
            onOpen={() => onOpen(credential)}
            onDelete={() => onDelete(credential)}
            dict={dict}
          />
        ))}
      </CatalogTable>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {credentials.map((credential) => (
        <CredentialCard
          key={credential.id}
          credential={credential}
          onOpen={() => onOpen(credential)}
          onDelete={() => onDelete(credential)}
          dict={dict}
        />
      ))}
    </div>
  );
}

function typeNameOf(credential: CredentialListItem, dict: I18nRecord) {
  const descriptor = findCredentialType(credential.typeId);
  return descriptor
    ? trDynamic(descriptor.nameKey, dict)
    : credential.typeId.toLowerCase();
}

/** The kebab: open or delete without opening the details first. */
function CredentialMenu({
  onOpen,
  onDelete,
  dict,
}: Readonly<{ onOpen: () => void; onDelete: () => void; dict: I18nRecord }>) {
  return (
    <Dropdown
      inline
      arrowIcon={false}
      label=""
      placement="bottom-end"
      className="w-44"
      renderTrigger={() => (
        <button
          type="button"
          aria-label={tr("menu.label", dict)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        >
          <HiDotsVertical className="h-4 w-4" />
        </button>
      )}
    >
      <DropdownItem icon={HiPencil} onClick={onOpen}>
        {tr("menu.open", dict)}
      </DropdownItem>
      <DropdownItem icon={HiTrash} onClick={onDelete}>
        {tr("menu.delete", dict)}
      </DropdownItem>
    </Dropdown>
  );
}

interface CredentialRowProps {
  readonly credential: CredentialListItem;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  readonly dict: I18nRecord;
}

/** Secondary line of every block: same size, same grey. */
const SUBLINE = "truncate text-xs text-gray-500 dark:text-gray-400";

/** A credential as a card: identity on top, state in the middle, provenance in the footer. */
function CredentialCard({
  credential,
  onOpen,
  onDelete,
  dict,
}: CredentialRowProps) {
  const descriptor = findCredentialType(credential.typeId);
  const typeName = typeNameOf(credential, dict);
  return (
    <div className="relative flex flex-col rounded-lg border border-gray-200 bg-white transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500">
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          <BrandLogo
            logo={descriptor?.logo}
            icon={descriptor?.icon}
            keyline={descriptor?.keyline}
            alt={typeName}
            size={40}
          />
        </span>
        <div className="min-w-0 flex-1">
          {/* A real button stretched over the card, so the kebab beside it stays a valid, clickable sibling. */}
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer truncate text-left font-semibold text-gray-900 after:absolute after:inset-0 after:rounded-lg focus:outline-none dark:text-white"
          >
            {credential.name}
          </button>
          <div className={SUBLINE}>
            {typeName}
            {" · "}
            <span className="font-mono">
              {maskIdentifier(credential.summary)}
            </span>
          </div>
        </div>
        <div className="relative shrink-0">
          <CredentialMenu onOpen={onOpen} onDelete={onDelete} dict={dict} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
        <EnvironmentBadge environment={credential.environment} dict={dict} />
        <CredentialTestBadge
          lastTestedAt={credential.lastTestedAt}
          lastTestResult={credential.lastTestResult}
          dict={dict}
          compact
        />
      </div>
      <p className="mt-2 line-clamp-2 h-8 px-4 text-xs text-gray-600 dark:text-gray-300">
        {usageLine(credential, dict)}
      </p>
      <div className="min-h-3 flex-1" />
      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
        <span>{new Date(credential.updatedAt).toLocaleDateString()}</span>
        {/* Credentials created before the API recorded an actor have none. */}
        {credential.updatedBy && (
          <span className="truncate">· {credential.updatedBy}</span>
        )}
      </div>
    </div>
  );
}

/** A credential as a table row; its name opens it. */
function CredentialRow({
  credential,
  onOpen,
  onDelete,
  dict,
}: CredentialRowProps) {
  const descriptor = findCredentialType(credential.typeId);
  const typeName = typeNameOf(credential, dict);
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <BrandLogo
            logo={descriptor?.logo}
            icon={descriptor?.icon}
            keyline={descriptor?.keyline}
            alt={typeName}
            size={24}
          />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="cursor-pointer truncate text-left text-sm font-medium text-gray-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
            >
              {credential.name}
            </button>
            <div className={`${SUBLINE} font-mono`}>
              {maskIdentifier(credential.summary)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">{typeName}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <EnvironmentBadge environment={credential.environment} dict={dict} />
          <CredentialTestBadge
            lastTestedAt={credential.lastTestedAt}
            lastTestResult={credential.lastTestResult}
            dict={dict}
            compact
          />
        </div>
      </td>
      <td className="max-w-64 px-4 py-2.5">
        <UsageLinks credential={credential} dict={dict} />
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        {new Date(credential.updatedAt).toLocaleDateString()}
        {credential.updatedBy && (
          <div className={SUBLINE}>{credential.updatedBy}</div>
        )}
      </td>
      <td className="px-2 py-2.5 text-right">
        <CredentialMenu onOpen={onOpen} onDelete={onDelete} dict={dict} />
      </td>
    </tr>
  );
}

/** The table's "Usada por": each consumer links to where it is managed, as in the details modal. */
function UsageLinks({
  credential,
  dict,
}: Readonly<{ credential: CredentialListItem; dict: I18nRecord }>) {
  const params = useParams<{ lang?: string }>();
  const lang = params?.lang ?? "es";
  if (credential.usedBy.length === 0) {
    return <span>{tr("list.unused", dict)}</span>;
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {credential.usedBy.map((usage) => {
        const detail = usageDetail(usage, dict);
        return (
          <li key={usage.id} className="min-w-0">
            <Link
              href={`/${lang}${usagePath(usage)}`}
              className="block truncate text-gray-700 hover:text-blue-700 hover:underline dark:text-gray-300 dark:hover:text-blue-300"
            >
              {usage.label}
            </Link>
            {detail && <div className={SUBLINE}>{detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Reuse summary: the count plus who holds the references. */
function usageLine(credential: CredentialListItem, dict: I18nRecord): string {
  if (credential.usedBy.length === 0) {
    return tr("list.unused", dict);
  }
  const count = tr("list.usedByCount", dict, {
    count: String(credential.usedBy.length),
  });
  return `${count} · ${credential.usedBy.map((usage) => usage.label).join(", ")}`;
}
