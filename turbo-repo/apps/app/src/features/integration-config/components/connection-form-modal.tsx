"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import { HiInformationCircle } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { CredentialListItem } from "@/features/credentials/credential.types";
import type {
  CreateConnectionRequest,
  IntegrationConnection,
  IntegrationTemplate,
  UpdateConnectionRequest,
} from "../integration-config.types";

interface ConnectionFormModalProps {
  readonly show: boolean;
  /** The instance being edited, or undefined to create a new one. */
  readonly connection: IntegrationConnection | undefined;
  readonly templates: readonly IntegrationTemplate[];
  readonly credentials: readonly CredentialListItem[];
  readonly onClose: () => void;
  readonly onSave: (
    create: CreateConnectionRequest | null,
    id?: string,
    patch?: UpdateConnectionRequest
  ) => Promise<unknown>;
  readonly saving: boolean;
  readonly dict: I18nRecord;
}

export function ConnectionFormModal({
  show,
  connection,
  templates,
  credentials,
  onClose,
  onSave,
  saving,
  dict,
}: Readonly<ConnectionFormModalProps>) {
  const editing = connection !== undefined;
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    setError(null);
    setTemplateId(connection?.templateId ?? templates[0]?.id ?? "");
    setName(connection?.name ?? "");
    setBaseUrl(connection?.baseUrl ?? "");
    setCredentialId(connection?.credentialProfileId ?? "");
  }, [show, connection, templates]);

  const canSave =
    name.trim() !== "" &&
    baseUrl.trim() !== "" &&
    (editing || templateId !== "") &&
    !saving;

  async function handleSave() {
    try {
      if (editing) {
        await onSave(null, connection.id, {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
        });
      } else {
        await onSave({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          credentialProfileId: credentialId || null,
          templateId,
        });
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("common.saveFailed", dict));
    }
  }

  const credentialName = credentials.find((c) => c.id === credentialId)?.name;

  return (
    <Modal show={show} onClose={onClose} size="lg">
      <ModalHeader>
        {editing
          ? tr("connection.form.editTitle", dict)
          : tr("connection.form.createTitle", dict)}
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {error && (
            <Alert color="failure" icon={HiInformationCircle}>
              <span className="text-xs">{error}</span>
            </Alert>
          )}

          <div className="flex flex-col gap-1">
            <Label className="text-xs">{tr("connection.form.template", dict)}</Label>
            <FormFieldState
              editing={editing}
              empty={templates.length === 0}
              editingContent={
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {templates.find((t) => t.id === connection?.templateId)?.name ??
                    tr("connection.form.noTemplate", dict)}
                </span>
              }
              emptyContent={
                <Alert color="gray" icon={HiInformationCircle}>
                  <span className="text-xs">{tr("connection.form.needTemplate", dict)}</span>
                </Alert>
              }
            >
              <Select
                sizing="sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.method} {template.path}
                  </option>
                ))}
              </Select>
            </FormFieldState>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">{tr("connection.form.name", dict)}</Label>
            <TextInput
              sizing="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("connection.form.namePlaceholder", dict)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">{tr("connection.form.baseUrl", dict)}</Label>
            <TextInput
              sizing="sm"
              className="font-mono [&_input]:text-xs"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.partner.example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">{tr("connection.form.credential", dict)}</Label>
            <FormFieldState
              editing={editing}
              empty={credentials.length === 0}
              editingContent={
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {credentialName ?? tr("connection.form.noCredential", dict)}
                  <span className="ml-2 text-[11px] text-gray-400">
                    {tr("connection.form.credentialFixed", dict)}
                  </span>
                </span>
              }
              emptyContent={
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {tr("connection.form.noCredentials", dict)}
                </p>
              }
            >
              <Select
                sizing="sm"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
              >
                <option value="">{tr("connection.form.noCredential", dict)}</option>
                {credentials.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name} · {credential.environment}
                  </option>
                ))}
              </Select>
            </FormFieldState>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button color="gray" size="sm" onClick={onClose}>
              {tr("common.cancel", dict)}
            </Button>
            <Button color="blue" size="sm" onClick={handleSave} disabled={!canSave}>
              {saving ? tr("common.saving", dict) : tr("common.save", dict)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

interface FormFieldStateProps {
  readonly editing: boolean;
  readonly empty: boolean;
  readonly editingContent: React.ReactNode;
  readonly emptyContent: React.ReactNode;
  readonly children: React.ReactNode;
}

function FormFieldState({
  editing,
  empty,
  editingContent,
  emptyContent,
  children,
}: Readonly<FormFieldStateProps>) {
  if (editing) return editingContent;
  if (empty) return emptyContent;
  return children;
}
