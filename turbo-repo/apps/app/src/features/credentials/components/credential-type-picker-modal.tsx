"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  TextInput,
} from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  CREDENTIAL_TYPES,
  type CredentialTypeDescriptor,
  type CredentialTypeId,
} from "../credential.types";
import { CredentialTypeLogo } from "./credential-type-logo";

interface CredentialTypePickerModalProps {
  readonly show: boolean;
  readonly onClose: () => void;
  readonly onSelect: (typeId: CredentialTypeId) => void;
  readonly dict: I18nRecord;
}

/**
 * Step 1 of "Add credential": pick the credential type, then fill its form.
 * Types the backend can't issue yet are listed but disabled, so the catalog
 * shows where the capability is going without pretending it's there.
 */
export function CredentialTypePickerModal({
  show,
  onClose,
  onSelect,
  dict,
}: CredentialTypePickerModalProps) {
  const [query, setQuery] = useState("");

  const matches = CREDENTIAL_TYPES.filter((type) =>
    trDynamic(type.nameKey, dict).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal dismissible show={show} onClose={onClose} size="2xl">
      <div className="flex flex-col items-start p-4 md:p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {tr("picker.title", dict)}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("picker.subtitle", dict)}
        </p>
      </div>
      <ModalBody className="max-h-[60vh] overflow-y-auto">
        <TextInput
          id="credential-type-search"
          icon={HiSearch}
          placeholder={tr("picker.searchPlaceholder", dict)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="mt-4 flex flex-col gap-2">
          {matches.map((type) => (
            <li key={type.id}>
              <CredentialTypeOption
                type={type}
                dict={dict}
                onSelect={() => onSelect(type.id)}
              />
            </li>
          ))}
          {matches.length === 0 && (
            <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {tr("picker.noMatches", dict)}
            </li>
          )}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={onClose}>
          {tr("picker.cancel", dict)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface CredentialTypeOptionProps {
  readonly type: CredentialTypeDescriptor;
  readonly dict: I18nRecord;
  readonly onSelect: () => void;
}

function CredentialTypeOption({
  type,
  dict,
  onSelect,
}: CredentialTypeOptionProps) {
  const base =
    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition";
  const enabled =
    "border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-700";
  const disabled =
    "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900";

  return (
    <button
      type="button"
      onClick={type.available ? onSelect : undefined}
      disabled={!type.available}
      className={`${base} ${type.available ? enabled : disabled}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <CredentialTypeLogo
          logo={type.logo}
          alt={trDynamic(type.nameKey, dict)}
          size={40}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {trDynamic(type.nameKey, dict)}
          </span>
          {!type.available && (
            <Badge color="gray" size="xs">
              {tr("picker.comingSoon", dict)}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {trDynamic(type.descriptionKey, dict)}
        </p>
      </div>
    </button>
  );
}
