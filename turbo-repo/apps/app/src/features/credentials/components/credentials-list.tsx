"use client";

import type { KeyboardEvent } from "react";
import { Dropdown, DropdownItem } from "flowbite-react";
import { HiDotsVertical, HiPencil, HiTrash } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  findCredentialType,
  maskIdentifier,
  type CredentialListItem,
} from "../credential.types";
import { CredentialTestBadge, EnvironmentBadge } from "./credential-badges";
import { CredentialTypeLogo } from "./credential-type-logo";

interface CredentialsListProps {
  readonly credentials: readonly CredentialListItem[];
  readonly onOpen: (credential: CredentialListItem) => void;
  readonly onDelete: (credential: CredentialListItem) => void;
  /** Empty-state copy differs for "nothing yet" vs "nothing matches". */
  readonly emptyMessage: string;
  readonly dict: I18nRecord;
}

/**
 * List view for credentials.
 *
 * Every block in a row is two lines — identity, state, provenance — so the rows
 * scan as a grid even though they are not a table. Clicking a row opens the
 * details modal (edit, test, delete); the kebab offers the same without opening.
 */
export function CredentialsList({
  credentials,
  onOpen,
  onDelete,
  emptyMessage,
  dict,
}: CredentialsListProps) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {credentials.map((credential) => (
        <li key={credential.id}>
          <CredentialRow
            credential={credential}
            onOpen={() => onOpen(credential)}
            onDelete={() => onDelete(credential)}
            dict={dict}
          />
        </li>
      ))}
    </ul>
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

function CredentialRow({
  credential,
  onOpen,
  onDelete,
  dict,
}: CredentialRowProps) {
  const descriptor = findCredentialType(credential.typeId);
  const typeName = descriptor
    ? trDynamic(descriptor.nameKey, dict)
    : credential.typeId.toLowerCase();

  // The row can't be a <button> — it contains the kebab's own button, which
  // would be invalid nesting — so it takes the keyboard contract by hand.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={credential.name}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className="flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <CredentialTypeLogo logo={descriptor?.logo} alt={typeName} size={40} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-white">
          {credential.name}
        </div>
        <div className={SUBLINE}>
          {typeName}
          {" · "}
          <span className="font-mono">
            {maskIdentifier(credential.summary)}
          </span>
        </div>
      </div>

      <div className="hidden w-52 shrink-0 flex-col gap-1 sm:flex">
        <div className="flex items-center gap-2">
          <EnvironmentBadge environment={credential.environment} dict={dict} />
          <CredentialTestBadge
            lastTestedAt={credential.lastTestedAt}
            lastTestResult={credential.lastTestResult}
            dict={dict}
            compact
          />
        </div>
        <div className={SUBLINE}>{usageLine(credential, dict)}</div>
      </div>

      <div className="hidden w-40 shrink-0 text-right md:block">
        <div className="truncate text-sm text-gray-700 dark:text-gray-300">
          {new Date(credential.updatedAt).toLocaleDateString()}
        </div>
        {/* Credentials created before the API recorded an actor have none; an empty
            subline would read as a rendering fault rather than as "nobody knows". */}
        {credential.updatedBy && (
          <div className={SUBLINE}>{credential.updatedBy}</div>
        )}
      </div>

      {/* Menu events stay in the menu: without this, opening it (or moving
          through it with the keyboard) would also trigger the row. */}
      <div
        role="presentation"
        className="shrink-0"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
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
      </div>
    </div>
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
