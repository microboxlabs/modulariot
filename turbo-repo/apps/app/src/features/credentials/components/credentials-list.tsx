"use client";

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

  return (
    <div className="relative flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 transition focus-within:ring-2 focus-within:ring-blue-500 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <CredentialTypeLogo logo={descriptor?.logo} alt={typeName} size={40} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-white">
          {/* A real button, so Enter/Space and assistive tech come for free. The
              row can't itself be one — it contains the kebab's button, which
              would be invalid nesting — so this stretches its hit area across
              the row with an overlay instead. */}
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-lg focus:outline-none"
          >
            {credential.name}
          </button>
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

      {/* Positioned, so it stacks above the row-wide overlay and stays clickable.
          Nothing needs to stop propagation any more: the menu is a sibling of the
          row's button rather than a child of it. */}
      <div className="relative shrink-0">
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
