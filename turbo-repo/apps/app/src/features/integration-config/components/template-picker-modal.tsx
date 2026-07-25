"use client";

import { useState } from "react";
import { Button, Modal, ModalBody, ModalFooter, TextInput } from "flowbite-react";
import { HiOutlineTemplate, HiSearch } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  schemaLeafPaths,
  type IntegrationTemplate,
} from "../integration-config.types";

interface TemplatePickerModalProps {
  readonly show: boolean;
  readonly templates: readonly IntegrationTemplate[];
  readonly onClose: () => void;
  readonly onSelect: (template: IntegrationTemplate) => void;
  readonly dict: I18nRecord;
}

/**
 * Step 1 of "New connection": pick the template, then fill its form — the same
 * two-step shape as adding a credential, where the type is chosen before anything
 * type-specific is asked for.
 *
 * The types here are operator-defined rather than built in, so unlike the credential
 * catalogue this list can be empty; that state points at the section that fills it.
 */
export function TemplatePickerModal({
  show,
  templates,
  onClose,
  onSelect,
  dict,
}: TemplatePickerModalProps) {
  const [query, setQuery] = useState("");

  const matches = templates.filter((template) =>
    template.name.toLowerCase().includes(query.toLowerCase())
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
          id="integration-template-search"
          icon={HiSearch}
          placeholder={tr("picker.searchPlaceholder", dict)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="mt-4 flex flex-col gap-2">
          {matches.map((template) => (
            <li key={template.id}>
              <TemplateOption
                template={template}
                dict={dict}
                onSelect={() => onSelect(template)}
              />
            </li>
          ))}
          {matches.length === 0 && (
            <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {templates.length === 0
                ? tr("picker.empty", dict)
                : tr("picker.noMatches", dict)}
            </li>
          )}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={onClose}>
          {tr("common.cancel", dict)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface TemplateOptionProps {
  readonly template: IntegrationTemplate;
  readonly dict: I18nRecord;
  readonly onSelect: () => void;
}

function TemplateOption({ template, dict, onSelect }: TemplateOptionProps) {
  const fields = schemaLeafPaths(template.requestSchema).length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-blue-500 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <HiOutlineTemplate className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {template.name}
          </span>
        </div>
        <p className="mt-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
          {template.method} {template.path}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr("templates.fields", dict, { count: String(fields) })}
        </p>
      </div>
    </button>
  );
}
